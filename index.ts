import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function razorAuth(id: string, secret: string) {
  return "Basic " + btoa(`${id}:${secret}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success:false, error:"Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
  const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!SUPABASE_URL || !SERVICE_ROLE || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET)
    return json({success:false,error:"Server payment configuration is incomplete."},500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return json({success:false,error:"Invalid JSON"},400); }

  try {
    if (body.action === "create_order") {
      const examId = String(body.exam_id || "");
      const email = String(body.student_email || "").trim().toLowerCase();
      const name = String(body.student_name || "").trim();
      if (!examId || !email || !name) return json({success:false,error:"Name, email and exam are required."},400);

      const { data: exam, error } = await admin.from("exams").select("id,title,description,duration_minutes,total_marks,is_published,is_paid,price").eq("id", examId).single();
      if (error || !exam) return json({success:false,error:"Exam not found."},404);
      if (!exam.is_published) return json({success:false,error:"This exam is not published."},400);
      if (!exam.is_paid || Number(exam.price) < 1) return json({success:false,error:"This exam is free."},400);

      const amount = Math.round(Number(exam.price) * 100);
      const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
        method:"POST",
        headers:{
          "Authorization":razorAuth(RAZORPAY_KEY_ID,RAZORPAY_KEY_SECRET),
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          amount, currency:"INR",
          receipt:`exam_${String(exam.id)}_${Date.now()}`,
          notes:{exam_id:String(exam.id), student_email:email}
        })
      });
      const order = await orderResp.json();
      if (!orderResp.ok) return json({success:false,error:order?.error?.description || "Could not create Razorpay order."},502);
      return json({success:true,key_id:RAZORPAY_KEY_ID,order_id:order.id,amount:order.amount,currency:order.currency,exam_id:String(exam.id),exam_title:exam.title});
    }

    if (body.action === "verify") {
      const examId = String(body.exam_id || "");
      const orderId = String(body.razorpay_order_id || "");
      const paymentId = String(body.razorpay_payment_id || "");
      const signature = String(body.razorpay_signature || "");
      const email = String(body.student_email || "").trim().toLowerCase();
      const name = String(body.student_name || "").trim();
      if (!examId || !orderId || !paymentId || !signature || !email || !name)
        return json({success:false,error:"Missing payment details."},400);

      const expected = await hmacHex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
      if (!same(expected, signature)) return json({success:false,error:"Invalid payment signature."},400);

      const orderResp = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
        headers:{Authorization:razorAuth(RAZORPAY_KEY_ID,RAZORPAY_KEY_SECRET)}
      });
      const order = await orderResp.json();
      if (!orderResp.ok) return json({success:false,error:"Could not verify Razorpay order."},502);
      if (String(order?.notes?.exam_id || "") !== examId) return json({success:false,error:"Payment is not for this exam."},400);
      if (String(order?.notes?.student_email || "").toLowerCase() !== email) return json({success:false,error:"Payment email does not match."},400);

      const payResp = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers:{Authorization:razorAuth(RAZORPAY_KEY_ID,RAZORPAY_KEY_SECRET)}
      });
      const payment = await payResp.json();
      if (!payResp.ok) return json({success:false,error:"Could not verify Razorpay payment."},502);
      if (String(payment?.order_id) !== orderId) return json({success:false,error:"Payment/order mismatch."},400);
      if (String(payment?.status) !== "captured") return json({success:false,error:"Payment is not captured yet."},400);

      const { data: existing } = await admin.from("exam_access").select("access_token").eq("razorpay_payment_id",paymentId).maybeSingle();
      if (existing?.access_token) return json({success:true,access_token:existing.access_token});

      const { data: access, error: accessError } = await admin.from("exam_access").insert({
        exam_id:examId, student_name:name, student_email:email,
        razorpay_order_id:orderId, razorpay_payment_id:paymentId
      }).select("access_token").single();
      if (accessError) return json({success:false,error:accessError.message},500);
      return json({success:true,access_token:access.access_token});
    }

    if (body.action === "start") {
      const examId = String(body.exam_id || "");
      const token = String(body.access_token || "");
      const name = String(body.student_name || "").trim();
      const email = String(body.student_email || "").trim().toLowerCase();
      if (!examId || !token || !name || !email) return json({success:false,error:"Missing exam access details."},400);

      const { data: exam, error: examError } = await admin.from("exams").select("id,title,description,duration_minutes,total_marks,negative_mark,is_published,is_paid,price").eq("id",examId).single();
      if (examError || !exam || !exam.is_published) return json({success:false,error:"Exam unavailable."},404);

      if (exam.is_paid) {
        const { data: access } = await admin.from("exam_access").select("*").eq("access_token",token).eq("exam_id",examId).maybeSingle();
        if (!access) return json({success:false,error:"Exam payment not found or access expired."},403);
        if (access.student_email !== email) return json({success:false,error:"Email does not match the paid access."},403);
      }

      const { data: qs, error:qError } = await admin.from("exam_questions")
        .select("id,question_text,option_a,option_b,option_c,option_d,marks,question_order")
        .eq("exam_id",examId).order("question_order");
      if (qError || !qs?.length) return json({success:false,error:"This exam has no questions yet."},400);

      const { data: attempt, error:aError } = await admin.from("exam_attempts").insert({
        exam_id:examId, student_name:name, student_email:email
      }).select("id").single();
      if (aError) return json({success:false,error:aError.message},500);

      return json({success:true,attempt_id:attempt.id,exam,questions:qs});
    }

    if (body.action === "submit") {
      const examId = String(body.exam_id || "");
      const token = String(body.access_token || "");
      const attemptId = String(body.attempt_id || "");
      const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
      if (!examId || !token || !attemptId) return json({success:false,error:"Missing submission details."},400);

      const { data: exam } = await admin.from("exams").select("id,total_marks,negative_mark,is_paid").eq("id",examId).single();
      if (!exam) return json({success:false,error:"Exam not found."},404);
      if (exam.is_paid) {
        const { data: access } = await admin.from("exam_access").select("student_email").eq("access_token",token).eq("exam_id",examId).maybeSingle();
        if (!access) return json({success:false,error:"Invalid exam access."},403);
      }

      const { data: attempt } = await admin.from("exam_attempts").select("id,exam_id,submitted_at").eq("id",attemptId).single();
      if (!attempt || String(attempt.exam_id)!==examId) return json({success:false,error:"Invalid exam attempt."},403);
      if (attempt.submitted_at) return json({success:false,error:"This attempt has already been submitted."},400);

      const { data: qs } = await admin.from("exam_questions").select("id,correct_option,marks").eq("exam_id",examId).order("question_order");
      if (!exam || !qs?.length) return json({success:false,error:"Exam data unavailable."},500);

      let correct=0,wrong=0,unanswered=0,score=0;
      const rows:any[]=[];
      for (const q of qs) {
        const selected = String(answers[q.id] || "");
        if (!selected) { unanswered++; continue; }
        const ok = selected === q.correct_option;
        if (ok) { correct++; score += Number(q.marks||1); }
        else { wrong++; score -= Number(exam.negative_mark||0); }
        rows.push({attempt_id:attemptId,question_id:q.id,selected_option:selected,is_correct:ok,marks_awarded:ok?Number(q.marks||1):-Number(exam.negative_mark||0)});
      }
      score=Math.max(0,score);
      const percentage=Number(exam.total_marks||0)?Math.round(score/Number(exam.total_marks)*10000)/100:0;

      if (rows.length) {
        const {error:ansError}=await admin.from("exam_answers").upsert(rows,{onConflict:"attempt_id,question_id"});
        if(ansError) return json({success:false,error:ansError.message},500);
      }
      const {error:updateError}=await admin.from("exam_attempts").update({
        submitted_at:new Date().toISOString(),score,correct_answers:correct,wrong_answers:wrong,unanswered,percentage
      }).eq("id",attemptId);
      if(updateError) return json({success:false,error:updateError.message},500);

      return json({success:true,score,percentage,correct_answers:correct,wrong_answers:wrong,unanswered});
    }

    return json({success:false,error:"Unknown action."},400);
  } catch (err) {
    console.error(err);
    return json({success:false,error:err?.message || "Server error"},500);
  }
});

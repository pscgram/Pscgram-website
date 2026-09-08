const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const SECURE_EXAM_URL = `${PSCGRAM_CONFIG.SUPABASE_URL}/functions/v1/paid-exam`;

let exam=null, questions=[], answers={}, current=0, attemptId=null, secondsLeft=0, timerHandle=null;
let paidAccessToken=null;

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function show(id){$(id).classList.remove("hidden");}
function hide(id){$(id).classList.add("hidden");}

async function secureExam(body){
 const r=await fetch(SECURE_EXAM_URL,{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY},
   body:JSON.stringify(body)
 });
 const data=await r.json().catch(()=>({}));
 if(!r.ok || !data.success) throw new Error(data.error || "Exam service error");
 return data;
}

async function loadExams(){
 const {data,error}=await db.from("exams").select("*").eq("is_published",true).order("created_at",{ascending:false});
 const box=$("exam-list");
 if(error){box.textContent=error.message;return;}
 if(!data?.length){box.innerHTML='<div class="empty">No online exams published yet.</div>';return;}
 box.innerHTML=data.map(e=>`<div class="exam-card">
   <div><strong>${esc(e.title)}</strong>
   <div class="exam-meta"><span>⏱ ${e.duration_minutes} min</span><span>•</span><span>🎯 ${e.total_marks} marks</span><span>•</span><span>${e.is_paid?`💳 ₹${Number(e.price||0).toFixed(0)}`:"🟢 Free"}</span></div>
   ${e.description?`<small class="muted">${esc(e.description)}</small>`:""}</div>
   <button class="btn primary start-btn" data-id="${esc(e.id)}">${e.is_paid?`Pay ₹${Number(e.price||0).toFixed(0)} & Start`:"Start Exam"}</button>
 </div>`).join("");
 box.querySelectorAll(".start-btn").forEach(b=>b.onclick=()=>prepare(b.dataset.id));
}

async function prepare(id){
 const {data:e,error}=await db.from("exams").select("*").eq("id",id).eq("is_published",true).single();
 if(error){alert(error.message);return;}
 if(e.is_paid){
   if(!Number(e.price||0) || Number(e.price)<1){alert("This paid exam has an invalid price. Please contact PSCGram.");return;}
   exam=e; questions=[]; answers={}; current=0; paidAccessToken=null;
   $("start-title").textContent=e.title;
   $("start-description").textContent=e.description||"";
   $("start-duration").textContent=e.duration_minutes;
   $("start-count").textContent="Loading after payment";
   $("payment-note").textContent=`This is a paid mock test. Price: ₹${Number(e.price).toFixed(0)}. Payment is verified securely before the exam is unlocked.`;
   $("start-form").querySelector("button[type=submit]").textContent=`Pay ₹${Number(e.price).toFixed(0)} & Start Exam`;
   $("student-email").required=true;
   hide("exam-list-panel"); show("start-panel"); window.scrollTo(0,0);
   return;
 }
 exam=e; questions=[]; answers={}; current=0; paidAccessToken=null;
 $("start-title").textContent=e.title; $("start-description").textContent=e.description||"";
 $("start-duration").textContent=e.duration_minutes; $("start-count").textContent="Ready";
 $("payment-note").textContent="";
 $("start-form").querySelector("button[type=submit]").textContent="Start Exam";
 $("student-email").required=false;
 hide("exam-list-panel"); show("start-panel"); window.scrollTo(0,0);
}

async function payForExam(){
 const name=$("student-name").value.trim(), email=$("student-email").value.trim();
 if(!name || !email){alert("Please enter your name and email.");return;}
 if(typeof Razorpay==="undefined"){alert("Payment system could not load. Please try again.");return;}
 const order=await secureExam({action:"create_order",exam_id:String(exam.id),student_name:name,student_email:email});
 return new Promise((resolve,reject)=>{
   const rzp=new Razorpay({
     key:order.key_id, order_id:order.order_id, amount:order.amount, currency:"INR",
     name:"PSCGram", description:exam.title,
     prefill:{name,email},
     notes:{exam_id:String(exam.id)},
     theme:{color:"#1456d8"},
     handler:async response=>{
       try{
         const verified=await secureExam({
           action:"verify", exam_id:String(exam.id),
           student_name:name, student_email:email,
           razorpay_order_id:response.razorpay_order_id,
           razorpay_payment_id:response.razorpay_payment_id,
           razorpay_signature:response.razorpay_signature
         });
         paidAccessToken=verified.access_token;
         resolve(verified);
       }catch(err){reject(err);}
     },
     modal:{ondismiss:()=>reject(new Error("Payment cancelled."))}
   });
   rzp.on("payment.failed",r=>reject(new Error(r?.error?.description||"Payment failed.")));
   rzp.open();
 });
}

async function startPaidExam(){
 const started=await secureExam({
   action:"start", exam_id:String(exam.id), access_token:paidAccessToken,
   student_name:$("student-name").value.trim(), student_email:$("student-email").value.trim()
 });
 attemptId=started.attempt_id; questions=started.questions; answers={}; current=0;
 exam={...exam,...started.exam};
 $("start-count").textContent=questions.length;
 hide("start-panel");show("exam-panel");$("live-title").textContent=exam.title;
 render(); startTimer(); window.scrollTo(0,0);
}

$("start-form").onsubmit=async ev=>{
 ev.preventDefault();
 try{
   const btn=$("start-form").querySelector("button[type=submit]");
   btn.disabled=true;
   if(exam.is_paid){
     if(!paidAccessToken) await payForExam();
     await startPaidExam();
   }else{
     const started=await secureExam({
       action:"start", exam_id:String(exam.id), access_token:"",
       student_name:$("student-name").value.trim(), student_email:$("student-email").value.trim()||"guest@pscgram.local"
     });
     attemptId=started.attempt_id; questions=started.questions; exam={...exam,...started.exam};
     secondsLeft=exam.duration_minutes*60;
     hide("start-panel");show("exam-panel");$("live-title").textContent=exam.title;
     render(); startTimer(); window.scrollTo(0,0);
   }
 }catch(err){alert(err.message||"Could not start exam.");}
 finally{$("start-form").querySelector("button[type=submit]").disabled=false;}
};

function startTimer(){clearInterval(timerHandle);updateTimer();timerHandle=setInterval(()=>{secondsLeft--;updateTimer();if(secondsLeft<=0){clearInterval(timerHandle);submitExam(true);}},1000);}
function updateTimer(){const m=Math.floor(Math.max(0,secondsLeft)/60),s=Math.max(0,secondsLeft)%60;$("timer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;$("timer").classList.toggle("warning",secondsLeft<=60);}
function render(){
 const q=questions[current];$("question-number").textContent=`QUESTION ${current+1} OF ${questions.length}`;$("question-text").textContent=q.question_text;
 const opts=[["A",q.option_a],["B",q.option_b],["C",q.option_c],["D",q.option_d]];
 $("options").innerHTML=opts.map(([k,v])=>`<button type="button" class="exam-option ${answers[q.id]===k?'selected':''}" data-opt="${k}"><span>${k}</span>${esc(v)}</button>`).join("");
 $("options").querySelectorAll(".exam-option").forEach(b=>b.onclick=()=>choose(b.dataset.opt));
 $("prev").disabled=current===0;$("next").classList.toggle("hidden",current===questions.length-1);$("submit").classList.toggle("hidden",current!==questions.length-1);
 $("palette").innerHTML=questions.map((x,i)=>`<button type="button" class="palette-btn ${i===current?'current':''} ${answers[x.id]?'answered':''}" data-i="${i}">${i+1}</button>`).join("");
 $("palette").querySelectorAll(".palette-btn").forEach(b=>b.onclick=()=>{current=Number(b.dataset.i);render();});
}
function choose(opt){const q=questions[current];answers[q.id]=opt;render();}
$("prev").onclick=()=>{if(current>0){current--;render();}};
$("next").onclick=()=>{if(current<questions.length-1){current++;render();}};
$("submit").onclick=()=>{if(confirm("Submit your exam now?"))submitExam(false);};

async function submitExam(auto){
 clearInterval(timerHandle);
 try{
   let result;
   if(exam.is_paid){
     result=await secureExam({action:"submit",exam_id:String(exam.id),attempt_id:String(attemptId),access_token:paidAccessToken,answers});
   }else{
     result=await secureExam({action:"submit",exam_id:String(exam.id),attempt_id:String(attemptId),access_token:"",answers});
   }
   hide("exam-panel");show("result-panel");
   $("result-title").textContent=auto?"Time is up!":"Exam submitted!";
   $("result-summary").innerHTML=`<div class="result-grid"><div><b>${result.score}</b><small>Score</small></div><div><b>${result.percentage}%</b><small>Percentage</small></div><div><b>${result.correct_answers}</b><small>Correct</small></div><div><b>${result.wrong_answers}</b><small>Wrong</small></div><div><b>${result.unanswered}</b><small>Unanswered</small></div></div>`;
   window.scrollTo(0,0);
 }catch(err){alert(err.message||"Could not submit the exam.");}
}
loadExams();

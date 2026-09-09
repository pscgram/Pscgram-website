const { createClient } = supabase;
const db = createClient(PSCGRAM_CONFIG.SUPABASE_URL, PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY);
const ADMIN_UID = "60d7f743-1b0f-48ad-a72c-2e6825b863e6";

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("login-error");
const uploadStatus = document.getElementById("upload-status");

function esc(v="") {
  return v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

async function showSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session && session.user.id === ADMIN_UID) {
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadAdminProducts();
    loadAdminExams();
  } else {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  }
}

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { error } = await db.auth.signInWithPassword({email, password});
  if (error) loginError.textContent = error.message;
  else showSession();
});

document.getElementById("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  showSession();
});

document.getElementById("refresh").addEventListener("click", loadAdminProducts);

document.getElementById("upload-form").addEventListener("submit", async e => {
  e.preventDefault();
  uploadStatus.textContent = "Uploading…";
  uploadStatus.className = "status full";
  const { data: { user } } = await db.auth.getUser();
  if (!user || user.id !== ADMIN_UID) { uploadStatus.textContent = "Admin authorization required."; return; }

  const title = document.getElementById("title").value.trim();
  const price = Number(document.getElementById("price").value || 0);
  const description = document.getElementById("description").value.trim();
  const cover_url = document.getElementById("cover").value.trim() || null;
  const file = document.getElementById("pdf").files[0];
  if (!file || file.type !== "application/pdf") { uploadStatus.textContent = "Please select a PDF file."; return; }

  const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const path = `${user.id}/${Date.now()}-${safe}`;

  const { error: storageError } = await db.storage.from("pdfs").upload(path, file, {
    contentType: "application/pdf", upsert: false
  });
  if (storageError) { uploadStatus.textContent = storageError.message; return; }

  const { error: productError } = await db.from("products").insert({
    title, price, description, cover_url, pdf_url: path, created_by: user.id
  });
  if (productError) {
    await db.storage.from("pdfs").remove([path]);
    uploadStatus.textContent = productError.message;
    return;
  }

  uploadStatus.textContent = "Published successfully!";
  e.target.reset();
  document.getElementById("price").value = 99;
  loadAdminProducts();
});

async function loadAdminProducts() {
  const box = document.getElementById("admin-products");
  box.innerHTML = "Loading…";
  const { data, error } = await db.from("products").select("*").order("created_at", {ascending:false});
  if (error) { box.textContent = error.message; return; }
  if (!data.length) { box.innerHTML = `<div class="muted">No products yet.</div>`; return; }

  box.innerHTML = data.map(p => `
    <div class="admin-item">
      <div><b>${esc(p.title)}</b><small>₹${Number(p.price||0).toFixed(0)} • ${new Date(p.created_at).toLocaleDateString()}</small></div>
      <button class="delete-btn" data-id="${p.id}" data-path="${esc(p.pdf_url || "")}">Delete</button>
    </div>`).join("");

  box.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Delete this material?")) return;
    const id = btn.dataset.id, path = btn.dataset.path;
    const { error: de } = await db.from("products").delete().eq("id", id);
    if (de) { alert(de.message); return; }
    if (path) await db.storage.from("pdfs").remove([path]);
    loadAdminProducts();
  }));
}

showSession();


// ===== ONLINE EXAMS =====
let selectedExamId = null;

document.getElementById("exam-form").addEventListener("submit", async e => {
  e.preventDefault();
  const status = document.getElementById("exam-status");
  status.textContent = "Creating…";
  const { data: { user } } = await db.auth.getUser();
  if (!user || user.id !== ADMIN_UID) { status.textContent = "Admin authorization required."; return; }

  const { data, error } = await db.from("exams").insert({
    title: document.getElementById("exam-title").value.trim(),
    description: document.getElementById("exam-description").value.trim() || null,
    duration_minutes: Number(document.getElementById("exam-duration").value),
    negative_mark: Number(document.getElementById("exam-negative").value || 0),
    total_marks: 0,
    is_published: false,
    is_paid: document.getElementById("exam-paid").value === "true",
    price: Number(document.getElementById("exam-price").value || 0)
  }).select().single();

  if (error) { status.textContent = error.message; return; }
  status.textContent = "Exam created.";
  e.target.reset();
  document.getElementById("exam-duration").value = 30;
  document.getElementById("exam-negative").value = 0;
  document.getElementById("exam-paid").value = "false";
  document.getElementById("exam-price").value = 29;
  document.getElementById("exam-price").disabled = true;
  await loadAdminExams();
  selectExam(data.id, data.title);
});

async function loadAdminExams() {
  const box = document.getElementById("admin-exams");
  box.innerHTML = "Loading…";
  const { data, error } = await db.from("exams").select("*").order("created_at", {ascending:false});
  if (error) { box.textContent = error.message; return; }
  if (!data.length) { box.innerHTML = `<div class="muted">No exams yet.</div>`; return; }

  box.innerHTML = data.map(x => `
    <div class="admin-item">
      <div><b>${esc(x.title)}</b><small>${x.duration_minutes} min • ${x.total_marks} marks • ${x.is_paid ? "Paid ₹" + Number(x.price||0).toFixed(0) : "Free"} • ${x.is_published ? "Published" : "Draft"}</small></div>
      <div class="admin-actions">
        <button class="btn ghost select-exam" data-id="${x.id}" data-title="${esc(x.title)}">Questions</button>
        <button class="btn ghost toggle-exam" data-id="${x.id}" data-published="${x.is_published}">${x.is_published ? "Unpublish" : "Publish"}</button>
        <button class="btn ghost price-exam" data-id="${x.id}" data-paid="${x.is_paid}" data-price="${x.price||29}">${x.is_paid ? "Set Free" : "Make Paid"}</button>
        <button class="delete-btn delete-exam" data-id="${x.id}">Delete</button>
      </div>
    </div>`).join("");

  box.querySelectorAll(".select-exam").forEach(b => b.addEventListener("click", () => selectExam(b.dataset.id, b.dataset.title)));
  box.querySelectorAll(".toggle-exam").forEach(b => b.addEventListener("click", async () => {
    const { error } = await db.from("exams").update({is_published: b.dataset.published !== "true"}).eq("id", b.dataset.id);
    if (error) alert(error.message); else loadAdminExams();
  }));
  box.querySelectorAll(".price-exam").forEach(b => b.addEventListener("click", async () => {
    if (b.dataset.paid === "true") {
      if (!confirm("Make this exam free?")) return;
      const { error } = await db.from("exams").update({is_paid:false, price:0}).eq("id", b.dataset.id);
      if (error) alert(error.message); else loadAdminExams();
    } else {
      const value = prompt("Enter exam price in ₹", b.dataset.price || "29");
      if (value === null) return;
      const price = Number(value);
      if (!Number.isFinite(price) || price < 1) { alert("Enter a valid price of at least ₹1."); return; }
      const { error } = await db.from("exams").update({is_paid:true, price}).eq("id", b.dataset.id);
      if (error) alert(error.message); else loadAdminExams();
    }
  }));
  box.querySelectorAll(".delete-exam").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this exam and all its questions/results?")) return;
    const { error } = await db.from("exams").delete().eq("id", b.dataset.id);
    if (error) alert(error.message);
    else { document.getElementById("question-panel").classList.add("hidden"); loadAdminExams(); }
  }));
}

async function selectExam(id, title) {
  selectedExamId = id;
  document.getElementById("question-panel").classList.remove("hidden");
  document.getElementById("question-panel-title").textContent = "Questions: " + title;
  await loadAdminQuestions();
  document.getElementById("question-panel").scrollIntoView({behavior:"smooth"});
}

document.getElementById("question-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!selectedExamId) return;
  const status = document.getElementById("question-status");
  status.textContent = "Adding…";
  const { data: existing, error: countError } = await db.from("exam_questions").select("question_order").eq("exam_id", selectedExamId).order("question_order",{ascending:false}).limit(1);
  if (countError) { status.textContent = countError.message; return; }
  const order = existing?.length ? Number(existing[0].question_order)+1 : 1;

  const { error } = await db.from("exam_questions").insert({
    exam_id: selectedExamId,
    question_text: document.getElementById("q-text").value.trim(),
    option_a: document.getElementById("q-a").value.trim(),
    option_b: document.getElementById("q-b").value.trim(),
    option_c: document.getElementById("q-c").value.trim(),
    option_d: document.getElementById("q-d").value.trim(),
    correct_option: document.getElementById("q-correct").value,
    marks: Number(document.getElementById("q-marks").value || 1),
    question_order: order
  });
  if (error) { status.textContent = error.message; return; }
  await recalcExamMarks();
  status.textContent = "Question added.";
  e.target.reset();
  document.getElementById("q-correct").value = "A";
  document.getElementById("q-marks").value = 1;
  loadAdminQuestions();
});

async function recalcExamMarks() {
  const { data } = await db.from("exam_questions").select("marks").eq("exam_id", selectedExamId);
  const total = (data || []).reduce((sum,q) => sum + Number(q.marks || 0), 0);
  await db.from("exams").update({total_marks: total}).eq("id", selectedExamId);
  loadAdminExams();
}

async function loadAdminQuestions() {
  const box = document.getElementById("admin-questions");
  const { data, error } = await db.from("exam_questions").select("*").eq("exam_id", selectedExamId).order("question_order");
  if (error) { box.textContent = error.message; return; }
  box.innerHTML = !data.length ? `<div class="muted">No questions yet.</div>` : data.map((q,i) => `
    <div class="admin-item">
      <div><b>Q${i+1}. ${esc(q.question_text)}</b><small>A: ${esc(q.option_a)} • B: ${esc(q.option_b)} • C: ${esc(q.option_c)} • D: ${esc(q.option_d)} • Correct: ${q.correct_option} • ${q.marks} mark(s)</small></div>
      <button class="delete-btn delete-question" data-id="${q.id}">Delete</button>
    </div>`).join("");
  box.querySelectorAll(".delete-question").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this question?")) return;
    const { error } = await db.from("exam_questions").delete().eq("id", b.dataset.id);
    if (error) alert(error.message); else { await recalcExamMarks(); loadAdminQuestions(); }
  }));
}


const paidSelect = document.getElementById("exam-paid");
const paidPrice = document.getElementById("exam-price");
if (paidSelect && paidPrice) paidSelect.addEventListener("change", () => {
  paidPrice.disabled = paidSelect.value !== "true";
});


// ===== DAILY CURRENT AFFAIRS =====
const caForm = document.getElementById("ca-form");
const caAdminStatus = document.getElementById("ca-status-admin");
const caList = document.getElementById("admin-ca-list");
if (caForm) {
  document.getElementById("ca-date").value = new Date().toISOString().slice(0,10);

  caForm.addEventListener("submit", async e => {
    e.preventDefault();
    caAdminStatus.textContent = "Publishing…";
    const { data: { user } } = await db.auth.getUser();
    if (!user || user.id !== ADMIN_UID) { caAdminStatus.textContent = "Admin authorization required."; return; }

    const points = document.getElementById("ca-points").value.split("\n").map(x=>x.trim()).filter(Boolean).slice(0,6);
    const payload = {
      category: document.getElementById("ca-category").value,
      published_date: document.getElementById("ca-date").value,
      title: document.getElementById("ca-title").value.trim(),
      note: document.getElementById("ca-note").value.trim(),
      points,
      sort_order: Number(document.getElementById("ca-sort").value || 1),
      is_published: true,
      created_by: user.id
    };
    const { error } = await db.from("current_affairs").insert(payload);
    if (error) { caAdminStatus.textContent = error.message; return; }
    caAdminStatus.textContent = "Published successfully!";
    caForm.reset();
    document.getElementById("ca-date").value = new Date().toISOString().slice(0,10);
    document.getElementById("ca-sort").value = 1;
    loadAdminCurrentAffairs();
  });
}
async function loadAdminCurrentAffairs(){
  if(!caList) return;
  caList.innerHTML="Loading…";
  const {data,error}=await db.from("current_affairs").select("*").order("published_date",{ascending:false}).order("sort_order",{ascending:true}).limit(30);
  if(error){caList.innerHTML=`<div class="muted">${esc(error.message)}</div>`;return;}
  if(!data?.length){caList.innerHTML='<div class="muted">No current-affairs entries yet.</div>';return;}
  caList.innerHTML=data.map(x=>`
    <div class="admin-item">
      <div><b>${esc(x.title)}</b><small>${esc(x.category)} • ${esc(x.published_date)} • ${x.is_published?"Published":"Hidden"}</small></div>
      <button class="delete-btn ca-delete" data-id="${x.id}">Delete</button>
    </div>`).join("");
  caList.querySelectorAll(".ca-delete").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("Delete this current-affairs entry?")) return;
    const {error}=await db.from("current_affairs").delete().eq("id",btn.dataset.id);
    if(error) alert(error.message); else loadAdminCurrentAffairs();
  }));
}
const oldShowSession=showSession;
showSession=async function(){
  await oldShowSession();
  const { data: { session } } = await db.auth.getSession();
  if(session && session.user.id===ADMIN_UID) loadAdminCurrentAffairs();
};


const { createClient } = supabase;

const db = createClient(
  PSCGRAM_CONFIG.SUPABASE_URL,
  PSCGRAM_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const ADMIN_UID = "5cff3811-f2d9-49a5-b8aa-60a50d628872";

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("login-error");
const uploadStatus = document.getElementById("upload-status");

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

async function showSession() {
  try {
    const { data: { session }, error } = await db.auth.getSession();

    if (error) throw error;

    if (session && session.user.id === ADMIN_UID) {
      loginPanel.classList.add("hidden");
      dashboard.classList.remove("hidden");

      await Promise.all([
        loadAdminProducts(),
        loadAdminExams(),
        loadAdminCurrentAffairs()
      ]);
    } else {
      dashboard.classList.add("hidden");
      loginPanel.classList.remove("hidden");
    }
  } catch (error) {
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    if (loginError) loginError.textContent = error.message;
  }
}

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();

  loginError.textContent = "Signing in…";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!data.user || data.user.id !== ADMIN_UID) {
      await db.auth.signOut();
      loginError.textContent =
        "This account is not authorized for the admin dashboard. Please use the registered admin account.";
      return;
    }

    loginError.textContent = "";
    await showSession();
  } catch (error) {
    loginError.textContent = error.message || "Login failed. Please try again.";
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  await showSession();
});

document.getElementById("refresh").addEventListener("click", loadAdminProducts);

document.getElementById("upload-form").addEventListener("submit", async e => {
  e.preventDefault();

  uploadStatus.textContent = "Uploading…";
  uploadStatus.className = "status full";

  try {
    const { data: { user } } = await db.auth.getUser();

    if (!user || user.id !== ADMIN_UID) {
      uploadStatus.textContent = "Admin authorization required.";
      return;
    }

    const title = document.getElementById("title").value.trim();
    const price = Number(document.getElementById("price").value || 0);
    const description = document.getElementById("description").value.trim();
    const cover_url = document.getElementById("cover").value.trim() || null;
    const file = document.getElementById("pdf").files[0];

    if (!file || file.type !== "application/pdf") {
      uploadStatus.textContent = "Please select a PDF file.";
      return;
    }

    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const path = `${user.id}/${Date.now()}-${safe}`;

    const { error: storageError } = await db.storage.from("pdfs").upload(
      path,
      file,
      { contentType: "application/pdf", upsert: false }
    );

    if (storageError) throw storageError;

    const { error: productError } = await db.from("products").insert({
      title,
      price,
      description,
      cover_url,
      pdf_url: path,
      created_by: user.id
    });

    if (productError) {
      await db.storage.from("pdfs").remove([path]);
      throw productError;
    }

    uploadStatus.textContent = "Published successfully!";
    e.target.reset();
    document.getElementById("price").value = 99;
    await loadAdminProducts();
  } catch (error) {
    uploadStatus.textContent = error.message || "Upload failed.";
  }
});

async function loadAdminProducts() {
  const box = document.getElementById("admin-products");
  box.innerHTML = "Loading…";

  const { data, error } = await db.from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = error.message;
    return;
  }

  if (!data.length) {
    box.innerHTML = '<div class="muted">No products yet.</div>';
    return;
  }

  box.innerHTML = data.map(p => `
    <div class="admin-item">
      <div>
        <b>${esc(p.title)}</b>
        <small>₹${Number(p.price || 0).toFixed(0)} • ${new Date(p.created_at).toLocaleDateString()}</small>
      </div>
      <button class="delete-btn" data-id="${esc(p.id)}" data-path="${esc(p.pdf_url || "")}">Delete</button>
    </div>
  `).join("");

  box.querySelectorAll(".delete-btn").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this material?")) return;

      const id = btn.dataset.id;
      const path = btn.dataset.path;

      const { error: deleteError } = await db.from("products")
        .delete().eq("id", id);

      if (deleteError) {
        alert(deleteError.message);
        return;
      }

      if (path) {
        const { error: storageError } = await db.storage.from("pdfs").remove([path]);
        if (storageError) {
          alert("Product deleted, but PDF storage cleanup failed: " + storageError.message);
        }
      }

      await loadAdminProducts();
    })
  );
}

// ===== ONLINE EXAMS =====
let selectedExamId = null;

document.getElementById("exam-form").addEventListener("submit", async e => {
  e.preventDefault();

  const status = document.getElementById("exam-status");
  status.textContent = "Creating…";

  try {
    const { data: { user } } = await db.auth.getUser();

    if (!user || user.id !== ADMIN_UID) {
      status.textContent = "Admin authorization required.";
      return;
    }

    const isPaid = document.getElementById("exam-paid").value === "true";

    const { data, error } = await db.from("exams").insert({
      title: document.getElementById("exam-title").value.trim(),
      description: document.getElementById("exam-description").value.trim() || null,
      duration_minutes: Number(document.getElementById("exam-duration").value),
      negative_mark: Number(document.getElementById("exam-negative").value || 0),
      total_marks: 0,
      is_published: false,
      is_paid: isPaid,
      price: isPaid ? Number(document.getElementById("exam-price").value || 29) : 0
    }).select().single();

    if (error) throw error;

    status.textContent = "Exam created.";
    e.target.reset();
    document.getElementById("exam-duration").value = 30;
    document.getElementById("exam-negative").value = 0;
    document.getElementById("exam-paid").value = "false";
    document.getElementById("exam-price").value = 29;
    document.getElementById("exam-price").disabled = true;

    await loadAdminExams();
    selectExam(data.id, data.title);
  } catch (error) {
    status.textContent = error.message || "Could not create exam.";
  }
});

async function loadAdminExams() {
  const box = document.getElementById("admin-exams");
  box.innerHTML = "Loading…";

  const { data, error } = await db.from("exams")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = error.message;
    return;
  }

  if (!data.length) {
    box.innerHTML = '<div class="muted">No exams yet.</div>';
    return;
  }

  box.innerHTML = data.map(x => `
    <div class="admin-item">
      <div>
        <b>${esc(x.title)}</b>
        <small>${x.duration_minutes} min • ${x.total_marks} marks • ${x.is_paid ? "Paid ₹" + Number(x.price || 0).toFixed(0) : "Free"} • ${x.is_published ? "Published" : "Draft"}</small>
      </div>
      <div class="admin-actions">
        <button class="btn ghost select-exam" data-id="${esc(x.id)}" data-title="${esc(x.title)}">Questions</button>
        <button class="btn ghost toggle-exam" data-id="${esc(x.id)}" data-published="${x.is_published}">${x.is_published ? "Unpublish" : "Publish"}</button>
        <button class="btn ghost price-exam" data-id="${esc(x.id)}" data-paid="${x.is_paid}" data-price="${x.price || 29}">${x.is_paid ? "Set Free" : "Make Paid"}</button>
        <button class="delete-btn delete-exam" data-id="${esc(x.id)}">Delete</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll(".select-exam").forEach(b =>
    b.addEventListener("click", () => selectExam(b.dataset.id, b.dataset.title))
  );

  box.querySelectorAll(".toggle-exam").forEach(b =>
    b.addEventListener("click", async () => {
      const { error } = await db.from("exams")
        .update({ is_published: b.dataset.published !== "true" })
        .eq("id", b.dataset.id);

      if (error) alert(error.message);
      else await loadAdminExams();
    })
  );

  box.querySelectorAll(".price-exam").forEach(b =>
    b.addEventListener("click", async () => {
      if (b.dataset.paid === "true") {
        if (!confirm("Make this exam free?")) return;

        const { error } = await db.from("exams")
          .update({ is_paid: false, price: 0 })
          .eq("id", b.dataset.id);

        if (error) alert(error.message);
        else await loadAdminExams();
      } else {
        const value = prompt("Enter exam price in ₹", b.dataset.price || "29");
        if (value === null) return;

        const price = Number(value);
        if (!Number.isFinite(price) || price < 1) {
          alert("Enter a valid price of at least ₹1.");
          return;
        }

        const { error } = await db.from("exams")
          .update({ is_paid: true, price })
          .eq("id", b.dataset.id);

        if (error) alert(error.message);
        else await loadAdminExams();
      }
    })
  );

  box.querySelectorAll(".delete-exam").forEach(b =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this exam and all its questions/results?")) return;

      const { error } = await db.from("exams").delete().eq("id", b.dataset.id);

      if (error) alert(error.message);
      else {
        document.getElementById("question-panel").classList.add("hidden");
        await loadAdminExams();
      }
    })
  );
}

async function selectExam(id, title) {
  selectedExamId = id;
  document.getElementById("question-panel").classList.remove("hidden");
  document.getElementById("question-panel-title").textContent = "Questions: " + title;
  await loadAdminQuestions();
  document.getElementById("question-panel").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("question-form").addEventListener("submit", async e => {
  e.preventDefault();

  if (!selectedExamId) return;

  const status = document.getElementById("question-status");
  status.textContent = "Adding…";

  try {
    const { data: existing, error: countError } = await db.from("exam_questions")
      .select("question_order")
      .eq("exam_id", selectedExamId)
      .order("question_order", { ascending: false })
      .limit(1);

    if (countError) throw countError;

    const order = existing?.length ? Number(existing[0].question_order) + 1 : 1;

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

    if (error) throw error;

    await recalcExamMarks();
    status.textContent = "Question added.";
    e.target.reset();
    document.getElementById("q-correct").value = "A";
    document.getElementById("q-marks").value = 1;
    await loadAdminQuestions();
  } catch (error) {
    status.textContent = error.message || "Could not add question.";
  }
});

async function recalcExamMarks() {
  const { data, error } = await db.from("exam_questions")
    .select("marks")
    .eq("exam_id", selectedExamId);

  if (error) {
    alert(error.message);
    return;
  }

  const total = (data || []).reduce((sum, q) => sum + Number(q.marks || 0), 0);

  const { error: updateError } = await db.from("exams")
    .update({ total_marks: total })
    .eq("id", selectedExamId);

  if (updateError) alert(updateError.message);
  await loadAdminExams();
}

async function loadAdminQuestions() {
  const box = document.getElementById("admin-questions");

  const { data, error } = await db.from("exam_questions")
    .select("*")
    .eq("exam_id", selectedExamId)
    .order("question_order");

  if (error) {
    box.textContent = error.message;
    return;
  }

  box.innerHTML = !data.length
    ? '<div class="muted">No questions yet.</div>'
    : data.map((q, i) => `
      <div class="admin-item">
        <div>
          <b>Q${i + 1}. ${esc(q.question_text)}</b>
          <small>A: ${esc(q.option_a)} • B: ${esc(q.option_b)} • C: ${esc(q.option_c)} • D: ${esc(q.option_d)} • Correct: ${esc(q.correct_option)} • ${q.marks} mark(s)</small>
        </div>
        <button class="delete-btn delete-question" data-id="${esc(q.id)}">Delete</button>
      </div>
    `).join("");

  box.querySelectorAll(".delete-question").forEach(b =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this question?")) return;

      const { error } = await db.from("exam_questions").delete().eq("id", b.dataset.id);

      if (error) alert(error.message);
      else {
        await recalcExamMarks();
        await loadAdminQuestions();
      }
    })
  );
}

const paidSelect = document.getElementById("exam-paid");
const paidPrice = document.getElementById("exam-price");

if (paidSelect && paidPrice) {
  paidSelect.addEventListener("change", () => {
    paidPrice.disabled = paidSelect.value !== "true";
  });
}

// ===== DAILY CURRENT AFFAIRS =====
const caForm = document.getElementById("ca-form");
const caAdminStatus = document.getElementById("ca-status-admin");
const caList = document.getElementById("admin-ca-list");
let editingCaId = null;

function resetCaForm() {
  editingCaId = null;
  caForm.reset();

  document.getElementById("ca-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("ca-sort").value = 1;

  const submit = caForm.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Publish Current Affair";

  const cancel = document.getElementById("ca-cancel-edit");
  if (cancel) cancel.classList.add("hidden");
}

if (caForm) {
  resetCaForm();

  caForm.addEventListener("submit", async e => {
    e.preventDefault();

    caAdminStatus.textContent = editingCaId
      ? "Updating & republishing…"
      : "Publishing…";

    try {
      const { data: { user } } = await db.auth.getUser();

      if (!user || user.id !== ADMIN_UID) {
        caAdminStatus.textContent = "Admin authorization required.";
        return;
      }

      const points = document.getElementById("ca-points").value
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean)
        .slice(0, 6);

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

      let error;

      if (editingCaId) {
        ({ error } = await db.from("current_affairs")
          .update(payload)
          .eq("id", editingCaId));
      } else {
        ({ error } = await db.from("current_affairs").insert(payload));
      }

      if (error) throw error;

      caAdminStatus.textContent = editingCaId
        ? "Updated and republished successfully!"
        : "Published successfully!";

      resetCaForm();
      await loadAdminCurrentAffairs();
    } catch (error) {
      caAdminStatus.textContent = error.message || "Could not save current affair.";
    }
  });

  const cancel = document.getElementById("ca-cancel-edit");

  if (cancel) {
    cancel.addEventListener("click", () => {
      resetCaForm();
      caAdminStatus.textContent = "Edit cancelled.";
    });
  }
}

async function editCurrentAffair(id) {
  const { data, error } = await db.from("current_affairs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  editingCaId = id;

  document.getElementById("ca-category").value = data.category || "National";
  document.getElementById("ca-date").value = data.published_date || new Date().toISOString().slice(0, 10);
  document.getElementById("ca-title").value = data.title || "";
  document.getElementById("ca-note").value = data.note || "";

  const points = Array.isArray(data.points) ? data.points : [];
  document.getElementById("ca-points").value = points.join("\n");
  document.getElementById("ca-sort").value = data.sort_order || 1;

  const submit = caForm.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Update & Republish";

  const cancel = document.getElementById("ca-cancel-edit");
  if (cancel) cancel.classList.remove("hidden");

  caAdminStatus.textContent = "Editing this entry…";
  caForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadAdminCurrentAffairs() {
  if (!caList) return;

  caList.innerHTML = "Loading…";

  const { data, error } = await db.from("current_affairs")
    .select("*")
    .order("published_date", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(30);

  if (error) {
    caList.innerHTML = `<div class="muted">${esc(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    caList.innerHTML = '<div class="muted">No current-affairs entries yet.</div>';
    return;
  }

  caList.innerHTML = data.map(x => `
    <div class="admin-item">
      <div>
        <b>${esc(x.title)}</b>
        <small>${esc(x.category)} • ${esc(x.published_date)} • ${x.is_published ? "Published" : "Hidden"}</small>
      </div>
      <div class="admin-actions">
        <button class="btn ghost ca-edit" data-id="${esc(x.id)}">Edit</button>
        <button class="delete-btn ca-delete" data-id="${esc(x.id)}">Delete</button>
      </div>
    </div>
  `).join("");

  caList.querySelectorAll(".ca-edit").forEach(btn =>
    btn.addEventListener("click", () => editCurrentAffair(btn.dataset.id))
  );

  caList.querySelectorAll(".ca-delete").forEach(btn =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this current-affairs entry? This will remove it from the website.")) return;

      const { error } = await db.from("current_affairs")
        .delete()
        .eq("id", btn.dataset.id);

      if (error) {
        alert(error.message);
      } else {
        if (editingCaId === btn.dataset.id) resetCaForm();
        await loadAdminCurrentAffairs();
      }
    })
  );
}

showSession();

/* PSCGram Live Exam Management
   Append this code to the END of admin.js.
   Uses the existing Supabase client named db.
*/

(() => {
  const liveForm = document.getElementById("live-exam-form");
  const questionForm = document.getElementById("live-question-form");
  const examList = document.getElementById("live-exam-list");

  if (!liveForm || !questionForm || !examList) return;

  const liveStatus = document.getElementById("live-exam-status");
  const questionStatus = document.getElementById("live-question-status");

  function showLiveStatus(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? "#c62828" : "#16803c";
  }

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  async function callLiveExam(payload) {
    const { data, error } = await db.functions.invoke("live-exam", {
      body: payload
    });

    if (error) {
      throw new Error(error.message || "Live Exam request failed.");
    }

    if (!data || data.error) {
      throw new Error(data?.error || "Unexpected server response.");
    }

    return data;
  }

  async function loadLiveExams() {
    examList.textContent = "Loading live exams…";

    try {
      const data = await callLiveExam({ action: "list_exams" });
      const exams = data.exams || [];

      if (!exams.length) {
        examList.textContent = "No live exams created yet.";
        return;
      }

      examList.innerHTML = exams.map(exam => `
        <div class="panel">
          <h3>${safeText(exam.title)}</h3>
          <p>${safeText(exam.description || "")}</p>
          <p><strong>Status:</strong> ${safeText(exam.status)}</p>
          <p><strong>Starts:</strong>
            ${safeText(exam.start_time
              ? new Date(exam.start_time).toLocaleString()
              : "Not specified")}
          </p>
          <p><strong>Duration:</strong>
            ${safeText(exam.duration_minutes)} minutes
          </p>
          <p><strong>Exam ID:</strong><br>
            <code>${safeText(exam.id)}</code>
          </p>
          <button class="btn ghost"
            type="button"
            data-live-action="select"
            data-id="${safeText(exam.id)}">
            Select for adding questions
          </button>
          ${exam.status === "draft" ? `
            <button class="btn primary"
              type="button"
              data-live-action="publish"
              data-id="${safeText(exam.id)}">
              Publish Exam
            </button>
          ` : ""}
          <button class="btn ghost"
            type="button"
            data-live-action="leaderboard"
            data-id="${safeText(exam.id)}">
            View Leaderboard
          </button>
          <button class="btn ghost"
            type="button"
            data-live-action="publish-leaderboard"
            data-id="${safeText(exam.id)}">
            Publish Leaderboard
          </button>
          <div id="live-result-${safeText(exam.id)}" class="status"></div>
        </div>
      `).join("");
    } catch (error) {
      examList.textContent = "Could not load live exams: " + error.message;
    }
  }

  // Create a live exam
  liveForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = document.getElementById("live-title").value.trim();
    const description =
      document.getElementById("live-description").value.trim();
    const startValue = document.getElementById("live-start").value;
    const duration = Number(
      document.getElementById("live-duration").value
    );

    if (!startValue || !Number.isFinite(duration) || duration < 1) {
      showLiveStatus(liveStatus, "Enter a valid start time and duration.", true);
      return;
    }

    showLiveStatus(liveStatus, "Creating live exam…");

    try {
      const data = await callLiveExam({
        action: "create_exam",
        title,
        description,
        start_time: new Date(startValue).toISOString(),
        duration_minutes: duration
      });

      if (data.exam?.id) {
        document.getElementById("live-question-exam-id").value =
          data.exam.id;
      }

      showLiveStatus(
        liveStatus,
        "Live exam created. Add questions, then publish the exam."
      );

      liveForm.reset();
      document.getElementById("live-duration").value = "30";
      await loadLiveExams();
    } catch (error) {
      showLiveStatus(liveStatus, error.message, true);
    }
  });

  // Add a question to a live exam
  questionForm.addEventListener("submit", async event => {
    event.preventDefault();

    const examId =
      document.getElementById("live-question-exam-id").value.trim();

    const options = [
      document.getElementById("live-q-a").value.trim(),
      document.getElementById("live-q-b").value.trim(),
      document.getElementById("live-q-c").value.trim(),
      document.getElementById("live-q-d").value.trim()
    ];

    const correctAnswer = Number(
      document.getElementById("live-q-correct").value
    );
    const marks = Number(document.getElementById("live-q-marks").value);

    showLiveStatus(questionStatus, "Adding question…");

    try {
      await callLiveExam({
        action: "add_question",
        exam_id: examId,
        question_text: document.getElementById("live-q-text").value.trim(),
        options,
        correct_answer: correctAnswer,
        marks
      });

      showLiveStatus(questionStatus, "Question added successfully.");
      questionForm.reset();
      document.getElementById("live-question-exam-id").value = examId;
      document.getElementById("live-q-marks").value = "1";
    } catch (error) {
      showLiveStatus(questionStatus, error.message, true);
    }
  });

  // Handle actions on each live exam
  examList.addEventListener("click", async event => {
    const button = event.target.closest("[data-live-action]");
    if (!button) return;

    const action = button.dataset.liveAction;
    const examId = button.dataset.id;

    if (action === "select") {
      document.getElementById("live-question-exam-id").value = examId;
      questionStatus.textContent = "Selected exam: " + examId;
      questionForm.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const resultBox = document.getElementById("live-result-" + examId);
    button.disabled = true;

    try {
      if (action === "publish") {
        await callLiveExam({
          action: "publish_exam",
          exam_id: examId
        });

        if (resultBox) {
          resultBox.textContent = "Exam published successfully.";
        }

        await loadLiveExams();
      }

      if (action === "publish-leaderboard") {
        const data = await callLiveExam({
          action: "publish_leaderboard",
          exam_id: examId
        });

        if (resultBox) {
          resultBox.textContent =
            data.message || "Leaderboard publication request completed.";
        }
      }

      if (action === "leaderboard") {
        const data = await callLiveExam({
          action: "get_leaderboard",
          exam_id: examId
        });

        const leaderboard = data.leaderboard || [];

        if (!resultBox) return;

        if (!leaderboard.length) {
          resultBox.textContent = "No leaderboard results available yet.";
        } else {
          resultBox.innerHTML = "<strong>Leaderboard</strong><ol>" +
            leaderboard.map(item => `
              <li>
                ${safeText(item.name || item.email || item.user_id || "Student")}
                — Score: ${safeText(item.score)}
              </li>
            `).join("") +
            "</ol>";
        }
      }
    } catch (error) {
      if (resultBox) {
        resultBox.textContent = "Error: " + error.message;
      }
    } finally {
      button.disabled = false;
    }
  });

  // Load the list if a user is already signed in.
  db.auth.getSession().then(({ data }) => {
    if (data?.session) loadLiveExams();
  });

  // Also refresh after a new sign-in.
  db.auth.onAuthStateChange(event => {
    if (event === "SIGNED_IN") loadLiveExams();
  });
})();



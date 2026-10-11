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

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = error.message;
  } else {
    await showSession();
  }
});

document.getElementById("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  await showSession();
});

document.getElementById("refresh").addEventListener("click", loadAdminProducts);

document.getElementById("upload-form").addEventListener("submit", async e => {
  e.preventDefault();

  uploadStatus.textContent = "Uploading…";
  uploadStatus.className = "status full";

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

  const { error: storageError } = await db.storage.from("pdfs").upload(path, file, {
    contentType: "application/pdf",
    upsert: false
  });

  if (storageError) {
    uploadStatus.textContent = storageError.message;
    return;
  }

  const { error: productError } = await db.from("products").insert({

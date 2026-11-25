const $ = id => document.getElementById(id);
const loginPanel = $("loginPanel");
const dashboard = $("dashboard");
const loginNotice = $("loginNotice");
const saveNotice = $("saveNotice");

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "تعذر تنفيذ الطلب.");
  return data;
}

function showDashboard() {
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
}

function fillForm(data) {
  ["siteName","ownerName","headline","tagline","about","email"].forEach(key => $(key).value = data[key] || "");
  $("skills").value = JSON.stringify(data.skills || [], null, 2);
  $("projects").value = JSON.stringify(data.projects || [], null, 2);
}

async function loadContent() {
  const data = await api("/api/site", { headers: {} });
  fillForm(data);
}

async function checkSession() {
  try {
    await api("/api/admin/me", { headers: {} });
    showDashboard();
    await loadContent();
  } catch {}
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  loginNotice.textContent = "";
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("password").value }) });
    $("password").value = "";
    showDashboard();
    await loadContent();
  } catch (error) { loginNotice.textContent = error.message; }
});

$("contentForm").addEventListener("submit", async event => {
  event.preventDefault();
  saveNotice.textContent = "";
  const button = $("saveButton");
  button.disabled = true;
  try {
    const content = {
      siteName: $("siteName").value,
      ownerName: $("ownerName").value,
      headline: $("headline").value,
      tagline: $("tagline").value,
      about: $("about").value,
      email: $("email").value,
      skills: JSON.parse($("skills").value),
      projects: JSON.parse($("projects").value)
    };
    await api("/api/admin/site", { method: "PUT", body: JSON.stringify(content) });
    saveNotice.textContent = "تم حفظ التغييرات بنجاح.";
  } catch (error) {
    saveNotice.textContent = error instanceof SyntaxError ? "راجع صيغة JSON في المهارات أو المشاريع." : error.message;
  } finally { button.disabled = false; }
});

$("logoutButton").addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST", body: "{}" }); } catch {}
  dashboard.classList.add("hidden");
  loginPanel.classList.remove("hidden");
});
checkSession();

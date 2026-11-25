const $ = (id) => document.getElementById(id);
const menuButton = $("menuButton");
const nav = $("nav");
menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}));
$("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("light");
  $("themeButton").textContent = document.body.classList.contains("light") ? "☾" : "◐";
});
$("year").textContent = new Date().getFullYear();

function renderCards(target, items, type) {
  const container = $(target);
  container.replaceChildren();
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = type === "project" ? "project-card" : "info-card";
    const label = document.createElement("span");
    label.className = type === "project" ? "project-label" : "card-number";
    label.textContent = type === "project" ? (item.label || `مشروع ${String(index + 1).padStart(2, "0")}`) : String(index + 1).padStart(2, "0");
    const title = document.createElement("h3");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description || "";
    card.append(label, title, description);
    if (type === "project" && item.url) {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "عرض المشروع ↗";
      link.style.cssText = "display:inline-block;margin-top:18px;color:var(--accent);font-weight:700";
      card.append(link);
    }
    container.append(card);
  });
}

fetch("/api/site", { headers: { "Accept": "application/json" } })
  .then(response => { if (!response.ok) throw new Error("Could not load site content"); return response.json(); })
  .then(data => {
    document.title = `${data.siteName || "TATA"} | الموقع الرسمي`;
    $("ownerName").textContent = data.ownerName || "مرحبًا بك في TATA";
    $("headline").textContent = data.headline || "";
    $("tagline").textContent = data.tagline || "";
    $("aboutText").textContent = data.about || "";
    if (Array.isArray(data.skills)) renderCards("skillsList", data.skills, "skill");
    if (Array.isArray(data.projects)) renderCards("projectsList", data.projects, "project");
    if (data.email) $("emailLink").href = `mailto:${data.email}`;
  })
  .catch(error => console.warn("TATA content:", error.message));

/* ============================================================
   APP SHELL — v4 CLEAN FIX
   The loader is ONLY controlled by CSS class, never removed from DOM.
   This prevents the "double overlay" and "removed element" bugs.
   ============================================================ */

/* ─── Theme ──────────────────────────────────────────────────── */
export function initTheme() {
  const stored = localStorage.getItem("rebuild-theme") || "dark";
  document.documentElement.classList.toggle("light-mode", stored === "light");
  document.body.classList.toggle("light-mode", stored === "light");

  const toggle = document.getElementById("themeToggle");
  if (!toggle || toggle.dataset.bound) return;
  toggle.dataset.bound = "true";
  toggle.textContent = stored === "light" ? "🌙 Dark" : "☀️ Light";
  toggle.addEventListener("click", () => {
    const next = document.body.classList.contains("light-mode") ? "dark" : "light";
    localStorage.setItem("rebuild-theme", next);
    document.documentElement.classList.toggle("light-mode", next === "light");
    document.body.classList.toggle("light-mode", next === "light");
    toggle.textContent = next === "light" ? "🌙 Dark" : "☀️ Light";
  });
}

/* ─── Modal ──────────────────────────────────────────────────── */
export function bindModal(openId, modalId, closeId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const open  = () => modal.classList.add("active");
  const close = () => modal.classList.remove("active");
  document.getElementById(openId)?.addEventListener("click", open);
  document.getElementById(closeId)?.addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}
export function openModal(id)  { document.getElementById(id)?.classList.add("active"); }
export function closeModal(id) { document.getElementById(id)?.classList.remove("active"); }

/* ─── Toast ──────────────────────────────────────────────────── */
const ICONS = { success: "✅", warn: "⚠️", error: "❌", info: "ℹ️" };
export function showToast(msg, type = "info", ms = 4500) {
  let host = document.getElementById("toastHost");
  if (!host) { host = document.createElement("div"); host.id = "toastHost"; document.body.appendChild(host); }
  const t = document.createElement("div");
  t.className = `mini-toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${ICONS[type]||"ℹ️"}</span><span class="toast-msg">${String(msg)}</span><button class="toast-close">×</button>`;
  const rm = () => { t.style.opacity="0"; t.style.transform="translateX(14px)"; t.style.transition="all .2s"; setTimeout(()=>t.remove(),220); };
  t.querySelector(".toast-close").addEventListener("click", rm);
  host.appendChild(t);
  setTimeout(rm, ms);
}

/* ─── Loader ─────────────────────────────────────────────────── */
/*
   IMPORTANT: The overlay <div id="pageLoadOverlay"> MUST exist in HTML.
   We only toggle the "hidden" CSS class — we never create or remove it.
   This prevents the duplicate/missing element bug.
*/
export function showLoader() {
  const el = document.getElementById("pageLoadOverlay");
  if (el) el.classList.remove("hidden");
}

export function hideLoader() {
  const el = document.getElementById("pageLoadOverlay");
  if (el) el.classList.add("hidden");
}

/* Safety net — force hide after N ms no matter what */
let _safetyTimer = null;
export function startLoaderSafetyNet(ms = 8000) {
  clearTimeout(_safetyTimer);
  _safetyTimer = setTimeout(() => {
    hideLoader();
    console.warn("[SchoolOS] Loader safety net fired after", ms, "ms");
  }, ms);
}
export function clearLoaderSafetyNet() {
  clearTimeout(_safetyTimer);
}

/* ─── Offline Banner ─────────────────────────────────────────── */
export function initOfflineBanner() {
  const banner = document.getElementById("offlineBanner");
  if (!banner) return;
  const update = () => banner.classList.toggle("visible", !navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/* ─── Confirm ────────────────────────────────────────────────── */
export function confirmAction(msg) {
  return Promise.resolve(window.confirm(msg));
}

/* ─── Bottom Nav Active ──────────────────────────────────────── */
export function markActiveNav() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".bottom-nav a").forEach(a => {
    const file = (a.getAttribute("href") || "").split("?")[0].split("/").pop();
    a.classList.toggle("active", file === page);
  });
}

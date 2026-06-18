/* ============================================================
   APP SHELL — UPGRADED
   Fixes: theme flash, toast stacking with close + icons,
          loading overlay, offline detection, breadcrumbs
   ============================================================ */

/* ─── Theme (applied to <html> to prevent flash) ────────────── */
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

/* Apply theme immediately before any render (call in <head> via inline script) */
(function () {
  const stored = localStorage.getItem("rebuild-theme") || "dark";
  if (stored === "light") {
    document.documentElement.classList.add("light-mode");
  }
})();

/* ─── Modal ──────────────────────────────────────────────────── */
export function bindModal(openBtnId, modalId, closeBtnId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const open  = () => modal.classList.add("active");
  const close = () => modal.classList.remove("active");

  document.getElementById(openBtnId)?.addEventListener("click", open);
  document.getElementById(closeBtnId)?.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

export function openModal(modalId)  { document.getElementById(modalId)?.classList.add("active"); }
export function closeModal(modalId) { document.getElementById(modalId)?.classList.remove("active"); }

/* ─── Toast (stacked, with icon, close button, 4s) ──────────── */
const TOAST_ICONS = { success: "✅", warn: "⚠️", error: "❌", info: "ℹ️" };

export function showToast(message, type = "info", duration = 4000) {
  let wrap = document.getElementById("toastHost");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toastHost";
    document.body.appendChild(wrap);
  }

  const toast = document.createElement("div");
  toast.className = `mini-toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || "ℹ️"}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" aria-label="Close">×</button>
  `;

  const remove = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(12px)";
    toast.style.transition = "all .2s ease";
    setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector(".toast-close").addEventListener("click", remove);
  wrap.appendChild(toast);
  setTimeout(remove, duration);
}

/* ─── Page Loading Overlay ───────────────────────────────────── */
export function showLoader() {
  let overlay = document.getElementById("pageLoadOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pageLoadOverlay";
    overlay.innerHTML = `<div class="loader-ring"></div>`;
    document.body.prepend(overlay);
  }
  overlay.classList.remove("hidden");
}

export function hideLoader() {
  const overlay = document.getElementById("pageLoadOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    setTimeout(() => overlay.remove(), 400);
  }
}

/* ─── Offline Banner ─────────────────────────────────────────── */
export function initOfflineBanner() {
  let banner = document.getElementById("offlineBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "offlineBanner";
    banner.textContent = "⚠️ You are offline. Changes may not save.";
    document.body.prepend(banner);
  }

  const update = () => banner.classList.toggle("visible", !navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/* ─── Confirm Dialog (replace window.confirm) ───────────────── */
export function confirmAction(message) {
  return new Promise((resolve) => {
    if (window.confirm(message)) resolve(true);
    else resolve(false);
  });
}

/* ─── Bottom Nav Active State ────────────────────────────────── */
export function markActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".bottom-nav a").forEach(link => {
    const href = link.getAttribute("href") || "";
    link.classList.toggle("active", href.includes(path));
  });
}

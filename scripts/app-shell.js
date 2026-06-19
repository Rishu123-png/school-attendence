/* ============================================================
   APP SHELL — v3 FIXED
   Fixes: removed IIFE (causes module scope issues),
          hideLoader always works even if overlay missing,
          toast host always appended to body correctly,
          theme flash prevention moved to inline HTML script
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
export function bindModal(openBtnId, modalId, closeBtnId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const open  = () => modal.classList.add("active");
  const close = () => modal.classList.remove("active");
  document.getElementById(openBtnId)?.addEventListener("click", open);
  document.getElementById(closeBtnId)?.addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}
export function openModal(id)  { document.getElementById(id)?.classList.add("active"); }
export function closeModal(id) { document.getElementById(id)?.classList.remove("active"); }

/* ─── Toast ──────────────────────────────────────────────────── */
const TOAST_ICONS = { success:"✅", warn:"⚠️", error:"❌", info:"ℹ️" };

export function showToast(message, type = "info", duration = 4500) {
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
    <span class="toast-msg">${String(message)}</span>
    <button class="toast-close" aria-label="Close">×</button>
  `;
  const remove = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(14px)";
    toast.style.transition = "all .2s ease";
    setTimeout(() => toast.remove(), 220);
  };
  toast.querySelector(".toast-close").addEventListener("click", remove);
  wrap.appendChild(toast);
  setTimeout(remove, duration);
}

/* ─── Loader — FIXED: always hides, never hangs ─────────────── */
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
  /* Try the existing overlay */
  const overlay = document.getElementById("pageLoadOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    /* Remove from DOM after fade */
    setTimeout(() => {
      try { overlay.remove(); } catch (_) { /* ignore */ }
    }, 420);
  }
}

/* Safety net: if anything goes wrong, force-hide after 8 seconds */
let _safetyTimer = null;
export function startLoaderSafetyNet(ms = 8000) {
  clearTimeout(_safetyTimer);
  _safetyTimer = setTimeout(() => {
    hideLoader();
    console.warn("School OS: loader safety net triggered after", ms, "ms");
  }, ms);
}
export function clearLoaderSafetyNet() {
  clearTimeout(_safetyTimer);
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
  window.addEventListener("online",  update);
  window.addEventListener("offline", update);
  update();
}

/* ─── Confirm ────────────────────────────────────────────────── */
export function confirmAction(message) {
  return Promise.resolve(window.confirm(message));
}

/* ─── Bottom Nav Active ───────────────────────────────────────── */
export function markActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".bottom-nav a").forEach(link => {
    const href = link.getAttribute("href") || "";
    const filename = href.split("?")[0].split("/").pop();
    link.classList.toggle("active", filename === path || href.includes(path));
  });
}

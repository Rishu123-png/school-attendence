export function initTheme() {
  const body = document.body;
  const toggle = document.getElementById("themeToggle");
  const stored = localStorage.getItem("rebuild-theme") || "dark";

  const apply = (theme) => {
    body.classList.toggle("light-mode", theme === "light");
    if (toggle) toggle.textContent = theme === "light" ? "🌙 Dark" : "☀️ Light";
  };

  apply(stored);

  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", () => {
      const next = body.classList.contains("light-mode") ? "dark" : "light";
      localStorage.setItem("rebuild-theme", next);
      apply(next);
    });
  }
}

export function bindModal(openBtnId, modalId, closeBtnId) {
  const openBtn = document.getElementById(openBtnId);
  const modal = document.getElementById(modalId);
  const closeBtn = document.getElementById(closeBtnId);
  if (!modal) return;

  openBtn?.addEventListener("click", () => modal.classList.add("active"));
  closeBtn?.addEventListener("click", () => modal.classList.remove("active"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });
}

export function showToast(message, type = "info") {
  const wrap = document.getElementById("toastHost") || document.body;
  const toast = document.createElement("div");
  toast.className = `mini-toast ${type}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}
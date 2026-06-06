// theme.js
export function initTheme() {
  const body = document.body;
  const themeBtn = document.getElementById("themeToggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const applyTheme = () => {
    const storedTheme = localStorage.getItem("theme");
    const isLight = storedTheme === "light";

    body.classList.toggle("light-mode", isLight);

    if (themeBtn) {
      themeBtn.textContent = isLight ? "🌙 Dark Mode" : "☀️ Light Mode";
    }

    if (themeMeta) {
      themeMeta.setAttribute("content", isLight ? "#eef2ff" : "#120d22");
    }
  };

  if (!localStorage.getItem("theme")) {
    localStorage.setItem("theme", "dark");
  }

  if (themeBtn && !themeBtn.dataset.bound) {
    themeBtn.dataset.bound = "true";
    themeBtn.addEventListener("click", () => {
      const nextTheme = body.classList.contains("light-mode") ? "dark" : "light";
      localStorage.setItem("theme", nextTheme);
      applyTheme();
    });
  }

  applyTheme();
}
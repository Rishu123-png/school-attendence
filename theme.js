// theme.js
export function initTheme() {
  const themeBtn = document.getElementById("themeToggle");
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
      localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
    });
  }
}

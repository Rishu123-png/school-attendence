export function initTheme() {
  const btn = document.getElementById("themeToggle");

  if (!btn) {
    console.warn("Theme button not found");
    return;
  }

  // Load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
  }

  // Toggle logic
  btn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");

    const isLight = document.body.classList.contains("light-mode");

    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
}
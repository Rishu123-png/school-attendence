const btn = document.getElementById("themeToggle");

// Toggle theme
btn.addEventListener("click", () => {
  document.body.classList.toggle("light-mode");

  localStorage.setItem(
    "theme",
    document.body.classList.contains("light-mode") ? "light" : "dark"
  );
});

// Load saved theme
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
  }
});
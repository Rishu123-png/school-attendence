export function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("menuToggle");
  const overlay = document.getElementById("sidebarOverlay");

  if (!sidebar || !toggleBtn) return;

  // Toggle open
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
    if (overlay) overlay.classList.add("active");
  });

  // Close
  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
    });
  }

  // ESC close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      sidebar.classList.remove("active");
      if (overlay) overlay.classList.remove("active");
    }
  });

  // 🔥 ACTIVE PAGE LOGIC
  const currentPage = window.location.pathname;

  const buttons = sidebar.querySelectorAll(".sidebar-menu button[data-page]");

  buttons.forEach(btn => {
  const page = btn.getAttribute("data-page");

  if (
    (page === "dashboard" && currentPage.includes("dashboard")) ||
    (page === "add-student" && currentPage.includes("add-students")) ||
    (page === "attendance" && currentPage.includes("mark-attendance")) ||
    (page === "marks" && currentPage.includes("marks"))
  ) {
    btn.classList.add("active");
  }
});
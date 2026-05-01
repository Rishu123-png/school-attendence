


export function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("menuToggle");
  const overlay = document.getElementById("sidebarOverlay");

  if (!sidebar || !toggleBtn) {
    console.warn("Sidebar elements not found");
    return;
  }

  // 🔹 Open sidebar
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
    if (overlay) overlay.classList.add("active");
  });

  // 🔹 Close sidebar (overlay click)
  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
    });
  }

  // 🔹 Close on ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      sidebar.classList.remove("active");
      if (overlay) overlay.classList.remove("active");
    }
  });

  // 🔹 Swipe close (mobile premium feature)
  let startX = 0;
  sidebar.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  sidebar.addEventListener("touchmove", (e) => {
    let currentX = e.touches[0].clientX;
    if (currentX - startX < -50) {
      sidebar.classList.remove("active");
      if (overlay) overlay.classList.remove("active");
    }
  });
}
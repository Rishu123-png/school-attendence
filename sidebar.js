// sidebar.js
import { auth, db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function closeSidebar(sidebar, overlay) {
  sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
}

function markActiveButtons(sidebar) {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  sidebar.querySelectorAll(".sidebar-menu button[data-page]").forEach(btn => {
    const page = btn.getAttribute("data-page");
    const isActive =
      (page === "dashboard" && currentPage.includes("dashboard")) ||
      (page === "add-student" && currentPage.includes("add-students")) ||
      (page === "attendance" && currentPage.includes("mark-attendance")) ||
      (page === "marks" && currentPage.includes("marks")) ||
      (page === "school-admin" && currentPage.includes("school-admin")) ||
      (page === "school-setup" && currentPage.includes("school-setup")) ||
      (page === "teachers-manage" && currentPage.includes("teachers-manage")) ||
      (page === "classes-manage" && currentPage.includes("classes-manage")) ||
      (page === "students-manage" && currentPage.includes("students-manage")) ||
      (page === "subjects-manage" && currentPage.includes("subjects-manage")) ||
      (page === "timetable-manage" && currentPage.includes("timetable-manage")) ||
      (page === "teacher-schedule" && currentPage.includes("teacher-schedule")) ||
      (page === "period-attendance" && currentPage.includes("period-attendance")) ||
      (page === "assignments-manage" && currentPage.includes("teacher-assignments"));

    btn.classList.toggle("active", isActive);
  });
}

function makeSidebarButton({ label, page, href }) {
  const btn = document.createElement("button");
  btn.dataset.page = page;
  btn.textContent = label;
  btn.onclick = () => {
    window.location.href = href;
  };
  return btn;
}

async function injectAdminLinks(sidebar) {
  const menu = sidebar.querySelector(".sidebar-menu");
  if (!menu || menu.dataset.adminLinksInjected === "true") return;
  menu.dataset.adminLinksInjected = "true";

  if (!auth.currentUser) return;

  try {
    const snap = await get(ref(db, `userProfiles/${auth.currentUser.uid}`));
    if (!snap.exists()) return;

    const profile = snap.val() || {};
    if (profile.role !== "schoolAdmin") return;

    const schoolId = profile.schoolId || new URLSearchParams(window.location.search).get("schoolId") || "";
    const withSchoolId = (fileName) => schoolId ? `${fileName}?schoolId=${encodeURIComponent(schoolId)}` : "school-setup.html";

    const separator = document.createElement("div");
    separator.textContent = "School Admin";
    separator.style.cssText = "margin:14px 6px 8px;color:rgba(255,255,255,0.45);font-size:12px;text-transform:uppercase;letter-spacing:1px;";
    menu.appendChild(separator);

    const adminLinks = [
      { label: "🏫 School Admin", page: "school-admin", href: withSchoolId("school-admin.html") },
      { label: "🧩 School Setup", page: "school-setup", href: "school-setup.html" },
      { label: "👨‍🏫 Teachers", page: "teachers-manage", href: withSchoolId("teachers-manage.html") },
      { label: "🎓 Students", page: "students-manage", href: withSchoolId("students-manage.html") },
      { label: "🏫 Classes", page: "classes-manage", href: withSchoolId("classes-manage.html") },
      { label: "📚 Subjects", page: "subjects-manage", href: withSchoolId("subjects-manage.html") },
      { label: "🗓️ Timetable", page: "timetable-manage", href: withSchoolId("timetable-manage.html") },
      { label: "🧭 Teacher Schedule", page: "teacher-schedule", href: withSchoolId("teacher-schedule.html") },
      { label: "📌 Period Attendance", page: "period-attendance", href: withSchoolId("period-attendance.html") },
      { label: "🧩 Assignments", page: "assignments-manage", href: withSchoolId("teacher-assignments.html") }
    ];

    adminLinks.forEach(link => menu.appendChild(makeSidebarButton(link)));
    markActiveButtons(sidebar);
  } catch (error) {
    console.warn("Failed to inject admin sidebar links", error);
  }
}

export async function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("menuToggle");
  const overlay = document.getElementById("sidebarOverlay");

  if (!sidebar || !toggleBtn) return;

  if (!toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = "true";
    toggleBtn.addEventListener("click", () => {
      const isOpen = sidebar.classList.contains("active");
      if (isOpen) closeSidebar(sidebar, overlay);
      else {
        sidebar.classList.add("active");
        if (overlay) overlay.classList.add("active");
      }
    });
  }

  if (overlay && !overlay.dataset.bound) {
    overlay.dataset.bound = "true";
    overlay.addEventListener("click", () => {
      closeSidebar(sidebar, overlay);
    });
  }

  if (!document.body.dataset.sidebarEscBound) {
    document.body.dataset.sidebarEscBound = "true";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSidebar(sidebar, overlay);
      }
    });
  }

  markActiveButtons(sidebar);
  await injectAdminLinks(sidebar);
}

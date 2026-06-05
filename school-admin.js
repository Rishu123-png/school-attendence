// school-admin.js — starter dashboard for the future multi-school admin panel
import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { requireAuth, getCurrentUserProfile, getSchoolDashboardData } from "./school-service.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? '');
}

function wireShortcut(id, fileName, schoolId) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.location.href = `${fileName}?schoolId=${encodeURIComponent(schoolId)}`;
  });
}

async function init() {
  initTheme();

  requireAuth(async () => {
    showLoading('Loading school admin dashboard…');
    try {
      const profile = await getCurrentUserProfile();
      const fromQuery = new URLSearchParams(window.location.search).get('schoolId');
      const schoolId = fromQuery || profile?.schoolId;

      if (!schoolId) {
        showToast('No school profile found for this account.', 'warning');
        setTimeout(() => window.location.href = 'school-setup.html', 800);
        return;
      }

      const data = await getSchoolDashboardData(schoolId);
      if (!data) {
        showToast('School workspace not found.', 'error');
        return;
      }

      setText('schoolAdminSchoolName', data.profile.name || 'School');
      setText('schoolAdminSchoolCode', data.profile.code || schoolId);
      setText('schoolAdminCityState', [data.profile.city, data.profile.state].filter(Boolean).join(', ') || 'Location not set');
      setText('schoolCountAdmins', data.counts.admins);
      setText('schoolCountTeachers', data.counts.teachers);
      setText('schoolCountStudents', data.counts.students);
      setText('schoolCountClasses', data.counts.classes);
      setText('schoolCountSubjects', data.counts.subjects);
      setText('schoolCountNotices', data.counts.notices);
      setText('schoolCurrentId', schoolId);

      wireShortcut('manageTeachersBtn', 'teachers-manage.html', schoolId);
      wireShortcut('manageClassesBtn', 'classes-manage.html', schoolId);
      wireShortcut('manageSubjectsBtn', 'subjects-manage.html', schoolId);
      wireShortcut('manageAssignmentsBtn', 'teacher-assignments.html', schoolId);
    } catch (error) {
      console.error(error);
      showToast('Failed to load school dashboard', 'error');
    } finally {
      hideLoading();
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
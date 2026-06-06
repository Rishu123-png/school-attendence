// school-admin.js — school admin dashboard with teachers + students preview
import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import {
  requireAuth,
  getCurrentUserProfile,
  getSchoolDashboardData,
  listSchoolCollection,
  listVisibleSchoolStudents
} from "./school-service.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? '');
}

function makeNavHandler(id, fileName, schoolId) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.location.href = `${fileName}?schoolId=${encodeURIComponent(schoolId)}`;
  });
}

function renderEmptyRow(tbody, colSpan, message) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = colSpan;
  td.textContent = message;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function renderTeacherPreview(rows) {
  const tbody = document.querySelector('#schoolTeachersPreviewTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    renderEmptyRow(tbody, 5, 'No school teachers found yet.');
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    [row.name, row.email, row.subject, row.role, row.status].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderStudentPreview(rows) {
  const tbody = document.querySelector('#schoolStudentsPreviewTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    renderEmptyRow(tbody, 5, 'No school students found yet. Use Student Management to add them.');
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const classLabel = row.classId || row.class || '—';
    const sourceLabel = row.source === 'legacy' ? 'Legacy root data' : 'School workspace';
    [row.fullName, classLabel, row.section || '—', row.rollNo || '—', sourceLabel].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
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

      const [data, teachers, students] = await Promise.all([
        getSchoolDashboardData(schoolId),
        listSchoolCollection(schoolId, 'teachers', 'teacherId'),
        listVisibleSchoolStudents(schoolId)
      ]);

      if (!data) {
        showToast('School workspace not found.', 'error');
        return;
      }

      setText('schoolAdminSchoolName', data.profile.name || 'School');
      setText('schoolAdminSchoolCode', data.profile.code || schoolId);
      setText('schoolAdminCityState', [data.profile.city, data.profile.state].filter(Boolean).join(', ') || 'Location not set');
      setText('schoolCountAdmins', data.counts.admins);
      setText('schoolCountTeachers', teachers.length || data.counts.teachers);
      setText('schoolCountStudents', students.length || data.counts.students);
      setText('schoolCountClasses', data.counts.classes);
      setText('schoolCountSubjects', data.counts.subjects);
      setText('schoolCountNotices', data.counts.notices);
      setText('schoolCurrentId', schoolId);

      renderTeacherPreview(teachers);
      renderStudentPreview(students);

      makeNavHandler('manageTeachersBtn', 'teachers-manage.html', schoolId);
      makeNavHandler('manageStudentsBtn', 'students-manage.html', schoolId);
      makeNavHandler('manageClassesBtn', 'classes-manage.html', schoolId);
      makeNavHandler('manageSubjectsBtn', 'subjects-manage.html', schoolId);
      makeNavHandler('manageAssignmentsBtn', 'teacher-assignments.html', schoolId);
      makeNavHandler('openTeachersPageBtn', 'teachers-manage.html', schoolId);
      makeNavHandler('openStudentsPageBtn', 'students-manage.html', schoolId);
    } catch (error) {
      console.error(error);
      showToast('Failed to load school dashboard', 'error');
    } finally {
      hideLoading();
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
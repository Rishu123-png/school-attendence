import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createTeacherRecord,
  listSchoolCollection,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function renderTeachers(rows) {
  const tbody = document.querySelector('#teachersTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'No teachers added yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    [row.name, row.email, row.subject, row.classesText, row.status, row.teacherId].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function refreshTeachers() {
  showLoading('Loading teachers…');
  try {
    const teachers = await listSchoolCollection(activeSchoolId, 'teachers', 'teacherId');
    const sorted = teachers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    renderTeachers(sorted);
  } catch (error) {
    console.error(error);
    showToast('Failed to load teachers', 'error');
  } finally {
    hideLoading();
  }
}

async function init() {
  initTheme();
  requireAuth(async () => {
    activeSchoolId = await resolveActiveSchoolId();
    if (!activeSchoolId) {
      showToast('No school selected', 'warning');
      return;
    }

    const schoolText = document.getElementById('teachersManageSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;
    document.getElementById('teachersBackToAdminBtn')?.addEventListener('click', goBack);
    document.getElementById('teachersRefreshBtn')?.addEventListener('click', refreshTeachers);

    document.getElementById('teacherForm')?.addEventListener('submit', async e => {
      e.preventDefault();

      const payload = {
        name: normalizeWhitespace(document.getElementById('teacherNameInput')?.value || ''),
        email: normalizeWhitespace(document.getElementById('teacherEmailInput')?.value || ''),
        subject: normalizeWhitespace(document.getElementById('teacherSubjectInput')?.value || ''),
        authUid: normalizeWhitespace(document.getElementById('teacherAuthUidInput')?.value || ''),
        classesText: normalizeWhitespace(document.getElementById('teacherClassesInput')?.value || '')
      };

      if (!payload.name || !payload.email) {
        showToast('Teacher name and email are required.', 'warning');
        return;
      }

      showLoading('Saving teacher…');
      try {
        const teacher = await createTeacherRecord(activeSchoolId, payload);
        await logAudit('school.teacher.create', { schoolId: activeSchoolId, teacherId: teacher.teacherId });
        showToast('Teacher record saved');
        document.getElementById('teacherForm')?.reset();
        await refreshTeachers();
      } catch (error) {
        console.error(error);
        showToast('Failed to save teacher', 'error');
      } finally {
        hideLoading();
      }
    });

    await refreshTeachers();
  });
}

window.addEventListener('DOMContentLoaded', init);
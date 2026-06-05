import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createSubjectRecord,
  listSchoolCollection,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function renderSubjects(rows) {
  const tbody = document.querySelector('#subjectsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No subjects added yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    [row.name, row.code, row.type, row.status, row.subjectId].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function refreshSubjects() {
  showLoading('Loading subjects…');
  try {
    const subjects = await listSchoolCollection(activeSchoolId, 'subjects', 'subjectId');
    const sorted = subjects.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    renderSubjects(sorted);
  } catch (error) {
    console.error(error);
    showToast('Failed to load subjects', 'error');
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

    const schoolText = document.getElementById('subjectsManageSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;
    document.getElementById('subjectsBackToAdminBtn')?.addEventListener('click', goBack);
    document.getElementById('subjectsRefreshBtn')?.addEventListener('click', refreshSubjects);

    document.getElementById('subjectForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        name: normalizeWhitespace(document.getElementById('subjectNameInput')?.value || ''),
        code: normalizeWhitespace(document.getElementById('subjectCodeInput')?.value || ''),
        type: normalizeWhitespace(document.getElementById('subjectTypeInput')?.value || 'core')
      };

      if (!payload.name || !payload.code) {
        showToast('Subject name and code are required.', 'warning');
        return;
      }

      showLoading('Saving subject…');
      try {
        const subject = await createSubjectRecord(activeSchoolId, payload);
        await logAudit('school.subject.create', { schoolId: activeSchoolId, subjectId: subject.subjectId });
        showToast('Subject saved');
        document.getElementById('subjectForm')?.reset();
        await refreshSubjects();
      } catch (error) {
        console.error(error);
        showToast('Failed to save subject', 'error');
      } finally {
        hideLoading();
      }
    });

    await refreshSubjects();
  });
}

window.addEventListener('DOMContentLoaded', init);
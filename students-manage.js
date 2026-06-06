import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createStudentRecord,
  listSchoolCollection,
  listVisibleSchoolStudents,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';
let classMap = new Map();

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function fillClassSelect(classes) {
  const select = document.getElementById('schoolStudentClassSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Select class --</option>';
  classMap = new Map();
  classes.forEach(item => {
    classMap.set(item.classId, item);
    const option = document.createElement('option');
    option.value = item.classId;
    option.textContent = item.displayName || item.name || item.classId;
    select.appendChild(option);
  });
}

function renderStudents(rows) {
  const tbody = document.querySelector('#studentsManageTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'No students found yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || row.class || '—';
    const sourceLabel = row.source === 'legacy' ? 'Legacy root data' : 'School workspace';
    [row.fullName, classLabel, row.section || '—', row.rollNo || '—', row.admissionNo || '—', sourceLabel].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function refreshAll() {
  showLoading('Loading students…');
  try {
    const [classes, students] = await Promise.all([
      listSchoolCollection(activeSchoolId, 'classes', 'classId'),
      listVisibleSchoolStudents(activeSchoolId)
    ]);
    const sortedClasses = classes.sort((a, b) => String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || '')));
    fillClassSelect(sortedClasses);
    renderStudents(students);
  } catch (error) {
    console.error(error);
    showToast('Failed to load students', 'error');
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

    const schoolText = document.getElementById('studentsManageSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;

    document.getElementById('studentsBackToAdminBtn')?.addEventListener('click', goBack);
    document.getElementById('studentsRefreshBtn')?.addEventListener('click', refreshAll);

    document.getElementById('studentManageForm')?.addEventListener('submit', async e => {
      e.preventDefault();

      const payload = {
        fullName: normalizeWhitespace(document.getElementById('schoolStudentNameInput')?.value || ''),
        classId: normalizeWhitespace(document.getElementById('schoolStudentClassSelect')?.value || ''),
        section: normalizeWhitespace(document.getElementById('schoolStudentSectionInput')?.value || ''),
        rollNo: normalizeWhitespace(document.getElementById('schoolStudentRollInput')?.value || ''),
        admissionNo: normalizeWhitespace(document.getElementById('schoolStudentAdmissionInput')?.value || '')
      };

      if (!payload.fullName || !payload.classId) {
        showToast('Student name and class are required.', 'warning');
        return;
      }

      showLoading('Saving student…');
      try {
        const record = await createStudentRecord(activeSchoolId, payload);
        await logAudit('school.student.create', { schoolId: activeSchoolId, studentId: record.studentId });
        showToast('Student saved');
        document.getElementById('studentManageForm')?.reset();
        await refreshAll();
      } catch (error) {
        console.error(error);
        showToast('Failed to save student', 'error');
      } finally {
        hideLoading();
      }
    });

    await refreshAll();
  });
}

window.addEventListener('DOMContentLoaded', init);
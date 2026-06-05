import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createTeacherAssignmentRecord,
  listSchoolCollection,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';
let teacherMap = new Map();
let classMap = new Map();
let subjectMap = new Map();

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function refillSelect(selectId, items, getId, getLabel, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = getId(item);
    option.textContent = getLabel(item);
    select.appendChild(option);
  });
}

function renderAssignments(rows) {
  const tbody = document.querySelector('#assignmentsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No assignments added yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const teacherName = teacherMap.get(row.teacherId)?.name || row.teacherId;
    const className = classMap.get(row.classId)?.displayName || row.classId;
    const subjectName = subjectMap.get(row.subjectId)?.name || row.subjectId;
    [teacherName, className, subjectName, row.status, row.assignmentId].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function refreshAssignments() {
  showLoading('Loading assignments…');
  try {
    const [teachers, classes, subjects, assignments] = await Promise.all([
      listSchoolCollection(activeSchoolId, 'teachers', 'teacherId'),
      listSchoolCollection(activeSchoolId, 'classes', 'classId'),
      listSchoolCollection(activeSchoolId, 'subjects', 'subjectId'),
      listSchoolCollection(activeSchoolId, 'teacherAssignments', 'assignmentId')
    ]);

    teacherMap = new Map(teachers.map(item => [item.teacherId, item]));
    classMap = new Map(classes.map(item => [item.classId, item]));
    subjectMap = new Map(subjects.map(item => [item.subjectId, item]));

    refillSelect('assignmentTeacherSelect', teachers, i => i.teacherId, i => i.name || i.teacherId, '-- Select teacher --');
    refillSelect('assignmentClassSelect', classes, i => i.classId, i => i.displayName || i.name || i.classId, '-- Select class --');
    refillSelect('assignmentSubjectSelect', subjects, i => i.subjectId, i => i.name || i.subjectId, '-- Select subject --');

    const sortedAssignments = assignments.sort((a, b) => String(a.assignmentId || '').localeCompare(String(b.assignmentId || '')));
    renderAssignments(sortedAssignments);
  } catch (error) {
    console.error(error);
    showToast('Failed to load assignments', 'error');
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

    const schoolText = document.getElementById('assignmentsManageSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;
    document.getElementById('assignmentsBackToAdminBtn')?.addEventListener('click', goBack);
    document.getElementById('assignmentsRefreshBtn')?.addEventListener('click', refreshAssignments);

    document.getElementById('assignmentForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        teacherId: normalizeWhitespace(document.getElementById('assignmentTeacherSelect')?.value || ''),
        classId: normalizeWhitespace(document.getElementById('assignmentClassSelect')?.value || ''),
        subjectId: normalizeWhitespace(document.getElementById('assignmentSubjectSelect')?.value || '')
      };

      if (!payload.teacherId || !payload.classId || !payload.subjectId) {
        showToast('Teacher, class and subject are required.', 'warning');
        return;
      }

      showLoading('Saving assignment…');
      try {
        const result = await createTeacherAssignmentRecord(activeSchoolId, payload);
        await logAudit('school.assignment.create', { schoolId: activeSchoolId, assignmentId: result.assignmentId });
        showToast('Assignment saved');
        document.getElementById('assignmentForm')?.reset();
        await refreshAssignments();
      } catch (error) {
        console.error(error);
        showToast('Failed to save assignment', 'error');
      } finally {
        hideLoading();
      }
    });

    await refreshAssignments();
  });
}

window.addEventListener('DOMContentLoaded', init);
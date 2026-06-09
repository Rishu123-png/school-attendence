import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading, showConfirm } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createStudentRecord,
  updateStudentRecord,
  deleteStudentRecord,
  listSchoolCollection,
  listVisibleSchoolStudents,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';
let classMap = new Map();
let subjectMap = new Map();
let editingStudentId = '';

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function fillClassSelect(classes) {
  const select = document.getElementById('schoolStudentClassSelect');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Select class --</option>';
  classMap = new Map();
  classes.forEach(item => {
    classMap.set(item.classId, item);
    const option = document.createElement('option');
    option.value = item.classId;
    option.textContent = item.displayName || item.name || item.classId;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function fillSubjectsSelect(subjects) {
  const select = document.getElementById('schoolStudentSubjectsSelect');
  if (!select) return;
  const current = new Set(Array.from(select.selectedOptions).map(option => option.value));
  select.innerHTML = '';
  subjectMap = new Map();
  subjects.forEach(item => {
    subjectMap.set(item.subjectId, item);
    const option = document.createElement('option');
    option.value = item.subjectId;
    option.textContent = `${item.name || item.subjectId}${item.code ? ` (${item.code})` : ''}`;
    if (current.has(item.subjectId)) option.selected = true;
    select.appendChild(option);
  });
}

function getSelectedSubjects() {
  const select = document.getElementById('schoolStudentSubjectsSelect');
  if (!select) return { ids: [], names: [] };
  const selectedOptions = Array.from(select.selectedOptions);
  return {
    ids: selectedOptions.map(option => option.value),
    names: selectedOptions.map(option => option.textContent.replace(/\s*\([^)]*\)\s*$/, ''))
  };
}

function setSelectedSubjects(subjectIds = []) {
  const select = document.getElementById('schoolStudentSubjectsSelect');
  if (!select) return;
  const set = new Set(subjectIds || []);
  Array.from(select.options).forEach(option => {
    option.selected = set.has(option.value);
  });
}

function resetStudentForm() {
  editingStudentId = '';
  document.getElementById('studentManageForm')?.reset();
  const title = document.getElementById('studentFormTitle');
  const hint = document.getElementById('studentFormHint');
  const badge = document.getElementById('studentEditBadge');
  const submitBtn = document.getElementById('studentSubmitBtn');
  const cancelBtn = document.getElementById('studentsCancelEditBtn');
  if (title) title.textContent = 'Add Student Record';
  if (hint) hint.innerHTML = 'This saves the student inside <strong>schools/&lt;schoolId&gt;/students</strong>.';
  if (badge) badge.style.display = 'none';
  if (submitBtn) submitBtn.textContent = '➕ Save Student';
  if (cancelBtn) cancelBtn.style.display = 'none';
  setSelectedSubjects([]);
}

function startEditStudent(row) {
  editingStudentId = row.studentId;
  document.getElementById('schoolStudentNameInput').value = row.fullName || '';
  document.getElementById('schoolStudentClassSelect').value = row.classId || '';
  document.getElementById('schoolStudentSectionInput').value = row.section || '';
  document.getElementById('schoolStudentRollInput').value = row.rollNo || '';
  document.getElementById('schoolStudentAdmissionInput').value = row.admissionNo || '';
  document.getElementById('schoolStudentSubjectGroupInput').value = row.subjectGroup || '';
  setSelectedSubjects(row.selectedSubjectIds || []);
  const title = document.getElementById('studentFormTitle');
  const hint = document.getElementById('studentFormHint');
  const badge = document.getElementById('studentEditBadge');
  const submitBtn = document.getElementById('studentSubmitBtn');
  const cancelBtn = document.getElementById('studentsCancelEditBtn');
  if (title) title.textContent = `Edit Student — ${row.fullName || row.studentId}`;
  if (hint) hint.textContent = 'Update class, section, roll no, admission no, or optional subject group for this student.';
  if (badge) badge.style.display = 'inline-flex';
  if (submitBtn) submitBtn.textContent = '💾 Update Student';
  if (cancelBtn) cancelBtn.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStudents(rows) {
  const tbody = document.querySelector('#studentsManageTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.textContent = 'No students found yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || row.class || '—';
    const sourceLabel = row.source === 'legacy' ? 'Legacy root data' : 'School workspace';
    const subjectsLabel = (row.selectedSubjectNames || []).length ? row.selectedSubjectNames.join(', ') : '—';
    [row.fullName, classLabel, row.section || '—', row.rollNo || '—', row.admissionNo || '—', row.subjectGroup || '—', subjectsLabel, sourceLabel].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });

    const actionsTd = document.createElement('td');
    actionsTd.style.display = 'flex';
    actionsTd.style.gap = '8px';
    actionsTd.style.flexWrap = 'wrap';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-ghost';
    editBtn.type = 'button';
    editBtn.textContent = '✏️ Edit';
    editBtn.style.padding = '8px 12px';
    editBtn.onclick = () => startEditStudent(row);

    actionsTd.appendChild(editBtn);

    if (row.source !== 'legacy') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-ghost';
      deleteBtn.type = 'button';
      deleteBtn.textContent = '🗑️ Delete';
      deleteBtn.style.padding = '8px 12px';
      deleteBtn.onclick = () => {
        showConfirm(`Delete student \"${row.fullName || row.studentId}\"?`, async () => {
          showLoading('Deleting student…');
          try {
            await deleteStudentRecord(activeSchoolId, row.studentId);
            await logAudit('school.student.delete', { schoolId: activeSchoolId, studentId: row.studentId });
            if (editingStudentId === row.studentId) resetStudentForm();
            showToast('Student deleted');
            await refreshAll();
          } catch (error) {
            console.error(error);
            showToast('Failed to delete student', 'error');
          } finally {
            hideLoading();
          }
        });
      };
      actionsTd.appendChild(deleteBtn);
    }

    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

async function refreshAll() {
  showLoading('Loading students…');
  try {
    const [classes, subjects, students] = await Promise.all([
      listSchoolCollection(activeSchoolId, 'classes', 'classId'),
      listSchoolCollection(activeSchoolId, 'subjects', 'subjectId'),
      listVisibleSchoolStudents(activeSchoolId)
    ]);
    const sortedClasses = classes.sort((a, b) => String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || '')));
    const sortedSubjects = subjects.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    fillClassSelect(sortedClasses);
    fillSubjectsSelect(sortedSubjects);
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
    document.getElementById('studentsCancelEditBtn')?.addEventListener('click', resetStudentForm);

    document.getElementById('studentManageForm')?.addEventListener('submit', async e => {
      e.preventDefault();

      const selectedSubjects = getSelectedSubjects();
      const payload = {
        fullName: normalizeWhitespace(document.getElementById('schoolStudentNameInput')?.value || ''),
        classId: normalizeWhitespace(document.getElementById('schoolStudentClassSelect')?.value || ''),
        section: normalizeWhitespace(document.getElementById('schoolStudentSectionInput')?.value || ''),
        rollNo: normalizeWhitespace(document.getElementById('schoolStudentRollInput')?.value || ''),
        admissionNo: normalizeWhitespace(document.getElementById('schoolStudentAdmissionInput')?.value || ''),
        subjectGroup: normalizeWhitespace(document.getElementById('schoolStudentSubjectGroupInput')?.value || ''),
        selectedSubjectIds: selectedSubjects.ids,
        selectedSubjectNames: selectedSubjects.names
      };

      if (!payload.fullName || !payload.classId) {
        showToast('Student name and class are required.', 'warning');
        return;
      }
      if (!payload.selectedSubjectIds.length) {
        showToast('Select at least one subject for the student.', 'warning');
        return;
      }

      showLoading(editingStudentId ? 'Updating student…' : 'Saving student…');
      try {
        let record;
        if (editingStudentId) {
          record = await updateStudentRecord(activeSchoolId, editingStudentId, payload);
          await logAudit('school.student.update', { schoolId: activeSchoolId, studentId: record.studentId });
          showToast('Student updated');
        } else {
          record = await createStudentRecord(activeSchoolId, payload);
          await logAudit('school.student.create', { schoolId: activeSchoolId, studentId: record.studentId });
          showToast('Student saved');
        }
        resetStudentForm();
        await refreshAll();
      } catch (error) {
        console.error(error);
        showToast(editingStudentId ? 'Failed to update student' : 'Failed to save student', 'error');
      } finally {
        hideLoading();
      }
    });

    resetStudentForm();
    await refreshAll();
  });
}

window.addEventListener('DOMContentLoaded', init);

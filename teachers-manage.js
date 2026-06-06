import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading, showConfirm } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createTeacherRecord,
  updateTeacherRecord,
  deleteTeacherRecord,
  listSchoolCollection,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';
let editingTeacherId = '';
let teachersCache = [];

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function getPayloadFromForm() {
  return {
    name: normalizeWhitespace(document.getElementById('teacherNameInput')?.value || ''),
    email: normalizeWhitespace(document.getElementById('teacherEmailInput')?.value || ''),
    subject: normalizeWhitespace(document.getElementById('teacherSubjectInput')?.value || ''),
    authUid: normalizeWhitespace(document.getElementById('teacherAuthUidInput')?.value || ''),
    classesText: normalizeWhitespace(document.getElementById('teacherClassesInput')?.value || ''),
    role: normalizeWhitespace(document.getElementById('teacherRoleInput')?.value || 'teacher'),
    status: normalizeWhitespace(document.getElementById('teacherStatusInput')?.value || 'active')
  };
}

function resetTeacherForm() {
  editingTeacherId = '';
  document.getElementById('teacherForm')?.reset();
  const submitBtn = document.getElementById('teacherSubmitBtn');
  const cancelBtn = document.getElementById('teachersCancelEditBtn');
  const badge = document.getElementById('teacherEditBadge');
  const title = document.getElementById('teacherFormTitle');
  const hint = document.getElementById('teacherFormHint');

  if (submitBtn) submitBtn.textContent = '➕ Save Teacher';
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (badge) badge.style.display = 'none';
  if (title) title.textContent = 'Add Teacher Record';
  if (hint) hint.textContent = 'Create a teacher record now. You can later link it with real Firebase Auth users too.';
  const role = document.getElementById('teacherRoleInput');
  const status = document.getElementById('teacherStatusInput');
  if (role) role.value = 'teacher';
  if (status) status.value = 'active';
}

function startEditTeacher(row) {
  editingTeacherId = row.teacherId;
  document.getElementById('teacherNameInput').value = row.name || '';
  document.getElementById('teacherEmailInput').value = row.email || '';
  document.getElementById('teacherSubjectInput').value = row.subject || '';
  document.getElementById('teacherAuthUidInput').value = row.authUid || '';
  document.getElementById('teacherClassesInput').value = row.classesText || '';
  document.getElementById('teacherRoleInput').value = row.role || 'teacher';
  document.getElementById('teacherStatusInput').value = row.status || 'active';

  const submitBtn = document.getElementById('teacherSubmitBtn');
  const cancelBtn = document.getElementById('teachersCancelEditBtn');
  const badge = document.getElementById('teacherEditBadge');
  const title = document.getElementById('teacherFormTitle');
  const hint = document.getElementById('teacherFormHint');

  if (submitBtn) submitBtn.textContent = '💾 Update Teacher';
  if (cancelBtn) cancelBtn.style.display = '';
  if (badge) badge.style.display = 'inline-flex';
  if (title) title.textContent = `Edit Teacher — ${row.name || row.teacherId}`;
  if (hint) hint.textContent = 'Update name, email, subject, classes, auth UID, role, or status and save again.';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTeachers(rows) {
  const tbody = document.querySelector('#teachersTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = 'No teachers added yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    [row.name, row.email, row.subject, row.classesText, row.authUid, row.role, row.status].forEach(value => {
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
    editBtn.onclick = () => startEditTeacher(row);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-ghost';
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.style.padding = '8px 12px';
    deleteBtn.onclick = () => {
      showConfirm(`Delete teacher \"${row.name || row.teacherId}\"? Linked assignments for this teacher will also be removed.`, async () => {
        showLoading('Deleting teacher…');
        try {
          await deleteTeacherRecord(activeSchoolId, row.teacherId);
          await logAudit('school.teacher.delete', { schoolId: activeSchoolId, teacherId: row.teacherId });
          if (editingTeacherId === row.teacherId) resetTeacherForm();
          showToast('Teacher deleted');
          await refreshTeachers();
        } catch (error) {
          console.error(error);
          showToast('Failed to delete teacher', 'error');
        } finally {
          hideLoading();
        }
      });
    };

    actionsTd.append(editBtn, deleteBtn);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

async function refreshTeachers() {
  showLoading('Loading teachers…');
  try {
    const teachers = await listSchoolCollection(activeSchoolId, 'teachers', 'teacherId');
    teachersCache = teachers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    renderTeachers(teachersCache);
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
    document.getElementById('teachersCancelEditBtn')?.addEventListener('click', resetTeacherForm);

    document.getElementById('teacherForm')?.addEventListener('submit', async e => {
      e.preventDefault();

      const payload = getPayloadFromForm();
      if (!payload.name || !payload.email) {
        showToast('Teacher name and email are required.', 'warning');
        return;
      }

      showLoading(editingTeacherId ? 'Updating teacher…' : 'Saving teacher…');
      try {
        if (editingTeacherId) {
          const teacher = await updateTeacherRecord(activeSchoolId, editingTeacherId, payload);
          await logAudit('school.teacher.update', { schoolId: activeSchoolId, teacherId: teacher.teacherId });
          showToast('Teacher updated');
        } else {
          const teacher = await createTeacherRecord(activeSchoolId, payload);
          await logAudit('school.teacher.create', { schoolId: activeSchoolId, teacherId: teacher.teacherId });
          showToast('Teacher record saved');
        }
        resetTeacherForm();
        await refreshTeachers();
      } catch (error) {
        console.error(error);
        showToast(editingTeacherId ? 'Failed to update teacher' : 'Failed to save teacher', 'error');
      } finally {
        hideLoading();
      }
    });

    resetTeacherForm();
    await refreshTeachers();
  });
}

window.addEventListener('DOMContentLoaded', init);
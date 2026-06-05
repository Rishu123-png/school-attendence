import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createClassRecord,
  listSchoolCollection,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';
let teacherMap = new Map();

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function fillTeacherSelect(teachers) {
  const select = document.getElementById('classTeacherSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Optional --</option>';
  teacherMap = new Map();
  teachers.forEach(teacher => {
    teacherMap.set(teacher.teacherId, teacher);
    const option = document.createElement('option');
    option.value = teacher.teacherId;
    option.textContent = `${teacher.name || 'Teacher'}${teacher.subject ? ` (${teacher.subject})` : ''}`;
    select.appendChild(option);
  });
}

function renderClasses(rows) {
  const tbody = document.querySelector('#classesTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No classes added yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const teacher = teacherMap.get(row.classTeacherId);
    [row.displayName || row.name, row.roomNo, teacher?.name || '—', row.status, row.classId].forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function refreshAll() {
  showLoading('Loading classes…');
  try {
    const [teachers, classes] = await Promise.all([
      listSchoolCollection(activeSchoolId, 'teachers', 'teacherId'),
      listSchoolCollection(activeSchoolId, 'classes', 'classId')
    ]);

    const sortedTeachers = teachers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const sortedClasses = classes.sort((a, b) => String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || '')));
    fillTeacherSelect(sortedTeachers);
    renderClasses(sortedClasses);
  } catch (error) {
    console.error(error);
    showToast('Failed to load classes', 'error');
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

    const schoolText = document.getElementById('classesManageSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;
    document.getElementById('classesBackToAdminBtn')?.addEventListener('click', goBack);
    document.getElementById('classesRefreshBtn')?.addEventListener('click', refreshAll);

    document.getElementById('classForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        name: normalizeWhitespace(document.getElementById('classNameInput')?.value || ''),
        section: normalizeWhitespace(document.getElementById('classSectionInput')?.value || ''),
        roomNo: normalizeWhitespace(document.getElementById('classRoomInput')?.value || ''),
        classTeacherId: normalizeWhitespace(document.getElementById('classTeacherSelect')?.value || '')
      };

      if (!payload.name || !payload.section) {
        showToast('Class name and section are required.', 'warning');
        return;
      }

      showLoading('Saving class…');
      try {
        const record = await createClassRecord(activeSchoolId, payload);
        await logAudit('school.class.create', { schoolId: activeSchoolId, classId: record.classId });
        showToast('Class saved');
        document.getElementById('classForm')?.reset();
        await refreshAll();
      } catch (error) {
        console.error(error);
        showToast('Failed to save class', 'error');
      } finally {
        hideLoading();
      }
    });

    await refreshAll();
  });
}

window.addEventListener('DOMContentLoaded', init);
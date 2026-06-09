import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading, showConfirm } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  listSchoolCollection,
  listTimetableForClass,
  upsertTimetableEntry,
  deleteTimetableEntry,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

let activeSchoolId = '';
let classMap = new Map();
let teacherMap = new Map();
let subjectMap = new Map();

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function fillSelect(selectId, rows, getId, getLabel, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(row => {
    const option = document.createElement('option');
    option.value = getId(row);
    option.textContent = getLabel(row);
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function renderTimetable(rows) {
  const tbody = document.querySelector('#timetablePreviewTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = 'No timetable slots found for the selected class.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const timeLabel = [row.startTime, row.endTime].filter(Boolean).join(' - ') || '—';
    const periodLabel = row.label || row.periodNo || row.periodId || '—';
    const slotTypeLabel = row.slotType === 'subject' ? 'Subject' : 'Class';
    const subjectLabel = row.subjectName || subjectMap.get(row.subjectId)?.name || row.subjectId || '—';
    const teacherLabel = row.teacherName || teacherMap.get(row.teacherId)?.name || row.teacherId || '—';
    const values = [DAY_LABELS[row.dayKey] || row.dayKey, periodLabel, slotTypeLabel, timeLabel, subjectLabel, teacherLabel, row.roomNo || '—'];

    values.forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });

    const actionsTd = document.createElement('td');
    actionsTd.style.display = 'flex';
    actionsTd.style.gap = '8px';
    actionsTd.style.flexWrap = 'wrap';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn-ghost';
    loadBtn.type = 'button';
    loadBtn.textContent = '✏️ Load';
    loadBtn.style.padding = '8px 12px';
    loadBtn.onclick = () => {
      document.getElementById('timetableClassSelect').value = row.classId || '';
      document.getElementById('timetableDaySelect').value = row.dayKey || 'monday';
      document.getElementById('timetablePeriodNoInput').value = row.periodNo || String(row.periodId || '').replace(/\D/g, '');
      document.getElementById('timetableSlotTypeSelect').value = row.slotType || 'subject';
      document.getElementById('timetableLabelInput').value = row.label || '';
      document.getElementById('timetableStartTimeInput').value = row.startTime || '';
      document.getElementById('timetableEndTimeInput').value = row.endTime || '';
      document.getElementById('timetableSubjectSelect').value = row.subjectId || '';
      document.getElementById('timetableTeacherSelect').value = row.teacherId || '';
      document.getElementById('timetableRoomInput').value = row.roomNo || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-ghost';
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️ Delete';
    deleteBtn.style.padding = '8px 12px';
    deleteBtn.onclick = () => {
      showConfirm(`Delete timetable slot ${DAY_LABELS[row.dayKey] || row.dayKey} / ${periodLabel}?`, async () => {
        showLoading('Deleting timetable slot…');
        try {
          await deleteTimetableEntry(activeSchoolId, row.classId, row.dayKey, row.periodId);
          await logAudit('school.timetable.delete', {
            schoolId: activeSchoolId,
            classId: row.classId,
            dayKey: row.dayKey,
            periodId: row.periodId
          });
          showToast('Timetable slot deleted');
          await refreshAll();
        } catch (error) {
          console.error(error);
          showToast('Failed to delete timetable slot', 'error');
        } finally {
          hideLoading();
        }
      });
    };

    actionsTd.append(loadBtn, deleteBtn);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
}

async function refreshAll() {
  showLoading('Loading timetable…');
  try {
    const [classes, teachers, subjects] = await Promise.all([
      listSchoolCollection(activeSchoolId, 'classes', 'classId'),
      listSchoolCollection(activeSchoolId, 'teachers', 'teacherId'),
      listSchoolCollection(activeSchoolId, 'subjects', 'subjectId')
    ]);

    classes.sort((a, b) => String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || '')));
    teachers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    subjects.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    classMap = new Map(classes.map(item => [item.classId, item]));
    teacherMap = new Map(teachers.map(item => [item.teacherId, item]));
    subjectMap = new Map(subjects.map(item => [item.subjectId, item]));

    fillSelect('timetableClassSelect', classes, i => i.classId, i => i.displayName || i.name || i.classId, '-- Select class --');
    fillSelect('timetableTeacherSelect', teachers, i => i.teacherId, i => i.name || i.teacherId, '-- Select teacher --');
    fillSelect('timetableSubjectSelect', subjects, i => i.subjectId, i => i.name || i.subjectId, '-- Select subject --');

    const selectedClassId = document.getElementById('timetableClassSelect')?.value || (classes[0]?.classId || '');
    if (selectedClassId && document.getElementById('timetableClassSelect')) {
      document.getElementById('timetableClassSelect').value = selectedClassId;
    }

    const timetableRows = selectedClassId ? await listTimetableForClass(activeSchoolId, selectedClassId) : [];
    renderTimetable(timetableRows);
  } catch (error) {
    console.error(error);
    showToast('Failed to load timetable', 'error');
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

    const schoolText = document.getElementById('timetableManageSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;

    document.getElementById('timetableBackToAdminBtn')?.addEventListener('click', goBack);
    document.getElementById('timetableRefreshBtn')?.addEventListener('click', refreshAll);
    document.getElementById('timetableClassSelect')?.addEventListener('change', refreshAll);

    document.getElementById('timetableForm')?.addEventListener('submit', async e => {
      e.preventDefault();

      const classId = normalizeWhitespace(document.getElementById('timetableClassSelect')?.value || '');
      const dayKey = normalizeWhitespace(document.getElementById('timetableDaySelect')?.value || '').toLowerCase();
      const periodNo = normalizeWhitespace(document.getElementById('timetablePeriodNoInput')?.value || '');
      const periodId = periodNo ? `period_${periodNo}` : '';
      const slotType = normalizeWhitespace(document.getElementById('timetableSlotTypeSelect')?.value || 'subject') || 'subject';
      const subjectId = normalizeWhitespace(document.getElementById('timetableSubjectSelect')?.value || '');
      const teacherId = normalizeWhitespace(document.getElementById('timetableTeacherSelect')?.value || '');

      if (!classId || !dayKey || !periodNo || !teacherId) {
        showToast('Class, day, period no and teacher are required.', 'warning');
        return;
      }
      if (slotType === 'subject' && !subjectId) {
        showToast('Choose a subject for subject slots.', 'warning');
        return;
      }

      const payload = {
        classId,
        dayKey,
        periodId,
        periodNo,
        slotType,
        label: normalizeWhitespace(document.getElementById('timetableLabelInput')?.value || `Period ${periodNo}`),
        startTime: normalizeWhitespace(document.getElementById('timetableStartTimeInput')?.value || ''),
        endTime: normalizeWhitespace(document.getElementById('timetableEndTimeInput')?.value || ''),
        subjectId,
        subjectName: subjectMap.get(subjectId)?.name || (slotType === 'class' ? 'Homeroom / General' : ''),
        teacherId,
        teacherName: teacherMap.get(teacherId)?.name || '',
        roomNo: normalizeWhitespace(document.getElementById('timetableRoomInput')?.value || '')
      };

      showLoading('Saving timetable slot…');
      try {
        const record = await upsertTimetableEntry(activeSchoolId, payload);
        await logAudit('school.timetable.upsert', {
          schoolId: activeSchoolId,
          classId: record.classId,
          dayKey: record.dayKey,
          periodId: record.periodId
        });
        showToast('Timetable slot saved');
        await refreshAll();
      } catch (error) {
        console.error(error);
        showToast('Failed to save timetable slot', 'error');
      } finally {
        hideLoading();
      }
    });

    await refreshAll();
  });
}

window.addEventListener('DOMContentLoaded', init);

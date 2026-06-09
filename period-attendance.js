import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  listSchoolCollection,
  listStudentsForAttendanceScope,
  listTimetableForDay,
  getPeriodAttendanceRecords,
  savePeriodAttendanceBatch,
  requireAuth,
  resolveActiveSchoolId
} from "./school-service.js";

let activeSchoolId = '';
let classMap = new Map();
let timetableSlots = [];
let visibleStudents = [];

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

const ATTENDANCE_STATUSES = [
  ['present', 'Present'],
  ['absent', 'Absent'],
  ['late', 'Late'],
  ['leave', 'Leave'],
  ['medical', 'Medical'],
  ['halfDay', 'Half Day']
];

function goBack() {
  window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
}

function formatDayFromDate(dateStr = '') {
  if (!dateStr) return { key: '', label: '' };
  const date = new Date(`${dateStr}T00:00:00`);
  const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const key = keys[date.getDay()] || '';
  return { key, label: DAY_LABELS[key] || '' };
}

function fillClassSelect(rows) {
  const select = document.getElementById('periodAttendanceClassSelect');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Select class --</option>';
  classMap = new Map();
  rows.forEach(row => {
    classMap.set(row.classId, row);
    const option = document.createElement('option');
    option.value = row.classId;
    option.textContent = row.displayName || row.name || row.classId;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function fillPeriodSelect(rows) {
  const select = document.getElementById('periodAttendancePeriodSelect');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Select period --</option>';
  timetableSlots = rows;
  rows.forEach(row => {
    const option = document.createElement('option');
    const timeLabel = [row.startTime, row.endTime].filter(Boolean).join(' - ');
    option.value = row.periodId;
    option.textContent = `${row.label || `Period ${row.periodNo || ''}`} · ${row.subjectName || row.subjectId || 'Subject'}${timeLabel ? ` · ${timeLabel}` : ''}`;
    select.appendChild(option);
  });
  if (current && rows.some(r => r.periodId === current)) select.value = current;
}

function updateDayLabel() {
  const dateStr = document.getElementById('periodAttendanceDateInput')?.value || '';
  const dayField = document.getElementById('periodAttendanceDayLabel');
  const dayInfo = formatDayFromDate(dateStr);
  if (dayField) dayField.value = dayInfo.label;
  return dayInfo;
}

function renderStudents(records = {}) {
  const tbody = document.querySelector('#periodAttendanceTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!visibleStudents.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.textContent = 'No students found for the selected class.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  visibleStudents.forEach(student => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = student.fullName || 'Unknown';
    tr.appendChild(nameTd);

    const classTd = document.createElement('td');
    classTd.textContent = classMap.get(student.classId)?.displayName || student.classId || student.class || '—';
    tr.appendChild(classTd);

    const rollTd = document.createElement('td');
    rollTd.textContent = student.rollNo || '—';
    tr.appendChild(rollTd);

    const statusTd = document.createElement('td');
    const select = document.createElement('select');
    select.dataset.studentId = student.studentId;
    select.dataset.studentName = student.fullName || '';
    ATTENDANCE_STATUSES.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = records[student.studentId]?.status || 'present';
    statusTd.appendChild(select);
    tr.appendChild(statusTd);

    tbody.appendChild(tr);
  });
}

function updatePeriodSummary() {
  const card = document.getElementById('periodSlotSummaryCard');
  const classId = document.getElementById('periodAttendanceClassSelect')?.value || '';
  const periodId = document.getElementById('periodAttendancePeriodSelect')?.value || '';
  const slot = timetableSlots.find(item => item.periodId === periodId);

  if (!card || !slot || !classId) {
    if (card) card.style.display = 'none';
    return null;
  }

  card.style.display = '';
  document.getElementById('periodSlotSummaryClass').textContent = `Class: ${classMap.get(classId)?.displayName || classId}`;
  document.getElementById('periodSlotSummaryType').textContent = `Type: ${slot.slotType === 'subject' ? 'Subject Slot' : 'Class / Homeroom'}`;
  document.getElementById('periodSlotSummaryTime').textContent = `Time: ${[slot.startTime, slot.endTime].filter(Boolean).join(' - ') || '—'}`;
  document.getElementById('periodSlotSummarySubject').textContent = `Subject: ${slot.subjectName || slot.subjectId || '—'}`;
  document.getElementById('periodSlotSummaryTeacher').textContent = `Teacher: ${slot.teacherName || slot.teacherId || '—'}`;
  return slot;
}

async function loadSlotsAndStudents({ preloadAttendance = true } = {}) {
  const classId = document.getElementById('periodAttendanceClassSelect')?.value || '';
  const dateStr = document.getElementById('periodAttendanceDateInput')?.value || '';
  const dayInfo = updateDayLabel();

  if (!classId || !dateStr) {
    fillPeriodSelect([]);
    visibleStudents = [];
    renderStudents({});
    updatePeriodSummary();
    return;
  }

  showLoading('Loading class period attendance…');
  try {
    const slots = await listTimetableForDay(activeSchoolId, classId, dayInfo.key);
    fillPeriodSelect(slots);

    let records = {};
    const periodId = document.getElementById('periodAttendancePeriodSelect')?.value || '';
    const slot = slots.find(item => item.periodId === periodId) || null;
    visibleStudents = slot
      ? await listStudentsForAttendanceScope(activeSchoolId, classId, slot.slotType || 'class', slot.subjectId || '')
      : [];

    if (preloadAttendance && periodId) {
      records = await getPeriodAttendanceRecords(activeSchoolId, classId, dateStr, periodId);
    }

    renderStudents(records);
    updatePeriodSummary();
  } catch (error) {
    console.error(error);
    showToast('Failed to load period attendance data', 'error');
  } finally {
    hideLoading();
  }
}

async function reloadExistingAttendanceForSelectedPeriod() {
  const classId = document.getElementById('periodAttendanceClassSelect')?.value || '';
  const dateStr = document.getElementById('periodAttendanceDateInput')?.value || '';
  const periodId = document.getElementById('periodAttendancePeriodSelect')?.value || '';
  if (!classId || !dateStr || !periodId) {
    renderStudents({});
    updatePeriodSummary();
    return;
  }

  showLoading('Loading recorded attendance…');
  try {
    const slot = timetableSlots.find(item => item.periodId === periodId) || null;
    visibleStudents = slot
      ? await listStudentsForAttendanceScope(activeSchoolId, classId, slot.slotType || 'class', slot.subjectId || '')
      : visibleStudents;
    const records = await getPeriodAttendanceRecords(activeSchoolId, classId, dateStr, periodId);
    renderStudents(records);
    updatePeriodSummary();
  } catch (error) {
    console.error(error);
    showToast('Failed to load recorded attendance', 'error');
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

    const schoolText = document.getElementById('periodAttendanceSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;

    const dateInput = document.getElementById('periodAttendanceDateInput');
    if (dateInput && !dateInput.value) {
      const today = new Date();
      dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    updateDayLabel();

    document.getElementById('periodAttendanceBackBtn')?.addEventListener('click', goBack);
    document.getElementById('periodAttendanceLoadBtn')?.addEventListener('click', () => loadSlotsAndStudents({ preloadAttendance: true }));
    document.getElementById('periodAttendanceClassSelect')?.addEventListener('change', () => loadSlotsAndStudents({ preloadAttendance: false }));
    document.getElementById('periodAttendanceDateInput')?.addEventListener('change', () => loadSlotsAndStudents({ preloadAttendance: false }));
    document.getElementById('periodAttendancePeriodSelect')?.addEventListener('change', reloadExistingAttendanceForSelectedPeriod);

    document.getElementById('periodAttendanceForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const classId = document.getElementById('periodAttendanceClassSelect')?.value || '';
      const dateStr = document.getElementById('periodAttendanceDateInput')?.value || '';
      const periodId = document.getElementById('periodAttendancePeriodSelect')?.value || '';
      const slot = timetableSlots.find(item => item.periodId === periodId);

      if (!classId || !dateStr || !periodId || !slot) {
        showToast('Choose class, date and one valid timetable slot first.', 'warning');
        return;
      }

      const rows = Array.from(document.querySelectorAll('#periodAttendanceTable tbody select[data-student-id]')).map(select => ({
        studentId: select.dataset.studentId || '',
        studentName: select.dataset.studentName || '',
        status: select.value || 'present'
      }));

      if (!rows.length) {
        showToast('No students found for this class.', 'warning');
        return;
      }

      showLoading('Saving period attendance…');
      try {
        const result = await savePeriodAttendanceBatch(activeSchoolId, {
          classId,
          date: dateStr,
          periodId,
          subjectId: slot.subjectId || '',
          subjectName: slot.subjectName || '',
          teacherId: slot.teacherId || '',
          teacherName: slot.teacherName || '',
          slotType: slot.slotType || 'class',
          rows
        });

        await logAudit('school.periodAttendance.save', {
          schoolId: activeSchoolId,
          classId,
          date: dateStr,
          periodId,
          saved: result.saved
        });
        showToast('Period attendance saved');
      } catch (error) {
        console.error(error);
        showToast('Failed to save period attendance', 'error');
      } finally {
        hideLoading();
      }
    });

    const classes = await listSchoolCollection(activeSchoolId, 'classes', 'classId');
    classMap = new Map(classes.map(item => [item.classId, item]));
    const classSelect = document.getElementById('periodAttendanceClassSelect');
    if (classSelect) {
      classSelect.innerHTML = '<option value="">-- Select class --</option>';
      classes.sort((a, b) => String(a.displayName || a.name || '').localeCompare(String(b.displayName || b.name || ''))).forEach(item => {
        const option = document.createElement('option');
        option.value = item.classId;
        option.textContent = item.displayName || item.name || item.classId;
        classSelect.appendChild(option);
      });
    }

    await loadSlotsAndStudents({ preloadAttendance: false });
  });
}

window.addEventListener('DOMContentLoaded', init);

import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import {
  listSchoolCollection,
  listTeacherScheduleForDate,
  resolveTeacherRecordForCurrentUser,
  requireAuth,
  resolveActiveSchoolId,
  getCurrentUserProfile
} from "./school-service.js";

let activeSchoolId = '';
let teacherMap = new Map();
let classMap = new Map();
let currentProfile = null;
let currentScheduleRows = [];

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

function isActualSchoolAdmin() {
  return currentProfile?.role === 'schoolAdmin' && !currentProfile?.teacherId;
}

function goBack() {
  if (isActualSchoolAdmin()) {
    window.location.href = `school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
  } else {
    window.location.href = 'dashboard.html';
  }
}

function updateDayLabel() {
  const dateStr = document.getElementById('teacherScheduleDateInput')?.value || '';
  const field = document.getElementById('teacherScheduleDayLabel');
  if (!dateStr) {
    if (field) field.value = '';
    return { key: '', label: '' };
  }
  const date = new Date(`${dateStr}T00:00:00`);
  const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const key = keys[date.getDay()] || '';
  const label = DAY_LABELS[key] || '';
  if (field) field.value = label;
  return { key, label };
}

function fillTeacherSelect(rows) {
  const select = document.getElementById('teacherScheduleTeacherSelect');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">-- Select teacher --</option>';
  teacherMap = new Map();
  rows.forEach(row => {
    teacherMap.set(row.teacherId, row);
    const option = document.createElement('option');
    option.value = row.teacherId;
    option.textContent = row.name || row.teacherId;
    select.appendChild(option);
  });
  if (current && rows.some(r => r.teacherId === current)) select.value = current;
}

function buildAttendanceUrl(row, selectedDate) {
  const url = new URL('period-attendance.html', window.location.href);
  url.searchParams.set('schoolId', activeSchoolId);
  url.searchParams.set('classId', row.classId || '');
  url.searchParams.set('date', selectedDate || '');
  url.searchParams.set('periodId', row.periodId || '');
  return url.toString();
}

function updateUpcomingClass(rows, selectedDate) {
  const card = document.getElementById('teacherUpcomingClassCard');
  const markBtn = document.getElementById('teacherUpcomingMarkBtn');
  if (!card || !markBtn) return;

  if (!rows.length) {
    card.style.display = 'none';
    return;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let nextRow = rows.find(row => {
    const start = String(row.startTime || '');
    if (!start.includes(':')) return false;
    const [hh, mm] = start.split(':').map(Number);
    return hh * 60 + mm >= nowMinutes;
  }) || rows[0];

  const classLabel = classMap.get(nextRow.classId)?.displayName || nextRow.classId || '—';
  const timeLabel = [nextRow.startTime, nextRow.endTime].filter(Boolean).join(' - ') || '—';
  document.getElementById('teacherUpcomingClassName').textContent = `Class: ${classLabel}`;
  document.getElementById('teacherUpcomingClassTime').textContent = `Time: ${timeLabel}`;
  document.getElementById('teacherUpcomingClassSubject').textContent = `Subject: ${nextRow.subjectName || nextRow.subjectId || '—'}`;
  document.getElementById('teacherUpcomingClassRoom').textContent = `Room: ${nextRow.roomNo || '—'}`;
  markBtn.onclick = () => { window.location.href = buildAttendanceUrl(nextRow, selectedDate); };
  card.style.display = '';
}

function renderRows(rows, selectedDate) {
  currentScheduleRows = rows;
  updateUpcomingClass(rows, selectedDate);

  const tbody = document.querySelector('#teacherScheduleTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'No timetable periods found for the selected teacher and date.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || '—';
    const periodLabel = row.label || `Period ${row.periodNo || ''}`;
    const timeLabel = [row.startTime, row.endTime].filter(Boolean).join(' - ') || '—';
    const values = [
      classLabel,
      DAY_LABELS[row.dayKey] || row.dayKey,
      periodLabel,
      timeLabel,
      row.subjectName || row.subjectId || '—',
      row.roomNo || '—'
    ];

    values.forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    const openBtn = document.createElement('button');
    openBtn.className = 'btn-cta';
    openBtn.type = 'button';
    openBtn.style.padding = '8px 12px';
    openBtn.textContent = '📌 Mark Attendance';
    openBtn.onclick = () => {
      window.location.href = buildAttendanceUrl(row, selectedDate);
    };
    actionTd.appendChild(openBtn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });
}

async function loadSchedule() {
  const teacherId = document.getElementById('teacherScheduleTeacherSelect')?.value || '';
  const dateStr = document.getElementById('teacherScheduleDateInput')?.value || '';
  updateDayLabel();

  if (!teacherId || !dateStr) {
    renderRows([], dateStr);
    return;
  }

  showLoading('Loading teacher schedule…');
  try {
    const rows = await listTeacherScheduleForDate(activeSchoolId, teacherId, dateStr);
    renderRows(rows, dateStr);
  } catch (error) {
    console.error(error);
    showToast('Failed to load teacher schedule', 'error');
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

    currentProfile = await getCurrentUserProfile();
    const schoolText = document.getElementById('teacherScheduleSchoolId');
    if (schoolText) schoolText.textContent = `School ID: ${activeSchoolId}`;

    const today = new Date();
    const dateInput = document.getElementById('teacherScheduleDateInput');
    if (dateInput && !dateInput.value) {
      dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    updateDayLabel();

    document.getElementById('teacherScheduleBackBtn')?.addEventListener('click', goBack);
    document.getElementById('teacherScheduleRefreshBtn')?.addEventListener('click', loadSchedule);
    document.getElementById('teacherScheduleDateInput')?.addEventListener('change', loadSchedule);
    document.getElementById('teacherScheduleTeacherSelect')?.addEventListener('change', loadSchedule);

    const [teachers, classes] = await Promise.all([
      listSchoolCollection(activeSchoolId, 'teachers', 'teacherId'),
      listSchoolCollection(activeSchoolId, 'classes', 'classId')
    ]);
    fillTeacherSelect(teachers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
    classMap = new Map(classes.map(item => [item.classId, item]));

    if (!isActualSchoolAdmin()) {
      const ownTeacher = await resolveTeacherRecordForCurrentUser(activeSchoolId);
      if (ownTeacher) {
        const select = document.getElementById('teacherScheduleTeacherSelect');
        if (select) {
          select.value = ownTeacher.teacherId;
          select.disabled = true;
        }
        const teacherField = document.getElementById('teacherScheduleTeacherField');
        if (teacherField) {
          teacherField.querySelector('.label').textContent = 'Your Teacher Record';
        }
      }
    }

    await loadSchedule();
  });
}

window.addEventListener('DOMContentLoaded', init);

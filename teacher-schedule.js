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
  if (currentProfile?.role === 'schoolAdmin') {
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

function renderRows(rows, selectedDate) {
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
      const url = new URL('period-attendance.html', window.location.href);
      url.searchParams.set('schoolId', activeSchoolId);
      url.searchParams.set('classId', row.classId || '');
      url.searchParams.set('date', selectedDate || '');
      url.searchParams.set('periodId', row.periodId || '');
      window.location.href = url.toString();
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

    if (currentProfile?.role !== 'schoolAdmin') {
      const ownTeacher = await resolveTeacherRecordForCurrentUser(activeSchoolId);
      if (ownTeacher) {
        const select = document.getElementById('teacherScheduleTeacherSelect');
        if (select) select.value = ownTeacher.teacherId;
      }
    }

    await loadSchedule();
  });
}

window.addEventListener('DOMContentLoaded', init);

import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { requireAuth, getCurrentUserProfile, resolveActiveSchoolId, listSchoolCollection, listVisibleSchoolStudents, listBunkEvents } from "./school-service.js";
import { initSidebar } from "./sidebar.js";

let activeSchoolId = '';
let classMap = new Map();
let studentMap = new Map();
let subjectMap = new Map();
let currentSummaryRows = [];

function goBack() {
  window.location.href = 'dashboard.html';
}

function buildSchoolAdminLink(profile) {
  const schoolId = profile?.schoolId || activeSchoolId;
  return schoolId ? `school-admin.html?schoolId=${encodeURIComponent(schoolId)}` : 'school-setup.html';
}

function populateSelect(selectId, options, placeholder, valueField = 'value', labelField = 'label') {
  const select = document.getElementById(selectId);
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach(optionRow => {
    const option = document.createElement('option');
    option.value = optionRow[valueField];
    option.textContent = optionRow[labelField];
    select.appendChild(option);
  });
  if (current && options.some(item => String(item[valueField]) === String(current))) {
    select.value = current;
  }
}

function aggregateBunkRows(events) {
  const grouped = new Map();

  events.forEach(event => {
    const classId = event.classId || '';
    const subjectId = event.subjectId || '';
    const key = `${event.studentId}__${subjectId}__${classId}`;
    const section = studentMap.get(event.studentId)?.section || event.section || '';
    const classLabel = classMap.get(classId)?.displayName || classId || '—';
    const subjectLabel = event.subjectName || subjectMap.get(subjectId)?.name || subjectId || '—';
    const studentName = event.studentName || studentMap.get(event.studentId)?.fullName || 'Unknown';

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        studentId: event.studentId,
        studentName,
        classId,
        classLabel,
        section,
        subjectId,
        subjectLabel,
        bunkCount: 0,
        lastDate: '',
        lastPeriod: '',
        teacherName: event.teacherName || '—'
      });
    }

    const row = grouped.get(key);
    row.bunkCount += 1;
    if (String(event.date || '') >= String(row.lastDate || '')) {
      row.lastDate = event.date || row.lastDate;
      row.lastPeriod = event.periodId || row.lastPeriod;
      row.teacherName = event.teacherName || row.teacherName;
    }
  });

  return Array.from(grouped.values()).sort((a, b) => b.bunkCount - a.bunkCount || String(b.lastDate || '').localeCompare(String(a.lastDate || '')));
}

function renderRows(rows) {
  const tbody = document.querySelector('#bunkersTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.textContent = 'No bunk events found for the selected filters.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    const values = [
      index + 1,
      row.studentName,
      row.classLabel,
      row.section || '—',
      row.subjectLabel,
      row.bunkCount,
      row.lastDate || '—',
      row.lastPeriod || '—'
    ];
    values.forEach(value => {
      const td = document.createElement('td');
      td.textContent = String(value || '—');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function applyFilters() {
  const classId = document.getElementById('bunkerClassFilter')?.value || '';
  const section = (document.getElementById('bunkerSectionFilter')?.value || '').trim();
  const subjectId = document.getElementById('bunkerSubjectFilter')?.value || '';

  const filtered = currentSummaryRows.filter(row => {
    if (classId && String(row.classId || '') !== String(classId)) return false;
    if (subjectId && String(row.subjectId || '') !== String(subjectId)) return false;
    if (section && String(row.section || '').toLowerCase() !== String(section).toLowerCase()) return false;
    return true;
  });

  renderRows(filtered);
  return filtered;
}

function downloadCsv(rows) {
  const header = ['Rank', 'Student', 'Class', 'Section', 'Subject', 'BunkCount', 'LastDate', 'LastPeriod'];
  const csvRows = rows.map((row, index) => [
    index + 1,
    row.studentName,
    row.classLabel,
    row.section || '',
    row.subjectLabel,
    row.bunkCount,
    row.lastDate || '',
    row.lastPeriod || ''
  ]);
  const csv = [header.join(',')]
    .concat(csvRows.map(r => r.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subject_bunkers.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function refreshBunkers() {
  showLoading('Loading bunk data…');
  try {
    const [profile, classes, subjects, students, bunkEvents] = await Promise.all([
      getCurrentUserProfile(),
      listSchoolCollection(activeSchoolId, 'classes', 'classId'),
      listSchoolCollection(activeSchoolId, 'subjects', 'subjectId'),
      listVisibleSchoolStudents(activeSchoolId),
      listBunkEvents(activeSchoolId)
    ]);

    classMap = new Map(classes.map(item => [item.classId, item]));
    subjectMap = new Map(subjects.map(item => [item.subjectId, item]));
    studentMap = new Map(students.map(item => [item.studentId, item]));

    populateSelect('bunkerClassFilter', classes.map(item => ({ value: item.classId, label: item.displayName || item.name || item.classId })), '-- All classes --');
    populateSelect('bunkerSubjectFilter', subjects.map(item => ({ value: item.subjectId, label: item.name || item.subjectId })), '-- All subjects --');

    const sections = Array.from(new Set(students.map(item => item.section).filter(Boolean))).sort();
    populateSelect('bunkerSectionFilter', sections.map(section => ({ value: section, label: section })), '-- All sections --');

    currentSummaryRows = aggregateBunkRows(bunkEvents);
    applyFilters();

    const adminBtn = document.getElementById('bunkersAdminBtn');
    if (adminBtn) {
      if (profile?.role === 'schoolAdmin' && !profile?.teacherId) {
        adminBtn.style.display = '';
        adminBtn.onclick = () => { window.location.href = buildSchoolAdminLink(profile); };
      } else {
        adminBtn.style.display = 'none';
      }
    }
  } catch (error) {
    console.error(error);
    showToast('Failed to load bunk data', 'error');
  } finally {
    hideLoading();
  }
}

async function init() {
  initSidebar();
  initTheme();
  requireAuth(async () => {
    activeSchoolId = await resolveActiveSchoolId();
    if (!activeSchoolId) {
      showToast('No school selected', 'warning');
      return;
    }

    document.getElementById('bunkersBackBtn')?.addEventListener('click', goBack);
    document.getElementById('bunkersRefreshBtn')?.addEventListener('click', refreshBunkers);
    document.getElementById('bunkersExportBtn')?.addEventListener('click', () => {
      const rows = applyFilters();
      downloadCsv(rows);
    });
    document.getElementById('bunkerClassFilter')?.addEventListener('change', applyFilters);
    document.getElementById('bunkerSectionFilter')?.addEventListener('change', applyFilters);
    document.getElementById('bunkerSubjectFilter')?.addEventListener('change', applyFilters);

    await refreshBunkers();
  });
}

window.addEventListener('DOMContentLoaded', init);

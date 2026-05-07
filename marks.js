
/* ======================================================
   EXPORTS (CSV / Excel) + PRINT
   ====================================================== */
function tableToCSV(headerRow, rows) {
  const all = [headerRow.join(',')].concat(rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')));
  return all.join('\n');
}

function downloadFile(filename, content, mime='text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.exportAttendanceCSV = async function () {
  if (!selectedStudentId) return alert('No student selected');
  const snap = await get(ref(db, `students/${selectedStudentId}`));
  const student = snap.val() || {};
  const attendance = student.attendance || {};
  const rows = Object.keys(attendance).sort().map(d => [d, attendance[d]]);
  const csv = tableToCSV(['Date','Status'], rows);
  downloadFile(`${(student.name||'student')}_attendance.csv`, csv, 'text/csv');
};

window.exportAttendanceCSVModal = async function () {
  const mp = document.getElementById('monthPicker');
  const month = mp?.value;
  if (!selectedStudentId) return alert('No student selected');
  const snap = await get(ref(db, `students/${selectedStudentId}`));
  const student = snap.val() || {};
  const attendance = student.attendance || {};
  const rows = Object.keys(attendance).sort().map(d => [d, attendance[d]]);
  const csv = tableToCSV(['Date','Status'], rows);
  downloadFile(`${(student.name||'student')}_attendance.csv`, csv, 'text/csv');
};

window.exportAttendanceExcel = async function () {
  if (!selectedStudentId) return alert('No student selected');
  const snap = await get(ref(db, `students/${selectedStudentId}`));
  const student = snap.val() || {};
  const attendance = student.attendance || {};
  const rows = Object.keys(attendance).sort().map(d => [d, attendance[d]]);
  const csv = tableToCSV(['Date','Status'], rows);
  downloadFile(`${(student.name||'student')}_attendance.xls`, csv, 'application/vnd.ms-excel');
};

window.exportClassAttendanceCSV = (rows, dateStr) => {
  if (!rows || rows.length === 0) return alert('No data to export');
  const csvRows = rows.map(st => {
    const selected = document.querySelector(`input[name="att_${st.id}"]:checked`);
    const value = selected ? selected.value : 'present';
    return [st.name, st.id, value];
  });
  const csv = tableToCSV(['Name','StudentId','Status'], csvRows);
  downloadFile(`class_attendance_${dateStr}.csv`, csv, 'text/csv');
};

function exportClassAttendanceCSV(rows, dateStr) {
  window.exportClassAttendanceCSV(rows, dateStr);
}

window.exportBunkersCSV = async function () {
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const rows = [];
    for (const id in data) {
      const s = data[id];
      if (!s) continue;
      if (!(s.teacher && s.teacher === auth.currentUser.uid)) continue;
      const absent = Object.values(s.attendance || {}).filter(v => v === 'absent').length;
      if (absent > 0) rows.push([s.name||'', s.class||'', s.subject||'', absent]);
    }
    if (rows.length === 0) return alert('No bunkers found');
    const csv = tableToCSV(['Name','Class','Subject','Absences'], rows);
    downloadFile('top_bunkers.csv', csv, 'text/csv');
  } catch (err) {
    console.error('exportBunkersCSV', err);
  }
};

window.printReport = function () {
  const table = document.getElementById('markAttendanceTable') || document.getElementById('attendanceMonthTable');
  if (!table) return alert('Nothing to print');
  const w = window.open('', '', 'width=900,height=700');
  const title = (document.getElementById('studentNameLabel')?.innerText) || (document.getElementById('modalStudentName')?.innerText) || 'Attendance Report';
  w.document.write(`<h3>Monthly Attendance Report — ${title}</h3>`);
  w.document.write(table.outerHTML);
  w.document.close();
  w.print();
};

/* ======================================================
   TOP BUNKERS (page: top-bunkers.html)
   - initTopBunkersPage builds table with low attendance students
   ====================================================== */
window.initTopBunkersPage = async function () {
  if (!auth.currentUser) { setTimeout(window.initTopBunkersPage, 300); return; }
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const bunkers = [];
    for (const id in data) {
      const s = data[id];
      if (!s) continue;
      if (!(s.teacher && s.teacher === auth.currentUser.uid)) continue;
      const absentCount = Object.values(s.attendance || {}).filter(v => v === 'absent').length;
      if (absentCount > 0) bunkers.push({ id, ...s, totalAbsent: absentCount });
    }
    bunkers.sort((a, b) => b.totalAbsent - a.totalAbsent);
    const table = document.getElementById('bunkersTable');
    if (!table) return;
    table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>`;
    bunkers.forEach(s => {
      const r = table.insertRow();
      r.insertCell(0).innerText = s.name;
      r.insertCell(1).innerText = s.class;
      r.insertCell(2).innerText = s.subject;
      const cell = r.insertCell(3); cell.innerText = s.totalAbsent;
      if (s.totalAbsent >= 3) cell.style.color = '#ffb4b4';
    });
  } catch (err) {
    console.error('initTopBunkersPage error', err);
  }
};

/* ======================================================
   MARKS + PREDICTION (marks.html area)
   - initMarksPage, loadMarksForStudent, saveMarksForStudent, computeAndShowPrediction
   - Already implemented earlier: kept intact
   ====================================================== */
/* (This section intentionally kept brief because your original code was included earlier in the big merged file.
   If you have a dedicated marks.html page, call initMarksPage() on load.)
*/
/* ======================================================
   ANALYTICS (new page: analytics.html)
   - initAnalyticsPage populates classes & default month
   - renderAnalytics fetches class students and monthly attendance and draws simple charts
   - Charts are plain SVG/DOM to avoid external libs; you can replace with Chart.js later
   ====================================================== */

window.initAnalyticsPage = function () {
  if (!auth.currentUser) { setTimeout(window.initAnalyticsPage, 300); return; }
  loadTeacherProfile();
  const now = new Date();
  document.getElementById('analyticsMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const cls = localStorage.getItem('analyticsClass');
  if (cls) {
    const sel = document.getElementById('analyticsClassSelect');
    if (sel) sel.value = cls;
    localStorage.removeItem('analyticsClass');
  }
};

window.renderAnalytics = async function () {
  const className = document.getElementById('analyticsClassSelect')?.value;
  const month = document.getElementById('analyticsMonth')?.value;
  if (!className) return alert('Select a class');
  if (!month) return alert('Select a month');

  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const students = [];
    for (const id in data) {
      const s = data[id];
      if (!s) continue;
      if (s.class !== className) continue;
      if (!(s.teacher && s.teacher === auth.currentUser.uid)) continue;
      students.push({ id, name: s.name || '', attendance: s.attendance || {} });
    }

    // Analyze month
    const [y, m] = month.split('-').map(Number);
    const mdays = new Date(y, m, 0).getDate();
    const totals = { present: 0, absent: 0, dayTotals: Array(mdays).fill(0) };
    const studentTotals = [];

    for (const s of students) {
      let spresent = 0, sabsent = 0;
      for (let d = 1; d <= mdays; d++) {
        const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const st = s.attendance[dd];
        if (st === 'present') { spresent++; totals.present++; totals.dayTotals[d-1]++; }
        if (st === 'absent') { sabsent++; totals.absent++; }
      }
      studentTotals.push({ id: s.id, name: s.name, present: spresent, absent: sabsent, totalDays: mdays });
    }

    // Simple charts area
    const area = document.getElementById('chartsArea');
    area.innerHTML = '';

    // Summary card
    const summary = document.createElement('div');
    summary.className = 'card';
    const totalStudents = students.length;
    const totalPossible = totalStudents * mdays;
    const presentPct = totalPossible ? Math.round((totals.present/totalPossible)*100) : 0;
    summary.innerHTML = `<div class="row space"><div><strong>${className} — ${month}</strong><div style="color:var(--muted)">${totalStudents} students · ${mdays} days</div></div>
                         <div style="text-align:right"><div style="font-size:22px">${presentPct}%</div><div style="color:var(--muted)">Present overall</div></div></div>`;
    area.appendChild(summary);

    // Day trend (bar)
    const dayCard = document.createElement('div');
    dayCard.className = 'card';
    dayCard.innerHTML = `<strong>Daily Present Count</strong><div id="dayBar" style="margin-top:10px; display:flex; gap:6px; align-items:end; height:140px;"></div>`;
    area.appendChild(dayCard);
    const dayBar = dayCard.querySelector('#dayBar');
    const maxDay = Math.max(...totals.dayTotals, 1);
    totals.dayTotals.forEach((v,i) => {
      const col = document.createElement('div');
      col.style.width = '100%';
      col.style.flex = '1';
      const h = Math.round((v/maxDay)*100);
      col.style.height = `${Math.max(6, h)}%`;
      col.style.background = 'linear-gradient(180deg,#0ea5e9,#3b82f6)';
      col.style.borderRadius = '6px';
      col.title = `Day ${i+1}: ${v} present`;
      dayBar.appendChild(col);
    });

    // Student ranking (table)
    const rankCard = document.createElement('div');
    rankCard.className = 'card';
    rankCard.innerHTML = `<strong>Student Attendance — present days</strong>`;
    const twrap = document.createElement('div');
    twrap.className = 'table-wrap';
    const t = document.createElement('table');
    t.innerHTML = `<tr><th>Name</th><th>Present</th><th>Absent</th><th>%</th></tr>`;
    studentTotals.sort((a,b)=>b.present-a.present).forEach(s => {
      const tr = t.insertRow();
      tr.insertCell(0).innerText = s.name;
      tr.insertCell(1).innerText = s.present;
      tr.insertCell(2).innerText = s.absent;
      tr.insertCell(3).innerText = Math.round((s.present/s.totalDays)*100) + '%';
    });
    twrap.appendChild(t);
    rankCard.appendChild(twrap);
    area.appendChild(rankCard);

       // Export / print buttons
    const ctrl = document.createElement('div');
    ctrl.className = 'row';
    ctrl.style.marginTop = '10px';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn-cta';
    exportBtn.innerText = 'Export Monthly Excel';
    exportBtn.onclick = async () => {
      // Build CSV: header days + students rows
      const header = ['Name'];
      for (let d=1; d<=mdays; d++) header.push(`D${d}`);
      const rows = studentTotals.map(st => {
        const row = [st.name];
        for (let d=1; d<=mdays; d++) {
          const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const stv = (students.find(s=>s.id===st.id).attendance[dd] || '').substring(0,1);
          row.push(stv);
        }
        return row;
      });
      const csv = tableToCSV(header, rows);
      downloadFile(`analytics_${className}_${month}.xls`, csv, 'application/vnd.ms-excel');
    };
    ctrl.appendChild(exportBtn);

    const printBtn = document.createElement('button');
    printBtn.className = 'btn-cta';
    printBtn.innerText = 'Print Report';
    printBtn.onclick = () => {
      const w = window.open('', '', 'width=900,height=700');
      w.document.write(`<h3>Attendance — ${className} — ${month}</h3>`);
      w.document.write(summary.outerHTML + rankCard.innerHTML);
      w.document.close();
      w.print();
    };
    ctrl.appendChild(printBtn);
    area.appendChild(ctrl);

  } catch (err) {
    console.error('renderAnalytics error', err);
    alert('Failed to render analytics');
  }
};

/* Provide a button from mark-attendance page to open analytics for the selected student */
window.openAnalyticsForStudent = function () {
  if (!selectedStudentId) { alert('No student selected'); return; }
  // store selected student in localStorage so analytics page can show per-student charts if desired
  localStorage.setItem('analyticsStudentId', selectedStudentId);
  window.location.href = 'analytics.html';
};

/* ======================================================
   Small helper used by marks prediction (not duplicated)
   ====================================================== */
function toPct(x) { if (x == null) return '-'; return (x*100).toFixed(1) + '%'; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ======================================================
   End of merged script
   ====================================================== */

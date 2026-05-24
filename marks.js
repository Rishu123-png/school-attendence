// marks.js — Marks & Prediction page logic
import { auth, db } from "./firebase.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { initTheme } from "./theme.js";
import { initSidebar } from "./sidebar.js";
import {
  ref, get, set, onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let marksChart = null;

function requireAuth(cb) {
  if (auth.currentUser) { cb(); return; }
  const unsub = onAuthStateChanged(auth, user => {
    if (user) { unsub(); cb(); }
    else { unsub(); window.location.href = 'index.html'; }
  });
}

export function initMarksPage() {
  requireAuth(() => {
    initSidebar();
    initTheme();
    loadStudentsForMarks();

    document.getElementById('saveMarksBtn')?.addEventListener('click', saveMarksForStudent);
    document.getElementById('predictBtn')?.addEventListener('click', computeAndShowPrediction);
    document.getElementById('clearMarksBtn')?.addEventListener('click', clearMarksForm);
  });
}

async function loadStudentsForMarks() {
  showLoading('Loading students…');
  try {
    const snap  = await get(ref(db, 'students'));
    const data  = snap.val() || {};
    const sel   = document.getElementById('marksStudentSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select student --</option>';
    for (const id in data) {
      const s = data[id];
      if (!s || s.teacher !== auth.currentUser.uid) continue;
      const opt = document.createElement('option');
      opt.value   = id;
      opt.innerText = `${s.name || 'Unknown'} (${s.class || '—'})`;
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const sid = sel.value;
      if (sid) loadMarksForStudent(sid, data[sid]);
      else {
        document.getElementById('marksForm').style.display = 'none';
      }
    };
  } catch (err) { showToast('Failed to load students', 'error'); }
  finally { hideLoading(); }
}

function loadMarksForStudent(id, student) {
  document.getElementById('marksForm').style.display   = 'block';
  document.getElementById('marksStudentName').innerText = student.name || '';

  const marks = student.marks || {};
  document.getElementById('ut1Score').value    = marks.ut1Score    || '';
  document.getElementById('ut1Max').value      = marks.ut1Max      || 25;
  document.getElementById('hyScore').value     = marks.hyScore     || '';
  document.getElementById('hyMax').value       = marks.hyMax       || 100;
  document.getElementById('ut2Score').value    = marks.ut2Score    || '';
  document.getElementById('ut2Max').value      = marks.ut2Max      || 25;
  document.getElementById('annualScore').value = marks.annualScore || '';
  document.getElementById('annualMax').value   = marks.annualMax   || 100;

  computeAndShowPrediction(student);
  renderPerformanceChart(marks);
  renderAttendanceImpact(student);
}

async function saveMarksForStudent() {
  const sid = document.getElementById('marksStudentSelect')?.value;
  if (!sid) { showToast('Select a student first', 'warning'); return; }

  const marks = {
    ut1Score:    parseFloat(document.getElementById('ut1Score').value)    || null,
    ut1Max:      parseFloat(document.getElementById('ut1Max').value)      || 25,
    hyScore:     parseFloat(document.getElementById('hyScore').value)     || null,
    hyMax:       parseFloat(document.getElementById('hyMax').value)       || 100,
    ut2Score:    parseFloat(document.getElementById('ut2Score').value)    || null,
    ut2Max:      parseFloat(document.getElementById('ut2Max').value)      || 25,
    annualScore: parseFloat(document.getElementById('annualScore').value) || null,
    annualMax:   parseFloat(document.getElementById('annualMax').value)   || 100,
  };

  showLoading('Saving marks…');
  try {
    await set(ref(db, `students/${sid}/marks`), marks);
    showToast('Marks saved successfully!');
    renderPerformanceChart(marks);
    computeAndShowPrediction();
  } catch (err) { showToast('Failed to save marks', 'error'); }
  finally { hideLoading(); }
}

function getVal(id) { return parseFloat(document.getElementById(id)?.value) || null; }

function computeAndShowPrediction(student) {
  const ut1Score = getVal('ut1Score'), ut1Max = getVal('ut1Max') || 25;
  const hyScore  = getVal('hyScore'),  hyMax  = getVal('hyMax')  || 100;
  const ut2Score = getVal('ut2Score');
  const annScore = getVal('annualScore');

  const ut1Pct = ut1Score != null ? ut1Score / ut1Max : null;
  const hyPct  = hyScore  != null ? hyScore  / hyMax  : null;

  const box = document.getElementById('predictionSummary');
  if (!box) return;

  let lines = [];

  if (ut1Pct != null) lines.push(`UT-1 Score:       ${toPct(ut1Pct)} (${ut1Score}/${ut1Max})`);
  if (hyPct  != null) lines.push(`Half-Yearly:      ${toPct(hyPct)}  (${hyScore}/${hyMax})`);

  // Predict UT-2 if missing
  if (ut2Score == null && ut1Pct != null && hyPct != null) {
    const predicted = clamp((ut1Pct * 0.4 + hyPct * 0.6) * 25, 0, 25);
    lines.push(`UT-2 Prediction:  ${predicted.toFixed(1)} / 25`);
    document.getElementById('ut2Score').placeholder = predicted.toFixed(1);
  } else if (ut2Score != null) {
    lines.push(`UT-2 Score:       ${ut2Score} / ${getVal('ut2Max') || 25}`);
  }

  // Predict Annual if missing
  if (annScore == null && ut1Pct != null && hyPct != null) {
    const predicted = clamp((ut1Pct * 0.3 + hyPct * 0.7) * 100, 0, 100);
    lines.push(`Annual Prediction: ${predicted.toFixed(1)} / 100`);
    document.getElementById('annualScore').placeholder = predicted.toFixed(1);
    const grade = predicted >= 90 ? 'A+' : predicted >= 75 ? 'A' : predicted >= 60 ? 'B' : predicted >= 40 ? 'C' : 'D';
    lines.push(`Predicted Grade:   ${grade}`);
  } else if (annScore != null) {
    lines.push(`Annual Score:      ${annScore} / ${getVal('annualMax') || 100}`);
  }

  if (!lines.length) {
    box.innerText = 'Enter UT-1 and Half-Yearly scores to see prediction.';
    box.style.color = '#aaa';
    return;
  }

  box.style.color = '#0f0';
  box.innerText = lines.join('\n');
}

window.predictStudyHourMarks = function () {
  const hours = parseFloat(document.getElementById('studyHours')?.value) || 0;
  const el    = document.getElementById('studyHourPrediction');
  if (!el) return;
  if (hours < 0 || hours > 24) { el.innerText = 'Enter hours between 0 and 10.'; return; }
  // Simple linear model: 2h→40%, 5h→70%, 8h→90%
  const pct  = clamp(hours * 10 + 20, 0, 100);
  const grade = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D';
  el.innerText  = `📊 Predicted score: ~${pct.toFixed(0)}% — Grade: ${grade}`;
  el.style.color = pct >= 75 ? '#4ad07a' : pct >= 50 ? '#f39c12' : '#ff6b6b';
};

function renderAttendanceImpact(student) {
  const el  = document.getElementById('attendanceInfo');
  if (!el || !student) return;
  const att     = student.attendance || {};
  const total   = Object.keys(att).length;
  const present = Object.values(att).filter(v => v === 'present').length;
  const pct     = total ? Math.round((present / total) * 100) : null;
  if (pct == null) { el.innerText = 'No attendance data recorded yet.'; return; }
  const color = pct >= 75 ? '#4ad07a' : pct >= 50 ? '#f39c12' : '#ff6b6b';
  el.innerHTML = `Attendance: <strong style="color:${color}">${pct}%</strong> (${present}/${total} days present).<br>
    ${pct < 75 ? '⚠️ Low attendance may negatively impact exam performance.' : '✅ Good attendance — keep it up!'}`;
}

function renderPerformanceChart(marks) {
  const canvas = document.getElementById('performanceChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = ['UT-1', 'Half-Yearly', 'UT-2', 'Annual'];
  const maxima = [marks.ut1Max||25, marks.hyMax||100, marks.ut2Max||25, marks.annualMax||100];
  const scores = [marks.ut1Score, marks.hyScore, marks.ut2Score, marks.annualScore];
  const pcts   = scores.map((s, i) => s != null ? Math.round((s / maxima[i]) * 100) : null);

  if (marksChart) marksChart.destroy();
  marksChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Score %',
        data: pcts,
        backgroundColor: pcts.map(p =>
          p == null ? 'rgba(255,255,255,0.1)' : p >= 75 ? 'rgba(74,208,122,0.6)' : p >= 50 ? 'rgba(243,156,18,0.6)' : 'rgba(255,107,107,0.6)'
        ),
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa' } },
        x: { grid: { display: false }, ticks: { color: '#aaa' } }
      }
    }
  });
}

function clearMarksForm() {
  ['ut1Score','hyScore','ut2Score','annualScore'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('predictionSummary').innerText = '';
  document.getElementById('studyHourPrediction').innerText = '';
  if (marksChart) { marksChart.destroy(); marksChart = null; }
  showToast('Marks cleared', 'info');
}

function toPct(x) { if (x == null) return '—'; return (x * 100).toFixed(1) + '%'; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ============================================================
   TIMETABLE MANAGE — UPGRADED
   Fixes: loader via admin-common, delete confirmation,
          empty state, mobile data-labels, schoolId security,
          error handling
   ============================================================ */

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast, confirmAction } from "./app-shell.js";
import { listClasses } from "../services/class-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listSubjects } from "../services/subject-service.js";
import { saveTimetableSlot, deleteTimetableSlot, listTimetableForClass } from "../services/timetable-service.js";

let activeSchoolId = "";
let classMap   = new Map();
let teacherMap = new Map();
let subjectMap = new Map();

const DAY_LABELS = {
  monday:"Monday", tuesday:"Tuesday", wednesday:"Wednesday",
  thursday:"Thursday", friday:"Friday", saturday:"Saturday", sunday:"Sunday"
};

function fillSelect(id, rows, getId, getLabel, placeholder) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = getId(row); opt.textContent = getLabel(row);
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function renderTable(rows) {
  const tbody = document.querySelector("#timetableTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>No timetable slots found for this class.<br>Use the form above to add slots.</p>
      </div>
    </td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const fields = [
      { label: "Day",     value: DAY_LABELS[row.dayKey] || row.dayKey },
      { label: "Period",  value: row.label || `Period ${row.periodNo || ""}` },
      { label: "Type",    value: row.slotType === "subject" ? "Subject" : "Class" },
      { label: "Time",    value: [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—" },
      { label: "Subject", value: row.subjectName || subjectMap.get(row.subjectId)?.name || row.subjectId || "—" },
      { label: "Teacher", value: row.teacherName || teacherMap.get(row.teacherId)?.name || row.teacherId || "—" },
      { label: "Room",    value: row.roomNo || "—" },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    const actionTd = document.createElement("td");
    actionTd.setAttribute("data-label", "Actions");
    const loadBtn = document.createElement("button");
    loadBtn.className = "btn-ghost"; loadBtn.textContent = "✏️ Load";
    loadBtn.onclick = () => {
      document.getElementById("ttClassSelect").value   = row.classId  || "";
      document.getElementById("ttDaySelect").value     = row.dayKey   || "monday";
      document.getElementById("ttPeriodNoInput").value = row.periodNo || String(row.periodId || "").replace(/\D/g,"");
      document.getElementById("ttSlotTypeSelect").value= row.slotType || "subject";
      document.getElementById("ttLabelInput").value    = row.label    || "";
      document.getElementById("ttStartTimeInput").value= row.startTime|| "";
      document.getElementById("ttEndTimeInput").value  = row.endTime  || "";
      document.getElementById("ttSubjectSelect").value = row.subjectId|| "";
      document.getElementById("ttTeacherSelect").value = row.teacherId|| "";
      document.getElementById("ttRoomInput").value     = row.roomNo   || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-danger"; deleteBtn.textContent = "🗑️";
    deleteBtn.onclick = async () => {
      const ok = await confirmAction(`Delete slot ${DAY_LABELS[row.dayKey]} / ${row.label || `Period ${row.periodNo}`}?`);
      if (!ok) return;
      await deleteTimetableSlot(activeSchoolId, row.classId, row.dayKey, row.periodId);
      showToast("Slot deleted", "success");
      await refresh();
    };
    actionTd.append(loadBtn, " ", deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const [classes, teachers, subjects] = await Promise.all([
    listClasses(activeSchoolId),
    listTeachers(activeSchoolId),
    listSubjects(activeSchoolId)
  ]);
  classMap   = new Map(classes.map(i  => [i.classId,   i]));
  teacherMap = new Map(teachers.map(i => [i.teacherId, i]));
  subjectMap = new Map(subjects.map(i => [i.subjectId, i]));

  fillSelect("ttClassSelect",   classes,  i => i.classId,   i => i.displayName || i.classId, "-- Select class --");
  fillSelect("ttTeacherSelect", teachers, i => i.teacherId, i => i.name || i.teacherId,       "-- Select teacher --");
  fillSelect("ttSubjectSelect", subjects, i => i.subjectId, i => i.name || i.subjectId,       "-- Select subject --");

  const selectedClass = document.getElementById("ttClassSelect").value || classes[0]?.classId || "";
  if (selectedClass) document.getElementById("ttClassSelect").value = selectedClass;
  const rows = selectedClass ? await listTimetableForClass(activeSchoolId, selectedClass) : [];
  renderTable(rows);
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  document.getElementById("ttRefreshBtn")?.addEventListener("click", refresh);
  document.getElementById("ttClassSelect")?.addEventListener("change", async () => {
    const classId = document.getElementById("ttClassSelect").value;
    const rows = classId ? await listTimetableForClass(activeSchoolId, classId) : [];
    renderTable(rows);
  });

  document.getElementById("timetableForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const classId   = document.getElementById("ttClassSelect").value;
    const teacherId = document.getElementById("ttTeacherSelect").value;
    const periodNo  = document.getElementById("ttPeriodNoInput").value;
    const slotType  = document.getElementById("ttSlotTypeSelect").value;
    const subjectId = document.getElementById("ttSubjectSelect").value;

    if (!classId)   { showToast("Class is required", "warn");   return; }
    if (!periodNo)  { showToast("Period No is required", "warn"); return; }
    if (!teacherId) { showToast("Teacher is required", "warn"); return; }
    if (slotType === "subject" && !subjectId) {
      showToast("Choose a subject for subject slots", "warn");
      return;
    }

    const btn = document.getElementById("ttSaveBtn");
    btn.disabled = true;
    try {
      await saveTimetableSlot(activeSchoolId, {
        classId,
        dayKey:      document.getElementById("ttDaySelect").value,
        periodNo,
        slotType,
        label:       document.getElementById("ttLabelInput").value,
        startTime:   document.getElementById("ttStartTimeInput").value,
        endTime:     document.getElementById("ttEndTimeInput").value,
        subjectId,
        subjectName: subjectMap.get(subjectId)?.name || "",
        teacherId,
        teacherName: teacherMap.get(teacherId)?.name || "",
        roomNo:      document.getElementById("ttRoomInput").value
      });
      showToast("✅ Timetable slot saved", "success");
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed to save slot", "error");
    } finally {
      btn.disabled = false;
    }
  });

  await refresh();
});

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listClasses } from "../services/class-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listSubjects } from "../services/subject-service.js";
import { saveTimetableSlot, deleteTimetableSlot, listTimetableForClass } from "../services/timetable-service.js";

let activeSchoolId = "";
let classMap = new Map();
let teacherMap = new Map();
let subjectMap = new Map();

const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday"
};

function fillSelect(id, rows, getId, getLabel, placeholder) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(row => {
    const option = document.createElement("option");
    option.value = getId(row);
    option.textContent = getLabel(row);
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function renderTable(rows) {
  const tbody = document.querySelector("#timetableTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No timetable slots found for the selected class.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const values = [
      DAY_LABELS[row.dayKey] || row.dayKey,
      row.label || `Period ${row.periodNo || ""}`,
      row.slotType === "subject" ? "Subject" : "Class",
      [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—",
      row.subjectName || subjectMap.get(row.subjectId)?.name || row.subjectId || "—",
      row.teacherName || teacherMap.get(row.teacherId)?.name || row.teacherId || "—",
      row.roomNo || "—"
    ];
    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    const actionTd = document.createElement("td");
    const loadBtn = document.createElement("button");
    loadBtn.className = "btn-ghost";
    loadBtn.textContent = "Load";
    loadBtn.onclick = () => {
      document.getElementById("ttClassSelect").value = row.classId || "";
      document.getElementById("ttDaySelect").value = row.dayKey || "monday";
      document.getElementById("ttPeriodNoInput").value = row.periodNo || String(row.periodId || "").replace(/\D/g, "");
      document.getElementById("ttSlotTypeSelect").value = row.slotType || "subject";
      document.getElementById("ttLabelInput").value = row.label || "";
      document.getElementById("ttStartTimeInput").value = row.startTime || "";
      document.getElementById("ttEndTimeInput").value = row.endTime || "";
      document.getElementById("ttSubjectSelect").value = row.subjectId || "";
      document.getElementById("ttTeacherSelect").value = row.teacherId || "";
      document.getElementById("ttRoomInput").value = row.roomNo || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-ghost";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      await deleteTimetableSlot(activeSchoolId, row.classId, row.dayKey, row.periodId);
      showToast("Timetable slot deleted", "success");
      await refresh();
    };
    actionTd.append(loadBtn, deleteBtn);
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
  classMap = new Map(classes.map(item => [item.classId, item]));
  teacherMap = new Map(teachers.map(item => [item.teacherId, item]));
  subjectMap = new Map(subjects.map(item => [item.subjectId, item]));

  fillSelect('ttClassSelect', classes, i => i.classId, i => i.displayName || i.classId, '-- Select class --');
  fillSelect('ttTeacherSelect', teachers, i => i.teacherId, i => i.name || i.teacherId, '-- Select teacher --');
  fillSelect('ttSubjectSelect', subjects, i => i.subjectId, i => i.name || i.subjectId, '-- Select subject --');

  const selectedClass = document.getElementById('ttClassSelect').value || classes[0]?.classId || "";
  if (selectedClass) document.getElementById('ttClassSelect').value = selectedClass;
  const rows = selectedClass ? await listTimetableForClass(activeSchoolId, selectedClass) : [];
  renderTable(rows);
}

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("ttRefreshBtn").addEventListener("click", refresh);
  document.getElementById("ttClassSelect").addEventListener("change", refresh);

  document.getElementById("timetableForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      classId: document.getElementById("ttClassSelect").value,
      dayKey: document.getElementById("ttDaySelect").value,
      periodNo: document.getElementById("ttPeriodNoInput").value,
      slotType: document.getElementById("ttSlotTypeSelect").value,
      label: document.getElementById("ttLabelInput").value,
      startTime: document.getElementById("ttStartTimeInput").value,
      endTime: document.getElementById("ttEndTimeInput").value,
      subjectId: document.getElementById("ttSubjectSelect").value,
      subjectName: subjectMap.get(document.getElementById("ttSubjectSelect").value)?.name || "",
      teacherId: document.getElementById("ttTeacherSelect").value,
      teacherName: teacherMap.get(document.getElementById("ttTeacherSelect").value)?.name || "",
      roomNo: document.getElementById("ttRoomInput").value
    };
    if (!payload.classId || !payload.dayKey || !payload.periodNo || !payload.teacherId) {
      showToast("Class, day, period and teacher are required", "warn");
      return;
    }
    if (payload.slotType === "subject" && !payload.subjectId) {
      showToast("Choose a subject for subject slots", "warn");
      return;
    }
    await saveTimetableSlot(activeSchoolId, payload);
    showToast("Timetable slot saved", "success");
    await refresh();
  });

  await refresh();
});
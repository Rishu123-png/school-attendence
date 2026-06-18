* ============================================================
   ANNOUNCEMENT SERVICE — NEW
   Admin posts notices, teachers + later app sees them
   ============================================================ */

import { db } from "./firebase.js";
import { ref, get, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(v = "") { return String(v).replace(/\s+/g, " ").trim(); }

export async function listAnnouncements(schoolId, limitCount = 50) {
  const snap = await get(ref(db, `schools/${schoolId}/announcements`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {})
    .map(([id, v]) => ({ announcementId: id, ...(v || {}) }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, limitCount);
}

export async function createAnnouncement(schoolId, data) {
  const r = push(ref(db, `schools/${schoolId}/announcements`));
  const id = r.key;
  const ts = serverTimestamp();
  await set(r, {
    announcementId: id,
    title:    norm(data.title),
    body:     norm(data.body),
    type:     norm(data.type || "general"),   // general | exam | event | urgent
    author:   norm(data.author || "Admin"),
    targetRole: norm(data.targetRole || "all"), // all | teacher | parent
    createdAt: ts, updatedAt: ts
  });
  return id;
}

export async function deleteAnnouncement(schoolId, announcementId) {
  await set(ref(db, `schools/${schoolId}/announcements/${announcementId}`), null);
}

export async function getLatestAnnouncements(schoolId, n = 3) {
  const all = await listAnnouncements(schoolId, n);
  return all.slice(0, n);
}

// audit.js — lightweight client-side audit trail for phase 1
import { auth, db } from "./firebase.js";
import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export async function logAudit(action, details = {}) {
  if (!auth.currentUser) return;

  try {
    const auditRef = push(ref(db, `auditLogs/${auth.currentUser.uid}`));
    await set(auditRef, {
      action,
      actorUid: auth.currentUser.uid,
      details,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('audit-log-failed', action, error);
  }
}
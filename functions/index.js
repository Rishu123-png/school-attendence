// functions/index.js
// OPTIONAL — secure, production-correct registration.
// The Admin SDK bypasses security rules, so it can read the teacher roster
// and link the uid WITHOUT relaxing any client rule.
//
// Requires: Firebase Blaze (pay-as-you-go) plan + Firebase CLI.
// Deploy:  firebase deploy --only functions
//
// Then switch register() in AuthContext.tsx to call this (see SETUP.md).

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.registerTeacher = onCall(async (req) => {
  const { name, email, password, schoolId } = req.data || {};

  // 1) Validate input
  if (!name || !email || !password || !schoolId) {
    throw new HttpsError("invalid-argument", "Missing required fields (name, email, password, schoolId).");
  }
  const cleanEmail = String(email).trim().toLowerCase();

  // 2) Confirm the admin added this teacher (Admin SDK ignores security rules)
  const snap = await admin.database().ref(`schools/${schoolId}/teachers`).get();
  const teachers = snap.val() || {};
  let teacherKey = null;
  for (const [k, t] of Object.entries(teachers)) {
    if (t && String(t.email).toLowerCase() === cleanEmail) {
      teacherKey = k;
      break;
    }
  }
  if (!teacherKey) {
    throw new HttpsError(
      "permission-denied",
      "You have not been added as a teacher by your school admin. Please ask your admin to add you first."
    );
  }

  // 3) Create the Auth user via Admin SDK
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: cleanEmail,
      emailVerified: false,
      password,
      displayName: name.trim(),
    });
  } catch (e) {
    if (e.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "This email is already registered. Try logging in instead.");
    }
    if (e.code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    logger.error("createUser failed", e);
    throw new HttpsError("internal", e.message || "Failed to create user.");
  }
  const uid = userRecord.uid;

  // 4) Write the user profile + link the teacher record (Admin SDK bypasses rules)
  try {
    await admin.database().ref(`userProfiles/${uid}`).set({
      uid,
      name: name.trim(),
      email: cleanEmail,
      role: "teacher",
      schoolId,
      createdAt: Date.now(),
    });

    await admin.database().ref(`schools/${schoolId}/teachers/${teacherKey}`).update({
      uid,
      status: "active",
      updatedAt: Date.now(),
    });
  } catch (e) {
    // Roll back the Auth user if DB writes failed
    try { await admin.auth().deleteUser(uid); } catch (_) {}
    logger.error("DB write failed, rolled back user", e);
    throw new HttpsError("internal", "Failed to create profile.");
  }

  // 5) Send verification email (optional)
  try {
    await admin.auth().generateEmailVerificationLink(cleanEmail);
    // NOTE: generateEmailVerificationLink returns a link you must send via your
    // own email provider. If you don't have one set up, the client can still
    // call sendEmailVerification() after signing in.
  } catch (e) {
    logger.warn("verification link generation failed (non-fatal)", e);
  }

  return { ok: true, uid };
});


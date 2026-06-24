// src/components/DebugBadge.tsx
// TEMPORARY diagnostic — shows super-admin state on screen.
// Delete this file and remove its <DebugBadge/> usage in App.tsx when done.
import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export default function DebugBadge() {
  const { user, isSuperAdmin, profile, loading } = useAuth();
  const [testResult, setTestResult] = useState<string>("…");
  const [collapsed, setCollapsed] = useState(false);

  // Independent test read of superAdmins/{uid} — bypasses the app's listener
  // so we see the raw value + any permission error.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) { if (!cancelled) setTestResult("not signed in"); return; }
      if (!cancelled) setTestResult("reading…");
      try {
        const snap = await get(ref(db, `superAdmins/${user.uid}`));
        if (cancelled) return;
        setTestResult(snap.exists() ? `EXISTS = ${JSON.stringify(snap.val())}` : "read OK but EMPTY (null)");
      } catch (e: any) {
        if (cancelled) return;
        setTestResult(`DENIED/ERROR: ${e.code || e.message}`);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [user?.uid]);

  if (!user) return null; // don't show on login screen

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{ position: "fixed", bottom: 8, right: 8, zIndex: 99999,
          background: "#111", color: "#0f0", border: "1px solid #0f0",
          borderRadius: 6, padding: "4px 8px", fontSize: 11, fontFamily: "monospace" }}
      >🐛 debug</button>
    );
  }

  return (
    <div
      style={{ position: "fixed", bottom: 8, right: 8, zIndex: 99999,
        maxWidth: "min(92vw, 360px)", background: "#111", color: "#eee",
        border: "1px solid #444", borderRadius: 8, padding: 10,
        fontSize: 11, fontFamily: "monospace", lineHeight: 1.5,
        boxShadow: "0 4px 20px rgba(0,0,0,.4)", textAlign: "left" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "#0f0", fontWeight: "bold" }}>🐛 DEBUG BADGE</span>
        <button onClick={() => setCollapsed(true)} style={{ background: "none", color: "#888", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      <div>loading: <b style={{ color: loading ? "#fbbf24" : "#4ade80" }}>{String(loading)}</b></div>
      <div>uid: <b style={{ color: "#60a5fa", wordBreak: "break-all" }}>{user.uid}</b></div>
      <div>email: <b style={{ color: "#60a5fa", wordBreak: "break-all" }}>{user.email}</b></div>
      <div>emailVerified: <b style={{ color: user.emailVerified ? "#4ade80" : "#fbbf24" }}>{String(user.emailVerified)}</b></div>
      <div>isSuperAdmin (app): <b style={{ color: isSuperAdmin ? "#4ade80" : "#f87171" }}>{String(isSuperAdmin)}</b></div>
      <div>profile: <b style={{ color: profile ? "#60a5fa" : "#888" }}>{profile ? `${profile.role}` : "null (none)"}</b></div>
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #333" }}>
        superAdmins/&#123;uid&#125; test read:
      </div>
      <div style={{ color: testResult.startsWith("EXISTS") ? "#4ade80" : testResult.startsWith("DENIED") ? "#f87171" : "#fbbf24", wordBreak: "break-all" }}>
        {testResult}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "#666" }}>
        Go to <b style={{ color: "#aaa" }}>#/super-admin</b> to test the panel.
        Screenshot this badge and send it.
      </div>
    </div>
  );
}

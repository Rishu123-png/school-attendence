/* ============================================================
   ANNOUNCEMENTS.JS — NEW
   ============================================================ */
import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast, confirmAction } from "./app-shell.js";
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from "../services/announcement-service.js";

let activeSchoolId = "";

const TYPE_CONFIG = {
  general: { icon: "📋", cls: "badge-info"    },
  exam:    { icon: "📝", cls: "badge-warn"    },
  event:   { icon: "🎉", cls: "badge-success" },
  urgent:  { icon: "🚨", cls: "badge-danger"  }
};

function renderAnnouncements(items) {
  const list = document.getElementById("announcementsList");
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><p>No announcements yet. Post one above.</p></div>`;
    return;
  }
  items.forEach(item => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
    const div = document.createElement("div");
    div.style.cssText = "background:var(--btn-ghost-bg);border:1px solid var(--line);border-radius:14px;padding:16px;";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span class="badge ${cfg.cls}">${cfg.icon} ${item.type || "general"}</span>
            <span style="font-size:12px;color:var(--muted);">${item.targetRole === "all" ? "👥 All" : item.targetRole === "teacher" ? "👨‍🏫 Teachers" : "👨‍👩‍👦 Parents"}</span>
          </div>
          <h3 style="font-size:15px;margin-bottom:4px;">${item.title || "Untitled"}</h3>
          <p style="font-size:13px;white-space:pre-wrap;">${item.body || ""}</p>
          <p style="font-size:11px;color:var(--muted);margin-top:6px;">By ${item.author || "Admin"}</p>
        </div>
        <button class="btn-danger" style="padding:6px 12px;font-size:12px;" data-id="${item.announcementId}">🗑️</button>
      </div>`;
    div.querySelector("button").addEventListener("click", async () => {
      const ok = await confirmAction(`Delete announcement "${item.title}"?`);
      if (!ok) return;
      await deleteAnnouncement(activeSchoolId, item.announcementId);
      showToast("Announcement deleted", "success");
      await refresh();
    });
    list.appendChild(div);
  });
}

async function refresh() {
  const items = await listAnnouncements(activeSchoolId, 50);
  renderAnnouncements(items);
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  document.getElementById("announcementForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const title = document.getElementById("annTitle").value.trim();
    const body  = document.getElementById("annBody").value.trim();
    if (!title) { showToast("Title is required", "warn"); return; }
    if (!body)  { showToast("Message is required", "warn"); return; }
    const btn = document.getElementById("annSubmitBtn");
    btn.disabled = true;
    try {
      await createAnnouncement(activeSchoolId, {
        title, body,
        type:       document.getElementById("annType").value,
        targetRole: document.getElementById("annTarget").value,
        author: profile.displayName || "Admin"
      });
      document.getElementById("announcementForm").reset();
      showToast("📢 Announcement posted!", "success");
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed", "error");
    } finally { btn.disabled = false; }
  });

  await refresh();
});

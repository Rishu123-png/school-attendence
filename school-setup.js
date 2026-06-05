// school-setup.js — phase 2 school onboarding page
import { initTheme } from "./theme.js";
import { showToast, showLoading, hideLoading } from "./toast.js";
import { logAudit } from "./audit.js";
import {
  createSchoolAndAdmin,
  getCurrentUserProfile,
  requireAuth
} from "./school-service.js";
import { normalizeWhitespace } from "./security.js";

function fillUserDefaults(user) {
  const adminName = document.getElementById('adminName');
  const adminEmail = document.getElementById('adminEmail');
  if (adminName && !adminName.value) adminName.value = user.displayName || '';
  if (adminEmail && !adminEmail.value) adminEmail.value = user.email || '';
}

async function init() {
  initTheme();

  requireAuth(async user => {
    fillUserDefaults(user);

    const existingProfile = await getCurrentUserProfile();
    if (existingProfile?.schoolId) {
      const info = document.getElementById('existingProfileNotice');
      if (info) {
        info.style.display = 'block';
        info.textContent = `This account is already linked to school: ${existingProfile.schoolId}`;
      }
    }

    const form = document.getElementById('schoolSetupForm');
    form?.addEventListener('submit', async e => {
      e.preventDefault();

      const formData = {
        schoolName: normalizeWhitespace(document.getElementById('schoolName')?.value || ''),
        schoolCode: normalizeWhitespace(document.getElementById('schoolCode')?.value || ''),
        adminName: normalizeWhitespace(document.getElementById('adminName')?.value || ''),
        adminEmail: normalizeWhitespace(document.getElementById('adminEmail')?.value || ''),
        phone: normalizeWhitespace(document.getElementById('schoolPhone')?.value || ''),
        city: normalizeWhitespace(document.getElementById('schoolCity')?.value || ''),
        state: normalizeWhitespace(document.getElementById('schoolState')?.value || ''),
        website: normalizeWhitespace(document.getElementById('schoolWebsite')?.value || '')
      };

      if (!formData.schoolName || !formData.schoolCode || !formData.adminName || !formData.adminEmail) {
        showToast('Please fill school name, school code, admin name, and admin email.', 'warning');
        return;
      }

      showLoading('Creating school workspace…');
      try {
        const result = await createSchoolAndAdmin(formData);
        await logAudit('school.create', { schoolId: result.schoolId, schoolName: formData.schoolName });
        showToast('School setup completed!');
        setTimeout(() => {
          window.location.href = `school-admin.html?schoolId=${encodeURIComponent(result.schoolId)}`;
        }, 500);
      } catch (error) {
        console.error(error);
        showToast(error.message || 'School setup failed', 'error');
      } finally {
        hideLoading();
      }
    });
  });
}

window.addEventListener('DOMContentLoaded', init);
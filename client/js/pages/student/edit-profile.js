import api from '../../core/api.js';
import { icon, field, toast } from '../../core/ui.js';
import { getMe, loadCulturalGroups, getCulturalGroups, loadMe } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { YEAR_LEVELS } from '../../core/constants.js';

export function render() {
  const me = getMe();
  const profile = (me && me.profile) || {};

  const yearOptions = YEAR_LEVELS.map((level) => `<option value="${level}" ${profile.yearLevel === level ? 'selected' : ''}>${level}</option>`).join('');

  return `
  <div class="student-sub-page">
    <div class="subpage-header">
      <a class="btn btn--ghost btn--sm" href="/student" data-link>${icon('chevronLeft', 16)} Back to dashboard</a>
      <h1>Edit Profile</h1>
      <p>Keep your personal information up to date.</p>
    </div>

    <form class="card form-card" id="edit-profile-form" novalidate>
      <div class="card__header"><div><h2>Personal Information</h2><p>Fields marked with * are required.</p></div></div>
      <div class="form-grid">
        ${field('Complete Name *', `<input type="text" id="fullName" name="fullName" value="${attr(profile.fullName)}" required />`)}
        ${field('Phone Number *', `<input type="tel" id="phone" name="phone" value="${attr(profile.phone)}" required />`)}
        ${field('SR-CODE', `<input type="text" id="srCode" name="srCode" value="${attr(profile.srCode)}" />`)}
        ${field('Year Level', `<select id="yearLevel" name="yearLevel">${yearOptions}</select>`)}
        ${field('Course / Program', `<input type="text" id="program" name="program" value="${attr(profile.program)}" />`)}
        ${field('Campus', `<input type="text" id="campus" name="campus" value="${attr(profile.campus)}" />`)}
        ${field('Academic Year', `<input type="text" id="academicYear" name="academicYear" value="${attr(profile.academicYear)}" />`)}
        ${field('Cultural Group', `<select id="culturalGroupId" name="culturalGroupId"><option value="">Select group</option></select>`)}
      </div>
      <div class="form-error" id="form-error" hidden></div>
      <div class="form-actions">
        <a class="btn btn--ghost" href="/student" data-link>Cancel</a>
        <button class="btn btn--primary" type="submit" id="save-btn">${icon('check', 16)} Save changes</button>
      </div>
    </form>
  </div>`;
}

function attr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function mount() {
  await loadCulturalGroups();
  const me = getMe();
  const profile = (me && me.profile) || {};
  const select = document.getElementById('culturalGroupId');
  if (select) {
    select.innerHTML = `<option value="">Select group</option>${getCulturalGroups().map((group) => `<option value="${group.id}" ${group.id === profile.culturalGroupId ? 'selected' : ''}>${escape(group.name)}</option>`).join('')}`;
  }

  const form = document.getElementById('edit-profile-form');
  const errorBox = document.getElementById('form-error');
  const save = document.getElementById('save-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const payload = {
      fullName: form.fullName.value.trim(),
      phone: form.phone.value.trim(),
      srCode: form.srCode.value.trim() || null,
      yearLevel: form.yearLevel.value,
      program: form.program.value.trim(),
      campus: form.campus.value.trim(),
      academicYear: form.academicYear.value.trim(),
      culturalGroupId: form.culturalGroupId.value || undefined
    };

    if (!payload.fullName || !payload.phone) {
      errorBox.textContent = 'Complete name and phone number are required.';
      errorBox.hidden = false;
      return;
    }

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      await api.put('/student/profile', payload);
      await loadMe(true);
      toast('Profile updated successfully.');
      await navigate('/student', { replace: true });
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      save.disabled = false;
      save.innerHTML = `${icon('check', 16)} Save changes`;
    }
  });
}

import { icon, field, toast } from '../core/ui.js';
import { register, homePathFor } from '../core/session.js';
import { navigate } from '../core/router.js';
import { loadCulturalGroups, getCulturalGroups } from '../core/store.js';
import { GSUITE_DOMAIN, YEAR_LEVELS, APP_NAME } from '../core/constants.js';

export function render() {
  const groups = getCulturalGroups();
  const groupOptions = groups.length
    ? groups.map((group) => `<option value="${group.id}">${escape(group.name)}</option>`).join('')
    : '<option value="">Loading cultural groups…</option>';

  const yearOptions = YEAR_LEVELS.map((level) => `<option value="${level}">${level}</option>`).join('');
  const now = new Date();
  const year = now.getFullYear();
  const defaultAY = now.getMonth() + 1 >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

  return `
  <div class="auth-shell auth-shell--register">
    <div class="auth-shell__brand">
      <a class="public-brand public-brand--light" href="/" data-link>
        <span class="brand-mark brand-mark--light">A</span>
        <span><strong>${APP_NAME}</strong><small>Office of Culture and Arts</small></span>
      </a>
    </div>

    <div class="auth-shell__panel">
      <div class="auth-card auth-card--wide">
        <span class="auth-card__kicker">Student registration</span>
        <h1>Create your account</h1>
        <p class="auth-card__subtitle">All fields marked with * are required.</p>

        <div class="alert alert--info">
          ${icon('info', 17)}
          <span>You must use your BSU GSuite email (<strong>${GSUITE_DOMAIN}</strong>). Administrator accounts are created only through the secured database seed.</span>
        </div>

        <form id="register-form" novalidate>
          <div class="form-grid">
            ${field('Complete Name *', `<input type="text" id="fullName" name="fullName" placeholder="John Monterey" autocomplete="name" required />`)}
            ${field('Email Address *', `<input type="email" id="email" name="email" placeholder="student${GSUITE_DOMAIN}" autocomplete="email" required />`)}
            ${field('Phone Number *', `<input type="tel" id="phone" name="phone" placeholder="09171234567" autocomplete="tel" required />`)}
            ${field('SR-CODE', `<input type="text" id="srCode" name="srCode" placeholder="22-00001" />`)}
            ${field('Year Level', `<select id="yearLevel" name="yearLevel">${yearOptions}</select>`)}
            ${field('Course / Program', `<input type="text" id="program" name="program" placeholder="BS Information Technology" />`)}
            ${field('Campus', `<input type="text" id="campus" name="campus" value="Alangilan Campus" />`)}
            ${field('Academic Year', `<input type="text" id="academicYear" name="academicYear" value="${defaultAY}" />`)}
            ${field('Cultural Group', `<select id="culturalGroupId" name="culturalGroupId"><option value="">Select your cultural group</option>${groupOptions}</select>`)}
          </div>

          <div class="form-grid">
            ${field('Password *', `<div class="input-with-icon">${icon('lock', 17)}<input type="password" id="password" name="password" placeholder="At least 8 characters" autocomplete="new-password" required /></div>`, 'Uppercase, lowercase, number, and special character required.')}
            ${field('Confirm Password *', `<div class="input-with-icon">${icon('lock', 17)}<input type="password" id="confirmPassword" name="confirmPassword" placeholder="Repeat your password" autocomplete="new-password" required /></div>`)}
          </div>

          <label class="checkbox checkbox--terms"><input type="checkbox" id="agree" required /> <span>I certify that the information I provided is true and correct.</span></label>

          <div class="form-error" id="form-error" hidden></div>
          <button class="btn btn--primary btn--block" type="submit" id="submit-btn">${icon('plus', 17)} Create student account</button>
        </form>

        <p class="auth-card__footer">Already registered? <a href="/login" data-link>Sign in here</a></p>
      </div>
    </div>
  </div>`;
}

function escape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function mount() {
  await loadCulturalGroups();
  const select = document.getElementById('culturalGroupId');
  if (select) {
    const groups = getCulturalGroups();
    const current = select.value;
    select.innerHTML = `<option value="">Select your cultural group</option>${groups.map((group) => `<option value="${group.id}">${escape(group.name)}</option>`).join('')}`;
    if (current) select.value = current;
  }

  const form = document.getElementById('register-form');
  const errorBox = document.getElementById('form-error');
  const submit = document.getElementById('submit-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const payload = {
      fullName: form.fullName.value.trim(),
      email: form.email.value.trim().toLowerCase(),
      phone: form.phone.value.trim(),
      srCode: form.srCode.value.trim() || null,
      yearLevel: form.yearLevel.value,
      program: form.program.value.trim() || 'Not Specified',
      campus: form.campus.value.trim() || 'Alangilan Campus',
      academicYear: form.academicYear.value.trim(),
      culturalGroupId: form.culturalGroupId.value || null,
      password: form.password.value,
      confirmPassword: form.confirmPassword.value
    };

    if (!payload.email.endsWith(GSUITE_DOMAIN)) {
      return showError(`ArtiFile uses Batangas State University Google Workspace accounts. Please use your GSuite email (e.g. student${GSUITE_DOMAIN}).`);
    }
    if (payload.password !== payload.confirmPassword) {
      return showError('Passwords do not match.');
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(payload.password)) {
      return showError('Password must be at least 8 characters with uppercase, lowercase, number, and special character.');
    }
    if (!document.getElementById('agree').checked) {
      return showError('Please certify that your information is correct.');
    }

    submit.disabled = true;
    submit.textContent = 'Creating account…';

    try {
      const me = await register(payload);
      toast('Registration successful. Welcome to ArtiFile!');
      await navigate(homePathFor(me), { replace: true });
    } catch (error) {
      showError(error.message);
      submit.disabled = false;
      submit.innerHTML = `${icon('plus', 17)} Create student account`;
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

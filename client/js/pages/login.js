import api from '../core/api.js';
import { icon, field, toast, modal } from '../core/ui.js';
import { login, homePathFor } from '../core/session.js';
import { navigate } from '../core/router.js';
import { GSUITE_DOMAIN, APP_NAME } from '../core/constants.js';

export function render() {
  return `
  <div class="auth-shell auth-shell--login">
    <div class="auth-shell__brand">
      <a class="public-brand public-brand--light" href="/" data-link>
        <span class="brand-mark brand-mark--light">A</span>
        <span><strong>${APP_NAME}</strong><small>Office of Culture and Arts</small></span>
      </a>
    </div>

    <div class="auth-shell__panel">
      <div class="auth-card">
        <span class="auth-card__kicker">Welcome back</span>
        <h1>Sign in to ArtiFile</h1>
        <p class="auth-card__subtitle">Use your Batangas State University GSuite account.</p>

        <div class="alert alert--info" id="gsuite-alert">
          ${icon('info', 17)}
          <span>Only <strong>${GSUITE_DOMAIN}</strong> accounts are allowed. Personal email addresses will be rejected.</span>
        </div>

        <form id="login-form" novalidate>
          ${field('Email Address', `
            <div class="input-with-icon">
              ${icon('mail', 17)}
              <input type="email" id="email" name="email" placeholder="student${GSUITE_DOMAIN}" autocomplete="username" required />
            </div>`)}
          ${field('Password', `
            <div class="input-with-icon">
              ${icon('lock', 17)}
              <input type="password" id="password" name="password" placeholder="Enter your password" autocomplete="current-password" required />
              <button class="input-with-icon__action" type="button" id="toggle-password" aria-label="Show password">${icon('eye', 17)}</button>
            </div>`)}
          <div class="form-row form-row--split">
            <label class="checkbox"><input type="checkbox" id="rememberMe" name="rememberMe" /> <span>Remember me</span></label>
            <button class="link-btn" type="button" id="forgot-btn">Forgot password?</button>
          </div>
          <div class="form-error" id="form-error" hidden></div>
          <button class="btn btn--primary btn--block" type="submit" id="submit-btn">${icon('lock', 17)} Sign in</button>
        </form>

        <div class="demo-accounts">
          <div class="demo-accounts__title">${icon('info', 16)} <span>Mock accounts for testing</span></div>
          <div class="demo-accounts__grid">
            <button type="button" class="demo-account" data-email="sample.student@g.batstate-u.edu.ph" data-password="SamplePass123!" aria-label="Fill student demo credentials">
              ${icon('user', 18)}
              <span>
                <strong>Student</strong>
                <small>sample.student@g.batstate-u.edu.ph</small>
                <small>SamplePass123!</small>
              </span>
            </button>
            <button type="button" class="demo-account" data-email="cultureandarts.alangilan@g.batstate-u.edu.ph" data-password="ChangeThisStrongPassword123!" aria-label="Fill admin demo credentials">
              ${icon('shield', 18)}
              <span>
                <strong>Admin</strong>
                <small>cultureandarts.alangilan@g.batstate-u.edu.ph</small>
                <small>ChangeThisStrongPassword123!</small>
              </span>
            </button>
          </div>
        </div>

        <p class="auth-card__footer">No account yet? <a href="/register" data-link>Register as a student applicant</a></p>
      </div>
    </div>
  </div>`;
}

export function mount() {
  const form = document.getElementById('login-form');
  const password = document.getElementById('password');
  const toggle = document.getElementById('toggle-password');
  const errorBox = document.getElementById('form-error');
  const submit = document.getElementById('submit-btn');
  const forgot = document.getElementById('forgot-btn');

  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.innerHTML = icon(show ? 'eyeOff' : 'eye', 17);
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  document.querySelectorAll('.demo-account').forEach((button) => {
    button.addEventListener('click', () => {
      form.email.value = button.dataset.email;
      form.password.value = button.dataset.password;
      errorBox.hidden = true;
      form.email.focus();
      toast('Demo credentials filled. Click Sign in to continue.');
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const email = form.email.value.trim();
    const pass = form.password.value;
    const rememberMe = form.rememberMe.checked;

    if (!email.endsWith(GSUITE_DOMAIN)) {
      showError(`ArtiFile uses Batangas State University Google Workspace accounts. Please use your GSuite email (e.g. student${GSUITE_DOMAIN}).`);
      return;
    }
    if (!pass) {
      showError('Please enter your password.');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Signing in…';

    try {
      const me = await login(email, pass, rememberMe);
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      toast(`Welcome back, ${me.user.fullName}.`);
      await navigate(next && next.startsWith('/') ? next : homePathFor(me), { replace: true });
    } catch (error) {
      showError(error.message);
      submit.disabled = false;
      submit.innerHTML = `${icon('lock', 17)} Sign in`;
    }
  });

  forgot.addEventListener('click', () => {
    const instance = modal({
      title: 'Forgot your password?',
      body: `
        <p class="modal__message">Enter your BSU GSuite email. Password resets are handled by the Administrative Aide VI.</p>
        ${field('GSuite Email', `<input type="email" id="forgot-email" placeholder="student${GSUITE_DOMAIN}" />`)}`,
      footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button><button class="btn btn--primary" id="forgot-submit" type="button">Send request</button>`
    });
    instance.element.querySelector('#forgot-submit').addEventListener('click', async () => {
      const email = instance.element.querySelector('#forgot-email').value.trim();
      try {
        const response = await api.post('/auth/forgot-password', { email });
        instance.close();
        toast(response.message, 'success');
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
}

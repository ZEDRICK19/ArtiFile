import api from '../../core/api.js';
import {
  icon, escapeHtml, statusBadge, initials, formatDate, toast, loadingState, emptyState, adminShell
} from '../../core/ui.js';
import { getMe } from '../../core/store.js';
import { STUDENT_TABS, CONTACT } from '../../core/constants.js';
import { renderPanel as renderRequirements } from './requirements.js';
import { renderPanel as renderResources } from './resources.js';

let dashboardData = null;
let activeTab = 'profile';

const TAB_ALIASES = {
  'pre-audition': 'pre',
  'post-audition': 'post',
  certificate: 'certificate',
  manual: 'manual',
  forms: 'forms',
  calendar: 'calendar',
  contact: 'contact',
  profile: 'profile'
};

export function render() {
  const me = getMe();
  const name = me ? me.user.fullName : 'Student Applicant';

  return `
  <div class="student-dashboard">
    <header class="student-topbar">
      <a class="public-brand public-brand--light" href="/student" data-link>
        <span class="brand-mark brand-mark--light">A</span>
        <span><strong>ArtiFile</strong><small>OCA Records System</small></span>
      </a>
      <div class="student-topbar__actions">
        <a class="icon-btn notification-pill notification-pill--light" href="/student/notifications" data-link aria-label="Notifications">
          ${icon('bell', 19)}
          ${me && me.unreadCount > 0 ? `<span class="notification-pill__count">${me.unreadCount}</span>` : ''}
        </a>
        <span class="student-topbar__name">${escapeHtml(name)}</span>
        <button class="btn btn--ghost-light btn--sm" data-logout type="button">${icon('logout', 16)} Log out</button>
      </div>
    </header>

    <div class="student-body">
      <section class="profile-card" id="profile-card">
        ${loadingState('Loading your profile…')}
      </section>

      <nav class="student-tabs" id="student-tabs" aria-label="Dashboard sections">
        ${STUDENT_TABS.map((tab) => `
          <button class="student-tab ${tab.id === activeTab ? 'is-active' : ''}" data-tab="${tab.id}" type="button">
            ${icon(tab.icon, 17)}<span>${escapeHtml(tab.label)}</span>
          </button>`).join('')}
      </nav>

      <section class="status-panel" id="status-panel"></section>

      <main class="student-tab-content" id="student-tab-content"></main>
    </div>
  </div>`;
}

export async function mount({ query = {} } = {}) {
  const requested = query.tab ? TAB_ALIASES[query.tab] : null;
  activeTab = requested || 'profile';

  bindTabs();

  try {
    const response = await api.get('/student/dashboard');
    dashboardData = response.data;
    renderProfile(dashboardData);
    renderStatus(dashboardData.status);
    await showTab(activeTab);
  } catch (error) {
    document.getElementById('profile-card').innerHTML = emptyState('Unable to load dashboard', error.message, 'alert');
    toast(error.message, 'error');
  }
}

function bindTabs() {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.tab === activeTab);
      });
      showTab(activeTab);
    });
  });
}

function renderProfile(data) {
  const card = document.getElementById('profile-card');
  if (!card) return;

  const profile = data.profile || {};
  const name = profile.fullName || data.user.fullName;
  const detail = (iconName, label, value) => `
    <div class="profile-card__detail">${icon(iconName, 16)}<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || '—')}</strong></span></div>`;

  card.innerHTML = `
    <div class="profile-card__avatar">${escapeHtml(initials(name))}</div>
    <div class="profile-card__identity">
      <h1>${escapeHtml(name)}</h1>
      <p>${escapeHtml(profile.yearLevel || '—')} · ${escapeHtml(profile.program || '—')}</p>
      <p>${escapeHtml(profile.culturalGroup || '—')}</p>
    </div>
    <div class="profile-card__contact">
      ${detail('mail', 'Email Address', data.user.email)}
      ${detail('phone', 'Phone Number', profile.phone)}
    </div>
    <div class="profile-card__action">
      <a class="btn btn--maroon btn--sm" href="/student/profile/edit" data-link>${icon('edit', 16)} Edit Profile</a>
      <a class="link-btn" href="/student/status" data-link>View application status ${icon('chevronRight', 14)}</a>
    </div>`;
}

function renderStatus(status) {
  const panel = document.getElementById('status-panel');
  if (!panel || !status) return;
  panel.className = `status-panel status-panel--${status.tone || 'info'}`;
  panel.innerHTML = `
    <div class="status-panel__icon">${icon(status.tone === 'success' ? 'checkCircle' : status.tone === 'danger' ? 'alert' : 'info', 22)}</div>
    <div class="status-panel__body">
      <div class="status-panel__title">
        <h2>${escapeHtml(status.label)}</h2>
        ${statusBadge(status.code)}
      </div>
      <p>${escapeHtml(status.message)}</p>
    </div>`;
}

async function showTab(tab) {
  const content = document.getElementById('student-tab-content');
  if (!content) return;

  if (tab === 'profile') {
    renderProfileInfo(content);
    return;
  }

  if (tab === 'pre' || tab === 'post') {
    content.innerHTML = '';
    await renderRequirements(content, { category: tab === 'pre' ? 'PRE_AUDITION' : 'POST_AUDITION' });
    return;
  }

  content.innerHTML = '';
  await renderResources(content, tab);
}

function renderProfileInfo(content) {
  const data = dashboardData || {};
  const profile = data.profile || {};
  const application = data.application || {};

  const cards = [
    ['user', 'Complete Name', profile.fullName],
    ['mail', 'Email Address', data.user ? data.user.email : ''],
    ['phone', 'Phone Number', profile.phone],
    ['shield', 'SR-CODE', profile.srCode],
    ['home', 'College / Campus', profile.campus],
    ['book', 'Course / Program', profile.program],
    ['layer', 'Year Level', profile.yearLevel],
    ['calendar', 'Academic Year', profile.academicYear],
    ['users', 'Cultural Group', profile.culturalGroup],
    ['clock', 'Application Date', formatDate(application.appliedAt)]
  ];

  content.innerHTML = `
    <section class="info-section">
      <div class="info-section__head">
        <h2>Profile Information</h2>
        <a class="btn btn--ghost btn--sm" href="/student/profile/edit" data-link>${icon('edit', 15)} Edit details</a>
      </div>
      <div class="info-grid">
        ${cards.map(([iconName, label, value]) => `
          <article class="info-card">
            <span class="info-card__icon">${icon(iconName, 19)}</span>
            <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || '—')}</strong></div>
          </article>`).join('')}
      </div>
    </section>`;
}

export function renderStatusPage() {
  const me = getMe();
  const data = dashboardData;
  const status = data ? data.status : (me && me.status) || null;

  return `
  <div class="student-sub-page">
    <div class="subpage-header">
      <a class="btn btn--ghost btn--sm" href="/student" data-link>${icon('chevronLeft', 16)} Back to dashboard</a>
      <h1>Application Status</h1>
    </div>
    <section class="status-panel status-panel--${status ? status.tone : 'info'}" id="standalone-status">
      ${status ? `
        <div class="status-panel__icon">${icon('info', 22)}</div>
        <div class="status-panel__body">
          <div class="status-panel__title"><h2>${escapeHtml(status.label)}</h2>${statusBadge(status.code)}</div>
          <p>${escapeHtml(status.message)}</p>
        </div>` : loadingState('Loading status…')}
    </section>
    <div id="status-documents" class="status-documents"></div>
  </div>`;
}

export async function mountStatusPage() {
  try {
    const response = await api.get('/student/application');
    const status = response.data.status;
    const panel = document.getElementById('standalone-status');
    if (panel) {
      panel.className = `status-panel status-panel--${status.tone || 'info'}`;
      panel.innerHTML = `
        <div class="status-panel__icon">${icon(status.tone === 'success' ? 'checkCircle' : 'alert', 22)}</div>
        <div class="status-panel__body">
          <div class="status-panel__title"><h2>${escapeHtml(status.label)}</h2>${statusBadge(status.code)}</div>
          <p>${escapeHtml(status.message)}</p>
        </div>`;
    }

    const docs = await api.get('/documents/my-documents');
    const container = document.getElementById('status-documents');
    if (!container) return;
    const items = Array.isArray(docs.data) ? docs.data : [];
    container.innerHTML = `
      <div class="card">
        <div class="card__header"><div><h2>Submitted documents</h2><p>Review status of each requirement.</p></div></div>
        ${items.length === 0
          ? emptyState('No documents yet', 'Upload your pre-audition requirements to see them here.', 'file')
          : `<div class="doc-mini-list">${items.map((doc) => `
              <div class="doc-mini">
                <div>${icon('file', 17)}<span><strong>${escapeHtml(doc.requirement.title)}</strong><small>${escapeHtml(doc.currentFileName || 'No file')}</small></span></div>
                ${statusBadge(doc.status)}
              </div>`).join('')}</div>`}
      </div>`;
  } catch (error) {
    toast(error.message, 'error');
  }
}

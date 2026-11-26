import api from '../../core/api.js';
import { icon, escapeHtml, formatDate, emptyState, loadingState } from '../../core/ui.js';
import { CONTACT } from '../../core/constants.js';

export function render() {
  return `
  <div class="student-sub-page">
    <div class="subpage-header">
      <a class="btn btn--ghost btn--sm" href="/student" data-link>${icon('chevronLeft', 16)} Back to dashboard</a>
      <h1 id="resource-title">Resources</h1>
    </div>
    <div id="resource-panel">${loadingState('Loading resources…')}</div>
  </div>`;
}

export async function mount({ params = {} } = {}) {
  const tab = params.tab || 'forms';
  const container = document.getElementById('resource-panel');
  const title = document.getElementById('resource-title');
  if (title) title.textContent = titleFor(tab);
  if (container) await renderPanel(container, tab);
}

function titleFor(tab) {
  const map = {
    certificate: 'Certificate of Membership',
    manual: 'Culture and Arts Manual',
    forms: 'Forms',
    calendar: 'Calendar of Activities',
    contact: 'Contact Details'
  };
  return map[tab] || 'Resources';
}

export async function renderPanel(container, tab) {
  container.innerHTML = loadingState('Loading…');

  let resources = { FORM: [], MANUAL: [], CERTIFICATE: [] };
  let events = [];
  let contact = {};

  try {
    const [resourceResponse, eventResponse, contactResponse] = await Promise.all([
      api.get('/resources'),
      api.get('/resources/events'),
      api.get('/resources/contact')
    ]);
    resources = resourceResponse.data || resources;
    events = Array.isArray(eventResponse.data) ? eventResponse.data : [];
    contact = contactResponse.data || {};
  } catch (error) {
    container.innerHTML = emptyState('Unable to load resources', error.message, 'alert');
    return;
  }

  if (tab === 'certificate') {
    container.innerHTML = certificateHtml(resources.CERTIFICATE || []);
    return;
  }

  if (tab === 'manual') {
    container.innerHTML = manualHtml(resources.MANUAL || []);
    return;
  }

  if (tab === 'forms') {
    const forms = Array.isArray(resources.FORM) ? resources.FORM : [];
    container.innerHTML = forms.length === 0
      ? emptyState('No forms configured', 'Please coordinate with the OCA office to request a form.', 'forms')
      : formsHtml(forms);
    return;
  }

  if (tab === 'calendar') {
    container.innerHTML = calendarHtml(events);
    return;
  }

  container.innerHTML = contactHtml(contact);
}

function resourceLink(resource) {
  if (resource.externalUrl) {
    return `<a class="btn btn--ghost btn--sm" href="${escapeHtml(resource.externalUrl)}" target="_blank" rel="noopener">${icon('external', 15)} Open document</a>`;
  }
  return `<span class="muted">Available at the OCA office</span>`;
}

function certificateHtml(items) {
  if (items.length === 0) {
    return emptyState('Certificate of Membership', 'Please coordinate with the OCA office to request your certificate.', 'certificate');
  }
  return `
  <div class="resource-grid">
    ${items.map((item) => `
      <article class="resource-card">
        <span class="resource-card__icon">${icon('certificate', 24)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || 'Official Certificate of Membership issued by the Office of Culture and Arts.')}</p>
        <div class="resource-card__actions">${resourceLink(item)}</div>
      </article>`).join('')}
  </div>`;
}

function manualHtml(items) {
  if (items.length === 0) {
    return emptyState('OCA File', 'The Culture and Arts Manual is available at the OCA office.', 'book');
  }
  return `
  <div class="resource-grid">
    ${items.map((item) => `
      <article class="resource-card">
        <span class="resource-card__icon">${icon('book', 24)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description || 'Culture and Arts Manual of the Office of Culture and Arts.')}</p>
        <div class="resource-card__actions">${resourceLink(item)}</div>
      </article>`).join('')}
  </div>`;
}

function formsHtml(items) {
  return `
  <div class="card">
    <div class="card__header"><div><h2>Available Forms</h2><p>Download or request copies from the OCA office.</p></div></div>
    <div class="form-list">
      ${items.map((item, index) => `
        <div class="form-list__row">
          <span class="form-list__number">${String(index + 1).padStart(2, '0')}</span>
          <span>${icon('file', 17)} ${escapeHtml(item.title)}</span>
          ${resourceLink(item)}
        </div>`).join('')}
    </div>
  </div>`;
}

function calendarHtml(events) {
  if (events.length === 0) {
    return emptyState('No events scheduled', 'Check back later for upcoming OCA activities.', 'calendar');
  }
  return `
  <div class="event-grid">
    ${events.map((event) => `
      <article class="event-card">
        <div class="event-card__date">
          <strong>${new Date(event.startAt).getDate()}</strong>
          <span>${new Date(event.startAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}</span>
        </div>
        <div class="event-card__body">
          <h3>${escapeHtml(event.title)}</h3>
          ${event.location ? `<p>${icon('home', 14)} ${escapeHtml(event.location)}</p>` : ''}
          <small>${formatDate(event.startAt, true)}</small>
          ${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}
        </div>
      </article>`).join('')}
  </div>`;
}

function contactHtml(settings) {
  const facebook = settings.fbPage || CONTACT.facebook;
  const email = settings.contactEmail || CONTACT.email;
  const telephone = settings.telephone || CONTACT.telephone;
  const office = settings.officeAddress || CONTACT.office;

  return `
  <div class="contact-grid">
    <a class="contact-card" href="${escapeHtml(facebook)}" target="_blank" rel="noopener">
      <span class="contact-card__icon">${icon('external', 22)}</span>
      <div><small>Facebook Page</small><strong>${escapeHtml(facebook)}</strong></div>
    </a>
    <a class="contact-card" href="mailto:${escapeHtml(email)}">
      <span class="contact-card__icon">${icon('mail', 22)}</span>
      <div><small>Email Address</small><strong>${escapeHtml(email)}</strong></div>
    </a>
    <div class="contact-card">
      <span class="contact-card__icon">${icon('phone', 22)}</span>
      <div><small>Telephone Numbers</small><strong>${escapeHtml(telephone)}</strong></div>
    </div>
  </div>
  <div class="alert alert--info" style="margin-top:18px">${icon('home', 17)} <span>${escapeHtml(office)}</span></div>`;
}

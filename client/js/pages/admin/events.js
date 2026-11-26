import api from '../../core/api.js';
import {
  icon, escapeHtml, formatDate, adminShell, loadingState, emptyState, toast, modal, confirmModal
} from '../../core/ui.js';
import { getMe } from '../../core/store.js';

export function render({ query = {} } = {}) {
  const me = getMe();
  return adminShell({
    title: 'Calendar, Forms & Resources',
    subtitle: 'Manage events, forms, manual, and membership resources',
    active: '/admin/events',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `<div id="admin-events-page">${loadingState('Loading calendar and resources…')}</div>`
  });
}

export async function mount({ query = {} } = {}) {
  const container = document.getElementById('admin-events-page');
  if (!container) return;

  try {
    const [eventResponse, resourceResponse] = await Promise.all([
      api.get('/admin/events'),
      api.get('/admin/resources')
    ]);
    const events = Array.isArray(eventResponse.data) ? eventResponse.data : [];
    const resources = Array.isArray(resourceResponse.data) ? resourceResponse.data : [];

    container.innerHTML = `
      <div class="dash-columns">
        <section class="card" id="events-section">
          <div class="card__header">
            <div><h2>Calendar of Activities</h2><p>${events.length} event(s)</p></div>
            <button class="btn btn--primary btn--sm" id="add-event" type="button">${icon('plus', 15)} Add event</button>
          </div>
          ${events.length === 0
            ? emptyState('No events', 'Add an event to populate the calendar.', 'calendar')
            : `<div class="admin-event-list">${events.map((event) => `
                <div class="admin-event">
                  <div class="admin-event__date">${formatDate(event.startAt, true)}</div>
                  <div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.location || 'No location')}</p></div>
                  <div class="table-actions">
                    <button class="icon-btn" data-edit-event="${event.id}" title="Edit" type="button">${icon('edit', 16)}</button>
                    <button class="icon-btn" data-delete-event="${event.id}" title="Remove" type="button">${icon('trash', 16)}</button>
                  </div>
                </div>`).join('')}</div>`}
        </section>

        <section class="card" id="forms-section">
          <div class="card__header">
            <div><h2>Forms & Resources</h2><p>Documents available to students</p></div>
            <button class="btn btn--primary btn--sm" id="add-resource" type="button">${icon('plus', 15)} Add resource</button>
          </div>
          ${resources.length === 0
            ? emptyState('No resources', 'Seed the database to load default forms.', 'forms')
            : `<div class="table-wrap"><table class="table">
                <thead><tr><th>Title</th><th>Kind</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>${resources.map((resource) => `
                  <tr>
                    <td>${escapeHtml(resource.title)}</td>
                    <td>${escapeHtml(resource.kind)}</td>
                    <td>${resource.isActive ? '<span class="badge badge--success">Active</span>' : '<span class="badge badge--neutral">Inactive</span>'}</td>
                    <td><div class="table-actions">
                      <button class="icon-btn" data-edit-resource="${resource.id}" title="Edit" type="button">${icon('edit', 16)}</button>
                      <button class="icon-btn" data-delete-resource="${resource.id}" title="Remove" type="button">${icon('trash', 16)}</button>
                    </div></td>
                  </tr>`).join('')}</tbody>
              </table></div>`}
        </section>
      </div>`;

    bindEvents(events, resources, container);
    if (query._hash === 'forms') {
      const forms = document.getElementById('forms-section');
      if (forms) forms.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    container.innerHTML = emptyState('Unable to load resources', error.message, 'alert');
    toast(error.message, 'error');
  }
}

function bindEvents(events, resources, container) {
  const addEvent = document.getElementById('add-event');
  if (addEvent) addEvent.addEventListener('click', () => eventModal(null, container));

  container.querySelectorAll('[data-edit-event]').forEach((button) => {
    button.addEventListener('click', () => {
      const found = events.find((item) => item.id === button.dataset.editEvent);
      if (found) eventModal(found, container);
    });
  });

  container.querySelectorAll('[data-delete-event]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await confirmModal({ title: 'Remove event?', message: 'This event will no longer appear on the calendar.', confirmText: 'Remove', danger: true });
      if (!confirmed) return;
      try {
        await api.del(`/admin/events/${button.dataset.deleteEvent}`);
        toast('Event removed.');
        await mount({ query: {} });
      } catch (error) { toast(error.message, 'error'); }
    });
  });

  const addResource = document.getElementById('add-resource');
  if (addResource) addResource.addEventListener('click', () => resourceModal(null, container));

  container.querySelectorAll('[data-edit-resource]').forEach((button) => {
    button.addEventListener('click', () => {
      const found = resources.find((item) => item.id === button.dataset.editResource);
      if (found) resourceModal(found, container);
    });
  });

  container.querySelectorAll('[data-delete-resource]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await confirmModal({ title: 'Remove resource?', message: 'This resource will no longer be shown to students.', confirmText: 'Remove', danger: true });
      if (!confirmed) return;
      try {
        await api.del(`/admin/resources/${button.dataset.deleteResource}`);
        toast('Resource removed.');
        await mount({ query: {} });
      } catch (error) { toast(error.message, 'error'); }
    });
  });
}

function isoLocal(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function eventModal(event, container) {
  const instance = modal({
    title: event ? 'Edit event' : 'Add event',
    body: `
      <label class="field"><span class="field__label">Title</span><input id="ev-title" value="${escapeAttr(event ? event.title : '')}" /></label>
      <label class="field"><span class="field__label">Description</span><textarea id="ev-desc" rows="3">${escapeHtml(event ? event.description || '' : '')}</textarea></label>
      <label class="field"><span class="field__label">Location</span><input id="ev-location" value="${escapeAttr(event ? event.location || '' : '')}" /></label>
      <label class="field"><span class="field__label">Start Date & Time</span><input type="datetime-local" id="ev-start" value="${event ? isoLocal(event.startAt) : ''}" /></label>`,
    footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button><button class="btn btn--primary" id="ev-save" type="button">Save event</button>`
  });

  instance.element.querySelector('#ev-save').addEventListener('click', async () => {
    const payload = {
      title: instance.element.querySelector('#ev-title').value.trim(),
      description: instance.element.querySelector('#ev-desc').value.trim(),
      location: instance.element.querySelector('#ev-location').value.trim(),
      startAt: instance.element.querySelector('#ev-start').value
    };
    try {
      if (event) await api.put(`/admin/events/${event.id}`, payload);
      else await api.post('/admin/events', payload);
      instance.close();
      toast(event ? 'Event updated.' : 'Event created.');
      await mount({ query: {} });
    } catch (error) { toast(error.message, 'error'); }
  });
}

function resourceModal(resource, container) {
  const instance = modal({
    title: resource ? 'Edit resource' : 'Add resource',
    body: `
      <label class="field"><span class="field__label">Title</span><input id="rs-title" value="${escapeAttr(resource ? resource.title : '')}" /></label>
      <label class="field"><span class="field__label">Key (unique identifier)</span><input id="rs-key" value="${escapeAttr(resource ? resource.key : '')}" placeholder="e.g. new_form" ${resource ? 'disabled' : ''} /></label>
      <label class="field"><span class="field__label">Kind</span><select id="rs-kind">
        <option value="FORM" ${resource && resource.kind === 'FORM' ? 'selected' : ''}>Form</option>
        <option value="MANUAL" ${resource && resource.kind === 'MANUAL' ? 'selected' : ''}>Manual</option>
        <option value="CERTIFICATE" ${resource && resource.kind === 'CERTIFICATE' ? 'selected' : ''}>Certificate</option>
      </select></label>
      <label class="field"><span class="field__label">Description</span><textarea id="rs-desc" rows="2">${escapeHtml(resource ? resource.description || '' : '')}</textarea></label>
      <label class="field"><span class="field__label">External URL (optional)</span><input id="rs-url" value="${escapeAttr(resource ? resource.externalUrl || '' : '')}" placeholder="https://" /></label>`,
    footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button><button class="btn btn--primary" id="rs-save" type="button">Save resource</button>`
  });

  instance.element.querySelector('#rs-save').addEventListener('click', async () => {
    const payload = {
      title: instance.element.querySelector('#rs-title').value.trim(),
      key: instance.element.querySelector('#rs-key').value.trim(),
      kind: instance.element.querySelector('#rs-kind').value,
      description: instance.element.querySelector('#rs-desc').value.trim(),
      externalUrl: instance.element.querySelector('#rs-url').value.trim()
    };
    try {
      if (resource) await api.put(`/admin/resources/${resource.id}`, payload);
      else await api.post('/admin/resources', payload);
      instance.close();
      toast(resource ? 'Resource updated.' : 'Resource created.');
      await mount({ query: {} });
    } catch (error) { toast(error.message, 'error'); }
  });
}

function escapeAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderAccounts() {
  const me = getMe();
  return adminShell({
    title: 'Account Management',
    subtitle: 'Student accounts and administrative access',
    active: '/admin/account-management',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `
      <div class="alert alert--info">${icon('shield', 17)} <span>Administrator accounts are created only through the secured database seed process. Public registration always assigns the Student role.</span></div>
      <div class="card">
        <div class="card__header"><div><h2>Registered Accounts</h2><p>Manage student applicant access</p></div>
          <a class="btn btn--primary btn--sm" href="/admin/applicants" data-link>${icon('users', 15)} View applicants</a>
        </div>
        <div class="state state--empty">${icon('info', 28)}<h3>Manage accounts from the Applicants page</h3><p>Open an applicant record to update status, archive, or restore access.</p><a class="btn btn--ghost" href="/admin/applicants" data-link>Go to applicants</a></div>
      </div>`
  });
}

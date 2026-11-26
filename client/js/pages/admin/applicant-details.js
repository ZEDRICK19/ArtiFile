import api from '../../core/api.js';
import {
  icon, escapeHtml, statusBadge, formatDate, formatDateTime, adminShell, loadingState,
  emptyState, toast, modal, confirmModal
} from '../../core/ui.js';
import { getMe } from '../../core/store.js';
import { APPLICATION_STATUSES } from '../../core/constants.js';

let applicant = null;

export function render({ params = {} } = {}) {
  const me = getMe();
  return adminShell({
    title: 'Applicant Record',
    subtitle: 'Complete applicant profile and requirements',
    active: '/admin/applicants',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `<div id="applicant-detail">${loadingState('Loading applicant record…')}</div>`
  });
}

export async function mount({ params = {} } = {}) {
  const container = document.getElementById('applicant-detail');
  if (!container) return;

  try {
    const response = await api.get(`/admin/applicants/${params.id}`);
    applicant = response.data;
    renderApplicant(container, applicant);
    bindActions(params.id);
  } catch (error) {
    container.innerHTML = emptyState('Applicant not found', error.message, 'alert');
    toast(error.message, 'error');
  }
}

function renderApplicant(container, data) {
  const application = data.application || {};
  const groups = data.requirementsByCategory || { PRE_AUDITION: [], POST_AUDITION: [] };

  const detail = (iconName, label, value) => `
    <article class="detail-card"><span>${icon(iconName, 18)}</span><div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || '—')}</strong></div></article>`;

  const requirementTable = (group, title) => `
    <section class="card" id="requirements">
      <div class="card__header"><div><h2>${title}</h2><p>Review status and submission history</p></div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Requirement</th><th>Status</th><th>File</th><th>Submitted</th><th>Action</th></tr></thead>
          <tbody>
            ${group.length === 0
              ? '<tr><td colspan="5" class="table__empty">No requirements configured.</td></tr>'
              : group.map((item) => {
                  const doc = item.document || {};
                  return `
                  <tr>
                    <td>${escapeHtml(item.title)}</td>
                    <td>${statusBadge(doc.status || 'NOT_SUBMITTED')}</td>
                    <td>${escapeHtml(doc.currentFileName || '—')}</td>
                    <td>${formatDate(doc.submittedAt)}</td>
                    <td>
                      ${doc.id
                        ? `<div class="table-actions"><a class="icon-btn" title="Open document viewer" href="/admin/documents/${doc.id}" data-link>${icon('eye', 16)}</a><button class="icon-btn" data-download="${doc.id}" title="Download" type="button">${icon('download', 16)}</button></div>`
                        : '<span class="muted">Not submitted</span>'}
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </section>`;

  container.innerHTML = `
    <div class="detail-toolbar">
      <a class="btn btn--ghost btn--sm" href="/admin/applicants" data-link>${icon('chevronLeft', 16)} Back to applicants</a>
      <div>
        <button class="btn btn--ghost btn--sm" id="archive-btn" type="button">${icon('folder', 15)} ${data.archivedAt ? 'Restore record' : 'Archive record'}</button>
        <button class="btn btn--primary btn--sm" id="status-btn" type="button">${icon('layer', 15)} Update status</button>
      </div>
    </div>

    <section class="card detail-hero">
      <div class="detail-hero__top">
        <span class="avatar avatar--lg">${escapeHtml(initialsValue(data.fullName))}</span>
        <div><h2>${escapeHtml(data.fullName)}</h2><p>${escapeHtml(data.culturalGroup)} · ${escapeHtml(data.yearLevel)} · ${escapeHtml(data.program)}</p></div>
        <div class="detail-hero__status">${statusBadge(application.status || 'PENDING')}</div>
      </div>
      ${application.feedback ? `<div class="feedback feedback--danger"><strong>${icon('alert', 15)} Admin feedback</strong><p>${escapeHtml(application.feedback)}</p></div>` : ''}
      <div class="detail-grid">
        ${detail('mail', 'Email Address', data.email)}
        ${detail('phone', 'Phone Number', data.phone)}
        ${detail('shield', 'SR-CODE', data.srCode)}
        ${detail('home', 'Campus', data.campus)}
        ${detail('calendar', 'Academic Year', data.academicYear)}
        ${detail('clock', 'Registration Date', formatDate(data.registrationDate))}
        ${detail('layer', 'Application Status', application.status)}
        ${detail('checkCircle', 'Status Decided At', formatDateTime(application.decidedAt))}
      </div>
    </section>

    ${requirementTable(groups.PRE_AUDITION || [], 'Pre-Audition Requirements')}
    ${requirementTable(groups.POST_AUDITION || [], 'Post-Audition Requirements')}

    <section class="card">
      <div class="card__header"><div><h2>Recent Activity</h2><p>Latest logged actions for this applicant</p></div></div>
      ${(data.activityLogs || []).length === 0
        ? emptyState('No activity yet', 'Actions involving this applicant will appear here.', 'clock')
        : `<div class="timeline">${data.activityLogs.map((log) => `
            <div class="timeline__item"><span>${icon('clock', 14)}</span><div><strong>${escapeHtml(log.action.replace(/_/g, ' '))}</strong><p>${escapeHtml(log.details || '')}</p><small>${escapeHtml(log.actor ? log.actor.email : '')} · ${formatDateTime(log.createdAt)}</small></div></div>`).join('')}</div>`}
    </section>`;
}

function initialsValue(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

function bindActions(id) {
  const statusButton = document.getElementById('status-btn');
  if (statusButton) {
    statusButton.addEventListener('click', () => {
      const current = applicant && applicant.application ? applicant.application.status : 'PENDING';
      const instance = modal({
        title: 'Update Application Status',
        body: `
          <label class="field"><span class="field__label">Application Status</span>
            <select id="new-status">${APPLICATION_STATUSES.map((status) => `<option value="${status}" ${status === current ? 'selected' : ''}>${escapeHtml(status.replace('_', ' '))}</option>`).join('')}</select>
          </label>
          <label class="field"><span class="field__label">Feedback / Reason</span>
            <textarea id="status-feedback" rows="3" placeholder="Required when rejecting"></textarea>
          </label>
          <div class="alert alert--warning">${icon('alert', 16)} <span>Accepting unlocks post-audition requirements and notifies the student. Rejecting sends an email notification.</span></div>`,
        footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button><button class="btn btn--primary" id="save-status" type="button">Confirm change</button>`
      });

      instance.element.querySelector('#save-status').addEventListener('click', async () => {
        const status = instance.element.querySelector('#new-status').value;
        const feedback = instance.element.querySelector('#status-feedback').value.trim();
        const confirmed = await confirmModal({
          title: 'Confirm status change',
          message: `Change this applicant's status to ${status.replace('_', ' ').toLowerCase()}?`,
          confirmText: 'Yes, change status',
          danger: status === 'REJECTED'
        });
        if (!confirmed) return;

        try {
          await api.put(`/admin/applicants/${id}/status`, { status, feedback: feedback || null });
          instance.close();
          toast('Application status updated.');
          await mount({ params: { id } });
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  }

  const archiveButton = document.getElementById('archive-btn');
  if (archiveButton) {
    archiveButton.addEventListener('click', async () => {
      const isArchived = Boolean(applicant && applicant.archivedAt);
      const confirmed = await confirmModal({
        title: isArchived ? 'Restore applicant record?' : 'Archive applicant record?',
        message: isArchived ? 'The applicant will regain access to the system.' : 'The applicant will lose system access but all records remain stored.',
        confirmText: isArchived ? 'Restore' : 'Archive',
        danger: !isArchived
      });
      if (!confirmed) return;
      try {
        await api.post(`/admin/applicants/${id}/archive`);
        toast(isArchived ? 'Applicant restored.' : 'Applicant archived.');
        await mount({ params: { id } });
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }

  document.querySelectorAll('[data-download]').forEach((button) => {
    button.addEventListener('click', () => window.open(api.fileUrl(button.dataset.download, true), '_blank'));
  });
}

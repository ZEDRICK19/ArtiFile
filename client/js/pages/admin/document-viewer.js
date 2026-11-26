import api from '../../core/api.js';
import {
  icon, escapeHtml, statusBadge, formatDateTime, formatBytes, adminShell, loadingState,
  emptyState, toast, modal, confirmModal
} from '../../core/ui.js';
import { getMe } from '../../core/store.js';

export function render({ params = {} } = {}) {
  const me = getMe();
  return adminShell({
    title: 'Document Viewer',
    subtitle: 'Preview, review, and download submitted documents',
    active: '/admin/documents',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `<div id="document-viewer">${loadingState('Loading document…')}</div>`
  });
}

export async function mount({ params = {} } = {}) {
  const container = document.getElementById('document-viewer');
  if (!container) return;

  try {
    const response = await api.get(`/documents/${params.id}`);
    const doc = response.data;
    renderDocument(container, doc);
    bindActions(doc, params.id);
  } catch (error) {
    container.innerHTML = emptyState('Document unavailable', error.message, 'alert');
    toast(error.message, 'error');
  }
}

function renderDocument(container, doc) {
  const mime = doc.currentMimeType || '';
  const fileUrl = api.fileUrl(doc.id, false);

  let preview;
  if (mime === 'application/pdf') {
    preview = `<iframe class="doc-preview" src="${fileUrl}" title="PDF preview"></iframe>`;
  } else if (mime.startsWith('image/')) {
    preview = `<img class="doc-preview doc-preview--image" src="${fileUrl}" alt="Document preview" />`;
  } else {
    preview = `<div class="state state--empty">${icon('file', 32)}<h3>Preview not available</h3><p>Download the file to view it.</p></div>`;
  }

  container.innerHTML = `
    <div class="detail-toolbar">
      <a class="btn btn--ghost btn--sm" href="/admin/documents" data-link>${icon('chevronLeft', 16)} Back to documents</a>
      <a class="btn btn--primary btn--sm" href="${api.fileUrl(doc.id, true)}" target="_blank" rel="noopener">${icon('download', 16)} Download</a>
    </div>

    <div class="viewer-grid">
      <section class="card viewer-preview">
        <div class="card__header"><div><h2>${escapeHtml(doc.currentFileName || 'Document')}</h2><p>${escapeHtml(doc.requirement.title)}</p></div>${statusBadge(doc.status)}</div>
        ${preview}
      </section>

      <aside class="viewer-side">
        <section class="card">
          <div class="card__header"><div><h2>Document Details</h2></div></div>
          <div class="detail-grid detail-grid--tight">
            <div class="detail-card"><span>${icon('user', 17)}</span><div><small>Applicant</small><strong>${escapeHtml(doc.application.user ? doc.application.user.email : '—')}</strong></div></div>
            <div class="detail-card"><span>${icon('file', 17)}</span><div><small>Requirement</small><strong>${escapeHtml(doc.requirement.title)}</strong></div></div>
            <div class="detail-card"><span>${icon('layer', 17)}</span><div><small>Category</small><strong>${escapeHtml(doc.requirement.category.replace('_', ' '))}</strong></div></div>
            <div class="detail-card"><span>${icon('clock', 17)}</span><div><small>Submitted</small><strong>${formatDateTime(doc.submittedAt)}</strong></div></div>
            <div class="detail-card"><span>${icon('file', 17)}</span><div><small>File size</small><strong>${formatBytes(doc.currentFileSize)}</strong></div></div>
            <div class="detail-card"><span>${icon('checkCircle', 17)}</span><div><small>Reviewed by</small><strong>${escapeHtml(doc.reviewedBy ? doc.reviewedBy.email : '—')}</strong></div></div>
          </div>
        </section>

        ${doc.feedback ? `<div class="feedback feedback--danger"><strong>${icon('alert', 15)} Feedback sent to student</strong><p>${escapeHtml(doc.feedback)}</p></div>` : ''}

        <section class="card">
          <div class="card__header"><div><h2>Review Actions</h2><p>Each action notifies the student</p></div></div>
          <div class="review-actions">
            <button class="btn btn--success btn--block" data-review="ACCEPTED" type="button">${icon('check', 16)} Accept document</button>
            <button class="btn btn--warning btn--block" data-review="REVISION_REQUIRED" type="button">${icon('refresh', 16)} Request revision</button>
            <button class="btn btn--danger btn--block" data-review="REJECTED" type="button">${icon('x', 16)} Reject document</button>
            <button class="btn btn--ghost btn--block" data-review="UNDER_REVIEW" type="button">${icon('eye', 16)} Mark under review</button>
          </div>
        </section>

        <section class="card">
          <div class="card__header"><div><h2>Submission History</h2><p>${(doc.history || []).length} version(s)</p></div></div>
          <div class="timeline">
            ${(doc.history || []).slice().reverse().map((version) => `
              <div class="timeline__item"><span>${icon(version.action === 'REPLACE' ? 'refresh' : 'upload', 14)}</span>
                <div><strong>Version ${version.version} · ${escapeHtml(version.action)}</strong><p>${escapeHtml(version.fileName)}</p><small>${formatDateTime(version.createdAt)}</small></div>
              </div>`).join('')}
          </div>
        </section>
      </aside>
    </div>`;
}

function bindActions(doc, id) {
  document.querySelectorAll('[data-review]').forEach((button) => {
    button.addEventListener('click', async () => {
      const status = button.dataset.review;
      let feedback = null;

      if (status === 'REVISION_REQUIRED' || status === 'REJECTED') {
        const instance = modal({
          title: status === 'REJECTED' ? 'Reject document' : 'Request revision',
          body: `
            <label class="field"><span class="field__label">Reason / Feedback (required)</span>
              <textarea id="review-feedback" rows="4" placeholder="Explain clearly what the student should do"></textarea>
            </label>`,
          footer: `<button class="btn btn--ghost" data-modal-close type="button">Cancel</button><button class="btn btn--primary" id="send-review" type="button">Send to student</button>`
        });
        feedback = await new Promise((resolve) => {
          instance.element.querySelector('#send-review').addEventListener('click', () => {
            const value = instance.element.querySelector('#review-feedback').value.trim();
            instance.close();
            resolve(value);
          });
          instance.element.addEventListener('click', (event) => {
            if (event.target === instance.element || event.target.closest('[data-modal-close]')) resolve(null);
          });
        });
        if (!feedback) return;
      }

      const confirmed = await confirmModal({
        title: 'Confirm review',
        message: `Set “${doc.requirement.title}” to ${status.replace('_', ' ').toLowerCase()}?`,
        confirmText: 'Save review',
        danger: status === 'REJECTED'
      });
      if (!confirmed) return;

      try {
        await api.put(`/admin/documents/${id}/review`, { status, feedback });
        toast('Review saved. The student has been notified.');
        await mount({ params: { id } });
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

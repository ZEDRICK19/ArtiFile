import api from '../../core/api.js';
import { icon, escapeHtml, statusBadge, formatDateTime, adminShell, loadingState, emptyState, toast } from '../../core/ui.js';
import { getMe } from '../../core/store.js';

let page = 1;
let limit = 20;

export function render() {
  const me = getMe();
  return adminShell({
    title: 'Activity Logs',
    subtitle: 'Audit trail of important system actions',
    active: '/admin/activity-logs',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `<div id="activity-panel">${loadingState('Loading activity logs…')}</div>`
  });
}

export async function mount() {
  await loadLogs();
}

async function loadLogs() {
  const panel = document.getElementById('activity-panel');
  if (!panel) return;

  try {
    const response = await api.get('/admin/activity-logs', { page, limit });
    const items = Array.isArray(response.data) ? response.data : [];
    const meta = response.meta || { page: 1, totalPages: 1, total: 0 };

    panel.innerHTML = `
      <div class="card">
        <div class="card__header"><div><h2>System Activity</h2><p>${meta.total} logged action(s)</p></div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Date & Time</th><th>User</th><th>Action</th><th>Details</th><th>IP Address</th></tr></thead>
            <tbody>
              ${items.length === 0
                ? '<tr><td colspan="5" class="table__empty">No activity recorded yet.</td></tr>'
                : items.map((log) => `
                  <tr>
                    <td>${formatDateTime(log.createdAt)}</td>
                    <td>${escapeHtml(log.actor ? log.actor.email : '—')}</td>
                    <td><span class="action-chip">${escapeHtml(log.action.replace(/_/g, ' '))}</span></td>
                    <td>${escapeHtml(log.details || '—')}</td>
                    <td>${escapeHtml(log.ipAddress || '—')}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <button class="btn btn--ghost btn--xs" id="log-prev" ${page <= 1 ? 'disabled' : ''} type="button">${icon('chevronLeft', 14)} Previous</button>
          <span>Page ${meta.page} of ${Math.max(1, meta.totalPages)}</span>
          <button class="btn btn--ghost btn--xs" id="log-next" ${page >= meta.totalPages ? 'disabled' : ''} type="button">Next ${icon('chevronRight', 14)}</button>
        </div>
      </div>`;

    const prev = document.getElementById('log-prev');
    const next = document.getElementById('log-next');
    if (prev) prev.addEventListener('click', () => { page -= 1; loadLogs(); });
    if (next) next.addEventListener('click', () => { page += 1; loadLogs(); });
  } catch (error) {
    panel.innerHTML = emptyState('Unable to load activity logs', error.message, 'alert');
    toast(error.message, 'error');
  }
}

export function renderDocuments() {
  const me = getMe();
  return adminShell({
    title: 'All Documents',
    subtitle: 'Every submitted requirement across applicants',
    active: '/admin/documents',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `<div id="admin-documents">${loadingState('Loading documents…')}</div>`
  });
}

export async function mountDocuments() {
  const container = document.getElementById('admin-documents');
  if (!container) return;

  try {
    const response = await api.get('/admin/documents');
    const items = Array.isArray(response.data) ? response.data : [];

    container.innerHTML = `
      <div class="card">
        <div class="card__header"><div><h2>Submitted Documents</h2><p>${items.length} record(s)</p></div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Requirement</th><th>Category</th><th>File</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${items.length === 0
                ? '<tr><td colspan="6" class="table__empty">No documents submitted yet.</td></tr>'
                : items.map((doc) => `
                  <tr>
                    <td>${escapeHtml(doc.requirement.title)}</td>
                    <td>${escapeHtml(doc.requirement.category.replace('_', ' '))}</td>
                    <td>${escapeHtml(doc.currentFileName || '—')}</td>
                    <td>${formatDateTime(doc.submittedAt)}</td>
                    <td>${statusBadge(doc.status)}</td>
                    <td>${doc.id ? `<a class="btn btn--ghost btn--xs" href="/admin/documents/${doc.id}" data-link>${icon('eye', 14)} Review</a>` : '<span class="muted">—</span>'}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (error) {
    container.innerHTML = emptyState('Unable to load documents', error.message, 'alert');
    toast(error.message, 'error');
  }
}

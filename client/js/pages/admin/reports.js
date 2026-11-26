import api from '../../core/api.js';
import { icon, escapeHtml, adminShell, loadingState, emptyState, toast } from '../../core/ui.js';
import { getMe } from '../../core/store.js';

export function render() {
  const me = getMe();
  return adminShell({
    title: 'Reports',
    subtitle: 'Database-backed application and document analytics',
    active: '/admin/reports',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    actions: `<button class="btn btn--ghost btn--sm" id="export-report" type="button">${icon('download', 15)} Export CSV</button>`,
    content: `<div id="reports-panel">${loadingState('Generating reports…')}</div>`
  });
}

export async function mount() {
  const panel = document.getElementById('reports-panel');
  if (!panel) return;

  try {
    const response = await api.get('/admin/reports');
    const data = response.data || {};
    const applications = Array.isArray(data.applicationsByStatus) ? data.applicationsByStatus : [];
    const groups = Array.isArray(data.applicantsByCulturalGroup) ? data.applicantsByCulturalGroup : [];
    const documents = Array.isArray(data.documentsByStatus) ? data.documentsByStatus : [];
    const monthly = Array.isArray(data.monthlySubmissions) ? data.monthlySubmissions : [];

    panel.innerHTML = `
      <div class="summary-grid">
        <article class="summary-card summary-card--maroon">
          <span class="summary-card__icon">${icon('upload', 20)}</span>
          <div><strong>${Number(data.totalSubmissions || 0)}</strong><span>Total Document Submissions</span></div>
        </article>
        <article class="summary-card summary-card--blue">
          <span class="summary-card__icon">${icon('users', 20)}</span>
          <div><strong>${groups.reduce((sum, item) => sum + Number(item.count || 0), 0)}</strong><span>Registered Applicants</span></div>
        </article>
        <article class="summary-card summary-card--green">
          <span class="summary-card__icon">${icon('checkCircle', 20)}</span>
          <div><strong>${countFor(applications, 'ACCEPTED')}</strong><span>Accepted Applications</span></div>
        </article>
      </div>

      <div class="dash-columns">
        <section class="card">
          <div class="card__header"><div><h2>Monthly Submissions</h2><p>Based on document submission history</p></div></div>
          ${monthly.length === 0
            ? emptyState('No submissions yet', 'Submission trends will appear here after students upload documents.', 'chart')
            : `<div class="chart-block"><div class="monthly-chart">${monthly.map((item) => {
                const max = Math.max(1, ...monthly.map((entry) => Number(entry.count || 0)));
                const height = Math.max(4, (Number(item.count || 0) / max) * 100);
                return `<div class="monthly-chart__bar" title="${escapeHtml(item.month)}: ${item.count}">
                  <span>${item.count}</span><div style="height:${height}%"></div><small>${escapeHtml(item.month)}</small>
                </div>`;
              }).join('')}</div></div>`}
        </section>

        <section class="card">
          <div class="card__header"><div><h2>Applications by Status</h2><p>Current application distribution</p></div></div>
          <div class="chart-block">${barChart(applications, 'status')}</div>
          <div class="chart-block chart-block--border">
            <h3>Documents by Status</h3>
            ${barChart(documents, 'status')}
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card__header"><div><h2>Applicants by Cultural Group</h2><p>Registration distribution</p></div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Cultural Group</th><th>Applicants</th><th>Share</th></tr></thead>
            <tbody>
              ${groups.length === 0
                ? '<tr><td colspan="3" class="table__empty">No applicants registered yet.</td></tr>'
                : groups.map((group) => {
                    const total = groups.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
                    const share = Math.round((Number(group.count || 0) / total) * 100);
                    return `<tr><td>${escapeHtml(group.name)}</td><td>${group.count}</td>
                      <td><div class="bar-row__track" style="max-width:220px"><div class="bar-row__fill" style="width:${share}%"></div></div></td></tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>
      </section>`;

    const exportButton = document.getElementById('export-report');
    if (exportButton) {
      exportButton.addEventListener('click', () => exportCsv({ applications, groups, documents, monthly }));
    }
  } catch (error) {
    panel.innerHTML = emptyState('Unable to generate reports', error.message, 'alert');
    toast(error.message, 'error');
  }
}

function countFor(items, status) {
  const found = items.find((item) => item.status === status);
  return found ? Number(found.count || 0) : 0;
}

function barChart(items, key) {
  const max = Math.max(1, ...items.map((item) => Number(item.count || 0)));
  return `<div class="bar-chart">${items.map((item) => `
    <div class="bar-row">
      <span class="bar-row__label">${escapeHtml(String(item[key]).replace(/_/g, ' '))}</span>
      <div class="bar-row__track"><div class="bar-row__fill" style="width:${Math.max(2, (Number(item.count || 0) / max) * 100)}%"></div></div>
      <span class="bar-row__value">${item.count}</span>
    </div>`).join('')}</div>`;
}

function exportCsv(data) {
  const lines = ['Section,Label,Count'];
  data.applications.forEach((item) => lines.push(`Application Status,${item.status},${item.count}`));
  data.documents.forEach((item) => lines.push(`Document Status,${item.status},${item.count}`));
  data.groups.forEach((item) => lines.push(`Cultural Group,${item.name},${item.count}`));
  data.monthly.forEach((item) => lines.push(`Monthly Submissions,${item.month},${item.count}`));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `artifile-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast('Report exported as CSV.');
}

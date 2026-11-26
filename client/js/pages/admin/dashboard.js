import api from '../../core/api.js';
import { icon, escapeHtml, adminShell, loadingState, toast } from '../../core/ui.js';
import { getMe } from '../../core/store.js';

export function render() {
  const me = getMe();
  return adminShell({
    title: 'Dashboard',
    subtitle: 'Records overview for the Office of Culture and Arts',
    active: '/admin',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `
      <div id="admin-dashboard">${loadingState('Calculating dashboard figures…')}</div>`
  });
}

export async function mount() {
  const container = document.getElementById('admin-dashboard');
  if (!container) return;

  try {
    const response = await api.get('/admin/dashboard');
    const data = response.data;
    const summary = data.summary || {};
    const groups = data.byCulturalGroup || [];

    const cards = [
      ['users', 'Total Registered Applicants', summary.totalRegisteredApplicants, 'maroon'],
      ['clock', 'Pending Applications', summary.pendingApplications, 'amber'],
      ['eye', 'Under Review', summary.underReviewApplications, 'blue'],
      ['checkCircle', 'Accepted Applicants', summary.acceptedApplicants, 'green'],
      ['x', 'Rejected Applicants', summary.rejectedApplicants, 'red'],
      ['files', 'Total Submitted Documents', summary.totalSubmittedDocuments, 'maroon'],
      ['refresh', 'Documents Under Review', summary.documentsUnderReview, 'amber'],
      ['alert', 'Documents Requiring Revision', summary.documentsRequiringRevision, 'red'],
      ['info', 'Incomplete Requirements', data.incompleteRequirements, 'blue']
    ];

    container.innerHTML = `
      <div class="summary-grid">
        ${cards.map(([iconName, label, value, tone]) => `
          <article class="summary-card summary-card--${tone}">
            <span class="summary-card__icon">${icon(iconName, 20)}</span>
            <div><strong>${Number(value || 0)}</strong><span>${escapeHtml(label)}</span></div>
          </article>`).join('')}
      </div>

      <div class="dash-columns">
        <section class="card">
          <div class="card__header"><div><h2>Applicants by Cultural Group</h2><p>Live counts from the database</p></div></div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Cultural Group</th><th>Total</th><th>Pending</th><th>Accepted</th><th>Rejected</th><th>Docs</th><th>Review</th><th>Revision</th><th>Incomplete</th></tr></thead>
              <tbody>
                ${groups.length === 0
                  ? '<tr><td colspan="9" class="table__empty">No cultural groups configured.</td></tr>'
                  : groups.map((group) => `
                    <tr>
                      <td><a href="/admin/applicants?culturalGroupId=${group.id}" data-link><strong>${escapeHtml(group.name)}</strong></a></td>
                      <td>${group.total}</td><td>${group.pending}</td><td>${group.accepted}</td><td>${group.rejected}</td>
                      <td>${group.submittedDocuments}</td><td>${group.documentsUnderReview}</td>
                      <td>${group.documentsRequiringRevision}</td><td>${group.incompleteRequirements}</td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="card__header"><div><h2>Application Status</h2><p>Distribution of all applications</p></div>
            <a class="link-btn" href="/admin/documents" data-link>View documents ${icon('chevronRight', 14)}</a>
          </div>
          <div class="chart-block">${barChart(data.statusBreakdown || [], 'status')}</div>
          <div class="chart-block chart-block--border">
            <h3>Document Review Status</h3>
            ${barChart(data.documentStatusBreakdown || [], 'status')}
          </div>
        </section>
      </div>`;
  } catch (error) {
    container.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message)}</div>`;
    toast(error.message, 'error');
  }
}

function barChart(items, key) {
  const max = Math.max(1, ...items.map((item) => Number(item.count || 0)));
  return `
  <div class="bar-chart">
    ${items.map((item) => {
      const value = Number(item.count || 0);
      const width = Math.max(2, (value / max) * 100);
      return `
      <div class="bar-row">
        <span class="bar-row__label">${escapeHtml(String(item[key]).replace(/_/g, ' '))}</span>
        <div class="bar-row__track"><div class="bar-row__fill" style="width:${width}%"></div></div>
        <span class="bar-row__value">${value}</span>
      </div>`;
    }).join('')}
  </div>`;
}

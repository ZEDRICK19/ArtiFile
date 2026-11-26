import api from '../../core/api.js';
import { icon, escapeHtml, statusBadge, formatDate, adminShell, loadingState, emptyState, toast } from '../../core/ui.js';
import { getMe } from '../../core/store.js';
import { YEAR_LEVELS, APPLICATION_STATUSES } from '../../core/constants.js';

let filters = { search: '', status: '', yearLevel: '', culturalGroupId: '', sortBy: 'createdAt', sortDir: 'desc', page: 1, limit: 10 };
let groups = [];

export function render({ query = {} } = {}) {
  filters = {
    ...filters,
    search: query.search || '',
    status: query.status || '',
    yearLevel: query.yearLevel || '',
    culturalGroupId: query.culturalGroupId || '',
    sortBy: query.sortBy || 'createdAt',
    sortDir: query.sortDir || 'desc',
    page: Number(query.page || 1)
  };

  const me = getMe();
  return adminShell({
    title: 'Student Applicants',
    subtitle: 'Search, filter, and manage applicant records',
    active: '/admin/applicants',
    unreadCount: me ? me.unreadCount || 0 : 0,
    user: me ? me.user : null,
    content: `
      <div id="applicants-panel">${loadingState('Loading applicants…')}</div>`
  });
}

export async function mount() {
  try {
    const groupResponse = await api.get('/resources/cultural-groups');
    groups = Array.isArray(groupResponse.data) ? groupResponse.data : [];
  } catch (error) {
    groups = [];
  }
  await loadApplicants();
}

function filterHtml() {
  const groupOptions = groups.map((group) => `<option value="${group.id}" ${filters.culturalGroupId === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('');
  return `
  <div class="filter-bar">
    <div class="search-box">${icon('search', 17)}<input type="search" id="f-search" placeholder="Search name, email, or SR-CODE" value="${escapeHtml(filters.search)}" /></div>
    <select id="f-status"><option value="">All statuses</option>${APPLICATION_STATUSES.map((status) => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${escapeHtml(status.replace('_', ' '))}</option>`).join('')}</select>
    <select id="f-year"><option value="">All year levels</option>${YEAR_LEVELS.map((level) => `<option value="${level}" ${filters.yearLevel === level ? 'selected' : ''}>${level}</option>`).join('')}</select>
    <select id="f-group"><option value="">All cultural groups</option>${groupOptions}</select>
    <select id="f-sort">
      <option value="createdAt" ${filters.sortBy === 'createdAt' ? 'selected' : ''}>Registration date</option>
      <option value="fullName" ${filters.sortBy === 'fullName' ? 'selected' : ''}>Name</option>
      <option value="yearLevel" ${filters.sortBy === 'yearLevel' ? 'selected' : ''}>Year level</option>
      <option value="status" ${filters.sortBy === 'status' ? 'selected' : ''}>Application status</option>
    </select>
    <select id="f-dir"><option value="desc" ${filters.sortDir === 'desc' ? 'selected' : ''}>Descending</option><option value="asc" ${filters.sortDir === 'asc' ? 'selected' : ''}>Ascending</option></select>
    <button class="btn btn--ghost btn--sm" id="f-reset" type="button">${icon('refresh', 15)} Reset</button>
  </div>`;
}

async function loadApplicants() {
  const panel = document.getElementById('applicants-panel');
  if (!panel) return;
  panel.innerHTML = loadingState('Loading applicants…');

  try {
    const response = await api.get('/admin/applicants', filters);
    const items = Array.isArray(response.data) ? response.data : [];
    const meta = response.meta || { page: 1, totalPages: 1, total: 0 };

    panel.innerHTML = `
      ${filterHtml()}
      <div class="card">
        <div class="card__header"><div><h2>Registered Applicants</h2><p>${meta.total} record(s) found</p></div></div>
        <div class="table-wrap">
          <table class="table table--applicants">
            <thead><tr><th>Applicant Name</th><th>Email Address</th><th>Phone</th><th>Course / Program</th><th>Year</th><th>Cultural Group</th><th>Registered</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${items.length === 0
                ? '<tr><td colspan="9" class="table__empty">No applicants match your filters.</td></tr>'
                : items.map((item) => `
                  <tr>
                    <td><a href="/admin/applicants/${item.id}" data-link><strong>${escapeHtml(item.fullName)}</strong></a></td>
                    <td>${escapeHtml(item.email)}</td>
                    <td>${escapeHtml(item.phone)}</td>
                    <td>${escapeHtml(item.program)}</td>
                    <td>${escapeHtml(item.yearLevel)}</td>
                    <td>${escapeHtml(item.culturalGroup)}</td>
                    <td>${formatDate(item.registrationDate)}</td>
                    <td>${statusBadge(item.applicationStatus)}</td>
                    <td>
                      <div class="table-actions">
                        <a class="icon-btn" title="View profile" href="/admin/applicants/${item.id}" data-link>${icon('eye', 16)}</a>
                        <a class="icon-btn" title="View documents" href="/admin/applicants/${item.id}#requirements" data-link>${icon('files', 16)}</a>
                      </div>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <button class="btn btn--ghost btn--xs" id="page-prev" ${meta.page <= 1 ? 'disabled' : ''} type="button">${icon('chevronLeft', 14)} Previous</button>
          <span>Page ${meta.page} of ${Math.max(1, meta.totalPages)}</span>
          <button class="btn btn--ghost btn--xs" id="page-next" ${meta.page >= meta.totalPages ? 'disabled' : ''} type="button">Next ${icon('chevronRight', 14)}</button>
        </div>
      </div>`;

    bindFilters();
    bindTable();
  } catch (error) {
    panel.innerHTML = emptyState('Unable to load applicants', error.message, 'alert');
    toast(error.message, 'error');
  }
}

function bindFilters() {
  const bind = (id, key) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('change', () => {
      filters[key] = element.value;
      filters.page = 1;
      loadApplicants();
    });
  };
  bind('f-status', 'status');
  bind('f-year', 'yearLevel');
  bind('f-group', 'culturalGroupId');
  bind('f-sort', 'sortBy');
  bind('f-dir', 'sortDir');

  const search = document.getElementById('f-search');
  if (search) {
    let timer;
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        filters.search = search.value.trim();
        filters.page = 1;
        loadApplicants();
      }, 350);
    });
  }
}

function bindTable() {
  const prev = document.getElementById('page-prev');
  const next = document.getElementById('page-next');
  const reset = document.getElementById('f-reset');

  if (prev) prev.addEventListener('click', () => { filters.page -= 1; loadApplicants(); });
  if (next) next.addEventListener('click', () => { filters.page += 1; loadApplicants(); });
  if (reset) reset.addEventListener('click', () => {
    filters = { search: '', status: '', yearLevel: '', culturalGroupId: '', sortBy: 'createdAt', sortDir: 'desc', page: 1, limit: 10 };
    const search = document.getElementById('f-search');
    if (search) search.value = '';
    loadApplicants();
  });
}

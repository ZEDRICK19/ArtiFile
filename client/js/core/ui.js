export function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString('en-PH', options);
}

export function formatDateTime(value) {
  return formatDate(value, true);
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = Number(bytes);
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function institutionStrip() {
  return `
  <div class="institution-strip" role="banner">
    <span class="institution-strip__seal">BSU</span>
    <div class="institution-strip__identity">
      <strong>Batangas State University</strong>
      <span>The National Engineering University · Alangilan Campus</span>
    </div>
    <span class="institution-strip__office">Office of Culture and Arts</span>
  </div>`;
}

const ICON_PATHS = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M17.5 14.5c2 .7 3.5 2.5 3.5 5.5"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
  file: '<path d="M6.5 3h7l4.5 4.5V21h-11.5z"/><path d="M13.5 3v5h4.5"/><path d="M9.5 13h5M9.5 17h5"/>',
  files: '<path d="M8.5 3h6.5l4 4V20h-10.5z"/><path d="M15 3v4.5h4"/><path d="M5 7v13.5h10"/>',
  forms: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4.5"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M8 3v5M16 3v5M3.5 10.5h17"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 6.5-2.5 7.5-2.5 9h17C20.5 16.5 18 15.5 18 9"/><path d="M10 21h4"/>',
  logout: '<path d="M10.5 4.5H5.5v15h5"/><path d="M14.5 8.5 18 12l-3.5 3.5"/><path d="M18 12H9.5"/>',
  download: '<path d="M12 4v12"/><path d="m7.5 11.5 4.5 4.5 4.5-4.5"/><path d="M4.5 20h15"/>',
  upload: '<path d="M12 20V8"/><path d="m7.5 12.5 4.5-4.5 4.5 4.5"/><path d="M4.5 4h15"/>',
  eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.6 9.6a3.4 3.4 0 0 0 4.8 4.8"/><path d="M6.5 6.8C4.1 8.5 2.5 12 2.5 12s3.5 5.5 9.5 5.5c1.5 0 2.9-.4 4.1-1"/><path d="M18.6 15.2C20.5 13.8 21.5 12 21.5 12S18 6.5 12 6.5c-.7 0-1.4.1-2 .2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.2 2.8 2.8 5.2-5.8"/>',
  x: '<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>',
  alert: '<path d="M12 4 3 20h18z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5h.01"/>',
  edit: '<path d="M4.5 19.5h4L19 9l-4-4L4.5 15.5z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7 7.5 20h9L17.5 7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  shield: '<path d="M12 3 20 6v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="5.5" y="10" width="13" height="10.5" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/>',
  unlock: '<rect x="5.5" y="10" width="13" height="10.5" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 6.8-1.2"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  phone: '<path d="M6.5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 4.8 4.8l1.4-2.3 4.5 1.8v3.5a2 2 0 0 1-2 2C10.5 20 4 13.5 4 5.5a2 2 0 0 1 2.5-2z"/>',
  book: '<path d="M4 4.5h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z"/><path d="M20 4.5h-3a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h3z"/>',
  certificate: '<circle cx="12" cy="9" r="5"/><path d="m8 13-1 8 5-3 5 3-1-8"/>',
  folder: '<path d="M3.5 6.5h7l2 2h8v11h-17z"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 7.5v5.5l-4 2V13z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
  external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 12 12"/><path d="M18 14v5.5H4.5V6H10"/>',
  layer: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  logo: '<path d="M4 20 12 4l8 16"/><path d="M7.5 14h9"/>'
};

export function icon(name, size = 18, label = '') {
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  const accessible = label
    ? ` role="img" aria-label="${escapeHtml(label)}"`
    : ' aria-hidden="true"';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"${accessible}>${path}</svg>`;
}

export function toneForStatus(status) {
  const map = {
    NOT_SUBMITTED: 'neutral',
    SUBMITTED: 'info',
    UNDER_REVIEW: 'warning',
    ACCEPTED: 'success',
    REVISION_REQUIRED: 'danger',
    REJECTED: 'danger',
    PENDING: 'warning',
    READY: 'info',
    INCOMPLETE: 'warning'
  };
  return map[status] || 'neutral';
}

export function labelForStatus(status) {
  const map = {
    NOT_SUBMITTED: 'Not Submitted',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    ACCEPTED: 'Accepted',
    REVISION_REQUIRED: 'Revision Required',
    REJECTED: 'Rejected',
    PENDING: 'Pending',
    UNDERREVIEW: 'Under Review',
    READY: 'Ready for Audition',
    INCOMPLETE: 'Pre-Audition Requirements Incomplete'
  };
  return map[status] || String(status || '').replace(/_/g, ' ');
}

export function statusBadge(status) {
  return `<span class="badge badge--${toneForStatus(status)}">${escapeHtml(labelForStatus(status))}</span>`;
}

export function toast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const item = document.createElement('div');
  item.className = `toast toast--${type}`;
  const iconName = type === 'error' ? 'alert' : type === 'warning' ? 'info' : 'checkCircle';
  item.innerHTML = `${icon(iconName, 18)}<span>${escapeHtml(message)}</span>`;
  root.appendChild(item);
  window.setTimeout(() => {
    item.classList.add('toast--out');
    window.setTimeout(() => item.remove(), 300);
  }, 4200);
}

export function modal({ title, body, footer = '', size = 'md' }) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal--${size}" role="dialog" aria-modal="true">
      <div class="modal__header">
        <h3>${escapeHtml(title)}</h3>
        <button class="icon-btn" data-modal-close type="button" aria-label="Close">${icon('x', 18)}</button>
      </div>
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__footer">${footer}</div>` : ''}
    </div>`;
  root.appendChild(overlay);

  function close() {
    overlay.classList.add('modal-overlay--out');
    window.setTimeout(() => overlay.remove(), 200);
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('[data-modal-close]')) close();
  });

  return { close, element: overlay };
}

export function confirmModal({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const instance = modal({
      title,
      body: `<p class="modal__message">${escapeHtml(message)}</p>`,
      footer: `
        <button class="btn btn--ghost" data-modal-close type="button">Cancel</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm type="button">${escapeHtml(confirmText)}</button>`
    });

    instance.element.querySelector('[data-confirm]').addEventListener('click', () => {
      instance.close();
      resolve(true);
    });
    instance.element.addEventListener('click', (event) => {
      if (event.target === instance.element || event.target.closest('[data-modal-close]')) {
        resolve(false);
      }
    });
  });
}

export function loadingState(label = 'Loading data…') {
  return `<div class="state state--loading"><span class="spinner"></span><p>${escapeHtml(label)}</p></div>`;
}

export function emptyState(title, message, iconName = 'folder') {
  return `<div class="state state--empty">${icon(iconName, 32)}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
}

const ADMIN_NAV = [
  {
    section: 'Records',
    items: [
      { path: '/admin', label: 'Dashboard', icon: 'home' },
      { path: '/admin/applicants', label: 'Applicants & Cultural Groups', icon: 'users' },
      { path: '/admin/documents', label: 'All Documents', icon: 'files' },
      { path: '/admin/reports', label: 'Reports', icon: 'chart' },
      { path: '/admin/activity-logs', label: 'Activity Logs', icon: 'clock' }
    ]
  },
  {
    section: 'Engagement',
    items: [
      { path: '/admin/events', label: 'Calendar of Activities', icon: 'calendar' },
      { path: '/admin/events#forms', label: 'Forms', icon: 'forms' }
    ]
  },
  {
    section: 'System',
    items: [
      { path: '/admin/account-management', label: 'Account Management', icon: 'settings' }
    ]
  }
];

export function adminShell({ title, subtitle = '', active = '', content = '', actions = '', unreadCount = 0, user = null }) {
  const nav = ADMIN_NAV.map((group) => {
    const items = group.items.map((item) => {
      const isActive = active === item.path
        || (item.path === '/admin/applicants' && active.startsWith('/admin/applicants'))
        || (item.path === '/admin/documents' && active.startsWith('/admin/documents'))
        || (item.path === '/admin/events' && active.startsWith('/admin/events'));
      return `<a class="admin-nav__item ${isActive ? 'is-active' : ''}" href="${item.path}" ${isActive ? 'aria-current="page"' : ''} data-link>${icon(item.icon, 18)}<span>${escapeHtml(item.label)}</span></a>`;
    }).join('');
    return `<div class="admin-nav__group"><span class="admin-nav__label">${escapeHtml(group.section)}</span>${items}</div>`;
  }).join('');

  const displayName = user ? (user.fullName || user.email) : 'Administrative Aide VI';

  return `
  <div class="admin-layout">
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="admin-sidebar__brand">
        <span class="brand-mark">A</span>
        <div><strong>ArtiFile</strong><small>OCA Records System</small></div>
      </div>
      <nav class="admin-nav">${nav}</nav>
      <div class="admin-sidebar__footer">
        <div class="admin-sidebar__role">${icon('shield', 16)} Administrative Aide VI</div>
        <button class="admin-nav__item" data-logout type="button">${icon('logout', 18)}<span>Log out</span></button>
      </div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar">
        <button class="icon-btn admin-menu-btn" data-admin-menu type="button" aria-label="Toggle menu">${icon('menu', 20)}</button>
        <div class="admin-topbar__titles">
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <div class="admin-topbar__actions">
          <a class="icon-btn notification-pill" href="/notifications" data-link aria-label="Notifications">
            ${icon('bell', 19)}
            ${unreadCount > 0 ? `<span class="notification-pill__count">${unreadCount}</span>` : ''}
          </a>
          <div class="admin-user">
            <span class="avatar avatar--sm">${escapeHtml(initials(displayName))}</span>
            <span class="admin-user__name">${escapeHtml(displayName)}</span>
          </div>
        </div>
      </header>
      <main class="admin-content">
        ${actions ? `<div class="page-actions">${actions}</div>` : ''}
        ${content}
      </main>
    </div>
  </div>`;
}

export function initials(name) {
  if (!name) return 'AF';
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function field(label, control, hint = '') {
  return `
    <label class="field">
      <span class="field__label">${escapeHtml(label)}</span>
      ${control}
      ${hint ? `<small class="field__hint">${escapeHtml(hint)}</small>` : ''}
    </label>`;
}

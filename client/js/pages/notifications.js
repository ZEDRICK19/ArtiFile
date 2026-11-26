import api from '../core/api.js';
import { icon, escapeHtml, formatDateTime, toast, adminShell, loadingState, emptyState } from '../core/ui.js';
import { getMe, updateMe } from '../core/store.js';

export function render() {
  const me = getMe();
  const isAdmin = me && me.user && me.user.role === 'ADMIN';
  const base = `<div class="card">
      <div class="card__header">
        <div><h2>Notifications</h2><p>Stay updated on application and document activity.</p></div>
        <button class="btn btn--ghost btn--sm" id="mark-all" type="button">${icon('check', 16)} Mark all as read</button>
      </div>
      <div id="notification-list">${loadingState('Loading notifications…')}</div>
    </div>`;

  if (isAdmin) {
    return adminShell({
      title: 'Notifications',
      subtitle: 'System activity addressed to you',
      active: '/notifications',
      unreadCount: me.unreadCount || 0,
      user: me.user,
      content: base
    });
  }

  return `
  <div class="student-sub-page">
    <div class="subpage-header">
      <a class="btn btn--ghost btn--sm" href="/student" data-link>${icon('chevronLeft', 16)} Back to dashboard</a>
      <h1>Notifications</h1>
    </div>
    ${base}
  </div>`;
}

export async function mount() {
  const container = document.getElementById('notification-list');
  const markAll = document.getElementById('mark-all');
  if (!container) return;

  try {
    const response = await api.get('/notifications', { limit: 100 });
    const items = Array.isArray(response.data) ? response.data : [];

    if (items.length === 0) {
      container.innerHTML = emptyState('No notifications yet', 'Updates about your documents and application will appear here.', 'bell');
    } else {
      container.innerHTML = `<div class="notification-list">${items.map((item) => `
        <article class="notification-item ${item.isRead ? '' : 'is-unread'}" data-id="${item.id}">
          <span class="notification-item__icon">${icon(iconFor(item.type), 18)}</span>
          <div class="notification-item__body">
            <div class="notification-item__top">
              <h3>${escapeHtml(item.title)}</h3>
              <time>${formatDateTime(item.createdAt)}</time>
            </div>
            <p>${escapeHtml(item.message)}</p>
            ${item.link ? `<a class="link-btn" href="${escapeHtml(item.link)}" data-link>View details ${icon('chevronRight', 14)}</a>` : ''}
          </div>
          ${item.isRead ? '' : `<button class="btn btn--ghost btn--xs" data-read="${item.id}" type="button">Mark read</button>`}
        </article>`).join('')}</div>`;
    }

    container.querySelectorAll('[data-read]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api.put(`/notifications/${button.dataset.read}/read`);
          const me = getMe();
          if (me) updateMe({ unreadCount: Math.max(0, (me.unreadCount || 1) - 1) });
          await mount();
        } catch (error) {
          toast(error.message, 'error');
        }
      });
    });
  } catch (error) {
    container.innerHTML = emptyState('Unable to load notifications', error.message, 'alert');
  }

  if (markAll) {
    markAll.addEventListener('click', async () => {
      try {
        const result = await api.put('/notifications/read-all');
        const me = getMe();
        if (me) updateMe({ unreadCount: 0 });
        toast(result.message);
        await mount();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  }
}

function iconFor(type) {
  const map = {
    DOCUMENT_ACCEPTED: 'checkCircle',
    DOCUMENT_REVISION: 'refresh',
    DOCUMENT_REJECTED: 'x',
    APPLICATION_STATUS: 'file',
    POST_AUDITION_UNLOCKED: 'unlock',
    NEW_REGISTRATION: 'user',
    DOCUMENT_SUBMITTED: 'upload',
    DOCUMENT_REPLACED: 'refresh'
  };
  return map[type] || 'bell';
}

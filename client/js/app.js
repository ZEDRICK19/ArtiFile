import { route, setGuard, setFallback, startRouter, navigate } from './core/router.js';
import { loadMe, getMe } from './core/store.js';
import { icon } from './core/ui.js';
import { homePathFor } from './core/session.js';

import * as landing from './pages/landing.js';
import * as login from './pages/login.js';
import * as register from './pages/register.js';
import * as notifications from './pages/notifications.js';
import * as studentDashboard from './pages/student/dashboard.js';
import * as studentRequirements from './pages/student/requirements.js';
import * as studentProfile from './pages/student/edit-profile.js';
import * as studentResources from './pages/student/resources.js';
import * as adminDashboard from './pages/admin/dashboard.js';
import * as adminApplicants from './pages/admin/applicants.js';
import * as adminApplicantDetails from './pages/admin/applicant-details.js';
import * as adminDocumentViewer from './pages/admin/document-viewer.js';
import * as adminActivity from './pages/admin/activity-logs.js';
import * as adminReports from './pages/admin/reports.js';
import * as adminEvents from './pages/admin/events.js';

await loadMe();

setGuard(async ({ path }) => {
  const me = getMe();

  if (path === '/login' || path === '/register') {
    if (me) return { allowed: false, redirect: homePathFor(me) };
    return { allowed: true };
  }

  if (path === '/') return { allowed: true };

  if (!me) {
    return { allowed: false, redirect: `/login?next=${encodeURIComponent(path)}` };
  }

  const role = me.user ? me.user.role : me.role;

  if (path.startsWith('/admin') && role !== 'ADMIN') {
    return { allowed: false, redirect: '/student' };
  }

  if (path.startsWith('/student') && role !== 'STUDENT') {
    return { allowed: false, redirect: '/admin' };
  }

  return { allowed: true };
});

setFallback(async () => `
  <div class="public-shell">
    <div class="state state--empty" style="min-height:70vh">
      ${icon('alert', 40)}
      <h2>Page not found</h2>
      <p>The page you requested does not exist in ArtiFile.</p>
      <a class="btn btn--primary" href="/" data-link>Back to home</a>
    </div>
  </div>`);

route('/', landing);
route('/login', login);
route('/register', register);
route('/notifications', notifications);

route('/student', studentDashboard);
route('/student/requirements', studentRequirements);
route('/student/status', { render: studentDashboard.renderStatusPage, mount: studentDashboard.mountStatusPage });
route('/student/notifications', notifications);
route('/student/profile/edit', studentProfile);
route('/student/resources/:tab', studentResources);

route('/admin', adminDashboard);
route('/admin/applicants', adminApplicants);
route('/admin/applicants/:id', adminApplicantDetails);
route('/admin/documents', { render: adminActivity.renderDocuments, mount: adminActivity.mountDocuments });
route('/admin/documents/:id', adminDocumentViewer);
route('/admin/activity-logs', adminActivity);
route('/admin/reports', adminReports);
route('/admin/events', adminEvents);
route('/admin/account-management', adminEvents.renderAccounts);

document.addEventListener('click', async (event) => {
  const menuButton = event.target.closest('[data-admin-menu]');
  if (menuButton) {
    const layout = document.querySelector('.admin-layout');
    if (layout) layout.classList.toggle('is-sidebar-open');
    return;
  }

  const link = event.target.closest('[data-link]');
  if (!link || link.dataset.bound === 'true') return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('#')) return;

  const layout = document.querySelector('.admin-layout');
  if (layout && link.closest('.admin-sidebar')) {
    layout.classList.remove('is-sidebar-open');
  }

  event.preventDefault();
  await navigate(href);
});

await startRouter();

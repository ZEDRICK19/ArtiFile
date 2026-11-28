/* ArtiFile database-free demo server.
 * Serves the real client files and an in-memory mock API on the same port.
 * No PostgreSQL, Prisma, or external package is required.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CLIENT_DIR = path.join(ROOT, 'client');
const PORT = Number(process.env.PORT || 5000);
const DOMAIN = '@g.batstate-u.edu.ph';
const ADMIN_EMAIL = 'cultureandarts.alangilan@g.batstate-u.edu.ph';
const ADMIN_PASSWORD = 'ChangeThisStrongPassword123!';
const STUDENT_EMAIL = 'sample.student@g.batstate-u.edu.ph';
const STUDENT_PASSWORD = 'SamplePass123!';

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

let sequence = 100;
const nextId = (prefix) => `${prefix}${++sequence}`;
const now = () => new Date().toISOString();
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const daysAhead = (days) => new Date(Date.now() + days * 86400000).toISOString();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function fail(res, status, message) {
  return json(res, status, { success: false, status, message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const text = raw.toString('utf8');
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        const params = new URLSearchParams(text);
        resolve(Object.fromEntries(params.entries()));
      }
    });
    req.on('error', reject);
  });
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function multipartValue(raw, name) {
  const text = raw.toString('latin1');
  const match = text.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`));
  return match ? match[1].trim() : '';
}

function multipartFileName(raw) {
  const text = raw.toString('latin1');
  const match = text.match(/filename="([^"]+)"/);
  if (!match) return 'submitted-document.pdf';
  return match[1].split('\\').pop().split('/').pop();
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return cookies;
}

function setSessionCookie(res, userId, rememberMe) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
  res.setHeader('Set-Cookie', `demo_session=${encodeURIComponent(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'demo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

/* ------------------------------------------------------------------ *
 * In-memory data
 * ------------------------------------------------------------------ */

const culturalGroups = [
  { id: 'g1', name: 'BatStateU Ad Libitum Chorus', description: 'University chorale group.', isActive: true },
  { id: 'g2', name: 'BatStateU-TNEU Indak Yaman Dance Varsity', description: 'University dance varsity team.', isActive: true },
  { id: 'g3', name: 'BatStateU-TNEU Dulaang Batangan', description: 'University theater and performing arts group.', isActive: true },
  { id: 'g4', name: 'BatStateU-TNEU Band', description: 'University marching and concert band.', isActive: true },
  { id: 'g5', name: 'Diwayanis Dance Theater', description: 'Cultural dance theater group.', isActive: true },
  { id: 'g6', name: 'Sikha BatStateU-TNEU', description: 'Student cultural and arts organization.', isActive: true },
  { id: 'g7', name: 'BatStateU Rondalla', description: 'Traditional Filipino instrumental ensemble.', isActive: true }
];

const requirements = [
  {
    id: 'req-waiver', key: 'waiver', title: "Waiver / Parent's Consent Form",
    description: 'Signed waiver or parent/guardian consent form.', category: 'PRE_AUDITION',
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'], maxFileSizeMb: 5, sortOrder: 1, isActive: true
  },
  {
    id: 'req-parent', key: 'parent_id', title: "Photocopy of Parent's ID with Three Specimen Signatures",
    description: 'Clear photocopy of a valid parent/guardian ID with three specimen signatures.', category: 'PRE_AUDITION',
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'], maxFileSizeMb: 5, sortOrder: 2, isActive: true
  },
  {
    id: 'req-profile', key: 'performer_profile', title: "Performer's Profile",
    description: 'Accomplished performer profile form for accepted applicants.', category: 'POST_AUDITION',
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'], maxFileSizeMb: 5, sortOrder: 3, isActive: true
  }
];

const events = [
  { id: 'evt1', title: 'Cultural Arts Audition', description: 'Annual audition for performer applicants.', location: 'OCA Hall, Alangilan Campus', startAt: daysAhead(12), endAt: daysAhead(12), isActive: true },
  { id: 'evt2', title: 'Rondalla Workshop', description: 'Basic rondalla ensemble workshop.', location: 'Music Room', startAt: daysAhead(25), endAt: daysAhead(25), isActive: true }
];

const resources = [
  { id: 'res1', key: 'audition_criteria', kind: 'FORM', title: 'Audition Criteria Form', description: 'Criteria for selection of culture and arts performers.', externalUrl: '', fileName: '', sortOrder: 1, isActive: true },
  { id: 'res2', key: 'pathfit_exemption', kind: 'FORM', title: 'PathFIT Exemption Form', description: 'Request for expanded PathFIT course exemption.', externalUrl: '', fileName: '', sortOrder: 2, isActive: true },
  { id: 'res3', key: 'culture_manual', kind: 'MANUAL', title: 'Culture and Arts Manual', description: 'Office policies and performer guidelines.', externalUrl: '', fileName: '', sortOrder: 1, isActive: true },
  { id: 'res4', key: 'membership_cert', kind: 'CERTIFICATE', title: 'Certificate of Membership', description: 'Sample certificate template.', externalUrl: '', fileName: '', sortOrder: 1, isActive: true }
];

const settings = {
  contactEmail: ADMIN_EMAIL,
  fbPage: 'https://www.facebook.com/OCABatStateUAlangilan',
  telephone: '425-0139; 425-0143 loc. 2016',
  systemName: 'ArtiFile',
  officeAddress: 'Office of Culture and Arts, Batangas State University TNEU, Alangilan Campus'
};

const users = [];
const profiles = [];
const applications = [];
const documents = [];
const notifications = [];
const activityLogs = [];

users.push({
  id: 'admin-1', email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  role: 'ADMIN', fullName: 'Administrative Aide VI', isActive: true, createdAt: daysAgo(120)
});

function addStudent(options) {
  const userId = nextId('user');
  const user = {
    id: userId, email: options.email, password: options.password,
    role: 'STUDENT', fullName: options.fullName, isActive: true, createdAt: daysAgo(options.createdDaysAgo || 30)
  };

  const profile = {
    id: nextId('profile'), userId, fullName: options.fullName,
    phone: options.phone || '09171234567',
    yearLevel: options.yearLevel || '1st Year',
    program: options.program || 'BS Information Technology',
    campus: 'Alangilan Campus', academicYear: '2026-2027',
    srCode: options.srCode || null,
    culturalGroupId: culturalGroups[options.groupIndex || 0].id,
    createdAt: daysAgo(options.createdDaysAgo || 30), archivedAt: null
  };

  const application = {
    id: nextId('app'), userId, status: options.status || 'PENDING',
    feedback: options.feedback || null, appliedAt: daysAgo(options.appliedDaysAgo || 28),
    decidedAt: ['ACCEPTED', 'REJECTED'].includes(options.status) ? daysAgo(3) : null
  };

  users.push(user);
  profiles.push(profile);
  applications.push(application);

  Object.entries(options.docs || {}).forEach(([key, status]) => {
    const requirement = requirements.find((item) => item.key === key);
    if (!requirement) return;
    const submitted = status !== 'NOT_SUBMITTED';
    const documentId = nextId('doc');
    documents.push({
      id: documentId, applicationId: application.id, requirementId: requirement.id,
      status, feedback: status === 'REVISION_REQUIRED' ? 'Please upload a clearer copy.' : null,
      currentFileName: submitted ? `${key}.pdf` : null,
      currentFileKey: submitted ? `demo-${documentId}.pdf` : null,
      currentMimeType: 'application/pdf', currentFileSize: submitted ? 245760 : null,
      submittedAt: submitted ? daysAgo(20) : null, updatedAt: daysAgo(18),
      reviewedAt: ['ACCEPTED', 'REJECTED', 'REVISION_REQUIRED'].includes(status) ? daysAgo(10) : null,
      reviewedById: ['ACCEPTED', 'REJECTED', 'REVISION_REQUIRED'].includes(status) ? 'admin-1' : null,
      history: submitted
        ? [{ version: 1, action: 'UPLOAD', fileName: `${key}.pdf`, mimeType: 'application/pdf', fileSize: 245760, createdAt: daysAgo(20), uploadedById: userId }]
        : []
    });
  });

  return { user, profile, application };
}

const sampleStudent = addStudent({
  email: STUDENT_EMAIL, password: STUDENT_PASSWORD, fullName: 'John Monterey',
  program: 'BS Information Technology', yearLevel: '1st Year', groupIndex: 0,
  status: 'PENDING', srCode: '22-00001', docs: { waiver: 'SUBMITTED' }
});

const seedStudents = [
  { email: 'charish.villanueva@g.batstate-u.edu.ph', password: 'Student123!', name: 'Charish Villanueva', program: 'BS Computer Science', year: '2nd Year', group: 1, status: 'ACCEPTED', docs: { waiver: 'ACCEPTED', parent_id: 'ACCEPTED', performer_profile: 'SUBMITTED' } },
  { email: 'precious.navarro@g.batstate-u.edu.ph', name: 'Precious Navarro', program: 'BS Aerospace Engineering', year: '3rd Year', group: 2, status: 'UNDER_REVIEW', docs: { waiver: 'UNDER_REVIEW', parent_id: 'SUBMITTED' } },
  { email: 'zed.monterey@g.batstate-u.edu.ph', name: 'Zed Monterey', program: 'BS Architecture', year: '4th Year', group: 3, status: 'ACCEPTED', docs: { waiver: 'ACCEPTED', parent_id: 'ACCEPTED', performer_profile: 'ACCEPTED' } },
  { email: 'cha.vilanueva@g.batstate-u.edu.ph', name: 'Cha Vilanueva', program: 'BS Computer Science', year: '1st Year', group: 4, status: 'PENDING', docs: { waiver: 'REVISION_REQUIRED' } },
  { email: 'adelline.navarro@g.batstate-u.edu.ph', name: 'Adelline Navarro', program: 'BS Information Technology', year: '2nd Year', group: 5, status: 'REJECTED', feedback: 'Did not meet the audition criteria.', docs: { waiver: 'REJECTED', parent_id: 'SUBMITTED' } }
];

const seededAccounts = seedStudents.map((item) => addStudent({
  email: item.email, password: item.password || 'DemoPass123!', fullName: item.name,
  program: item.program, yearLevel: item.year, groupIndex: item.group,
  status: item.status, feedback: item.feedback, docs: item.docs, createdDaysAgo: 24 + item.group * 2
}));

notifications.push(
  { id: nextId('notif'), userId: 'admin-1', title: 'New student registered', message: 'John Monterey created a new ArtiFile account.', type: 'NEW_REGISTRATION', link: '/admin/applicants', isRead: false, createdAt: daysAgo(1) },
  { id: nextId('notif'), userId: sampleStudent.user.id, title: 'Application received', message: 'Your application has been submitted and is awaiting review.', type: 'APPLICATION_STATUS', link: '/student/status', isRead: false, createdAt: daysAgo(2) },
  { id: nextId('notif'), userId: seededAccounts[0].user.id, title: 'Application accepted', message: 'Your post-audition requirement is now unlocked.', type: 'POST_AUDITION_UNLOCKED', link: '/student/requirements?category=POST_AUDITION', isRead: false, createdAt: daysAgo(3) }
);

activityLogs.push(
  { id: nextId('log'), actorId: 'admin-1', actor: { id: 'admin-1', email: ADMIN_EMAIL, role: 'ADMIN' }, action: 'LOGIN', entityType: 'USER', entityId: 'admin-1', applicantId: null, details: `${ADMIN_EMAIL} signed in.`, createdAt: daysAgo(1) },
  { id: nextId('log'), actorId: sampleStudent.user.id, actor: { id: sampleStudent.user.id, email: STUDENT_EMAIL, role: 'STUDENT' }, action: 'UPLOAD_DOCUMENT', entityType: 'DOCUMENT', entityId: documents[0].id, applicantId: sampleStudent.profile.id, details: 'Waiver / Parent’s Consent Form uploaded.', createdAt: daysAgo(2) }
);

/* ------------------------------------------------------------------ *
 * View builders
 * ------------------------------------------------------------------ */

function deriveStatus(application, docs) {
  const list = Array.isArray(docs) ? docs : [];
  const appStatus = application ? application.status : 'PENDING';

  if (appStatus === 'REJECTED') {
    return {
      code: 'REJECTED', label: 'Rejected', tone: 'danger',
      message: application.feedback
        ? `Your application was rejected. Feedback: ${application.feedback}`
        : 'Your application was rejected. Please contact the OCA office for clarification.',
      canAccessPost: false
    };
  }
  if (appStatus === 'ACCEPTED') {
    return {
      code: 'ACCEPTED', label: 'Accepted', tone: 'success',
      message: 'Congratulations! You are accepted. You may now submit your post-audition requirement (Performer’s Profile).',
      canAccessPost: true
    };
  }
  if (appStatus === 'UNDER_REVIEW') {
    return {
      code: 'UNDER_REVIEW', label: 'Under Review', tone: 'warning',
      message: 'Your application and documents are currently under review by the Administrative Aide VI.',
      canAccessPost: false
    };
  }

  const preDocs = list.filter((doc) => doc.requirement && doc.requirement.category === 'PRE_AUDITION');
  const revision = preDocs.find((doc) => doc.status === 'REVISION_REQUIRED' || doc.status === 'REJECTED');
  if (revision) {
    return {
      code: 'INCOMPLETE', label: 'Pre-Audition Requirements Incomplete', tone: 'danger',
      message: `Revision requested for “${revision.requirement.title}”. ${revision.feedback || 'Please replace the document.'}`,
      canAccessPost: false
    };
  }
  if (preDocs.filter((doc) => doc.status === 'ACCEPTED').length >= 2) {
    return {
      code: 'READY', label: 'Ready for Audition', tone: 'info',
      message: 'All pre-audition requirements are accepted. You are ready for the audition.',
      canAccessPost: false
    };
  }
  if (preDocs.some((doc) => doc.status === 'SUBMITTED' || doc.status === 'UNDER_REVIEW')) {
    return {
      code: 'PENDING', label: 'Pending Application', tone: 'warning',
      message: 'Your documents have been submitted and are awaiting review.',
      canAccessPost: false
    };
  }
  return {
    code: 'INCOMPLETE', label: 'Pre-Audition Requirements Incomplete', tone: 'warning',
    message: 'Please upload the Waiver / Parent’s Consent Form and the Photocopy of Parent’s ID with three specimen signatures.',
    canAccessPost: false
  };
}

function requirementById(id) {
  return requirements.find((item) => item.id === id) || null;
}

function groupById(id) {
  return culturalGroups.find((item) => item.id === id) || null;
}

function documentView(document, options = {}) {
  const application = applications.find((item) => item.id === document.applicationId);
  const owner = application ? users.find((item) => item.id === application.userId) : null;
  const reviewer = document.reviewedById ? users.find((item) => item.id === document.reviewedById) : null;
  const view = {
    ...document,
    requirement: requirementById(document.requirementId),
    reviewedBy: reviewer ? { id: reviewer.id, email: reviewer.email } : null,
    history: document.history || []
  };
  if (options.withApplication) {
    view.application = application
      ? { id: application.id, status: application.status, userId: application.userId, user: owner ? { id: owner.id, email: owner.email } : null }
      : null;
  }
  return view;
}

function profileView(profile) {
  if (!profile) return null;
  const group = groupById(profile.culturalGroupId);
  return { ...profile, culturalGroup: group ? group.name : null };
}

function buildMe(user) {
  const profile = profiles.find((item) => item.userId === user.id);
  const application = applications.find((item) => item.userId === user.id);
  const docs = application
    ? documents.filter((item) => item.applicationId === application.id).map((item) => documentView(item))
    : [];
  const status = deriveStatus(application, docs);

  return {
    user: {
      id: user.id, email: user.email, role: user.role,
      fullName: profile ? profile.fullName : user.fullName, isActive: user.isActive
    },
    profile: profileView(profile),
    application: application
      ? { id: application.id, status: application.status, feedback: application.feedback, appliedAt: application.appliedAt, decidedAt: application.decidedAt }
      : null,
    status,
    unreadCount: notifications.filter((item) => item.userId === user.id && !item.isRead).length
  };
}

function currentUser(req) {
  const sessionId = parseCookies(req).demo_session;
  return sessionId ? users.find((item) => item.id === sessionId) || null : null;
}

function requireAuth(req, res) {
  const user = currentUser(req);
  if (!user) {
    fail(res, 401, 'You must be logged in to access this resource.');
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'ADMIN') {
    fail(res, 403, 'This resource is restricted to administrators.');
    return null;
  }
  return user;
}

function logActivity(user, action, entityType, entityId, applicantId, details) {
  activityLogs.unshift({
    id: nextId('log'), actorId: user.id,
    actor: { id: user.id, email: user.email, role: user.role },
    action, entityType, entityId, applicantId: applicantId || null,
    details, createdAt: now()
  });
}

function notifyAdmin(title, message, type, link) {
  notifications.unshift({
    id: nextId('notif'), userId: 'admin-1', title, message, type,
    link, isRead: false, createdAt: now()
  });
}

function notifyUser(userId, title, message, type, link) {
  notifications.unshift({
    id: nextId('notif'), userId, title, message, type,
    link, isRead: false, createdAt: now()
  });
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

const routes = [];

function add(method, pattern, handler) {
  const keys = [];
  const source = pattern.replace(/:([A-Za-z]+)/g, (_, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  routes.push({ method, regex: new RegExp(`^${source}$`), keys, handler });
}

/* Health and authentication */

add('GET', '/api/health', (req, res) => json(res, 200, {
  success: true, message: 'ArtiFile API is running in demo mode.', timestamp: now(), environment: 'demo'
}));

add('POST', '/api/auth/login', async (req, res) => {
  const data = await readBody(req);
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');

  if (!email.endsWith(DOMAIN)) {
    return fail(res, 400, `Please use your GSuite email (${DOMAIN}).`);
  }

  let user = users.find((item) => item.email === email);
  if (!user) {
    const namePart = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    const created = addStudent({
      email, password: password || 'DemoPass123!', fullName: namePart,
      program: 'BS Information Technology', yearLevel: '1st Year', groupIndex: 0, status: 'PENDING'
    });
    user = created.user;
    notifyAdmin('New student registered', `${namePart} (${email}) created a new ArtiFile account.`, 'NEW_REGISTRATION', '/admin/applicants');
  }

  if (!user.isActive) {
    return fail(res, 403, 'This account has been deactivated. Please contact the OCA office.');
  }
  if (user.password !== password) {
    return fail(res, 401, 'Incorrect password. Please try again.');
  }

  setSessionCookie(res, user.id, Boolean(data.rememberMe));
  logActivity(user, 'LOGIN', 'USER', user.id, null, `${user.email} signed in.`);

  return json(res, 200, {
    success: true, message: `Welcome back, ${buildMe(user).user.fullName}.`, data: buildMe(user)
  });
});

add('POST', '/api/auth/register', async (req, res) => {
  const data = await readBody(req);
  const email = String(data.email || '').trim().toLowerCase();

  if (!email.endsWith(DOMAIN)) {
    return fail(res, 400, `You must use your BSU GSuite email (${DOMAIN}).`);
  }
  if (users.some((item) => item.email === email)) {
    return fail(res, 409, 'An account with this email already exists. Please log in instead.');
  }
  if (String(data.password || '').length < 8) {
    return fail(res, 400, 'Password must be at least 8 characters.');
  }

  const groupIndex = data.culturalGroupId
    ? Math.max(0, culturalGroups.findIndex((item) => item.id === data.culturalGroupId))
    : 0;
  const created = addStudent({
    email, password: String(data.password), fullName: String(data.fullName || email.split('@')[0]),
    phone: String(data.phone || '09171234567'),
    program: String(data.program || 'BS Information Technology'),
    yearLevel: String(data.yearLevel || '1st Year'),
    srCode: String(data.srCode || '') || null,
    groupIndex, status: 'PENDING', createdDaysAgo: 0, appliedDaysAgo: 0
  });

  setSessionCookie(res, created.user.id, false);
  notifyAdmin('New student registered', `${created.profile.fullName} (${email}) created a new ArtiFile account.`, 'NEW_REGISTRATION', '/admin/applicants');
  logActivity(created.user, 'REGISTER', 'USER', created.user.id, null, `${created.profile.fullName} registered with ${email}.`);

  return json(res, 201, {
    success: true, message: 'Registration successful. Welcome to ArtiFile!', data: buildMe(created.user)
  });
});

add('POST', '/api/auth/logout', (req, res) => {
  const user = currentUser(req);
  if (user) logActivity(user, 'LOGOUT', 'USER', user.id, null, `${user.email} signed out.`);
  clearSessionCookie(res);
  return json(res, 200, { success: true, message: 'You have been logged out successfully.' });
});

add('GET', '/api/auth/me', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  return json(res, 200, { success: true, data: buildMe(user) });
});

add('POST', '/api/auth/forgot-password', (req, res) => json(res, 200, {
  success: true, message: 'If the account exists, a password reset instruction has been sent to your GSuite email.'
}));

/* Student */

add('GET', '/api/student/dashboard', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const me = buildMe(user);
  const application = applications.find((item) => item.userId === user.id);
  const docs = application
    ? documents.filter((item) => item.applicationId === application.id).map((item) => documentView(item))
    : [];
  return json(res, 200, {
    success: true,
    data: { ...me, documents: docs, recentNotifications: notifications.filter((item) => item.userId === user.id).slice(0, 5) }
  });
});

add('GET', '/api/student/application', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const me = buildMe(user);
  return json(res, 200, {
    success: true, data: { application: me.application, status: me.status, profile: me.profile }
  });
});

add('GET', '/api/student/requirements', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const application = applications.find((item) => item.userId === user.id);
  if (!application) return fail(res, 404, 'Application record not found.');
  const canAccessPost = application.status === 'ACCEPTED';

  const data = requirements.filter((item) => item.isActive).map((requirement) => {
    const document = documents.find((item) => item.applicationId === application.id && item.requirementId === requirement.id);
    const locked = requirement.category === 'POST_AUDITION' && !canAccessPost;
    return {
      id: requirement.id, key: requirement.key, title: requirement.title,
      description: requirement.description, category: requirement.category,
      allowedMimeTypes: requirement.allowedMimeTypes, allowedExtensions: requirement.allowedExtensions,
      maxFileSizeMb: requirement.maxFileSizeMb, locked,
      lockReason: locked ? 'This requirement becomes available only when your application status is ACCEPTED.' : null,
      document: locked || !document
        ? { id: null, status: 'NOT_SUBMITTED', feedback: null, fileName: null, fileSize: null, submittedAt: null, updatedAt: null, reviewedAt: null, versionCount: document ? document.history.length : 0 }
        : {
            id: document.id, status: document.status, feedback: document.feedback,
            fileName: document.currentFileName, fileSize: document.currentFileSize,
            submittedAt: document.submittedAt, updatedAt: document.updatedAt,
            reviewedAt: document.reviewedAt, versionCount: document.history.length
          }
    };
  });

  return json(res, 200, { success: true, data });
});

add('PUT', '/api/student/profile', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const data = await readBody(req);
  const profile = profiles.find((item) => item.userId === user.id);
  if (!profile) return fail(res, 404, 'Student profile not found.');

  ['fullName', 'phone', 'yearLevel', 'program', 'campus', 'academicYear', 'srCode', 'culturalGroupId'].forEach((key) => {
    if (data[key] !== undefined) profile[key] = data[key];
  });
  profile.updatedAt = now();
  logActivity(user, 'UPDATE_PROFILE', 'STUDENT_PROFILE', profile.id, profile.id, 'Student updated their personal information.');

  return json(res, 200, { success: true, message: 'Profile updated successfully.', data: profileView(profile) });
});

/* Documents */

add('GET', '/api/documents/my-documents', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const application = applications.find((item) => item.userId === user.id);
  if (!application) return fail(res, 404, 'Application record not found.');
  const docs = documents
    .filter((item) => item.applicationId === application.id)
    .sort((a, b) => requirementById(a.requirementId).sortOrder - requirementById(b.requirementId).sortOrder)
    .map((item) => documentView(item));
  return json(res, 200, { success: true, data: docs });
});

async function uploadDocument(req, res, mode) {
  const user = requireAuth(req, res);
  if (!user) return;
  const raw = await readRaw(req);
  const params = req.params || {};
  let requirement;

  if (mode === 'replace') {
    const document = documents.find((item) => item.id === params.id);
    if (!document) return fail(res, 404, 'Document not found.');
    const application = applications.find((item) => item.id === document.applicationId);
    if (!application || application.userId !== user.id) return fail(res, 403, 'You can only replace your own documents.');
    requirement = requirementById(document.requirementId);
  } else {
    const key = multipartValue(raw, 'requirementKey');
    requirement = requirements.find((item) => item.key === key);
    if (!requirement) return fail(res, 400, 'That requirement is not available.');
    if (mode === 'pre' && requirement.category !== 'PRE_AUDITION') return fail(res, 403, 'This requirement does not belong to that category.');
    if (mode === 'post' && requirement.category !== 'POST_AUDITION') return fail(res, 403, 'This requirement does not belong to that category.');
  }

  const application = applications.find((item) => item.userId === user.id);
  if (!application) return fail(res, 404, 'Application record not found.');
  if (requirement.category === 'POST_AUDITION' && application.status !== 'ACCEPTED') {
    return fail(res, 403, 'Post-audition requirements are locked until your application is ACCEPTED.');
  }

  let document = mode === 'replace'
    ? documents.find((item) => item.id === params.id)
    : documents.find((item) => item.applicationId === application.id && item.requirementId === requirement.id);

  if (!document) {
    document = {
      id: nextId('doc'), applicationId: application.id, requirementId: requirement.id,
      status: 'SUBMITTED', feedback: null, history: []
    };
    documents.push(document);
  }

  const fileName = multipartFileName(raw);
  const version = (document.history.length || 0) + 1;
  Object.assign(document, {
    status: 'SUBMITTED', feedback: null, reviewedById: null, reviewedAt: null,
    currentFileName: fileName, currentFileKey: `demo-${document.id}-v${version}.pdf`,
    currentMimeType: 'application/pdf', currentFileSize: 245760,
    submittedAt: now(), updatedAt: now()
  });
  document.history.push({ version, action: version > 1 ? 'REPLACE' : 'UPLOAD', fileName, mimeType: 'application/pdf', fileSize: 245760, createdAt: now(), uploadedById: user.id });

  const profile = profiles.find((item) => item.userId === user.id);
  notifyAdmin(version > 1 ? 'Student replaced a document' : 'Student submitted a requirement', `A student ${version > 1 ? 'replaced' : 'uploaded'} “${requirement.title}”.`, version > 1 ? 'DOCUMENT_REPLACED' : 'DOCUMENT_SUBMITTED', '/admin/documents');
  logActivity(user, version > 1 ? 'REPLACE_DOCUMENT' : 'UPLOAD_DOCUMENT', 'DOCUMENT', document.id, profile ? profile.id : null, `${requirement.title} uploaded (version ${version}).`);

  return json(res, version > 1 ? 200 : 201, {
    success: true,
    message: version > 1 ? 'Document replaced successfully.' : 'Document uploaded successfully.',
    data: { id: document.id, requirementKey: requirement.key, status: document.status, fileName, submittedAt: document.submittedAt, version }
  });
}

add('POST', '/api/documents/upload-pre', (req, res) => uploadDocument(req, res, 'pre'));
add('POST', '/api/documents/upload-post', (req, res) => uploadDocument(req, res, 'post'));
add('POST', '/api/documents/:id/replace', (req, res) => uploadDocument(req, res, 'replace'));

add('GET', '/api/documents/:id/download', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const document = documents.find((item) => item.id === req.params.id);
  if (!document || !document.currentFileKey) return fail(res, 404, 'Document not found or no file has been uploaded yet.');
  const application = applications.find((item) => item.id === document.applicationId);
  if (user.role !== 'ADMIN' && (!application || application.userId !== user.id)) return fail(res, 403, 'You are not authorized to access this document.');

  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const download = String(new URL(req.url, `http://localhost:${PORT}`).searchParams.get('download') || '') === '1';
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(document.currentFileName || 'document.pdf')}`,
    'Content-Length': pdf.length,
    'Cache-Control': 'private, no-store'
  });
  return res.end(pdf);
});

add('GET', '/api/documents/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const document = documents.find((item) => item.id === req.params.id);
  if (!document || !document.currentFileKey) return fail(res, 404, 'Document not found or no file has been uploaded yet.');
  const application = applications.find((item) => item.id === document.applicationId);
  if (user.role !== 'ADMIN' && (!application || application.userId !== user.id)) return fail(res, 403, 'You are not authorized to access this document.');
  return json(res, 200, { success: true, data: documentView(document, { withApplication: true }) });
});

/* Admin */

function applicantView(profile) {
  const user = users.find((item) => item.id === profile.userId);
  const application = applications.find((item) => item.userId === profile.userId);
  const group = groupById(profile.culturalGroupId);
  const docs = application ? documents.filter((item) => item.applicationId === application.id) : [];
  return {
    id: profile.id, fullName: profile.fullName, email: user ? user.email : '',
    phone: profile.phone, program: profile.program, yearLevel: profile.yearLevel,
    campus: profile.campus, academicYear: profile.academicYear, srCode: profile.srCode,
    culturalGroup: group ? group.name : '—', culturalGroupId: profile.culturalGroupId,
    registrationDate: profile.createdAt, isActive: user ? user.isActive : false,
    applicationStatus: application ? application.status : 'PENDING',
    application: application ? { id: application.id, status: application.status, feedback: application.feedback } : null,
    documentCount: docs.filter((item) => item.submittedAt).length
  };
}

add('GET', '/api/admin/dashboard', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const statusCount = (status) => applications.filter((item) => item.status === status).length;
  const docCount = (status) => documents.filter((item) => item.status === status).length;
  const byCulturalGroup = culturalGroups.map((group) => {
    const members = profiles.filter((item) => item.culturalGroupId === group.id && !item.archivedAt);
    const apps = members.map((item) => applications.find((app) => app.userId === item.userId)).filter(Boolean);
    const docs = apps.flatMap((app) => documents.filter((item) => item.applicationId === app.id));
    return {
      id: group.id, name: group.name, total: members.length,
      pending: apps.filter((item) => item.status === 'PENDING').length,
      underReview: apps.filter((item) => item.status === 'UNDER_REVIEW').length,
      accepted: apps.filter((item) => item.status === 'ACCEPTED').length,
      rejected: apps.filter((item) => item.status === 'REJECTED').length,
      submittedDocuments: docs.filter((item) => item.submittedAt).length,
      documentsUnderReview: docs.filter((item) => item.status === 'UNDER_REVIEW').length,
      documentsRequiringRevision: docs.filter((item) => item.status === 'REVISION_REQUIRED').length,
      incompleteRequirements: members.length
    };
  });

  return json(res, 200, {
    success: true,
    data: {
      summary: {
        totalRegisteredApplicants: profiles.filter((item) => !item.archivedAt).length,
        pendingApplications: statusCount('PENDING'),
        underReviewApplications: statusCount('UNDER_REVIEW'),
        acceptedApplicants: statusCount('ACCEPTED'),
        rejectedApplicants: statusCount('REJECTED'),
        totalSubmittedDocuments: documents.filter((item) => item.submittedAt).length,
        documentsUnderReview: docCount('UNDER_REVIEW'),
        documentsRequiringRevision: docCount('REVISION_REQUIRED')
      },
      incompleteRequirements: profiles.filter((item) => !item.archivedAt).length,
      byCulturalGroup,
      statusBreakdown: ['PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].map((status) => ({ status, count: statusCount(status) })),
      documentStatusBreakdown: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REVISION_REQUIRED', 'REJECTED', 'NOT_SUBMITTED'].map((status) => ({ status, count: docCount(status) }))
    }
  });
});

add('GET', '/api/admin/applicants', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const query = new URL(req.url, `http://localhost:${PORT}`).searchParams;
  const page = Math.max(1, Number(query.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(query.get('limit') || 10)));
  const search = String(query.get('search') || '').toLowerCase();
  const yearLevel = query.get('yearLevel');
  const culturalGroupId = query.get('culturalGroupId');
  const status = query.get('status');
  const sortBy = query.get('sortBy') || 'createdAt';
  const sortDir = query.get('sortDir') === 'asc' ? 1 : -1;

  let items = profiles.filter((item) => !item.archivedAt).map(applicantView);
  if (search) items = items.filter((item) => [item.fullName, item.email, item.srCode].some((value) => String(value || '').toLowerCase().includes(search)));
  if (yearLevel) items = items.filter((item) => item.yearLevel === yearLevel);
  if (culturalGroupId) items = items.filter((item) => item.culturalGroupId === culturalGroupId);
  if (status) items = items.filter((item) => item.applicationStatus === status);

  items.sort((a, b) => {
    const left = sortBy === 'status' ? a.applicationStatus : sortBy === 'name' ? a.fullName : a.registrationDate;
    const right = sortBy === 'status' ? b.applicationStatus : sortBy === 'name' ? b.fullName : b.registrationDate;
    return String(left).localeCompare(String(right)) * sortDir;
  });

  const total = items.length;
  const start = (page - 1) * limit;
  return json(res, 200, {
    success: true, data: items.slice(start, start + limit),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  });
});

add('GET', '/api/admin/applicants/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const profile = profiles.find((item) => item.id === req.params.id);
  if (!profile) return fail(res, 404, 'Applicant not found.');
  const user = users.find((item) => item.id === profile.userId);
  const application = applications.find((item) => item.userId === profile.userId);
  const group = groupById(profile.culturalGroupId);
  const docs = application ? documents.filter((item) => item.applicationId === application.id) : [];

  const requirementsByCategory = { PRE_AUDITION: [], POST_AUDITION: [] };
  requirements.filter((item) => item.isActive).forEach((requirement) => {
    const document = docs.find((item) => item.requirementId === requirement.id);
    requirementsByCategory[requirement.category].push({
      requirementId: requirement.id, key: requirement.key, title: requirement.title,
      category: requirement.category,
      document: document
        ? { ...document, requirement: requirementById(document.requirementId), history: document.history || [] }
        : { id: null, status: 'NOT_SUBMITTED', feedback: null, currentFileName: null, submittedAt: null, history: [] }
    });
  });

  return json(res, 200, {
    success: true,
    data: {
      id: profile.id, fullName: profile.fullName, email: user ? user.email : '', phone: profile.phone,
      program: profile.program, yearLevel: profile.yearLevel, campus: profile.campus,
      academicYear: profile.academicYear, srCode: profile.srCode,
      culturalGroup: group ? group.name : '—', registrationDate: profile.createdAt,
      archivedAt: profile.archivedAt, isActive: user ? user.isActive : false,
      application: application
        ? { ...application, derived: deriveStatus(application, docs.map((item) => documentView(item))) }
        : null,
      requirementsByCategory,
      activityLogs: activityLogs.filter((item) => item.applicantId === profile.id).slice(0, 20)
    }
  });
});

add('PUT', '/api/admin/applicants/:id/status', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const profile = profiles.find((item) => item.id === req.params.id);
  if (!profile) return fail(res, 404, 'Applicant not found.');
  const application = applications.find((item) => item.userId === profile.userId);
  if (!application) return fail(res, 404, 'Application record not found.');
  const data = await readBody(req);
  const previousStatus = application.status;
  application.status = String(data.status || application.status).toUpperCase();
  application.feedback = data.feedback || null;
  application.decidedAt = now();

  const messages = {
    ACCEPTED: 'Your application has been ACCEPTED. Your post-audition requirement is now unlocked.',
    REJECTED: `Your application was rejected. Reason: ${application.feedback || 'No reason provided.'}`,
    UNDER_REVIEW: 'Your application status is now under review.'
  };
  notifyUser(profile.userId, `Application ${application.status.toLowerCase()}`, messages[application.status] || 'Your application status was updated.', 'APPLICATION_STATUS', '/student/status');
  logActivity(admin, 'APPLICATION_STATUS_CHANGE', 'APPLICATION', application.id, profile.id, `Application status changed from ${previousStatus} to ${application.status}.`);

  return json(res, 200, {
    success: true, message: `Application status updated to ${application.status.replace('_', ' ').toLowerCase()}.`,
    data: { id: application.id, status: application.status, feedback: application.feedback, decidedAt: application.decidedAt }
  });
});

add('POST', '/api/admin/applicants/:id/archive', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const profile = profiles.find((item) => item.id === req.params.id);
  if (!profile) return fail(res, 404, 'Applicant not found.');
  const user = users.find((item) => item.id === profile.userId);
  profile.archivedAt = profile.archivedAt ? null : now();
  if (user) user.isActive = !profile.archivedAt;
  logActivity(admin, profile.archivedAt ? 'ARCHIVE_APPLICANT' : 'RESTORE_APPLICANT', 'STUDENT_PROFILE', profile.id, profile.id, `${profile.archivedAt ? 'Archived' : 'Restored'} applicant ${profile.fullName}.`);
  return json(res, 200, {
    success: true, message: profile.archivedAt ? 'Applicant record archived.' : 'Applicant record restored.',
    data: { id: profile.id, archivedAt: profile.archivedAt }
  });
});

add('GET', '/api/admin/documents', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const docs = [...documents].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map((item) => documentView(item, { withApplication: true }));
  return json(res, 200, { success: true, data: docs });
});

add('PUT', '/api/admin/documents/:id/review', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const document = documents.find((item) => item.id === req.params.id);
  if (!document) return fail(res, 404, 'Document not found.');
  const data = await readBody(req);
  document.status = String(data.status || document.status).toUpperCase();
  document.feedback = data.feedback || null;
  document.reviewedById = admin.id;
  document.reviewedAt = now();
  document.updatedAt = now();

  const application = applications.find((item) => item.id === document.applicationId);
  const requirement = requirementById(document.requirementId);
  if (application) {
    notifyUser(application.userId, `Document review: ${document.status.replace('_', ' ').toLowerCase()}`, `Your “${requirement ? requirement.title : 'document'}” was reviewed as ${document.status.replace('_', ' ').toLowerCase()}.`, 'DOCUMENT_REVIEW', '/student/requirements');
  }
  const profile = application ? profiles.find((item) => item.userId === application.userId) : null;
  logActivity(admin, 'DOCUMENT_REVIEW', 'DOCUMENT', document.id, profile ? profile.id : null, `${requirement ? requirement.title : 'Document'} reviewed as ${document.status}.`);

  return json(res, 200, {
    success: true, message: 'Document review saved and the student has been notified.',
    data: { id: document.id, status: document.status, feedback: document.feedback, reviewedAt: document.reviewedAt }
  });
});

add('GET', '/api/admin/activity-logs', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const query = new URL(req.url, `http://localhost:${PORT}`).searchParams;
  const page = Math.max(1, Number(query.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(query.get('limit') || 20)));
  const total = activityLogs.length;
  const start = (page - 1) * limit;
  return json(res, 200, {
    success: true, data: activityLogs.slice(start, start + limit),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  });
});

add('GET', '/api/admin/reports', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const countStatus = (status) => applications.filter((item) => item.status === status).length;
  const monthlyMap = new Map();
  documents.forEach((document) => {
    if (!document.submittedAt) return;
    const date = new Date(document.submittedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
  });

  return json(res, 200, {
    success: true,
    data: {
      applicationsByStatus: ['PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'].map((status) => ({ status, count: countStatus(status) })),
      applicantsByCulturalGroup: culturalGroups.map((group) => ({
        culturalGroupId: group.id, name: group.name,
        count: profiles.filter((item) => item.culturalGroupId === group.id && !item.archivedAt).length
      })),
      documentsByStatus: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REVISION_REQUIRED', 'REJECTED'].map((status) => ({ status, count: documents.filter((item) => item.status === status).length })),
      monthlySubmissions: Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
      totalSubmissions: documents.filter((item) => item.submittedAt).length
    }
  });
});

add('GET', '/api/admin/events', (req, res) => {
  if (!requireAdmin(req, res)) return;
  return json(res, 200, { success: true, data: events.filter((item) => item.isActive) });
});

add('POST', '/api/admin/events', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const data = await readBody(req);
  const event = {
    id: nextId('evt'), title: String(data.title || '').trim(), description: String(data.description || '') || null,
    location: String(data.location || '') || null, startAt: String(data.startAt || now()),
    endAt: String(data.endAt || '') || null, isActive: true, createdById: admin.id
  };
  events.push(event);
  logActivity(admin, 'CREATE_EVENT', 'EVENT', event.id, null, `Created event “${event.title}”.`);
  return json(res, 201, { success: true, message: 'Event created.', data: event });
});

add('PUT', '/api/admin/events/:id', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const event = events.find((item) => item.id === req.params.id);
  if (!event) return fail(res, 404, 'Event not found.');
  const data = await readBody(req);
  Object.assign(event, data, { id: event.id, createdById: event.createdById });
  logActivity(admin, 'UPDATE_EVENT', 'EVENT', event.id, null, `Updated event “${event.title}”.`);
  return json(res, 200, { success: true, message: 'Event updated.', data: event });
});

add('DELETE', '/api/admin/events/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const event = events.find((item) => item.id === req.params.id);
  if (!event) return fail(res, 404, 'Event not found.');
  event.isActive = false;
  logActivity(admin, 'DELETE_EVENT', 'EVENT', event.id, null, `Deactivated event “${event.title}”.`);
  return json(res, 200, { success: true, message: 'Event removed from the calendar.', data: event });
});

add('GET', '/api/admin/resources', (req, res) => {
  if (!requireAdmin(req, res)) return;
  return json(res, 200, { success: true, data: resources.filter((item) => item.isActive) });
});

add('POST', '/api/admin/resources', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const data = await readBody(req);
  const resource = {
    id: nextId('res'), key: String(data.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    kind: String(data.kind || 'FORM').toUpperCase(), title: String(data.title || '').trim(),
    description: String(data.description || '') || null, externalUrl: String(data.externalUrl || '') || null,
    fileName: String(data.fileName || '') || null, sortOrder: Number(data.sortOrder || 0), isActive: true
  };
  resources.push(resource);
  logActivity(admin, 'CREATE_RESOURCE', 'RESOURCE', resource.id, null, `Added resource “${resource.title}”.`);
  return json(res, 201, { success: true, message: 'Resource created.', data: resource });
});

add('PUT', '/api/admin/resources/:id', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const resource = resources.find((item) => item.id === req.params.id);
  if (!resource) return fail(res, 404, 'Resource not found.');
  const data = await readBody(req);
  Object.assign(resource, data, { id: resource.id });
  logActivity(admin, 'UPDATE_RESOURCE', 'RESOURCE', resource.id, null, `Updated resource “${resource.title}”.`);
  return json(res, 200, { success: true, message: 'Resource updated.', data: resource });
});

add('DELETE', '/api/admin/resources/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const resource = resources.find((item) => item.id === req.params.id);
  if (!resource) return fail(res, 404, 'Resource not found.');
  resource.isActive = false;
  logActivity(admin, 'DELETE_RESOURCE', 'RESOURCE', resource.id, null, `Removed resource “${resource.title}”.`);
  return json(res, 200, { success: true, message: 'Resource removed.', data: resource });
});

add('GET', '/api/admin/cultural-groups', (req, res) => {
  if (!requireAdmin(req, res)) return;
  return json(res, 200, {
    success: true,
    data: culturalGroups.map((group) => ({ ...group, applicantCount: profiles.filter((item) => item.culturalGroupId === group.id && !item.archivedAt).length }))
  });
});

/* Public resources */

add('GET', '/api/resources', (req, res) => {
  const grouped = { FORM: [], MANUAL: [], CERTIFICATE: [] };
  resources.filter((item) => item.isActive).forEach((item) => {
    if (grouped[item.kind]) grouped[item.kind].push(item);
  });
  return json(res, 200, { success: true, data: grouped });
});

add('GET', '/api/resources/events', (req, res) => json(res, 200, { success: true, data: events.filter((item) => item.isActive) }));

add('GET', '/api/resources/cultural-groups', (req, res) => json(res, 200, {
  success: true,
  data: culturalGroups.map((group) => ({ id: group.id, name: group.name, applicantCount: profiles.filter((item) => item.culturalGroupId === group.id && !item.archivedAt).length }))
}));

add('GET', '/api/resources/contact', (req, res) => json(res, 200, { success: true, data: settings }));

/* Notifications */

add('GET', '/api/notifications', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const query = new URL(req.url, `http://localhost:${PORT}`).searchParams;
  const limit = Math.min(100, Math.max(1, Number(query.get('limit') || 50)));
  const items = notifications.filter((item) => item.userId === user.id).slice(0, limit);
  const unreadCount = notifications.filter((item) => item.userId === user.id && !item.isRead).length;
  return json(res, 200, { success: true, data: items, unreadCount, meta: { page: 1, limit, total: items.length, totalPages: 1 } });
});

add('PUT', '/api/notifications/read-all', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  let count = 0;
  notifications.forEach((item) => {
    if (item.userId === user.id && !item.isRead) {
      item.isRead = true;
      count += 1;
    }
  });
  return json(res, 200, { success: true, message: `${count} notification(s) marked as read.`, data: { updatedCount: count } });
});

add('PUT', '/api/notifications/:id/read', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const notification = notifications.find((item) => item.id === req.params.id && item.userId === user.id);
  if (!notification) return fail(res, 404, 'Notification not found.');
  notification.isRead = true;
  return json(res, 200, { success: true, message: 'Notification marked as read.', data: notification });
});

/* ------------------------------------------------------------------ *
 * Static files and SPA fallback
 * ------------------------------------------------------------------ */

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

function serveStatic(pathname, res) {
  let filePath = path.join(CLIENT_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(CLIENT_DIR)) return fail(res, 403, 'Forbidden.');

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (path.extname(pathname)) return fail(res, 404, 'File not found.');
    filePath = path.join(CLIENT_DIR, 'index.html');
  }

  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  return fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://localhost:${PORT}`);
  } catch {
    return fail(res, 400, 'Invalid request URL.');
  }

  if (!url.pathname.startsWith('/api/')) {
    return serveStatic(url.pathname, res);
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return fail(res, 400, 'Invalid request URL.');
  }

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = route.regex.exec(pathname);
    if (!match) continue;
    const params = {};
    route.keys.forEach((key, index) => {
      params[key] = match[index + 1];
    });
    req.params = params;
    try {
      return await route.handler(req, res);
    } catch (error) {
      console.error('[demo]', error);
      if (!res.headersSent) return fail(res, 500, 'Demo server error: ' + error.message);
      return res.end();
    }
  }

  return fail(res, 404, `Endpoint not found: ${req.method} ${pathname}`);
});

server.listen(PORT, () => {
  console.log('=========================================');
  console.log('  ArtiFile DEMO MODE (no database)');
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log('  API:  in-memory mock data');
  console.log('');
  console.log(`  Student: ${STUDENT_EMAIL} / ${STUDENT_PASSWORD}`);
  console.log(`  Admin:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('  Any other @g.batstate-u.edu.ph email also works.');
  console.log('');
  console.log('  Changes reset when the server stops.');
  console.log('  Press Ctrl+C to stop.');
  console.log('=========================================');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));

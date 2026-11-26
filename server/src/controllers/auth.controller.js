const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { registerSchema, loginSchema } = require('../validators/auth');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/tokens');
const { logActivity } = require('../utils/activity');
const { notifyAllAdmins } = require('../utils/notifications');
const { deriveApplicationStatus } = require('../utils/derived-status');
const { AppError } = require('../middleware/error');
const { sendMail } = require('../config/mailer');

function currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.studentProfile ? user.studentProfile.fullName : env.seedAdminName,
    isActive: user.isActive
  };
}

async function buildMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: { include: { culturalGroup: true } },
      application: {
        include: {
          documents: { include: { requirement: true } }
        }
      }
    }
  });

  if (!user) {
    throw new AppError('Account not found.', 404);
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false }
  });

  const application = user.application
    ? {
        id: user.application.id,
        status: user.application.status,
        feedback: user.application.feedback,
        appliedAt: user.application.appliedAt,
        decidedAt: user.application.decidedAt
      }
    : null;

  const status = deriveApplicationStatus(application, user.application ? user.application.documents : []);

  return {
    user: sanitizeUser(user),
    profile: user.studentProfile
      ? {
          id: user.studentProfile.id,
          fullName: user.studentProfile.fullName,
          phone: user.studentProfile.phone,
          yearLevel: user.studentProfile.yearLevel,
          program: user.studentProfile.program,
          campus: user.studentProfile.campus,
          academicYear: user.studentProfile.academicYear,
          srCode: user.studentProfile.srCode,
          culturalGroupId: user.studentProfile.culturalGroupId,
          culturalGroup: user.studentProfile.culturalGroup ? user.studentProfile.culturalGroup.name : null,
          createdAt: user.studentProfile.createdAt
        }
      : null,
    application,
    status,
    unreadCount
  };
}

async function register(req, res) {
  const data = registerSchema.parse(req.body);
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('An account with this email already exists. Please log in instead.', 409);
  }

  let culturalGroupId = data.culturalGroupId;
  if (!culturalGroupId) {
    const firstGroup = await prisma.culturalGroup.findFirst({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    if (!firstGroup) {
      throw new AppError('No cultural group is configured. Please contact the OCA office.', 500);
    }
    culturalGroupId = firstGroup.id;
  } else {
    const group = await prisma.culturalGroup.findUnique({ where: { id: culturalGroupId } });
    if (!group || !group.isActive) {
      throw new AppError('The selected cultural group is not available.', 400);
    }
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: 'STUDENT',
        isActive: true
      }
    });

    await tx.studentProfile.create({
      data: {
        userId: createdUser.id,
        fullName: data.fullName,
        phone: data.phone,
        yearLevel: data.yearLevel,
        program: data.program,
        campus: data.campus,
        academicYear: data.academicYear || currentAcademicYear(),
        culturalGroupId,
        srCode: data.srCode || null
      }
    });

    await tx.application.create({
      data: {
        userId: createdUser.id,
        status: 'PENDING'
      }
    });

    return createdUser;
  });

  const token = signToken(user, false);
  setAuthCookie(res, token, false);

  await notifyAllAdmins({
    title: 'New student registered',
    message: `${data.fullName} (${email}) created a new ArtiFile account.`,
    type: 'NEW_REGISTRATION',
    link: '/admin/applicants'
  });

  await logActivity({
    actorId: user.id,
    action: 'REGISTER',
    entityType: 'USER',
    entityId: user.id,
    details: `${data.fullName} registered with ${email}.`,
    req
  });

  const me = await buildMe(user.id);

  return res.status(201).json({
    success: true,
    message: 'Registration successful. Welcome to ArtiFile!',
    data: me
  });
}

async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const email = data.email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true }
  });

  if (!user) {
    throw new AppError('No account was found with that email address.', 401);
  }

  if (!user.isActive) {
    throw new AppError('This account has been deactivated. Please contact the OCA office.', 403);
  }

  const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('Incorrect password. Please try again.', 401);
  }

  const token = signToken(user, data.rememberMe);
  setAuthCookie(res, token, data.rememberMe);

  await logActivity({
    actorId: user.id,
    action: 'LOGIN',
    entityType: 'USER',
    entityId: user.id,
    details: `${user.email} signed in.`,
    req
  });

  const me = await buildMe(user.id);

  return res.status(200).json({
    success: true,
    message: `Welcome back, ${me.user.fullName}.`,
    data: me
  });
}

async function logout(req, res) {
  if (req.user) {
    await logActivity({
      actorId: req.user.id,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      details: `${req.user.email} signed out.`,
      req
    });
  }

  clearAuthCookie(res);

  return res.status(200).json({
    success: true,
    message: 'You have been logged out successfully.'
  });
}

async function me(req, res) {
  const data = await buildMe(req.user.id);
  return res.status(200).json({ success: true, data });
}

async function forgotPassword(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();

  if (!email.endsWith(env.gsuiteDomain)) {
    throw new AppError(
      `Please use your GSuite email (${env.gsuiteDomain}) to request a password reset.`,
      400
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await sendMail({
      to: email,
      subject: 'ArtiFile Password Reset Request',
      text: 'A password reset was requested for your ArtiFile account. Please contact the Administrative Aide VI at cultureandarts.alangilan@g.batstate-u.edu.ph to complete the reset.'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'If the account exists, a password reset instruction has been sent to your GSuite email.'
  });
}

module.exports = { register, login, logout, me, forgotPassword, buildMe, sanitizeUser };

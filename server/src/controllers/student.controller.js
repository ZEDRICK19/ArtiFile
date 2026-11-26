const prisma = require('../config/prisma');
const { updateProfileSchema } = require('../validators/auth');
const { logActivity } = require('../utils/activity');
const { buildMe } = require('./auth.controller');
const { AppError } = require('../middleware/error');

async function getProfile(req, res) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: req.user.id },
    include: { culturalGroup: true }
  });

  if (!profile) {
    throw new AppError('Student profile not found.', 404);
  }

  return res.status(200).json({ success: true, data: profile });
}

async function updateProfile(req, res) {
  const data = updateProfileSchema.parse(req.body);

  if (data.culturalGroupId) {
    const group = await prisma.culturalGroup.findUnique({ where: { id: data.culturalGroupId } });
    if (!group || !group.isActive) {
      throw new AppError('The selected cultural group is not available.', 400);
    }
  }

  if (data.srCode) {
    const duplicate = await prisma.studentProfile.findFirst({
      where: { srCode: data.srCode, userId: { not: req.user.id } }
    });
    if (duplicate) {
      throw new AppError('That SR-CODE is already registered to another student.', 409);
    }
  }

  const profile = await prisma.studentProfile.update({
    where: { userId: req.user.id },
    data,
    include: { culturalGroup: true }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'UPDATE_PROFILE',
    entityType: 'STUDENT_PROFILE',
    entityId: profile.id,
    applicantId: profile.id,
    details: 'Student updated their personal information.',
    req
  });

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    data: profile
  });
}

async function getApplication(req, res) {
  const me = await buildMe(req.user.id);
  return res.status(200).json({
    success: true,
    data: {
      application: me.application,
      status: me.status,
      profile: me.profile
    }
  });
}

async function getRequirements(req, res) {
  const application = await prisma.application.findUnique({
    where: { userId: req.user.id },
    include: { documents: { include: { requirement: true, history: true } } }
  });

  if (!application) {
    throw new AppError('Application record not found.', 404);
  }

  const requirements = await prisma.requirement.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
  });

  const canAccessPost = application.status === 'ACCEPTED';

  const data = requirements.map((requirement) => {
    const document = application.documents.find((doc) => doc.requirementId === requirement.id);
    const locked = requirement.category === 'POST_AUDITION' && !canAccessPost;

    return {
      id: requirement.id,
      key: requirement.key,
      title: requirement.title,
      description: requirement.description,
      category: requirement.category,
      allowedMimeTypes: requirement.allowedMimeTypes,
      allowedExtensions: requirement.allowedExtensions,
      maxFileSizeMb: requirement.maxFileSizeMb,
      locked,
      lockReason: locked
        ? 'This requirement becomes available only when your application status is ACCEPTED.'
        : null,
      document: locked
        ? null
        : document
          ? {
              id: document.id,
              status: document.status,
              feedback: document.feedback,
              fileName: document.currentFileName,
              fileSize: document.currentFileSize,
              submittedAt: document.submittedAt,
              updatedAt: document.updatedAt,
              reviewedAt: document.reviewedAt,
              versionCount: document.history.length
            }
          : {
              id: null,
              status: 'NOT_SUBMITTED',
              feedback: null,
              fileName: null,
              fileSize: null,
              submittedAt: null,
              updatedAt: null,
              reviewedAt: null,
              versionCount: 0
            }
    };
  });

  return res.status(200).json({ success: true, data });
}

async function getDashboard(req, res) {
  const me = await buildMe(req.user.id);

  const documents = me.application
    ? await prisma.document.findMany({
        where: { applicationId: me.application.id },
        include: { requirement: true },
        orderBy: { updatedAt: 'desc' }
      })
    : [];

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  return res.status(200).json({
    success: true,
    data: {
      ...me,
      documents,
      recentNotifications: notifications
    }
  });
}

module.exports = { getProfile, updateProfile, getApplication, getRequirements, getDashboard };

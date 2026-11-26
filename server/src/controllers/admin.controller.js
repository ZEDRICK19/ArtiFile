const prisma = require('../config/prisma');
const {
  reviewSchema,
  applicationStatusSchema,
  applicantIdSchema,
  listQuerySchema
} = require('../validators/documents');
const { notify } = require('../utils/notifications');
const { logActivity } = require('../utils/activity');
const { deriveApplicationStatus } = require('../utils/derived-status');
const { sendMail } = require('../config/mailer');
const { AppError } = require('../middleware/error');

const GROUP_SELECT = {
  id: true,
  name: true,
  isActive: true
};

async function getDashboard(req, res) {
  const [totalApplicants, groups, statusCounts, docCounts, preRequirementCount] = await Promise.all([
    prisma.studentProfile.count({ where: { archivedAt: null } }),
    prisma.culturalGroup.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        students: {
          where: { archivedAt: null },
          include: {
            user: { include: { application: { include: { documents: true } } } }
          }
        }
      }
    }),
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.document.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.requirement.count({ where: { category: 'PRE_AUDITION', isActive: true } })
  ]);

  const countByStatus = (list, status) => {
    const found = list.find((item) => item.status === status);
    return found ? found._count._all : 0;
  };

  const byCulturalGroup = groups.map((group) => {
    const students = group.students.map((student) => ({
      ...student,
      application: student.user ? student.user.application : null
    }));
    const allDocs = students.flatMap((student) =>
      student.application ? student.application.documents : []
    );

    const incomplete = students.filter((student) => {
      if (!student.application) return true;
      const preDocs = student.application.documents.filter((doc) => doc.requirementId);
      const acceptedPre = student.application.documents.filter((doc) => doc.status === 'ACCEPTED');
      return preDocs.length < preRequirementCount || acceptedPre.length < preRequirementCount;
    }).length;

    return {
      id: group.id,
      name: group.name,
      total: students.length,
      pending: students.filter((s) => s.application && s.application.status === 'PENDING').length,
      underReview: students.filter((s) => s.application && s.application.status === 'UNDER_REVIEW').length,
      accepted: students.filter((s) => s.application && s.application.status === 'ACCEPTED').length,
      rejected: students.filter((s) => s.application && s.application.status === 'REJECTED').length,
      submittedDocuments: allDocs.filter((doc) => doc.submittedAt !== null).length,
      documentsUnderReview: allDocs.filter((doc) => doc.status === 'UNDER_REVIEW').length,
      documentsRequiringRevision: allDocs.filter((doc) => doc.status === 'REVISION_REQUIRED').length,
      incompleteRequirements: incomplete
    };
  });

  const totalSubmittedDocuments = docCounts.reduce((sum, item) => sum + item._count._all, 0);

  return res.status(200).json({
    success: true,
    data: {
      summary: {
        totalRegisteredApplicants: totalApplicants,
        pendingApplications: countByStatus(statusCounts, 'PENDING'),
        underReviewApplications: countByStatus(statusCounts, 'UNDER_REVIEW'),
        acceptedApplicants: countByStatus(statusCounts, 'ACCEPTED'),
        rejectedApplicants: countByStatus(statusCounts, 'REJECTED'),
        totalSubmittedDocuments,
        documentsUnderReview: countByStatus(docCounts, 'UNDER_REVIEW'),
        documentsRequiringRevision: countByStatus(docCounts, 'REVISION_REQUIRED')
      },
      incompleteRequirements: byCulturalGroup.reduce((sum, group) => sum + group.incompleteRequirements, 0),
      byCulturalGroup,
      statusBreakdown: [
        { status: 'PENDING', count: countByStatus(statusCounts, 'PENDING') },
        { status: 'UNDER_REVIEW', count: countByStatus(statusCounts, 'UNDER_REVIEW') },
        { status: 'ACCEPTED', count: countByStatus(statusCounts, 'ACCEPTED') },
        { status: 'REJECTED', count: countByStatus(statusCounts, 'REJECTED') }
      ],
      documentStatusBreakdown: [
        { status: 'SUBMITTED', count: countByStatus(docCounts, 'SUBMITTED') },
        { status: 'UNDER_REVIEW', count: countByStatus(docCounts, 'UNDER_REVIEW') },
        { status: 'ACCEPTED', count: countByStatus(docCounts, 'ACCEPTED') },
        { status: 'REVISION_REQUIRED', count: countByStatus(docCounts, 'REVISION_REQUIRED') },
        { status: 'REJECTED', count: countByStatus(docCounts, 'REJECTED') },
        { status: 'NOT_SUBMITTED', count: countByStatus(docCounts, 'NOT_SUBMITTED') }
      ]
    }
  });
}

async function getApplicants(req, res) {
  const query = listQuerySchema.parse(req.query);

  const where = { archivedAt: null };

  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: 'insensitive' } },
      { srCode: { contains: query.search, mode: 'insensitive' } },
      { user: { email: { contains: query.search, mode: 'insensitive' } } }
    ];
  }
  if (query.yearLevel) where.yearLevel = query.yearLevel;
  if (query.culturalGroupId) where.culturalGroupId = query.culturalGroupId;
  if (query.status) {
    where.user = { ...(where.user || {}), application: { status: query.status } };
  }

  const orderBy = query.sortBy === 'status'
    ? { user: { application: { status: query.sortDir } } }
    : { [query.sortBy]: query.sortDir };

  const [items, total] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            application: { include: { documents: { include: { requirement: true } } } }
          }
        },
        culturalGroup: { select: GROUP_SELECT }
      }
    }),
    prisma.studentProfile.count({ where })
  ]);

  const data = items.map((student) => {
    const application = student.user.application || null;
    return {
      id: student.id,
      fullName: student.fullName,
      email: student.user.email,
      phone: student.phone,
      program: student.program,
      yearLevel: student.yearLevel,
      campus: student.campus,
      academicYear: student.academicYear,
      srCode: student.srCode,
      culturalGroup: student.culturalGroup.name,
      culturalGroupId: student.culturalGroupId,
      registrationDate: student.createdAt,
      isActive: student.user.isActive,
      applicationStatus: application ? application.status : 'PENDING',
      application: application
        ? {
            id: application.id,
            status: application.status,
            feedback: application.feedback,
            derived: deriveApplicationStatus(application, application.documents)
          }
        : null,
      documentCount: application ? application.documents.filter((d) => d.submittedAt).length : 0
    };
  });

  return res.status(200).json({
    success: true,
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    }
  });
}

async function getApplicantById(req, res) {
  const parsed = applicantIdSchema.parse(req.params);

  const student = await prisma.studentProfile.findUnique({
    where: { id: parsed.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          createdAt: true,
          application: {
            include: {
              documents: {
                include: {
                  requirement: true,
                  reviewedBy: { select: { id: true, email: true } },
                  history: { orderBy: { version: 'asc' } }
                },
                orderBy: { requirement: { sortOrder: 'asc' } }
              }
            }
          }
        }
      },
      culturalGroup: { select: GROUP_SELECT }
    }
  });

  if (!student) {
    throw new AppError('Applicant not found.', 404);
  }

  const application = student.user.application || null;

  const requirements = await prisma.requirement.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
  });

  const documentsByCategory = {
    PRE_AUDITION: [],
    POST_AUDITION: []
  };

  for (const requirement of requirements) {
    const existing = application
      ? application.documents.find((doc) => doc.requirementId === requirement.id)
      : null;
    documentsByCategory[requirement.category].push({
      requirementId: requirement.id,
      key: requirement.key,
      title: requirement.title,
      category: requirement.category,
      document: existing || {
        id: null,
        status: 'NOT_SUBMITTED',
        feedback: null,
        currentFileName: null,
        submittedAt: null,
        history: []
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      id: student.id,
      fullName: student.fullName,
      email: student.user.email,
      phone: student.phone,
      program: student.program,
      yearLevel: student.yearLevel,
      campus: student.campus,
      academicYear: student.academicYear,
      srCode: student.srCode,
      culturalGroup: student.culturalGroup.name,
      registrationDate: student.createdAt,
      archivedAt: student.archivedAt,
      isActive: student.user.isActive,
      application: application
        ? {
            id: application.id,
            status: application.status,
            feedback: application.feedback,
            appliedAt: application.appliedAt,
            decidedAt: application.decidedAt,
            derived: deriveApplicationStatus(application, application.documents)
          }
        : null,
      requirementsByCategory: documentsByCategory,
      activityLogs: await prisma.activityLog.findMany({
        where: { applicantId: student.id },
        include: { actor: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    }
  });
}

async function updateApplicantStatus(req, res) {
  const parsedParams = applicantIdSchema.parse(req.params);
  const data = applicationStatusSchema.parse(req.body);

  const student = await prisma.studentProfile.findUnique({
    where: { id: parsedParams.id },
    include: { user: { select: { id: true, email: true } } }
  });

  if (!student) {
    throw new AppError('Applicant not found.', 404);
  }

  const application = await prisma.application.findUnique({
    where: { userId: student.userId }
  });

  if (!application) {
    throw new AppError('Application record not found.', 404);
  }

  const previousStatus = application.status;

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: data.status,
      feedback: data.status === 'REJECTED' ? data.feedback : (data.feedback || null),
      decidedById: req.user.id,
      decidedAt: new Date()
    }
  });

  if (data.status === 'ACCEPTED') {
    await notify(student.userId, {
      title: 'Application accepted',
      message: 'Your application has been ACCEPTED. Your post-audition requirement (Performer’s Profile) is now unlocked.',
      type: 'POST_AUDITION_UNLOCKED',
      link: '/student/requirements?category=POST_AUDITION'
    });
    await sendMail({
      to: student.user.email,
      subject: 'ArtiFile: Your application has been accepted',
      text: `Hello ${student.fullName}, your ArtiFile application has been ACCEPTED. You may now log in and submit your Performer's Profile under Post-Audition Requirements.`
    });
  } else if (data.status === 'REJECTED') {
    await notify(student.userId, {
      title: 'Application rejected',
      message: `Your application was rejected. Reason: ${data.feedback}`,
      type: 'APPLICATION_STATUS',
      link: '/student/status'
    });
    await sendMail({
      to: student.user.email,
      subject: 'ArtiFile: Application status update',
      text: `Hello ${student.fullName}, your ArtiFile application was REJECTED. Reason: ${data.feedback}`
    });
  } else {
    await notify(student.userId, {
      title: 'Application status updated',
      message: `Your application status is now ${data.status.replace('_', ' ').toLowerCase()}.`,
      type: 'APPLICATION_STATUS',
      link: '/student/status'
    });
  }

  await logActivity({
    actorId: req.user.id,
    action: 'APPLICATION_STATUS_CHANGE',
    entityType: 'APPLICATION',
    entityId: updated.id,
    applicantId: student.id,
    details: `Application status changed from ${previousStatus} to ${data.status}.`,
    req
  });

  return res.status(200).json({
    success: true,
    message: `Application status updated to ${data.status.replace('_', ' ').toLowerCase()}.`,
    data: {
      id: updated.id,
      status: updated.status,
      feedback: updated.feedback,
      decidedAt: updated.decidedAt
    }
  });
}

async function reviewDocument(req, res) {
  const parsedParams = applicantIdSchema.parse({ id: req.params.id });
  const data = reviewSchema.parse(req.body);

  const document = await prisma.document.findUnique({
    where: { id: parsedParams.id },
    include: {
      requirement: true,
      application: {
        include: { user: { select: { id: true, email: true } } }
      }
    }
  });

  if (!document) {
    throw new AppError('Document not found.', 404);
  }

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: {
      status: data.status,
      feedback: data.feedback || null,
      reviewedById: req.user.id,
      reviewedAt: new Date()
    }
  });

  const typeMap = {
    ACCEPTED: 'DOCUMENT_ACCEPTED',
    REVISION_REQUIRED: 'DOCUMENT_REVISION',
    REJECTED: 'DOCUMENT_REJECTED',
    UNDER_REVIEW: 'SYSTEM',
    SUBMITTED: 'SYSTEM'
  };

  const messageMap = {
    ACCEPTED: `Your “${document.requirement.title}” was accepted.`,
    REVISION_REQUIRED: `Revision was requested for “${document.requirement.title}”. Reason: ${data.feedback}`,
    REJECTED: `Your “${document.requirement.title}” was rejected. Reason: ${data.feedback}`,
    UNDER_REVIEW: `Your “${document.requirement.title}” is now under review.`,
    SUBMITTED: `Your “${document.requirement.title}” status was reset to submitted.`
  };

  await notify(document.application.userId, {
    title: `Document review: ${data.status.replace('_', ' ').toLowerCase()}`,
    message: messageMap[data.status],
    type: typeMap[data.status],
    link: '/student/requirements'
  });

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: document.application.userId },
    select: { id: true }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'DOCUMENT_REVIEW',
    entityType: 'DOCUMENT',
    entityId: document.id,
    applicantId: studentProfile ? studentProfile.id : null,
    documentId: document.id,
    details: `${document.requirement.title} reviewed as ${data.status}.`,
    req
  });

  return res.status(200).json({
    success: true,
    message: 'Document review saved and the student has been notified.',
    data: {
      id: updated.id,
      status: updated.status,
      feedback: updated.feedback,
      reviewedAt: updated.reviewedAt
    }
  });
}

async function getActivityLogs(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const where = {};

  if (req.query.actorId) where.actorId = String(req.query.actorId);
  if (req.query.applicantId) where.applicantId = String(req.query.applicantId);
  if (req.query.action) where.action = { contains: String(req.query.action), mode: 'insensitive' };
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
    if (req.query.to) where.createdAt.lte = new Date(String(req.query.to));
  }

  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, email: true, role: true } }
      }
    }),
    prisma.activityLog.count({ where })
  ]);

  return res.status(200).json({
    success: true,
    data: items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

async function getReports(req, res) {
  const [statusCounts, groupCounts, docCounts, history] = await Promise.all([
    prisma.application.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.studentProfile.groupBy({
      by: ['culturalGroupId'],
      where: { archivedAt: null },
      _count: { _all: true }
    }),
    prisma.document.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.documentSubmissionHistory.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    })
  ]);

  const groups = await prisma.culturalGroup.findMany({ select: { id: true, name: true } });

  const monthlyMap = new Map();
  for (const entry of history) {
    const key = `${entry.createdAt.getFullYear()}-${String(entry.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
  }

  const monthlySubmissions = Array.from(monthlyMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return res.status(200).json({
    success: true,
    data: {
      applicationsByStatus: statusCounts.map((item) => ({
        status: item.status,
        count: item._count._all
      })),
      applicantsByCulturalGroup: groupCounts.map((item) => {
        const found = groups.find((group) => group.id === item.culturalGroupId);
        return {
          culturalGroupId: item.culturalGroupId,
          name: found ? found.name : 'Unknown',
          count: item._count._all
        };
      }),
      documentsByStatus: docCounts.map((item) => ({
        status: item.status,
        count: item._count._all
      })),
      monthlySubmissions,
      totalSubmissions: history.length
    }
  });
}

async function getCulturalGroups(req, res) {
  const groups = await prisma.culturalGroup.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          students: { where: { archivedAt: null } }
        }
      }
    }
  });

  return res.status(200).json({
    success: true,
    data: groups.map((group) => ({
      id: group.id,
      name: group.name,
      applicantCount: group._count.students
    }))
  });
}

async function createCulturalGroup(req, res) {
  const name = String(req.body.name || '').trim();
  if (name.length < 2) {
    throw new AppError('Cultural group name is required.', 400);
  }

  const existing = await prisma.culturalGroup.findUnique({ where: { name } });
  if (existing) {
    throw new AppError('A cultural group with that name already exists.', 409);
  }

  const group = await prisma.culturalGroup.create({ data: { name, isActive: true } });

  await logActivity({
    actorId: req.user.id,
    action: 'CREATE_CULTURAL_GROUP',
    entityType: 'CULTURAL_GROUP',
    entityId: group.id,
    details: `Created cultural group ${group.name}.`,
    req
  });

  return res.status(201).json({ success: true, message: 'Cultural group created.', data: group });
}

async function updateCulturalGroup(req, res) {
  const id = String(req.params.id);
  const name = String(req.body.name || '').trim();
  const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);

  if (name.length < 2) {
    throw new AppError('Cultural group name is required.', 400);
  }

  const group = await prisma.culturalGroup.update({
    where: { id },
    data: { name, isActive }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'UPDATE_CULTURAL_GROUP',
    entityType: 'CULTURAL_GROUP',
    entityId: group.id,
    details: `Updated cultural group to ${group.name}.`,
    req
  });

  return res.status(200).json({ success: true, message: 'Cultural group updated.', data: group });
}

async function archiveApplicant(req, res) {
  const parsed = applicantIdSchema.parse(req.params);

  const student = await prisma.studentProfile.findUnique({ where: { id: parsed.id } });
  if (!student) {
    throw new AppError('Applicant not found.', 404);
  }

  const updated = await prisma.studentProfile.update({
    where: { id: parsed.id },
    data: { archivedAt: student.archivedAt ? null : new Date() }
  });

  const user = await prisma.user.findUnique({ where: { id: updated.userId } });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: !updated.archivedAt }
    });
  }

  await logActivity({
    actorId: req.user.id,
    action: updated.archivedAt ? 'ARCHIVE_APPLICANT' : 'RESTORE_APPLICANT',
    entityType: 'STUDENT_PROFILE',
    entityId: updated.id,
    applicantId: updated.id,
    details: `${updated.archivedAt ? 'Archived' : 'Restored'} applicant ${updated.fullName}.`,
    req
  });

  return res.status(200).json({
    success: true,
    message: updated.archivedAt ? 'Applicant record archived.' : 'Applicant record restored.',
    data: { id: updated.id, archivedAt: updated.archivedAt }
  });
}

async function getEvents(req, res) {
  const events = await prisma.event.findMany({
    where: { isActive: true },
    orderBy: { startAt: 'asc' }
  });
  return res.status(200).json({ success: true, data: events });
}

async function createEvent(req, res) {
  const title = String(req.body.title || '').trim();
  const description = req.body.description ? String(req.body.description).trim() : null;
  const location = req.body.location ? String(req.body.location).trim() : null;
  const startAt = new Date(req.body.startAt);
  const endAt = req.body.endAt ? new Date(req.body.endAt) : null;

  if (title.length < 2) {
    throw new AppError('Event title is required.', 400);
  }
  if (Number.isNaN(startAt.getTime())) {
    throw new AppError('A valid start date and time is required.', 400);
  }
  if (endAt && Number.isNaN(endAt.getTime())) {
    throw new AppError('The end date and time is invalid.', 400);
  }
  if (endAt && endAt < startAt) {
    throw new AppError('The end date cannot be earlier than the start date.', 400);
  }

  const event = await prisma.event.create({
    data: {
      title,
      description,
      location,
      startAt,
      endAt,
      isActive: true,
      createdById: req.user.id
    }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'CREATE_EVENT',
    entityType: 'EVENT',
    entityId: event.id,
    details: `Created event “${title}”.`,
    req
  });

  return res.status(201).json({ success: true, message: 'Event created.', data: event });
}

async function updateEvent(req, res) {
  const id = String(req.params.id);
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Event not found.', 404);
  }

  const title = req.body.title === undefined ? existing.title : String(req.body.title).trim();
  const description = req.body.description === undefined
    ? existing.description
    : (req.body.description ? String(req.body.description).trim() : null);
  const location = req.body.location === undefined
    ? existing.location
    : (req.body.location ? String(req.body.location).trim() : null);
  const startAt = req.body.startAt === undefined ? existing.startAt : new Date(req.body.startAt);
  const endAt = req.body.endAt === undefined
    ? existing.endAt
    : (req.body.endAt ? new Date(req.body.endAt) : null);
  const isActive = req.body.isActive === undefined ? existing.isActive : Boolean(req.body.isActive);

  if (title.length < 2) {
    throw new AppError('Event title is required.', 400);
  }
  if (Number.isNaN(new Date(startAt).getTime())) {
    throw new AppError('A valid start date and time is required.', 400);
  }
  if (endAt && Number.isNaN(new Date(endAt).getTime())) {
    throw new AppError('The end date and time is invalid.', 400);
  }

  const event = await prisma.event.update({
    where: { id },
    data: { title, description, location, startAt, endAt, isActive }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'UPDATE_EVENT',
    entityType: 'EVENT',
    entityId: event.id,
    details: `Updated event “${title}”.`,
    req
  });

  return res.status(200).json({ success: true, message: 'Event updated.', data: event });
}

async function deleteEvent(req, res) {
  const id = String(req.params.id);
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Event not found.', 404);
  }

  const event = await prisma.event.update({
    where: { id },
    data: { isActive: false }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'DELETE_EVENT',
    entityType: 'EVENT',
    entityId: event.id,
    details: `Deactivated event “${event.title}”.`,
    req
  });

  return res.status(200).json({ success: true, message: 'Event removed from the calendar.', data: event });
}

async function getResources(req, res) {
  const resources = await prisma.resource.findMany({
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }]
  });
  return res.status(200).json({ success: true, data: resources });
}

async function createResource(req, res) {
  const key = String(req.body.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const title = String(req.body.title || '').trim();
  const kind = String(req.body.kind || 'FORM').toUpperCase();
  const allowedKinds = ['FORM', 'MANUAL', 'CERTIFICATE'];

  if (key.length < 2) {
    throw new AppError('A resource key is required.', 400);
  }
  if (title.length < 2) {
    throw new AppError('Resource title is required.', 400);
  }
  if (!allowedKinds.includes(kind)) {
    throw new AppError('Invalid resource kind.', 400);
  }

  const duplicate = await prisma.resource.findUnique({ where: { key } });
  if (duplicate) {
    throw new AppError('A resource with that key already exists.', 409);
  }

  const resource = await prisma.resource.create({
    data: {
      key,
      kind,
      title,
      description: req.body.description ? String(req.body.description).trim() : null,
      externalUrl: req.body.externalUrl ? String(req.body.externalUrl).trim() : null,
      fileKey: req.body.fileKey ? String(req.body.fileKey).trim() : null,
      fileName: req.body.fileName ? String(req.body.fileName).trim() : null,
      sortOrder: Number(req.body.sortOrder || 0),
      isActive: true
    }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'CREATE_RESOURCE',
    entityType: 'RESOURCE',
    entityId: resource.id,
    details: `Added resource “${title}”.`,
    req
  });

  return res.status(201).json({ success: true, message: 'Resource created.', data: resource });
}

async function updateResource(req, res) {
  const id = String(req.params.id);
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Resource not found.', 404);
  }

  const allowedKinds = ['FORM', 'MANUAL', 'CERTIFICATE'];
  const kind = req.body.kind === undefined
    ? existing.kind
    : String(req.body.kind).toUpperCase();

  if (!allowedKinds.includes(kind)) {
    throw new AppError('Invalid resource kind.', 400);
  }

  const title = req.body.title === undefined ? existing.title : String(req.body.title).trim();
  if (title.length < 2) {
    throw new AppError('Resource title is required.', 400);
  }

  const resource = await prisma.resource.update({
    where: { id },
    data: {
      kind,
      title,
      description: req.body.description === undefined
        ? existing.description
        : (req.body.description ? String(req.body.description).trim() : null),
      externalUrl: req.body.externalUrl === undefined
        ? existing.externalUrl
        : (req.body.externalUrl ? String(req.body.externalUrl).trim() : null),
      fileKey: req.body.fileKey === undefined
        ? existing.fileKey
        : (req.body.fileKey ? String(req.body.fileKey).trim() : null),
      fileName: req.body.fileName === undefined
        ? existing.fileName
        : (req.body.fileName ? String(req.body.fileName).trim() : null),
      sortOrder: req.body.sortOrder === undefined ? existing.sortOrder : Number(req.body.sortOrder),
      isActive: req.body.isActive === undefined ? existing.isActive : Boolean(req.body.isActive)
    }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'UPDATE_RESOURCE',
    entityType: 'RESOURCE',
    entityId: resource.id,
    details: `Updated resource “${title}”.`,
    req
  });

  return res.status(200).json({ success: true, message: 'Resource updated.', data: resource });
}

async function deleteResource(req, res) {
  const id = String(req.params.id);
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Resource not found.', 404);
  }

  const resource = await prisma.resource.update({
    where: { id },
    data: { isActive: false }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'DELETE_RESOURCE',
    entityType: 'RESOURCE',
    entityId: resource.id,
    details: `Deactivated resource “${resource.title}”.`,
    req
  });

  return res.status(200).json({ success: true, message: 'Resource removed.', data: resource });
}

module.exports = {
  getDashboard,
  getApplicants,
  getApplicantById,
  updateApplicantStatus,
  reviewDocument,
  getActivityLogs,
  getReports,
  getCulturalGroups,
  createCulturalGroup,
  updateCulturalGroup,
  archiveApplicant,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getResources,
  createResource,
  updateResource,
  deleteResource
};

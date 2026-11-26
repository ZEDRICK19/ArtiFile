const fs = require('fs');
const prisma = require('../config/prisma');
const { requirementKeySchema, documentIdSchema } = require('../validators/documents');
const { notifyAllAdmins } = require('../utils/notifications');
const { logActivity } = require('../utils/activity');
const { resolveStoredPath } = require('../utils/files');
const { AppError } = require('../middleware/error');

async function rulesFromBody(req) {
  const parsed = requirementKeySchema.safeParse(req.body);
  const key = parsed.success ? parsed.data.requirementKey : '__invalid__';
  const requirement = await prisma.requirement.findUnique({ where: { key } });
  if (!requirement || !requirement.isActive) {
    throw new AppError('That requirement is not available for upload.', 400);
  }
  return requirement;
}

async function rulesFromParams(req) {
  const parsed = documentIdSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError('Invalid document identifier.', 400);
  }
  const document = await prisma.document.findUnique({
    where: { id: parsed.data.id },
    include: { requirement: true, application: true }
  });
  if (!document) {
    throw new AppError('Document not found.', 404);
  }
  return document.requirement;
}

async function getOwnApplication(userId) {
  const application = await prisma.application.findUnique({
    where: { userId },
    include: { documents: { include: { requirement: true } } }
  });
  if (!application) {
    throw new AppError('Application record not found.', 404);
  }
  return application;
}

async function ingest(req, res, options) {
  let requirementKey;
  let documentId = null;

  if (options.mode === 'replace') {
    const parsed = documentIdSchema.parse(req.params);
    documentId = parsed.id;
    const existing = await prisma.document.findUnique({
      where: { id: documentId },
      include: { application: true, requirement: true }
    });
    if (!existing) {
      throw new AppError('Document not found.', 404);
    }
    if (existing.application.userId !== req.user.id) {
      throw new AppError('You can only replace your own documents.', 403);
    }
    requirementKey = existing.requirement.key;
  } else {
    const parsed = requirementKeySchema.parse(req.body);
    requirementKey = parsed.requirementKey;
  }

  const requirement = await prisma.requirement.findUnique({ where: { key: requirementKey } });
  if (!requirement || !requirement.isActive) {
    throw new AppError('That requirement is not available.', 400);
  }

  if (options.expectedCategory && requirement.category !== options.expectedCategory) {
    throw new AppError('This requirement does not belong to that category.', 403);
  }

  const application = await getOwnApplication(req.user.id);

  if (requirement.category === 'POST_AUDITION' && application.status !== 'ACCEPTED') {
    throw new AppError(
      'Post-audition requirements are locked. Your application status must be ACCEPTED before you can submit a Performer’s Profile.',
      403
    );
  }

  if (!req.file) {
    throw new AppError('No file was selected. Please choose a document.', 400);
  }

  let nextVersion = 1;
  let isReplace = false;

  const savedDocument = await prisma.$transaction(async (tx) => {
    let document = documentId
      ? await tx.document.findUnique({ where: { id: documentId } })
      : await tx.document.findUnique({
          where: {
            applicationId_requirementId: {
              applicationId: application.id,
              requirementId: requirement.id
            }
          }
        });

    if (!document) {
      document = await tx.document.create({
        data: {
          applicationId: application.id,
          requirementId: requirement.id,
          status: 'SUBMITTED'
        }
      });
    }

    const lastVersion = await tx.documentSubmissionHistory.aggregate({
      where: { documentId: document.id },
      _max: { version: true }
    });
    nextVersion = (lastVersion._max.version || 0) + 1;
    isReplace = nextVersion > 1;

    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        status: 'SUBMITTED',
        feedback: null,
        reviewedById: null,
        reviewedAt: null,
        currentFileKey: req.file.filename,
        currentFileName: req.file.originalname,
        currentMimeType: req.file.mimetype,
        currentFileSize: req.file.size,
        submittedAt: new Date()
      }
    });

    await tx.documentSubmissionHistory.create({
      data: {
        documentId: updated.id,
        version: nextVersion,
        action: isReplace ? 'REPLACE' : 'UPLOAD',
        fileKey: req.file.filename,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedById: req.user.id
      }
    });

    return updated;
  });

  await notifyAllAdmins({
    title: isReplace ? 'Student replaced a document' : 'Student submitted a requirement',
    message: `A student ${isReplace ? 'replaced' : 'uploaded'} “${requirement.title}”.`,
    type: isReplace ? 'DOCUMENT_REPLACED' : 'DOCUMENT_SUBMITTED',
    link: '/admin/documents'
  });

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: req.user.id },
    select: { id: true }
  });

  await logActivity({
    actorId: req.user.id,
    action: isReplace ? 'REPLACE_DOCUMENT' : 'UPLOAD_DOCUMENT',
    entityType: 'DOCUMENT',
    entityId: savedDocument.id,
    applicantId: studentProfile ? studentProfile.id : null,
    documentId: savedDocument.id,
    details: `${requirement.title} ${isReplace ? 'replaced' : 'uploaded'} (version ${nextVersion}).`,
    req
  });

  return res.status(isReplace ? 200 : 201).json({
    success: true,
    message: isReplace
      ? 'Document replaced successfully. The previous version is kept in the submission history.'
      : 'Document uploaded successfully.',
    data: {
      id: savedDocument.id,
      requirementKey: requirement.key,
      status: savedDocument.status,
      fileName: savedDocument.currentFileName,
      submittedAt: savedDocument.submittedAt,
      version: nextVersion
    }
  });
}

async function uploadPre(req, res) {
  return ingest(req, res, { expectedCategory: 'PRE_AUDITION' });
}

async function uploadPost(req, res) {
  return ingest(req, res, { expectedCategory: 'POST_AUDITION' });
}

async function replace(req, res) {
  return ingest(req, res, { mode: 'replace' });
}

async function myDocuments(req, res) {
  const application = await prisma.application.findUnique({
    where: { userId: req.user.id },
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
  });

  if (!application) {
    throw new AppError('Application record not found.', 404);
  }

  return res.status(200).json({ success: true, data: application.documents });
}

async function findAccessibleDocument(req) {
  const parsed = documentIdSchema.parse(req.params);
  const document = await prisma.document.findUnique({
    where: { id: parsed.id },
    include: {
      requirement: true,
      application: {
        include: { user: { select: { id: true, email: true } } }
      },
      reviewedBy: { select: { id: true, email: true } },
      history: { orderBy: { version: 'asc' } }
    }
  });

  if (!document || !document.currentFileKey) {
    throw new AppError('Document not found or no file has been uploaded yet.', 404);
  }

  const isAdmin = req.user.role === 'ADMIN';
  const isOwner = document.application.userId === req.user.id;

  if (!isAdmin && !isOwner) {
    throw new AppError('You are not authorized to access this document.', 403);
  }

  if (!isAdmin && document.requirement.category === 'POST_AUDITION' && document.application.status !== 'ACCEPTED') {
    throw new AppError('Post-audition requirements are locked for your account.', 403);
  }

  return document;
}

async function getDocument(req, res) {
  const document = await findAccessibleDocument(req);
  return res.status(200).json({ success: true, data: document });
}

async function downloadDocument(req, res) {
  const document = await findAccessibleDocument(req);
  const filePath = resolveStoredPath(document.currentFileKey);

  if (!fs.existsSync(filePath)) {
    throw new AppError('The stored file is missing. Please contact the OCA office.', 404);
  }

  const asAttachment = String(req.query.download || '') === '1';

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: document.application.userId },
    select: { id: true }
  });

  await logActivity({
    actorId: req.user.id,
    action: 'DOWNLOAD_DOCUMENT',
    entityType: 'DOCUMENT',
    entityId: document.id,
    applicantId: studentProfile ? studentProfile.id : null,
    documentId: document.id,
    details: `${document.currentFileName} ${asAttachment ? 'downloaded' : 'previewed'}.`,
    req
  });

  res.setHeader('Content-Type', document.currentMimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${asAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(document.currentFileName || 'document')}`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');

  return fs.createReadStream(filePath).pipe(res);
}

async function adminListDocuments(req, res) {
  const documents = await prisma.document.findMany({
    include: {
      requirement: true,
      application: {
        include: {
          user: { select: { id: true, email: true } }
        }
      },
      reviewedBy: { select: { id: true, email: true } },
      history: { orderBy: { version: 'asc' } }
    },
    orderBy: { updatedAt: 'desc' }
  });
  return res.status(200).json({ success: true, data: documents });
}

module.exports = {
  rulesFromBody,
  rulesFromParams,
  uploadPre,
  uploadPost,
  replace,
  myDocuments,
  getDocument,
  downloadDocument,
  adminListDocuments
};

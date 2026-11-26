const prisma = require('../config/prisma');

function ipFromRequest(req) {
  if (!req) return null;
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

async function logActivity({
  actorId,
  action,
  entityType,
  entityId = null,
  applicantId = null,
  documentId = null,
  details = null,
  req = null
}) {
  return prisma.activityLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
      applicantId,
      documentId,
      details,
      ipAddress: ipFromRequest(req)
    }
  });
}

module.exports = { logActivity };

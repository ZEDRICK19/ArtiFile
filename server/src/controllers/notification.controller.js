const prisma = require('../config/prisma');
const { AppError } = require('../middleware/error');

async function list(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const onlyUnread = String(req.query.unread || '') === 'true';

  const where = { userId: req.user.id };
  if (onlyUnread) where.isRead = false;

  const [items, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    prisma.notification.count({ where })
  ]);

  return res.status(200).json({
    success: true,
    data: items,
    unreadCount,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

async function markRead(req, res) {
  const id = String(req.params.id);

  const notification = await prisma.notification.findFirst({
    where: { id, userId: req.user.id }
  });

  if (!notification) {
    throw new AppError('Notification not found.', 404);
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });

  return res.status(200).json({ success: true, message: 'Notification marked as read.', data: updated });
}

async function markAllRead(req, res) {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true }
  });

  return res.status(200).json({
    success: true,
    message: `${result.count} notification(s) marked as read.`,
    data: { updatedCount: result.count }
  });
}

module.exports = { list, markRead, markAllRead };

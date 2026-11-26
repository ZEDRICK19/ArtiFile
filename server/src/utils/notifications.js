const prisma = require('../config/prisma');

async function notify(userId, { title, message, type = 'SYSTEM', link = null }) {
  return prisma.notification.create({
    data: { userId, title, message, type, link }
  });
}

async function notifyAllAdmins({ title, message, type = 'SYSTEM', link = null }) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true }
  });

  if (admins.length === 0) return [];

  return prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title,
      message,
      type,
      link
    }))
  });
}

module.exports = { notify, notifyAllAdmins };

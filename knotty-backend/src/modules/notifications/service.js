const prisma = require('../../config/database');
const { sendSMS } = require('../../integrations/africas-talking');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function getForUser(userId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where: { user_id: userId },
      skip,
      take,
      orderBy: { created_at: 'desc' },
    }),
    prisma.notification.count({ where: { user_id: userId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function markRead(id, userId) {
  return prisma.notification.updateMany({ where: { id, user_id: userId }, data: { is_read: true } });
}

async function broadcast({ school_id, title, message, channel, target_roles }) {
  const users = await prisma.user.findMany({
    where: { school_id, is_active: true, ...(target_roles && { role: { in: target_roles } }) },
    select: { id: true, phone: true },
  });

  const notifications = await prisma.notification.createMany({
    data: users.map((u) => ({
      user_id: u.id,
      school_id,
      type: 'GENERAL',
      title,
      message,
      channel: channel || 'IN_APP',
    })),
  });

  if (channel === 'SMS') {
    const phones = users.map((u) => u.phone).filter(Boolean);
    if (phones.length) sendSMS(phones, `${title}: ${message}`).catch(console.error);
  }

  return { sent: notifications.count };
}

module.exports = { getForUser, markRead, broadcast };

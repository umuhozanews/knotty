const prisma = require('../config/database');

async function logAction({ school_id, actor_user_id, action, entity_type, entity_id, before_state = null, after_state = null }) {
  try {
    return await prisma.auditLog.create({
      data: {
        school_id,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_state,
        after_state,
      },
    });
  } catch (error) {
    console.error('[AUDIT_LOG_ERROR] Failed to record audit log:', error);
  }
}

module.exports = { logAction };

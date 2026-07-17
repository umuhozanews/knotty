const crypto = require('crypto');
const prisma = require('../config/database');

function _checksum({ school_id, actor_user_id, action, entity_type, entity_id, before_state, after_state, created_at, prev_checksum }) {
  const payload = JSON.stringify({ school_id, actor_user_id, action, entity_type, entity_id, before_state, after_state, created_at, prev_checksum });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function logAction({ school_id, actor_user_id, action, entity_type, entity_id, before_state = null, after_state = null }) {
  try {
    const created_at = new Date();

    // Get the checksum of the most recent entry for this school (hash chain)
    const prev = await prisma.auditLog.findFirst({
      where: { school_id },
      orderBy: { created_at: 'desc' },
      select: { checksum: true },
    });
    const prev_checksum = prev?.checksum ?? null;

    const checksum = _checksum({ school_id, actor_user_id, action, entity_type, entity_id, before_state, after_state, created_at, prev_checksum });

    return await prisma.auditLog.create({
      data: { school_id, actor_user_id, action, entity_type, entity_id, before_state, after_state, created_at, checksum, prev_checksum },
    });
  } catch (err) {
    // Always surface audit failures — callers may still fire-and-forget safely
    process.stderr.write(`[AUDIT_FAIL] ${action} on ${entity_type}:${entity_id} — ${err.message}\n`);
    throw err;
  }
}

// Verify the hash chain for a school — returns { valid, broken_at }
async function verifyChain(school_id) {
  const logs = await prisma.auditLog.findMany({
    where: { school_id },
    orderBy: { created_at: 'asc' },
  });

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const expected = _checksum({
      school_id: log.school_id,
      actor_user_id: log.actor_user_id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      before_state: log.before_state,
      after_state: log.after_state,
      created_at: log.created_at,
      prev_checksum: log.prev_checksum,
    });
    if (expected !== log.checksum) {
      return { valid: false, broken_at: log.id };
    }
  }
  return { valid: true, broken_at: null };
}

module.exports = { logAction, verifyChain };

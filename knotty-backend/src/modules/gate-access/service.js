const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const attendanceSvc = require('../attendance/service');

// ─── Campuses ───
async function listCampuses(schoolId) {
  return prisma.campus.findMany({
    where: { school_id: schoolId },
    orderBy: { name: 'asc' },
  });
}

async function createCampus(schoolId, data) {
  const { name, address, timezone_override } = data;
  return prisma.campus.create({
    data: {
      school_id: schoolId,
      name,
      address,
      timezone_override,
    },
  });
}

// ─── Gate Devices ───
async function listGateDevices(schoolId, { campusId } = {}) {
  return prisma.gateDevice.findMany({
    where: {
      school_id: schoolId,
      ...(campusId && { campus_id: campusId }),
    },
    include: {
      campus: { select: { name: true } },
      restricted_zone: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });
}

async function createGateDevice(schoolId, data) {
  const { campus_id, name, location_type, zone_id } = data;

  // Verify campus
  const campus = await prisma.campus.findFirst({ where: { id: campus_id, school_id: schoolId } });
  if (!campus) throw Object.assign(new Error('Campus not found'), { status: 404 });

  if (zone_id) {
    const zone = await prisma.restrictedZone.findFirst({ where: { id: zone_id, school_id: schoolId } });
    if (!zone) throw Object.assign(new Error('Restricted zone not found'), { status: 404 });
  }

  return prisma.gateDevice.create({
    data: {
      school_id: schoolId,
      campus_id,
      name,
      location_type,
      zone_id,
    },
  });
}

async function updateGateDevice(id, schoolId, data) {
  const { name, location_type, zone_id } = data;
  const device = await prisma.gateDevice.findFirst({ where: { id, school_id: schoolId } });
  if (!device) throw Object.assign(new Error('Gate device not found'), { status: 404 });

  if (zone_id) {
    const zone = await prisma.restrictedZone.findFirst({ where: { id: zone_id, school_id: schoolId } });
    if (!zone) throw Object.assign(new Error('Restricted zone not found'), { status: 404 });
  }

  return prisma.gateDevice.update({
    where: { id },
    data: { name, location_type, zone_id },
  });
}

async function deleteGateDevice(id, schoolId) {
  const device = await prisma.gateDevice.findFirst({ where: { id, school_id: schoolId } });
  if (!device) throw Object.assign(new Error('Gate device not found'), { status: 404 });

  return prisma.gateDevice.delete({ where: { id } });
}

// ─── Restricted Zones ───
async function listRestrictedZones(schoolId) {
  return prisma.restrictedZone.findMany({
    where: { school_id: schoolId },
    include: {
      campus: { select: { name: true } },
      access_grants: true,
    },
    orderBy: { name: 'asc' },
  });
}

async function createRestrictedZone(schoolId, data) {
  const { campus_id, name, description } = data;

  const campus = await prisma.campus.findFirst({ where: { id: campus_id, school_id: schoolId } });
  if (!campus) throw Object.assign(new Error('Campus not found'), { status: 404 });

  return prisma.restrictedZone.create({
    data: {
      school_id: schoolId,
      campus_id,
      name,
      description,
    },
  });
}

async function updateRestrictedZone(id, schoolId, data) {
  const { name, description } = data;
  const zone = await prisma.restrictedZone.findFirst({ where: { id, school_id: schoolId } });
  if (!zone) throw Object.assign(new Error('Restricted zone not found'), { status: 404 });

  return prisma.restrictedZone.update({
    where: { id },
    data: { name, description },
  });
}

async function deleteRestrictedZone(id, schoolId) {
  const zone = await prisma.restrictedZone.findFirst({ where: { id, school_id: schoolId } });
  if (!zone) throw Object.assign(new Error('Restricted zone not found'), { status: 404 });

  return prisma.restrictedZone.delete({ where: { id } });
}

// ─── Access Grants ───
async function createZoneAccessGrant(schoolId, zoneId, data) {
  const { grantee_type, grantee_id, valid_from, valid_to } = data;

  const zone = await prisma.restrictedZone.findFirst({ where: { id: zoneId, school_id: schoolId } });
  if (!zone) throw Object.assign(new Error('Restricted zone not found'), { status: 404 });

  return prisma.zoneAccessGrant.create({
    data: {
      zone_id: zoneId,
      grantee_type,
      grantee_id,
      valid_from: new Date(valid_from),
      valid_to: valid_to ? new Date(valid_to) : null,
    },
  });
}

async function deleteZoneAccessGrant(id, schoolId) {
  const grant = await prisma.zoneAccessGrant.findFirst({
    where: {
      id,
      zone: { school_id: schoolId },
    },
  });
  if (!grant) throw Object.assign(new Error('Access grant not found'), { status: 404 });

  return prisma.zoneAccessGrant.delete({ where: { id } });
}

// ─── Access Decisions (Core Loop) ───
async function evaluateAccess(schoolId, data, operatorUserId) {
  const { deviceId, cardNumber, secureToken, nfcUid, direction = 'ENTRY' } = data;

  // Find gate device
  const device = await prisma.gateDevice.findFirst({
    where: { id: deviceId, school_id: schoolId },
  });
  if (!device) throw Object.assign(new Error('Gate device not recognized'), { status: 404 });

  let card = null;

  // Resolve card
  if (cardNumber) {
    card = await prisma.knottyCard.findFirst({
      where: { card_number: cardNumber, school_id: schoolId },
      include: {
        student: { include: { user: true } },
      },
    });
  } else if (nfcUid) {
    card = await prisma.knottyCard.findFirst({
      where: { nfc_uid: nfcUid, school_id: schoolId },
      include: {
        student: { include: { user: true } },
      },
    });
  } else if (secureToken) {
    // Decode secure token
    let resolvedCardNumber = null;
    if (secureToken.startsWith('KS:')) {
      const parts = secureToken.split(':');
      if (parts.length === 4) {
        const [, cNum, expiryStr, signature] = parts;
        const expiry = parseInt(expiryStr, 10);
        if (expiry > Date.now()) {
          const message = `${cNum}:${expiryStr}`;
          const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET)
            .update(message)
            .digest('base64url');
          if (signature === expectedSig) {
            resolvedCardNumber = cNum;
          }
        }
      }
    } else {
      try {
        const payload = jwt.verify(secureToken, process.env.JWT_SECRET);
        resolvedCardNumber = payload.card_number;
      } catch (e) {
        // invalid
      }
    }

    if (resolvedCardNumber) {
      card = await prisma.knottyCard.findFirst({
        where: { card_number: resolvedCardNumber, school_id: schoolId },
        include: {
          student: { include: { user: true } },
        },
      });
    }
  }

  const occurredAt = new Date();

  // Log denied if no card resolved
  if (!card) {
    const log = await prisma.accessLog.create({
      data: {
        school_id: schoolId,
        device_id: deviceId,
        direction,
        decision: 'DENIED',
        denial_reason: 'CARD_NOT_FOUND',
        occurred_at: occurredAt,
      },
    });
    return { decision: 'DENIED', reason: 'CARD_NOT_FOUND', log };
  }

  // Check card status
  if (!card.is_active) {
    const log = await prisma.accessLog.create({
      data: {
        school_id: schoolId,
        card_id: card.id,
        device_id: deviceId,
        direction,
        decision: 'DENIED',
        denial_reason: 'CARD_INACTIVE',
        occurred_at: occurredAt,
      },
    });
    return { decision: 'DENIED', reason: 'CARD_INACTIVE', ownerName: card.student ? `${card.student.user.first_name} ${card.student.user.last_name}` : 'Staff', log };
  }

  if (card.is_frozen) {
    const log = await prisma.accessLog.create({
      data: {
        school_id: schoolId,
        card_id: card.id,
        device_id: deviceId,
        direction,
        decision: 'DENIED',
        denial_reason: 'CARD_FROZEN',
        occurred_at: occurredAt,
      },
    });
    return { decision: 'DENIED', reason: 'CARD_FROZEN', ownerName: `${card.student.user.first_name} ${card.student.user.last_name}`, log };
  }

  // Find owner details
  const student = card.student;
  const user = student.user;

  // Check restricted zone grants if zone_id exists
  if (device.zone_id) {
    const now = new Date();
    const grants = await prisma.zoneAccessGrant.findMany({
      where: {
        zone_id: device.zone_id,
        valid_from: { lte: now },
        OR: [
          { valid_to: null },
          { valid_to: { gte: now } },
        ],
      },
    });

    const userRoleId = user.role; // e.g. "STUDENT", "TEACHER"
    const userId = user.id;

    const hasAccess = grants.some(grant => {
      if (grant.grantee_type === 'ROLE' && grant.grantee_id === userRoleId) return true;
      if (grant.grantee_type === 'USER' && grant.grantee_id === userId) return true;
      return false;
    });

    if (!hasAccess) {
      const log = await prisma.accessLog.create({
        data: {
          school_id: schoolId,
          card_id: card.id,
          device_id: deviceId,
          direction,
          decision: 'DENIED',
          denial_reason: 'RESTRICTED_ZONE_DENIED',
          occurred_at: occurredAt,
        },
      });
      return { decision: 'DENIED', reason: 'RESTRICTED_ZONE_DENIED', ownerName: `${user.first_name} ${user.last_name}`, log };
    }
  }

  // Create access log (GRANTED)
  const log = await prisma.accessLog.create({
    data: {
      school_id: schoolId,
      card_id: card.id,
      device_id: deviceId,
      direction,
      decision: 'GRANTED',
      occurred_at: occurredAt,
    },
  });

  // Auto-mark attendance when a student enters or exits through a gate
  if (operatorUserId && student) {
    (async () => {
      try {
        const now = new Date();
        const kigaliDateStr = now.toLocaleDateString('en-ZA', { timeZone: 'Africa/Kigali' });
        const today = new Date(kigaliDateStr.replace(/\//g, '-'));
        today.setUTCHours(0, 0, 0, 0);

        const existingAtt = await prisma.attendance.findUnique({
          where: { student_id_date: { student_id: student.id, date: today } },
        });

        if (direction === 'ENTRY' && !existingAtt) {
          await attendanceSvc.scanAttendance(card.card_number, operatorUserId, { type: 'IN' });
        } else if (direction === 'EXIT' && existingAtt?.check_in_time && !existingAtt.check_out_time) {
          await attendanceSvc.scanAttendance(card.card_number, operatorUserId, { type: 'OUT' });
        }
      } catch (e) {
        console.error('[gate-access] attendance sync error:', e.message);
      }
    })();
  }

  return {
    decision: 'GRANTED',
    ownerName: `${user.first_name} ${user.last_name}`,
    photoUrl: user.profile_photo,
    studentCode: student.student_code,
    log,
  };
}

async function manualAccessOverride(schoolId, { logId, overriddenByUserId }) {
  const log = await prisma.accessLog.findFirst({
    where: { id: logId, school_id: schoolId },
  });
  if (!log) throw Object.assign(new Error('Access log not found'), { status: 404 });

  return prisma.accessLog.update({
    where: { id: logId },
    data: {
      decision: 'GRANTED',
      overridden_by_user_id: overriddenByUserId,
    },
  });
}

// ─── Visitor Logs ───
async function createVisitorLog(schoolId, campusId, data) {
  const { visitor_name, id_document_ref, photo_url, host_user_id, purpose, expected_checkout_at } = data;

  const campus = await prisma.campus.findFirst({ where: { id: campusId, school_id: schoolId } });
  if (!campus) throw Object.assign(new Error('Campus not found'), { status: 404 });

  const host = await prisma.user.findFirst({ where: { id: host_user_id, school_id: schoolId } });
  if (!host) throw Object.assign(new Error('Host user not found'), { status: 404 });

  const badgeQrToken = `VISITOR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  return prisma.visitorLog.create({
    data: {
      school_id: schoolId,
      campus_id: campusId,
      visitor_name,
      id_document_ref,
      photo_url,
      host_user_id,
      purpose,
      badge_qr_token: badgeQrToken,
      expected_checkout_at: expected_checkout_at ? new Date(expected_checkout_at) : null,
      checked_in_at: new Date(),
    },
    include: {
      host: { select: { first_name: true, last_name: true } },
    },
  });
}

async function checkoutVisitorLog(id, schoolId) {
  const log = await prisma.visitorLog.findFirst({
    where: { id, school_id: schoolId, checked_out_at: null },
  });
  if (!log) throw Object.assign(new Error('Active visitor session not found'), { status: 404 });

  return prisma.visitorLog.update({
    where: { id },
    data: { checked_out_at: new Date() },
  });
}

async function listVisitorLogs(schoolId, { campusId, page = 1, limit = 20 } = {}) {
  const { skip, take } = paginate(null, page, limit);

  const where = {
    school_id: schoolId,
    ...(campusId && { campus_id: campusId }),
  };

  const [data, total] = await Promise.all([
    prisma.visitorLog.findMany({
      where,
      skip,
      take,
      orderBy: { checked_in_at: 'desc' },
      include: {
        host: { select: { first_name: true, last_name: true } },
        campus: { select: { name: true } },
      },
    }),
    prisma.visitorLog.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

// ─── Access Logs ───
async function listAccessLogs(schoolId, { page = 1, limit = 30, decision, direction, deviceId } = {}) {
  const { skip, take } = paginate(null, page, limit);

  const where = {
    school_id: schoolId,
    ...(decision && { decision }),
    ...(direction && { direction }),
    ...(deviceId && { device_id: deviceId }),
  };

  const [data, total] = await Promise.all([
    prisma.accessLog.findMany({
      where,
      skip,
      take,
      orderBy: { occurred_at: 'desc' },
      include: {
        device: { select: { name: true, location_type: true } },
        card: {
          include: {
            student: {
              include: { user: { select: { first_name: true, last_name: true, profile_photo: true } } },
            },
          },
        },
        overrider: { select: { first_name: true, last_name: true } },
      },
    }),
    prisma.accessLog.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

module.exports = {
  listCampuses,
  createCampus,
  listGateDevices,
  createGateDevice,
  updateGateDevice,
  deleteGateDevice,
  listRestrictedZones,
  createRestrictedZone,
  updateRestrictedZone,
  deleteRestrictedZone,
  createZoneAccessGrant,
  deleteZoneAccessGrant,
  evaluateAccess,
  manualAccessOverride,
  createVisitorLog,
  checkoutVisitorLog,
  listVisitorLogs,
  listAccessLogs,
};

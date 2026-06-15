const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');
const { sendSMS } = require('../../integrations/africas-talking');

// ─── Existing Health Incident Records (Legacy/Direct Incident Logs) ───
async function create(data, recordedBy, schoolId) {
  return prisma.healthRecord.create({
    data: { ...data, recorded_by: recordedBy, school_id: schoolId },
  });
}

async function list(studentId, { page, limit }) {
  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.healthRecord.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { recorded_at: 'desc' },
      include: { recorder: { select: { first_name: true, last_name: true, role: true } } },
    }),
    prisma.healthRecord.count({ where: { student_id: studentId } }),
  ]);
  return paginatedResponse(data, total, page, limit);
}

async function listSchool(schoolId, { page, limit } = {}) {
  const { skip, take } = paginate(null, page || 1, limit || 30);
  const [data, total] = await Promise.all([
    prisma.healthRecord.findMany({
      where: { school_id: schoolId },
      skip,
      take,
      orderBy: { recorded_at: 'desc' },
      include: {
        recorder: { select: { first_name: true, last_name: true } },
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
    }),
    prisma.healthRecord.count({ where: { school_id: schoolId } }),
  ]);
  return paginatedResponse(data, total, page || 1, limit || 30);
}

async function update(id, schoolId, data) {
  return prisma.healthRecord.updateMany({ where: { id, school_id: schoolId }, data });
}

async function remove(id, schoolId) {
  return prisma.healthRecord.deleteMany({ where: { id, school_id: schoolId } });
}

// ─── New Advanced Medical Profiles ───
async function getMedicalProfile(studentId, schoolId) {
  let profile = await prisma.medicalProfile.findFirst({
    where: { student_id: studentId, school_id: schoolId },
  });

  // If no profile exists, return a blank template instead of 404, facilitating lazy creation
  if (!profile) {
    profile = {
      student_id: studentId,
      school_id: schoolId,
      blood_type: null,
      allergies: [],
      chronic_conditions: [],
      emergency_contact_phone: '',
    };
  }
  return profile;
}

async function upsertMedicalProfile(studentId, schoolId, data) {
  const { blood_type, allergies, chronic_conditions, emergency_contact_phone } = data;

  const existing = await prisma.medicalProfile.findFirst({
    where: { student_id: studentId, school_id: schoolId },
  });

  if (existing) {
    return prisma.medicalProfile.update({
      where: { id: existing.id },
      data: {
        blood_type,
        allergies,
        chronic_conditions,
        emergency_contact_phone,
      },
    });
  } else {
    return prisma.medicalProfile.create({
      data: {
        school_id: schoolId,
        student_id: studentId,
        blood_type,
        allergies,
        chronic_conditions,
        emergency_contact_phone,
      },
    });
  }
}

// ─── New Immunization Records ───
async function addImmunizationRecord(studentId, data) {
  const { vaccine_name, date_administered } = data;
  return prisma.immunizationRecord.create({
    data: {
      student_id: studentId,
      vaccine_name,
      date_administered: new Date(date_administered),
    },
  });
}

async function listImmunizations(studentId) {
  return prisma.immunizationRecord.findMany({
    where: { student_id: studentId },
    orderBy: { date_administered: 'desc' },
  });
}

async function removeImmunizationRecord(id) {
  return prisma.immunizationRecord.delete({ where: { id } });
}

// ─── New Clinic Visits & Medication Administrations ───
async function createClinicVisit(studentId, schoolId, data, recorderId) {
  const { presenting_complaint, treatment_notes, follow_up_required = false, medications = [] } = data;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { first_name: true, last_name: true } },
        parent: { select: { id: true, phone: true } },
      },
    });

    const visit = await tx.clinicVisit.create({
      data: {
        school_id: schoolId,
        student_id: studentId,
        presenting_complaint,
        treatment_notes,
        recorded_by_staff_id: recorderId,
        follow_up_required,
      },
    });

    if (medications.length > 0) {
      const medsData = medications.map(med => ({
        school_id: schoolId,
        student_id: studentId,
        clinic_visit_id: visit.id,
        medication_name: med.medication_name,
        dosage: med.dosage,
        administered_by_staff_id: recorderId,
      }));
      await tx.medicationAdministration.createMany({ data: medsData });
    }

    if (student && student.parent) {
      const parentUser = student.parent;
      const studentName = `${student.user.first_name} ${student.user.last_name}`;
      const msg = `KNOTTY Health Alert: ${studentName} visited the school clinic today. Complaint: ${presenting_complaint}. Treatment: ${treatment_notes || 'Observed'}.`;

      // Create in-app notification
      await tx.notification.create({
        data: {
          user_id: parentUser.id,
          school_id: schoolId,
          type: 'HEALTH',
          title: 'Clinic Visit Logged',
          message: msg,
          channel: 'IN_APP',
        },
      });

      if (parentUser.phone) {
        sendSMS(parentUser.phone, msg).catch(console.error);

        await tx.notificationLog.create({
          data: {
            school_id: schoolId,
            recipient_user_id: parentUser.id,
            channel: 'SMS',
            status: 'SENT',
          },
        });
      }
    }

    return tx.clinicVisit.findUnique({
      where: { id: visit.id },
      include: { medications: true },
    });
  });
}

async function listClinicVisits(studentId, schoolId, { page = 1, limit = 20 } = {}) {
  const { skip, take } = paginate(null, page, limit);

  const where = {
    school_id: schoolId,
    ...(studentId && { student_id: studentId }),
  };

  const [data, total] = await Promise.all([
    prisma.clinicVisit.findMany({
      where,
      skip,
      take,
      orderBy: { visit_datetime: 'desc' },
      include: {
        recorder: { select: { first_name: true, last_name: true } },
        medications: true,
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
    }),
    prisma.clinicVisit.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

module.exports = {
  create,
  list,
  listSchool,
  update,
  remove,
  getMedicalProfile,
  upsertMedicalProfile,
  addImmunizationRecord,
  listImmunizations,
  removeImmunizationRecord,
  createClinicVisit,
  listClinicVisits,
};

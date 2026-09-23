const { PassThrough } = require('stream');
const prisma = require('../../config/database');
const cloudinary = require('../../config/cloudinary');

async function _uploadJson(data, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder: 'ishurihub-backups', public_id: publicId, overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    const pass = new PassThrough();
    pass.end(Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
    pass.pipe(stream);
  });
}

async function runBackup(schoolId) {
  const [
    students,
    healthRecords,
    medicalProfiles,
    clinicVisits,
    feePayments,
    walletTransactions,
    auditLogs,
    attendance,
    disciplineRecords,
  ] = await Promise.all([
    prisma.student.findMany({ where: { school_id: schoolId }, include: { user: { select: { first_name: true, last_name: true, email: true, role: true, phone: true } } } }),
    prisma.healthRecord.findMany({ where: { school_id: schoolId } }),
    prisma.medicalProfile.findMany({ where: { school_id: schoolId } }),
    prisma.clinicVisit.findMany({ where: { school_id: schoolId }, include: { medications: true } }),
    prisma.feePayment.findMany({ where: { school_id: schoolId } }),
    prisma.walletTransaction.findMany({ where: { school_id: schoolId } }),
    prisma.auditLog.findMany({ where: { school_id: schoolId }, orderBy: { created_at: 'asc' } }),
    prisma.attendanceRecord.findMany({ where: { school_id: schoolId } }),
    prisma.disciplineRecord.findMany({ where: { school_id: schoolId } }),
  ]);

  const payload = {
    version: '1.0',
    created_at: new Date().toISOString(),
    school_id: schoolId,
    note: 'Medical fields are AES-256-GCM encrypted. Restoration requires ENCRYPTION_KEY.',
    encrypted_fields: [
      'HealthRecord.description', 'HealthRecord.treatment_given',
      'MedicalProfile.blood_type', 'MedicalProfile.allergies',
      'MedicalProfile.chronic_conditions', 'MedicalProfile.emergency_contact_phone',
      'ClinicVisit.presenting_complaint', 'ClinicVisit.treatment_notes',
      'MedicationAdministration.medication_name', 'MedicationAdministration.dosage',
      'ImmunizationRecord.vaccine_name',
    ],
    counts: {
      students: students.length,
      health_records: healthRecords.length,
      medical_profiles: medicalProfiles.length,
      clinic_visits: clinicVisits.length,
      fee_payments: feePayments.length,
      wallet_transactions: walletTransactions.length,
      audit_logs: auditLogs.length,
      attendance: attendance.length,
      discipline_records: disciplineRecords.length,
    },
    tables: {
      students,
      health_records: healthRecords,
      medical_profiles: medicalProfiles,
      clinic_visits: clinicVisits,
      fee_payments: feePayments,
      wallet_transactions: walletTransactions,
      audit_logs: auditLogs,
      attendance,
      discipline_records: disciplineRecords,
    },
  };

  const date = new Date().toISOString().split('T')[0];
  const publicId = `${schoolId}_${date}`;
  const result = await _uploadJson(payload, publicId);

  return {
    school_id: schoolId,
    url: result.secure_url,
    size_bytes: result.bytes,
    records: payload.counts,
    created_at: payload.created_at,
  };
}

async function runBackupAllSchools() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  const results = [];
  for (const school of schools) {
    try {
      const result = await runBackup(school.id);
      results.push({ ...result, school_name: school.name, status: 'ok' });
    } catch (err) {
      results.push({ school_id: school.id, school_name: school.name, status: 'error', error: err.message });
    }
  }
  return results;
}

module.exports = { runBackup, runBackupAllSchools };

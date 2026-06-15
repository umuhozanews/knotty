const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { generateStudentCode } = require('../../utils/cardNumberGenerator');
const { paginate, paginatedResponse } = require('../../utils/helpers');
const fs = require('fs');
const path = require('path');

async function handleProfilePhotoUpload(base64Data, schoolId, userId) {
  if (!base64Data) return null;
  if (!base64Data.startsWith('data:image')) {
    if (base64Data.startsWith('http') || base64Data.startsWith('/uploads')) {
      return base64Data;
    }
    return null;
  }

  const CLOUDINARY_CONFIGURED =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name';

  const matches = base64Data.match(/^data:image\/([A-Za-z+-]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid image base64 format');
  }

  const extension = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  if (CLOUDINARY_CONFIGURED) {
    const cloudinary = require('../../config/cloudinary');
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `knotty/${schoolId}/profiles`, public_id: userId, overwrite: true },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(buffer);
    });
    return result.secure_url;
  } else if (process.env.VERCEL) {
    // Vercel read-only filesystem: store base64 data directly
    return base64Data;
  } else {
    try {
      const UPLOADS_DIR = path.join(__dirname, '../../../../uploads/profiles');
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const filename = `${userId}-${Date.now()}.${extension}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      return `/uploads/profiles/${filename}`;
    } catch (err) {
      console.error('Failed to write profile photo to disk, storing base64 instead:', err);
      return base64Data;
    }
  }
}

async function createStudent(data, schoolId) {
  const { guardian_name, guardian_phone, ...studentDetails } = data;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw Object.assign(new Error('School not found'), { status: 404 });

  const student_code = await generateStudentCode(school.code);
  const password_hash = await bcrypt.hash(studentDetails.password || 'Knotty@2024', 10);

  return prisma.$transaction(async (tx) => {
    let parentId = studentDetails.parent_id;
    if (!parentId && (guardian_name || guardian_phone)) {
      const gName = guardian_name || '';
      const gPhone = guardian_phone || '';
      const phoneClean = gPhone.trim().replace(/[+\s]+/g, '');
      const tempEmail = phoneClean ? `${phoneClean}@parent.school` : `parent-${Math.random().toString(36).substring(2, 9)}@parent.school`;
      
      let existingParent = await tx.user.findUnique({ where: { email: tempEmail } });
      if (!existingParent) {
        existingParent = await tx.user.create({
          data: {
            email: tempEmail,
            first_name: gName.split(' ')[0] || 'Guardian',
            last_name: gName.split(' ').slice(1).join(' ') || 'Parent',
            phone: gPhone,
            role: 'PARENT',
            password_hash: await bcrypt.hash('Parent@2024', 10),
            school_id: schoolId,
            is_active: true,
          },
        });
      }
      parentId = existingParent.id;
    }

    const user = await tx.user.create({
      data: {
        school_id: schoolId,
        role: 'STUDENT',
        first_name: studentDetails.first_name,
        last_name: studentDetails.last_name,
        email: studentDetails.email,
        phone: studentDetails.phone,
        password_hash,
      },
    });

    let profile_photo = null;
    if (studentDetails.profile_photo) {
      profile_photo = await handleProfilePhotoUpload(studentDetails.profile_photo, schoolId, user.id);
      await tx.user.update({
        where: { id: user.id },
        data: { profile_photo },
      });
    }

    const student = await tx.student.create({
      data: {
        user_id: user.id,
        school_id: schoolId,
        student_code,
        date_of_birth: studentDetails.date_of_birth,
        gender: studentDetails.gender,
        nationality: studentDetails.nationality,
        level_id: studentDetails.level_id,
        class_id: studentDetails.class_id,
        parent_id: parentId || undefined,
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
        level: true,
        class: true,
        parent: { select: { first_name: true, last_name: true, phone: true, email: true } },
      },
    });

    return student;
  });
}

async function listStudents(schoolId, { page, limit, search, classId, levelId }) {
  const where = {
    school_id: schoolId,
    is_active: true,
    ...(classId && { class_id: classId }),
    ...(levelId && { level_id: levelId }),
    ...(search && {
      user: {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
    }),
  };

  const { skip, take } = paginate(null, page, limit);
  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take,
      include: {
        user: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
        level: { select: { name: true } },
        class: { select: { name: true } },
        card: { select: { card_number: true, wallet_balance: true, is_active: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.student.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function getStudentById(id, schoolId) {
  const student = await prisma.student.findFirst({
    where: { id, school_id: schoolId },
    include: {
      user: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
      level: true,
      class: true,
      card: true,
      parent: { select: { id: true, first_name: true, last_name: true, phone: true, email: true } },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return student;
}

async function getFullProfile(id, schoolId) {
  const student = await getStudentById(id, schoolId);

  const [attendances, reports, health, discipline, achievements] = await Promise.all([
    prisma.attendance.findMany({
      where: { student_id: id },
      orderBy: { date: 'desc' },
      take: 30,
    }),
    prisma.academicReport.findMany({
      where: { student_id: id },
      orderBy: { created_at: 'desc' },
    }),
    prisma.healthRecord.findMany({
      where: { student_id: id },
      orderBy: { recorded_at: 'desc' },
      take: 10,
    }),
    prisma.disciplineRecord.findMany({
      where: { student_id: id },
      orderBy: { recorded_at: 'desc' },
      take: 10,
    }),
    prisma.achievement.findMany({
      where: { student_id: id },
      orderBy: { awarded_at: 'desc' },
    }),
  ]);

  return { ...student, attendances, reports, health, discipline, achievements };
}

async function updateStudent(id, schoolId, data) {
  const { first_name, last_name, phone, profile_photo, guardian_name, guardian_phone, ...studentData } = data;

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({ where: { id, school_id: schoolId } });
    if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

    let photoUrl = undefined;
    if (profile_photo) {
      photoUrl = await handleProfilePhotoUpload(profile_photo, schoolId, student.user_id);
    }

    if (first_name || last_name || phone || photoUrl) {
      await tx.user.update({
        where: { id: student.user_id },
        data: {
          ...(first_name && { first_name }),
          ...(last_name && { last_name }),
          ...(phone && { phone }),
          ...(photoUrl && { profile_photo: photoUrl }),
        },
      });
    }

    // Handle guardian creation/update
    let parentId = student.parent_id;
    if (guardian_name !== undefined || guardian_phone !== undefined) {
      const gName = guardian_name || '';
      const gPhone = guardian_phone || '';
      
      if (parentId) {
        await tx.user.update({
          where: { id: parentId },
          data: {
            ...(guardian_name !== undefined && {
              first_name: gName.split(' ')[0] || 'Guardian',
              last_name: gName.split(' ').slice(1).join(' ') || 'Parent',
            }),
            ...(guardian_phone !== undefined && { phone: gPhone }),
          },
        });
      } else if (gName.trim() || gPhone.trim()) {
        const phoneClean = gPhone.trim().replace(/[+\s]+/g, '');
        const tempEmail = phoneClean ? `${phoneClean}@parent.school` : `parent-${Math.random().toString(36).substring(2, 9)}@parent.school`;
        
        let existingParent = await tx.user.findUnique({ where: { email: tempEmail } });
        if (!existingParent) {
          existingParent = await tx.user.create({
            data: {
              email: tempEmail,
              first_name: gName.split(' ')[0] || 'Guardian',
              last_name: gName.split(' ').slice(1).join(' ') || 'Parent',
              phone: gPhone,
              role: 'PARENT',
              password_hash: await bcrypt.hash('Parent@2024', 10),
              school_id: schoolId,
              is_active: true,
            },
          });
        }
        parentId = existingParent.id;
        studentData.parent_id = parentId;
      }
    }

    return tx.student.update({
      where: { id },
      data: studentData,
      include: {
        user: { select: { first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
        level: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        parent: { select: { first_name: true, last_name: true, phone: true, email: true } },
      },
    });
  });
}

async function deleteStudent(id, schoolId) {
  const student = await prisma.student.findFirst({ where: { id, school_id: schoolId } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  return prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { student_id: id } });
    await tx.feePayment.deleteMany({ where: { student_id: id } });
    await tx.canteenTransaction.deleteMany({ where: { student_id: id } });
    await tx.walletTransaction.deleteMany({ where: { student_id: id } });
    await tx.healthRecord.deleteMany({ where: { student_id: id } });
    await tx.disciplineRecord.deleteMany({ where: { student_id: id } });
    await tx.achievement.deleteMany({ where: { student_id: id } });
    await tx.academicReport.deleteMany({ where: { student_id: id } });
    await tx.knottyCard.deleteMany({ where: { student_id: id } });
    
    await tx.student.delete({ where: { id } });
    await tx.user.delete({ where: { id: student.user_id } });
  });
}

async function getParentChildren(parentId, schoolId) {
  return prisma.student.findMany({
    where: { parent_id: parentId, school_id: schoolId },
    include: {
      user: { select: { id: true, first_name: true, last_name: true, email: true, phone: true, profile_photo: true } },
      level: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      card: { select: { id: true, card_number: true, wallet_balance: true, is_frozen: true, is_active: true, expires_at: true } },
    },
  });
}

async function getConsentRecords(studentId, schoolId) {
  return prisma.consentRecord.findMany({
    where: { student_id: studentId, school_id: schoolId },
    include: {
      guardian: { select: { first_name: true, last_name: true, email: true } },
    },
    orderBy: { granted_at: 'desc' },
  });
}

async function recordConsent(schoolId, studentId, { consent_type, version, guardian_id, document_url }) {
  return prisma.consentRecord.create({
    data: {
      school_id: schoolId,
      student_id,
      guardian_id,
      consent_type,
      version,
      document_url: document_url || null,
    },
    include: {
      guardian: { select: { first_name: true, last_name: true } },
    },
  });
}

module.exports = {
  createStudent,
  listStudents,
  getStudentById,
  getFullProfile,
  updateStudent,
  deleteStudent,
  getParentChildren,
  getConsentRecords,
  recordConsent,
};

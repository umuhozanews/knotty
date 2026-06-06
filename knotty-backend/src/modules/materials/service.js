const path = require('path');
const fs = require('fs');
const prisma = require('../../config/database');
const cloudinary = require('../../integrations/cloudinary');
const { paginate, paginatedResponse } = require('../../utils/helpers');

const CLOUDINARY_CONFIGURED =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads/materials');

async function uploadMaterial(schoolId, uploadedBy, { title, description, subject, classId, levelId }, file) {
  let file_url = '';
  let file_name = file.originalname;

  if (CLOUDINARY_CONFIGURED) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `knotty/${schoolId}/materials`, resource_type: 'auto', use_filename: true },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(file.buffer);
      });
      file_url = result.secure_url;
    } catch {
      throw Object.assign(new Error('File upload failed'), { status: 500 });
    }
  } else {
    // Local disk fallback for development
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const safe = `${Date.now()}-${file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, safe), file.buffer);
    file_url = `/uploads/materials/${safe}`;
  }

  return prisma.material.create({
    data: {
      school_id: schoolId,
      uploaded_by: uploadedBy,
      title,
      description: description || null,
      subject: subject || null,
      class_id: classId || null,
      level_id: levelId || null,
      file_url,
      file_name,
      file_type: file.mimetype,
    },
    include: {
      uploader: { select: { first_name: true, last_name: true } },
      class: { select: { name: true } },
      level: { select: { name: true } },
    },
  });
}

async function listMaterials(schoolId, { page = 1, limit = 20, classId, levelId, search } = {}) {
  const { skip, take } = paginate(null, page, limit);
  const where = {
    school_id: schoolId,
    ...(classId && { class_id: classId }),
    ...(levelId && { level_id: levelId }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.material.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        uploader: { select: { first_name: true, last_name: true } },
        class: { select: { name: true } },
        level: { select: { name: true } },
      },
    }),
    prisma.material.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function deleteMaterial(id, schoolId, userId, role) {
  const mat = await prisma.material.findFirst({ where: { id, school_id: schoolId } });
  if (!mat) throw Object.assign(new Error('Material not found'), { status: 404 });
  if (role !== 'ADMIN' && mat.uploaded_by !== userId) {
    throw Object.assign(new Error('You can only delete your own materials'), { status: 403 });
  }
  return prisma.material.delete({ where: { id } });
}

module.exports = { uploadMaterial, listMaterials, deleteMaterial };

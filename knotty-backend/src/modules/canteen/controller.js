const service = require('./service');

async function purchase(req, res, next) {
  try {
    const result = await service.purchase({ ...req.body, served_by: req.user.id, school_id: req.user.school_id });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function studentTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { studentId } = req.params;

    // Parents can only view their own child's transactions
    if (req.user.role === 'PARENT') {
      const prisma = require('../../config/database');
      const student = await prisma.student.findFirst({
        where: { id: studentId, school_id: req.user.school_id, parent_id: req.user.id },
      });
      if (!student) {
        return res.status(403).json({ success: false, message: 'Access denied: not your child' });
      }
    }

    const result = await service.getStudentTransactions(studentId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function dailyReport(req, res, next) {
  try {
    const result = await service.getDailyReport(req.user.school_id, req.query.date);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function myTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const prisma = require('../../config/database');
    const student = await prisma.student.findFirst({
      where: { user_id: req.user.id, school_id: req.user.school_id },
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const result = await service.getStudentTransactions(student.id, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listProducts(req, res, next) {
  try {
    const data = await service.listProducts(req.user.school_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function createProduct(req, res, next) {
  try {
    let photo_url = req.body.photo_url || null;
    if (req.file) {
      const CLOUDINARY_CONFIGURED =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_CLOUD_NAME !== 'your-cloud-name';

      if (CLOUDINARY_CONFIGURED) {
        const { uploadImage } = require('../../integrations/cloudinary');
        photo_url = await uploadImage(req.file.buffer, 'canteen', `product_${Date.now()}`);
      } else if (process.env.VERCEL) {
        photo_url = `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`;
      } else {
        const fs = require('fs');
        const path = require('path');
        const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
        const UPLOADS_DIR = path.join(baseDir, '../../../uploads/canteen');
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const ext = (req.file.mimetype && req.file.mimetype.split('/')[1]) || 'jpg';
        const filename = `product_${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
        photo_url = `/uploads/canteen/${filename}`;
      }
    }
    const data = await service.createProduct({ ...req.body, photo_url, school_id: req.user.school_id });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function deleteProduct(req, res, next) {
  try {
    await service.deleteProduct(req.params.id, req.user.school_id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { purchase, studentTransactions, myTransactions, dailyReport, listProducts, createProduct, deleteProduct };

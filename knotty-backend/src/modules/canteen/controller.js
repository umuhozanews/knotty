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
        const UPLOADS_DIR = path.join(baseDir, '../../../../uploads/canteen');
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const ext = (req.file.mimetype && req.file.mimetype.split('/')[1]) || 'jpg';
        const filename = `product_${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
        const FRONTEND_DIR = path.join(baseDir, '../../../../knotty-app/public/uploads/canteen');
        try {
          if (!fs.existsSync(FRONTEND_DIR)) fs.mkdirSync(FRONTEND_DIR, { recursive: true });
          fs.writeFileSync(path.join(FRONTEND_DIR, filename), req.file.buffer);
        } catch (_) {}
        photo_url = `/uploads/canteen/${filename}`;
      }
    }
    if (!photo_url) {
      const n = (req.body.name || '').toLowerCase();
      if (n.includes('water') || n.includes('amazi')) photo_url = '/canteen/water.png';
      else if (n.includes('samosa') || n.includes('sambusa')) photo_url = '/canteen/sambusa.png';
      else if (n.includes('chapati')) photo_url = '/canteen/chapati.png';
      else if (n.includes('juice') || n.includes('inyange')) photo_url = '/canteen/inyange.png';
      else if (n.includes('fanta') || n.includes('soda')) photo_url = '/canteen/fanta.png';
      else if (n.includes('milk') || n.includes('amata')) photo_url = '/canteen/milk.png';
      else if (n.includes('porridge') || n.includes('igikoma')) photo_url = '/canteen/porridge.png';
      else if (n.includes('mango') || n.includes('embe')) photo_url = '/canteen/embe.png';
      else if (n.includes('banana') || n.includes('igitoki')) photo_url = '/canteen/banana.png';
      else if (n.includes('avocado') || n.includes('avoka')) photo_url = '/canteen/avocado.png';
      else if (n.includes('mandazi') || n.includes('amandazi')) photo_url = '/canteen/amandazi.png';
      else if (n.includes('egg') || n.includes('igi')) photo_url = '/canteen/egg.png';
      else if (n.includes('biscuit') || n.includes('maria')) photo_url = '/canteen/maria.png';
      else if (n.includes('beans')) photo_url = '/canteen/rice_beans.png';
      else if (n.includes('meat') || n.includes('beef') || n.includes('chicken') || n.includes('rice') || n.includes('lunch') || n.includes('plate') || n.includes('meal')) photo_url = '/canteen/rice_meat.png';
      else if (req.body.category === 'Drinks') photo_url = '/canteen/water.png';
      else if (req.body.category === 'Fruits') photo_url = '/canteen/banana.png';
      else if (req.body.category === 'Bread') photo_url = '/canteen/chapati.png';
      else if (req.body.category === 'Snacks') photo_url = '/canteen/sambusa.png';
      else photo_url = '/canteen/rice_meat.png';
    }
    const data = await service.createProduct({ ...req.body, photo_url, school_id: req.user.school_id });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function updateProduct(req, res, next) {
  try {
    let photo_url = req.body.photo_url;
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
        const UPLOADS_DIR = path.join(baseDir, '../../../../uploads/canteen');
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const ext = (req.file.mimetype && req.file.mimetype.split('/')[1]) || 'jpg';
        const filename = `product_${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
        const FRONTEND_DIR = path.join(baseDir, '../../../../knotty-app/public/uploads/canteen');
        try {
          if (!fs.existsSync(FRONTEND_DIR)) fs.mkdirSync(FRONTEND_DIR, { recursive: true });
          fs.writeFileSync(path.join(FRONTEND_DIR, filename), req.file.buffer);
        } catch (_) {}
        photo_url = `/uploads/canteen/${filename}`;
      }
    }
    const updatePayload = { ...req.body };
    if (photo_url !== undefined) updatePayload.photo_url = photo_url;
    const data = await service.updateProduct(req.params.id, req.user.school_id, updatePayload);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function restockProduct(req, res, next) {
  try {
    const { quantity } = req.body;
    const data = await service.restockProduct(req.params.id, req.user.school_id, quantity);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function deleteProduct(req, res, next) {
  try {
    await service.deleteProduct(req.params.id, req.user.school_id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = {
  purchase,
  studentTransactions,
  myTransactions,
  dailyReport,
  listProducts,
  createProduct,
  updateProduct,
  restockProduct,
  deleteProduct,
};

const service = require('./service');

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    const { title, description, subject, classId, levelId } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const mat = await service.uploadMaterial(
      req.user.school_id,
      req.user.id,
      { title, description, subject, classId, levelId },
      req.file
    );
    res.status(201).json({ success: true, data: mat });
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { page, limit, classId, levelId, search } = req.query;
    const result = await service.listMaterials(req.user.school_id, {
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      classId: classId || undefined,
      levelId: levelId || undefined,
      search: search || undefined,
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.deleteMaterial(req.params.id, req.user.school_id, req.user.id, req.user.role);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
}

module.exports = { upload, list, remove };

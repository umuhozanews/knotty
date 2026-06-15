const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const { checkClassAccess } = require('../../middleware/classAccess');

router.use(authenticate);
router.get('/', authorize('ADMIN', 'TEACHER', 'STUDENT', 'NURSE', 'BURSAR', 'DISCIPLINE'), checkClassAccess, ctrl.list);
router.post('/', authorize('ADMIN', 'TEACHER'), upload.single('file'), checkClassAccess, ctrl.upload);
router.delete('/:id', authorize('ADMIN', 'TEACHER'), ctrl.remove);

module.exports = router;

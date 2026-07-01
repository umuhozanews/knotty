const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);
router.post('/purchase', authorize('ADMIN', 'CANTEEN'), ctrl.purchase);
router.get('/my-transactions', authorize('STUDENT'), ctrl.myTransactions);
router.get('/transactions/:studentId', authorize('ADMIN', 'PARENT'), ctrl.studentTransactions);
router.get('/report', authorize('ADMIN', 'CANTEEN'), ctrl.dailyReport);
router.get('/products', authorize('ADMIN', 'CANTEEN', 'STUDENT', 'TEACHER'), ctrl.listProducts);
router.post('/products', authorize('ADMIN', 'CANTEEN'), upload.single('photo'), ctrl.createProduct);
router.delete('/products/:id', authorize('ADMIN', 'CANTEEN'), ctrl.deleteProduct);

module.exports = router;

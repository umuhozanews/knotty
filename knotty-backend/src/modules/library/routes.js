const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

// Books Catalog
router.get('/books', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.listBooks);
router.get('/books/:id', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'STUDENT', 'PARENT'), ctrl.getBook);
router.post('/books', authorize('ADMIN', 'LIBRARIAN'), ctrl.createBook);
router.put('/books/:id', authorize('ADMIN', 'LIBRARIAN'), ctrl.updateBook);
router.delete('/books/:id', authorize('ADMIN', 'LIBRARIAN'), ctrl.deleteBook);

// Book Copies
router.post('/books/:bookId/copies', authorize('ADMIN', 'LIBRARIAN'), ctrl.createBookCopy);
router.put('/copies/:id', authorize('ADMIN', 'LIBRARIAN'), ctrl.updateBookCopy);
router.delete('/copies/:id', authorize('ADMIN', 'LIBRARIAN'), ctrl.deleteBookCopy);

// Borrowing & Returns
router.post('/borrow', authorize('ADMIN', 'LIBRARIAN'), ctrl.borrowBook);
router.post('/return', authorize('ADMIN', 'LIBRARIAN'), ctrl.returnBook);
router.get('/borrow/student/:studentId', authorize('ADMIN', 'LIBRARIAN', 'STUDENT', 'PARENT', 'TEACHER'), ctrl.getStudentHistory);
router.get('/borrow', authorize('ADMIN', 'LIBRARIAN'), ctrl.listSchoolBorrows);
router.get('/stats', authorize('ADMIN', 'LIBRARIAN'), ctrl.getStats);

module.exports = router;

const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

// Student lookup — accepts card_number, NFC UID, or student_code
router.get('/student-lookup', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE', 'STUDENT'), ctrl.lookupStudent);

// Books Catalog
router.get('/books', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'STUDENT', 'PARENT', 'BURSAR', 'DISCIPLINE', 'NURSE', 'CANTEEN'), ctrl.listBooks);
router.get('/books/:id', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'STUDENT', 'PARENT', 'BURSAR', 'DISCIPLINE', 'NURSE', 'CANTEEN'), ctrl.getBook);
router.post('/books', authorize('ADMIN', 'LIBRARIAN', 'TEACHER'), ctrl.createBook);
router.put('/books/:id', authorize('ADMIN', 'LIBRARIAN', 'TEACHER'), ctrl.updateBook);
router.delete('/books/:id', authorize('ADMIN', 'LIBRARIAN'), ctrl.deleteBook);

// Book Copies
router.post('/books/:bookId/copies', authorize('ADMIN', 'LIBRARIAN', 'TEACHER'), ctrl.createBookCopy);
router.put('/copies/:id', authorize('ADMIN', 'LIBRARIAN', 'TEACHER'), ctrl.updateBookCopy);
router.delete('/copies/:id', authorize('ADMIN', 'LIBRARIAN'), ctrl.deleteBookCopy);

// Borrowing & Returns
router.post('/borrow', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.borrowBook);
router.post('/return', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.returnBook);
router.post('/borrow/:id/renew', authorize('ADMIN', 'LIBRARIAN', 'TEACHER'), ctrl.renewBorrow);
router.post('/borrow/:id/waive-fine', authorize('ADMIN', 'LIBRARIAN', 'BURSAR'), ctrl.waiveFine);
router.get('/borrow/student/:studentId', authorize('ADMIN', 'LIBRARIAN', 'STUDENT', 'PARENT', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.getStudentHistory);
router.get('/borrow', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.listSchoolBorrows);

// Reservations / Holds
router.post('/reservations', authorize('ADMIN', 'LIBRARIAN', 'STUDENT', 'TEACHER'), ctrl.createReservation);
router.get('/reservations', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.listReservations);
router.post('/reservations/:id/cancel', authorize('ADMIN', 'LIBRARIAN', 'STUDENT', 'TEACHER'), ctrl.cancelReservation);
router.post('/reservations/:id/fulfill', authorize('ADMIN', 'LIBRARIAN', 'TEACHER'), ctrl.fulfillReservation);

// Members
router.get('/members', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.listMembers);
router.get('/members/:studentId', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE', 'STUDENT', 'PARENT'), ctrl.getMemberDetail);

// Reports & Stats
router.get('/stats', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE', 'NURSE', 'CANTEEN'), ctrl.getStats);
router.get('/stats/weekly', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.getWeeklyStats);
router.get('/reports/overdue', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.getOverdueReport);
router.get('/reports/most-borrowed', authorize('ADMIN', 'LIBRARIAN', 'TEACHER', 'BURSAR', 'DISCIPLINE'), ctrl.getMostBorrowed);

module.exports = router;

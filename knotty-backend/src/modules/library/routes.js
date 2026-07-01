const router = require('express').Router();
const ctrl = require('./controller');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');

router.use(authenticate);

// Student lookup — accepts card_number, NFC UID, or student_code
router.get('/student-lookup', authorize('ADMIN', 'LIBRARIAN'), ctrl.lookupStudent);

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
router.post('/borrow/:id/renew', authorize('ADMIN', 'LIBRARIAN'), ctrl.renewBorrow);
router.post('/borrow/:id/waive-fine', authorize('ADMIN', 'LIBRARIAN'), ctrl.waiveFine);
router.get('/borrow/student/:studentId', authorize('ADMIN', 'LIBRARIAN', 'STUDENT', 'PARENT', 'TEACHER'), ctrl.getStudentHistory);
router.get('/borrow', authorize('ADMIN', 'LIBRARIAN'), ctrl.listSchoolBorrows);

// Reservations / Holds
router.post('/reservations', authorize('ADMIN', 'LIBRARIAN', 'STUDENT'), ctrl.createReservation);
router.get('/reservations', authorize('ADMIN', 'LIBRARIAN'), ctrl.listReservations);
router.post('/reservations/:id/cancel', authorize('ADMIN', 'LIBRARIAN', 'STUDENT'), ctrl.cancelReservation);
router.post('/reservations/:id/fulfill', authorize('ADMIN', 'LIBRARIAN'), ctrl.fulfillReservation);

// Members
router.get('/members', authorize('ADMIN', 'LIBRARIAN'), ctrl.listMembers);
router.get('/members/:studentId', authorize('ADMIN', 'LIBRARIAN'), ctrl.getMemberDetail);

// Reports & Stats
router.get('/stats', authorize('ADMIN', 'LIBRARIAN'), ctrl.getStats);
router.get('/stats/weekly', authorize('ADMIN', 'LIBRARIAN'), ctrl.getWeeklyStats);
router.get('/reports/overdue', authorize('ADMIN', 'LIBRARIAN'), ctrl.getOverdueReport);
router.get('/reports/most-borrowed', authorize('ADMIN', 'LIBRARIAN'), ctrl.getMostBorrowed);

module.exports = router;

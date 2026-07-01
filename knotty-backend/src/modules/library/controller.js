const service = require('./service');

async function createBook(req, res, next) {
  try {
    const result = await service.createBook(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function listBooks(req, res, next) {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const result = await service.listBooks(req.user.school_id, {
      search, category, page: Number(page), limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getBook(req, res, next) {
  try {
    const result = await service.getBook(req.params.id, req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function updateBook(req, res, next) {
  try {
    const result = await service.updateBook(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: result, message: 'Book updated successfully' });
  } catch (err) { next(err); }
}

async function deleteBook(req, res, next) {
  try {
    await service.deleteBook(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (err) { next(err); }
}

async function createBookCopy(req, res, next) {
  try {
    const result = await service.createBookCopy(req.params.bookId, req.body, req.user.school_id);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function updateBookCopy(req, res, next) {
  try {
    const result = await service.updateBookCopy(req.params.id, req.user.school_id, req.body);
    res.json({ success: true, data: result, message: 'Book copy updated successfully' });
  } catch (err) { next(err); }
}

async function deleteBookCopy(req, res, next) {
  try {
    await service.deleteBookCopy(req.params.id, req.user.school_id);
    res.json({ success: true, message: 'Book copy deleted successfully' });
  } catch (err) { next(err); }
}

async function borrowBook(req, res, next) {
  try {
    const result = await service.borrowBook(req.body, req.user.school_id);
    res.json({ success: true, data: result, message: 'Book checked out successfully' });
  } catch (err) { next(err); }
}

async function returnBook(req, res, next) {
  try {
    const result = await service.returnBook(req.body, req.user.school_id);
    res.json({ success: true, data: result, message: 'Book returned successfully' });
  } catch (err) { next(err); }
}

async function renewBorrow(req, res, next) {
  try {
    const { extra_days = 14 } = req.body;
    const result = await service.renewBorrow(req.params.id, req.user.school_id, extra_days);
    res.json({ success: true, data: result, message: 'Loan renewed successfully' });
  } catch (err) { next(err); }
}

async function waiveFine(req, res, next) {
  try {
    const result = await service.waiveFine(req.params.id, req.user.school_id);
    res.json({ success: true, data: result, message: 'Fine waived successfully' });
  } catch (err) { next(err); }
}

async function createReservation(req, res, next) {
  try {
    const result = await service.createReservation(req.body, req.user.school_id);
    res.status(201).json({ success: true, data: result, message: 'Reservation created' });
  } catch (err) { next(err); }
}

async function listReservations(req, res, next) {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const result = await service.listReservations(req.user.school_id, {
      status, page: Number(page), limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function cancelReservation(req, res, next) {
  try {
    const result = await service.cancelReservation(req.params.id, req.user.school_id);
    res.json({ success: true, data: result, message: 'Reservation cancelled' });
  } catch (err) { next(err); }
}

async function fulfillReservation(req, res, next) {
  try {
    const result = await service.fulfillReservation(req.params.id, req.user.school_id);
    res.json({ success: true, data: result, message: 'Reservation fulfilled' });
  } catch (err) { next(err); }
}

async function getStudentHistory(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { studentId } = req.params;

    // Students can only view their own history; parents can only view their child's
    if (req.user.role === 'STUDENT') {
      const prisma = require('../../config/database');
      const student = await prisma.student.findFirst({
        where: { id: studentId, user_id: req.user.id },
      });
      if (!student) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (req.user.role === 'PARENT') {
      const prisma = require('../../config/database');
      const student = await prisma.student.findFirst({
        where: { id: studentId, school_id: req.user.school_id, parent_id: req.user.id },
      });
      if (!student) {
        return res.status(403).json({ success: false, message: 'Access denied: not your child' });
      }
    }

    const result = await service.getStudentHistory(studentId, {
      page: Number(page), limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listSchoolBorrows(req, res, next) {
  try {
    const { status, search, page = 1, limit = 30 } = req.query;
    const result = await service.listSchoolBorrows(req.user.school_id, {
      status, search, page: Number(page), limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listMembers(req, res, next) {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const result = await service.listMembers(req.user.school_id, {
      search, page: Number(page), limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getMemberDetail(req, res, next) {
  try {
    const result = await service.getMemberDetail(req.params.studentId, req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function getWeeklyStats(req, res, next) {
  try {
    const result = await service.getWeeklyStats(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function getOverdueReport(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await service.getOverdueReport(req.user.school_id, {
      page: Number(page), limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getMostBorrowed(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    const result = await service.getMostBorrowed(req.user.school_id, { limit: Number(limit) });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const result = await service.getStats(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

async function lookupStudent(req, res, next) {
  try {
    const result = await service.lookupStudent(req.query.q, req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = {
  createBook, listBooks, getBook, updateBook, deleteBook,
  createBookCopy, updateBookCopy, deleteBookCopy,
  borrowBook, returnBook, renewBorrow, waiveFine,
  createReservation, listReservations, cancelReservation, fulfillReservation,
  getStudentHistory, listSchoolBorrows,
  listMembers, getMemberDetail,
  getWeeklyStats, getOverdueReport, getMostBorrowed,
  getStats, lookupStudent,
};

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
      search,
      category,
      page: Number(page),
      limit: Number(limit)
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

async function getStudentHistory(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await service.getStudentHistory(req.params.studentId, {
      page: Number(page),
      limit: Number(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listSchoolBorrows(req, res, next) {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const result = await service.listSchoolBorrows(req.user.school_id, {
      status,
      page: Number(page),
      limit: Number(limit)
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const result = await service.getStats(req.user.school_id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

module.exports = {
  createBook,
  listBooks,
  getBook,
  updateBook,
  deleteBook,
  createBookCopy,
  updateBookCopy,
  deleteBookCopy,
  borrowBook,
  returnBook,
  getStudentHistory,
  listSchoolBorrows,
  getStats,
};

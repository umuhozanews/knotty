const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');

async function createBook(data, schoolId) {
  const { title, author, isbn, category, total_copies = 1, copy_tags = [] } = data;

  return prisma.$transaction(async (tx) => {
    const book = await tx.book.create({
      data: {
        school_id: schoolId,
        title,
        author,
        isbn,
        category,
        total_copies,
      },
    });

    // Create copies based on tag lists or default sequence tags
    const copiesData = [];
    for (let i = 0; i < total_copies; i++) {
      const tag = copy_tags[i] || `${isbn || 'BOOK'}-${book.id.substring(0, 5)}-${i + 1}`;
      
      // Ensure copy tag is unique
      const existingCopy = await tx.bookCopy.findUnique({ where: { copy_tag: tag } });
      const finalTag = existingCopy ? `${tag}-${Date.now()}-${i}` : tag;

      copiesData.push({
        school_id: schoolId,
        book_id: book.id,
        copy_tag: finalTag,
        status: 'AVAILABLE',
      });
    }

    if (copiesData.length > 0) {
      await tx.bookCopy.createMany({ data: copiesData });
    }

    return book;
  });
}

async function listBooks(schoolId, { search, category, page = 1, limit = 20 }) {
  const { skip, take } = paginate(null, page, limit);
  const where = {
    school_id: schoolId,
    ...(category && { category }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.book.findMany({
      where,
      skip,
      take,
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { copies: true } },
      },
    }),
    prisma.book.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function getBook(id, schoolId) {
  const book = await prisma.book.findFirst({
    where: { id, school_id: schoolId },
    include: {
      copies: {
        orderBy: { copy_tag: 'asc' },
        include: {
          borrows: {
            where: { returned_at: null },
            include: {
              student: {
                include: { user: { select: { first_name: true, last_name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  return book;
}

async function updateBook(id, schoolId, data) {
  const { title, author, isbn, category } = data;
  const book = await prisma.book.findFirst({ where: { id, school_id: schoolId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });

  return prisma.book.update({
    where: { id },
    data: { title, author, isbn, category },
  });
}

async function deleteBook(id, schoolId) {
  const book = await prisma.book.findFirst({ where: { id, school_id: schoolId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });

  return prisma.book.delete({ where: { id } });
}

async function createBookCopy(bookId, data, schoolId) {
  const { copy_tag } = data;
  const book = await prisma.book.findFirst({ where: { id: bookId, school_id: schoolId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });

  // Check unique copy tag
  const existing = await prisma.bookCopy.findUnique({ where: { copy_tag } });
  if (existing) throw Object.assign(new Error('Copy tag already exists'), { status: 400 });

  return prisma.$transaction(async (tx) => {
    const copy = await tx.bookCopy.create({
      data: {
        school_id: schoolId,
        book_id: bookId,
        copy_tag,
        status: 'AVAILABLE',
      },
    });

    await tx.book.update({
      where: { id: bookId },
      data: { total_copies: { increment: 1 } },
    });

    return copy;
  });
}

async function updateBookCopy(id, schoolId, data) {
  const { status, copy_tag } = data;
  const copy = await prisma.bookCopy.findFirst({ where: { id, school_id: schoolId } });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });

  if (copy_tag && copy_tag !== copy.copy_tag) {
    const existing = await prisma.bookCopy.findUnique({ where: { copy_tag } });
    if (existing) throw Object.assign(new Error('Copy tag already exists'), { status: 400 });
  }

  return prisma.bookCopy.update({
    where: { id },
    data: { status, copy_tag },
  });
}

async function deleteBookCopy(id, schoolId) {
  const copy = await prisma.bookCopy.findFirst({ where: { id, school_id: schoolId } });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });

  return prisma.$transaction(async (tx) => {
    await tx.bookCopy.delete({ where: { id } });
    await tx.book.update({
      where: { id: copy.book_id },
      data: { total_copies: { decrement: 1 } },
    });
  });
}

async function borrowBook(data, schoolId) {
  const { copy_tag, student_code, due_days = 14 } = data;

  const copy = await prisma.bookCopy.findFirst({
    where: { copy_tag, school_id: schoolId },
    include: { book: true },
  });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });
  if (copy.status !== 'AVAILABLE') {
    throw Object.assign(new Error(`Book copy is currently ${copy.status}`), { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { student_code, school_id: schoolId },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const borrowedAt = new Date();
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + due_days);

  return prisma.$transaction(async (tx) => {
    const record = await tx.borrowRecord.create({
      data: {
        school_id: schoolId,
        book_copy_id: copy.id,
        student_id: student.id,
        borrowed_at: borrowedAt,
        due_at: dueAt,
      },
    });

    await tx.bookCopy.update({
      where: { id: copy.id },
      data: { status: 'BORROWED' },
    });

    return record;
  });
}

async function returnBook(data, schoolId) {
  const { copy_tag, fine_rate_per_day = 200 } = data;

  const copy = await prisma.bookCopy.findFirst({
    where: { copy_tag, school_id: schoolId },
    include: { book: true },
  });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });
  if (copy.status !== 'BORROWED') {
    throw Object.assign(new Error('Book copy is not marked as borrowed'), { status: 400 });
  }

  const activeBorrow = await prisma.borrowRecord.findFirst({
    where: { book_copy_id: copy.id, returned_at: null },
    include: {
      student: {
        include: {
          user: { select: { first_name: true, last_name: true } },
          card: true,
        },
      },
    },
  });
  if (!activeBorrow) throw Object.assign(new Error('No active borrowing record found'), { status: 404 });

  const now = new Date();
  let fineAmount = 0;

  if (now > activeBorrow.due_at) {
    const diffTime = Math.abs(now - activeBorrow.due_at);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    fineAmount = diffDays * fine_rate_per_day;
  }

  return prisma.$transaction(async (tx) => {
    let fineWalletTxnId = null;

    if (fineAmount > 0) {
      const studentCard = activeBorrow.student.card;
      if (studentCard && studentCard.is_active && !studentCard.is_frozen && studentCard.wallet_balance >= fineAmount) {
        const updatedCard = await tx.knottyCard.update({
          where: { id: studentCard.id },
          data: { wallet_balance: { decrement: fineAmount } },
        });

        const walletTxn = await tx.walletTransaction.create({
          data: {
            card_id: studentCard.id,
            student_id: activeBorrow.student_id,
            school_id: schoolId,
            type: 'DEDUCTION',
            amount: fineAmount,
            balance_before: studentCard.wallet_balance,
            balance_after: updatedCard.wallet_balance,
            source: 'ADMIN',
            description: `Library fine for overdue return: "${copy.book.title}"`,
          },
        });

        fineWalletTxnId = walletTxn.id;
      }
    }

    const updatedRecord = await tx.borrowRecord.update({
      where: { id: activeBorrow.id },
      data: {
        returned_at: now,
        fine_amount: fineAmount,
      },
    });

    await tx.bookCopy.update({
      where: { id: copy.id },
      data: { status: 'AVAILABLE' },
    });

    return {
      record: updatedRecord,
      fine_amount: fineAmount,
      fine_charged_to_wallet: fineWalletTxnId !== null,
    };
  });
}

async function getStudentHistory(studentId, { page = 1, limit = 20 }) {
  const { skip, take } = paginate(null, page, limit);

  const [data, total] = await Promise.all([
    prisma.borrowRecord.findMany({
      where: { student_id: studentId },
      skip,
      take,
      orderBy: { borrowed_at: 'desc' },
      include: {
        copy: { include: { book: true } },
      },
    }),
    prisma.borrowRecord.count({ where: { student_id: studentId } }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function listSchoolBorrows(schoolId, { status, page = 1, limit = 30 }) {
  const { skip, take } = paginate(null, page, limit);

  const now = new Date();
  const where = {
    school_id: schoolId,
    ...(status === 'active' && { returned_at: null }),
    ...(status === 'returned' && { returned_at: { not: null } }),
    ...(status === 'overdue' && { returned_at: null, due_at: { lt: now } }),
  };

  const [data, total] = await Promise.all([
    prisma.borrowRecord.findMany({
      where,
      skip,
      take,
      orderBy: { due_at: 'asc' },
      include: {
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
        copy: { include: { book: true } },
      },
    }),
    prisma.borrowRecord.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function getStats(schoolId) {
  const [
    totalCopies,
    borrowedCopies,
    returnedRecordCount,
    overdueCopiesCount,
    missingCopiesCount
  ] = await Promise.all([
    prisma.bookCopy.count({ where: { school_id: schoolId } }),
    prisma.bookCopy.count({ where: { school_id: schoolId, status: 'BORROWED' } }),
    prisma.borrowRecord.count({ where: { school_id: schoolId, returned_at: { not: null } } }),
    prisma.borrowRecord.count({
      where: {
        school_id: schoolId,
        returned_at: null,
        due_at: { lt: new Date() }
      }
    }),
    prisma.bookCopy.count({ where: { school_id: schoolId, status: 'LOST' } })
  ]);

  // Aggregate pending fees (from outstanding overdue borrows)
  const outstandingOverdue = await prisma.borrowRecord.findMany({
    where: {
      school_id: schoolId,
      returned_at: null,
      due_at: { lt: new Date() }
    },
    select: {
      due_at: true
    }
  });

  let pendingFees = 0;
  const now = new Date();
  for (const b of outstandingOverdue) {
    const diffTime = Math.abs(now - b.due_at);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    pendingFees += diffDays * 200; // default 200 RWF fine rate
  }

  return {
    borrowedBooks: borrowedCopies || 0,
    returnedBooks: returnedRecordCount || 0,
    overdueBooks: overdueCopiesCount || 0,
    missingBooks: missingCopiesCount || 0,
    totalBooks: totalCopies || 0,
    visitors: 0,
    newMembers: 0,
    pendingFees: pendingFees || 0,
    borrowedTrend: '0%',
    returnedTrend: '0%',
    overdueTrend: '0%',
    missingTrend: '0%',
    totalTrend: '0%',
    visitorsTrend: '0%',
    newMembersTrend: '0%',
    pendingFeesTrend: '0%'
  };
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

const prisma = require('../../config/database');
const { paginate, paginatedResponse } = require('../../utils/helpers');
const { randomUUID } = require('crypto');

async function createBook(data, schoolId) {
  const {
    title, author, isbn, category, total_copies = 1, copy_tags = [],
    description, publisher, published_year, language, cover_url, subject, location
  } = data;

  // Build all copy data before the transaction — no per-copy DB lookup needed
  // because randomUUID() guarantees global uniqueness.
  const bookId = randomUUID();
  const copiesData = [];
  for (let i = 0; i < total_copies; i++) {
    const tag = copy_tags[i] || `${isbn || 'BK'}-${bookId.substring(0, 8)}-${i + 1}`;
    copiesData.push({ school_id: schoolId, book_id: bookId, copy_tag: tag, status: 'AVAILABLE' });
  }

  return prisma.$transaction([
    prisma.book.create({
      data: {
        id: bookId,
        school_id: schoolId,
        title, author, isbn, category, total_copies,
        description, publisher,
        published_year: published_year ? Number(published_year) : null,
        language, cover_url, subject, location,
      },
    }),
    ...(copiesData.length > 0 ? [prisma.bookCopy.createMany({ data: copiesData })] : []),
  ]).then(([book]) => book);
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
        { subject: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.book.findMany({
      where, skip, take, orderBy: { title: 'asc' },
      include: {
        _count: { select: { copies: true } },
        copies: {
          select: { status: true },
        },
      },
    }),
    prisma.book.count({ where }),
  ]);

  const enriched = data.map((b) => ({
    ...b,
    available_copies: b.copies.filter((c) => c.status === 'AVAILABLE').length,
    borrowed_copies: b.copies.filter((c) => c.status === 'BORROWED').length,
  }));

  return paginatedResponse(enriched, total, page, limit);
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
      reservations: {
        where: { status: 'PENDING' },
        include: {
          student: {
            include: { user: { select: { first_name: true, last_name: true } } },
          },
        },
        orderBy: { reserved_at: 'asc' },
      },
    },
  });

  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  return book;
}

async function updateBook(id, schoolId, data) {
  const { title, author, isbn, category, description, publisher, published_year, language, cover_url, subject, location } = data;
  const book = await prisma.book.findFirst({ where: { id, school_id: schoolId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });

  return prisma.book.update({
    where: { id },
    data: {
      title, author, isbn, category, description, publisher,
      published_year: published_year ? Number(published_year) : undefined,
      language, cover_url, subject, location,
    },
  });
}

async function deleteBook(id, schoolId) {
  const book = await prisma.book.findFirst({ where: { id, school_id: schoolId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  return prisma.book.delete({ where: { id } });
}

async function createBookCopy(bookId, data, schoolId) {
  const { copy_tag, condition, notes } = data;
  const book = await prisma.book.findFirst({ where: { id: bookId, school_id: schoolId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });

  const existing = await prisma.bookCopy.findUnique({ where: { copy_tag } });
  if (existing) throw Object.assign(new Error('Copy tag already exists'), { status: 400 });

  return prisma.$transaction(async (tx) => {
    const copy = await tx.bookCopy.create({
      data: { school_id: schoolId, book_id: bookId, copy_tag, status: 'AVAILABLE', condition, notes },
    });
    await tx.book.update({ where: { id: bookId }, data: { total_copies: { increment: 1 } } });
    return copy;
  });
}

async function updateBookCopy(id, schoolId, data) {
  const { status, copy_tag, condition, notes } = data;
  const copy = await prisma.bookCopy.findFirst({ where: { id, school_id: schoolId } });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });

  if (copy_tag && copy_tag !== copy.copy_tag) {
    const existing = await prisma.bookCopy.findUnique({ where: { copy_tag } });
    if (existing) throw Object.assign(new Error('Copy tag already exists'), { status: 400 });
  }

  return prisma.bookCopy.update({ where: { id }, data: { status, copy_tag, condition, notes } });
}

async function deleteBookCopy(id, schoolId) {
  const copy = await prisma.bookCopy.findFirst({ where: { id, school_id: schoolId } });
  if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });

  return prisma.$transaction(async (tx) => {
    await tx.bookCopy.delete({ where: { id } });
    await tx.book.update({ where: { id: copy.book_id }, data: { total_copies: { decrement: 1 } } });
  });
}

async function borrowBook(data, schoolId) {
  const { copy_tag, student_code, student_id, due_days = 14, notes } = data;

  let copy;
  if (copy_tag) {
    copy = await prisma.bookCopy.findFirst({
      where: { copy_tag, school_id: schoolId },
      include: { book: true },
    });
  } else {
    // Find first available copy of a book_id if provided
    if (data.book_id) {
      copy = await prisma.bookCopy.findFirst({
        where: { book_id: data.book_id, school_id: schoolId, status: 'AVAILABLE' },
        include: { book: true },
      });
    }
  }
  if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });
  if (copy.status !== 'AVAILABLE') {
    throw Object.assign(new Error(`Book copy is currently ${copy.status}`), { status: 400 });
  }

  let student;
  if (student_id) {
    student = await prisma.student.findFirst({ where: { id: student_id, school_id: schoolId } });
  } else if (student_code) {
    student = await prisma.student.findFirst({ where: { student_code, school_id: schoolId } });
  }
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
        notes,
      },
      include: {
        copy: { include: { book: true } },
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
    });

    await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'BORROWED' } });

    // Fulfill any pending reservation for this student+book
    await tx.reservation.updateMany({
      where: { student_id: student.id, book_id: copy.book_id, status: 'PENDING' },
      data: { status: 'FULFILLED' },
    });

    return record;
  });
}

async function returnBook(data, schoolId) {
  const { copy_tag, borrow_id, fine_rate_per_day = 200 } = data;

  let activeBorrow;

  if (borrow_id) {
    activeBorrow = await prisma.borrowRecord.findFirst({
      where: { id: borrow_id, school_id: schoolId, returned_at: null },
      include: {
        copy: { include: { book: true } },
        student: {
          include: {
            user: { select: { first_name: true, last_name: true } },
            card: true,
          },
        },
      },
    });
  } else {
    const copy = await prisma.bookCopy.findFirst({
      where: { copy_tag, school_id: schoolId },
      include: { book: true },
    });
    if (!copy) throw Object.assign(new Error('Book copy not found'), { status: 404 });
    if (copy.status !== 'BORROWED') {
      throw Object.assign(new Error('Book copy is not marked as borrowed'), { status: 400 });
    }

    activeBorrow = await prisma.borrowRecord.findFirst({
      where: { book_copy_id: copy.id, returned_at: null },
      include: {
        copy: { include: { book: true } },
        student: {
          include: {
            user: { select: { first_name: true, last_name: true } },
            card: true,
          },
        },
      },
    });
  }

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
            description: `Library fine for overdue return: "${activeBorrow.copy.book.title}"`,
          },
        });
        fineWalletTxnId = walletTxn.id;
      }
    }

    const updatedRecord = await tx.borrowRecord.update({
      where: { id: activeBorrow.id },
      data: { returned_at: now, fine_amount: fineAmount },
    });

    await tx.bookCopy.update({
      where: { id: activeBorrow.book_copy_id },
      data: { status: 'AVAILABLE' },
    });

    return {
      record: updatedRecord,
      fine_amount: fineAmount,
      fine_charged_to_wallet: fineWalletTxnId !== null,
    };
  });
}

async function renewBorrow(borrowId, schoolId, extraDays = 14) {
  const borrow = await prisma.borrowRecord.findFirst({
    where: { id: borrowId, school_id: schoolId, returned_at: null },
  });
  if (!borrow) throw Object.assign(new Error('Active borrow record not found'), { status: 404 });
  if (borrow.renewed_count >= 3) {
    throw Object.assign(new Error('Maximum renewals reached (3 times)'), { status: 400 });
  }

  const newDueAt = new Date(borrow.due_at);
  newDueAt.setDate(newDueAt.getDate() + extraDays);

  return prisma.borrowRecord.update({
    where: { id: borrowId },
    data: { due_at: newDueAt, renewed_count: { increment: 1 } },
    include: {
      copy: { include: { book: true } },
      student: { include: { user: { select: { first_name: true, last_name: true } } } },
    },
  });
}

async function waiveFine(borrowId, schoolId) {
  const borrow = await prisma.borrowRecord.findFirst({
    where: { id: borrowId, school_id: schoolId },
  });
  if (!borrow) throw Object.assign(new Error('Borrow record not found'), { status: 404 });

  return prisma.borrowRecord.update({
    where: { id: borrowId },
    data: { fine_waived: true, fine_amount: 0 },
  });
}

async function createReservation(data, schoolId) {
  const { book_id, student_id, student_code, expires_days = 7, notes } = data;

  const book = await prisma.book.findFirst({ where: { id: book_id, school_id: schoolId } });
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });

  let student;
  if (student_id) {
    student = await prisma.student.findFirst({ where: { id: student_id, school_id: schoolId } });
  } else if (student_code) {
    student = await prisma.student.findFirst({ where: { student_code, school_id: schoolId } });
  }
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  // Prevent duplicate pending reservation
  const existing = await prisma.reservation.findFirst({
    where: { book_id, student_id: student.id, status: 'PENDING' },
  });
  if (existing) throw Object.assign(new Error('Student already has a pending reservation for this book'), { status: 400 });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expires_days);

  return prisma.reservation.create({
    data: {
      school_id: schoolId,
      book_id,
      student_id: student.id,
      status: 'PENDING',
      expires_at: expiresAt,
      notes,
    },
    include: {
      book: { select: { title: true, author: true } },
      student: { include: { user: { select: { first_name: true, last_name: true } } } },
    },
  });
}

async function listReservations(schoolId, { status, page = 1, limit = 30 }) {
  const { skip, take } = paginate(null, page, limit);
  const where = {
    school_id: schoolId,
    ...(status && { status }),
  };

  const [data, total] = await Promise.all([
    prisma.reservation.findMany({
      where, skip, take, orderBy: { reserved_at: 'asc' },
      include: {
        book: { select: { id: true, title: true, author: true, category: true } },
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
    }),
    prisma.reservation.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function cancelReservation(id, schoolId) {
  const res = await prisma.reservation.findFirst({ where: { id, school_id: schoolId } });
  if (!res) throw Object.assign(new Error('Reservation not found'), { status: 404 });
  if (res.status !== 'PENDING') throw Object.assign(new Error('Only pending reservations can be cancelled'), { status: 400 });

  return prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });
}

async function fulfillReservation(id, schoolId) {
  const res = await prisma.reservation.findFirst({ where: { id, school_id: schoolId } });
  if (!res) throw Object.assign(new Error('Reservation not found'), { status: 404 });
  return prisma.reservation.update({ where: { id }, data: { status: 'FULFILLED' } });
}

async function getStudentHistory(studentId, { page = 1, limit = 20 }) {
  const { skip, take } = paginate(null, page, limit);

  const [data, total] = await Promise.all([
    prisma.borrowRecord.findMany({
      where: { student_id: studentId },
      skip, take,
      orderBy: { borrowed_at: 'desc' },
      include: { copy: { include: { book: true } } },
    }),
    prisma.borrowRecord.count({ where: { student_id: studentId } }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function listSchoolBorrows(schoolId, { status, search, page = 1, limit = 30 }) {
  const { skip, take } = paginate(null, page, limit);
  const now = new Date();
  const where = {
    school_id: schoolId,
    ...(status === 'active' && { returned_at: null }),
    ...(status === 'returned' && { returned_at: { not: null } }),
    ...(status === 'overdue' && { returned_at: null, due_at: { lt: now } }),
    ...(search && {
      OR: [
        { student: { user: { first_name: { contains: search, mode: 'insensitive' } } } },
        { student: { user: { last_name: { contains: search, mode: 'insensitive' } } } },
        { student: { student_code: { contains: search, mode: 'insensitive' } } },
        { copy: { book: { title: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.borrowRecord.findMany({
      where, skip, take, orderBy: { due_at: 'asc' },
      include: {
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
        copy: { include: { book: true } },
      },
    }),
    prisma.borrowRecord.count({ where }),
  ]);

  return paginatedResponse(data, total, page, limit);
}

async function listMembers(schoolId, { search, page = 1, limit = 20 }) {
  const { skip, take } = paginate(null, page, limit);
  const where = {
    school_id: schoolId,
    ...(search && {
      OR: [
        { user: { first_name: { contains: search, mode: 'insensitive' } } },
        { user: { last_name: { contains: search, mode: 'insensitive' } } },
        { student_code: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where, skip, take, orderBy: [{ user: { last_name: 'asc' } }],
      include: {
        user: { select: { first_name: true, last_name: true, email: true } },
        class: { select: { name: true } },
        _count: { select: { borrow_records: true } },
      },
    }),
    prisma.student.count({ where }),
  ]);

  // Enrich with active borrows count
  const enriched = await Promise.all(
    students.map(async (s) => {
      const active = await prisma.borrowRecord.count({
        where: { student_id: s.id, returned_at: null },
      });
      const overdue = await prisma.borrowRecord.count({
        where: { student_id: s.id, returned_at: null, due_at: { lt: new Date() } },
      });
      return { ...s, active_borrows: active, overdue_borrows: overdue };
    })
  );

  return paginatedResponse(enriched, total, page, limit);
}

async function getMemberDetail(studentId, schoolId) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, school_id: schoolId },
    include: {
      user: { select: { first_name: true, last_name: true, email: true } },
      class: { select: { name: true } },
    },
  });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const [borrows, reservations] = await Promise.all([
    prisma.borrowRecord.findMany({
      where: { student_id: studentId },
      orderBy: { borrowed_at: 'desc' },
      take: 50,
      include: { copy: { include: { book: true } } },
    }),
    prisma.reservation.findMany({
      where: { student_id: studentId, status: 'PENDING' },
      include: { book: { select: { title: true, author: true } } },
    }),
  ]);

  const activeBorrows = borrows.filter((b) => !b.returned_at);
  const now = new Date();
  const overdueBorrows = activeBorrows.filter((b) => b.due_at < now);
  const totalFines = borrows.reduce((sum, b) => sum + b.fine_amount, 0);

  return {
    student,
    borrows,
    reservations,
    summary: {
      total_borrowed: borrows.length,
      active_borrows: activeBorrows.length,
      overdue_borrows: overdueBorrows.length,
      total_fines: totalFines,
    },
  };
}

async function getWeeklyStats(schoolId) {
  const weeks = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const [checkouts, returns] = await Promise.all([
      prisma.borrowRecord.count({
        where: { school_id: schoolId, borrowed_at: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.borrowRecord.count({
        where: { school_id: schoolId, returned_at: { gte: dayStart, lte: dayEnd } },
      }),
    ]);

    weeks.push({
      day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      date: dayStart.toISOString().split('T')[0],
      checkouts,
      returns,
    });
  }
  return weeks;
}

async function getOverdueReport(schoolId, { page = 1, limit = 50 }) {
  const { skip, take } = paginate(null, page, limit);
  const now = new Date();
  const where = { school_id: schoolId, returned_at: null, due_at: { lt: now } };

  const [data, total] = await Promise.all([
    prisma.borrowRecord.findMany({
      where, skip, take, orderBy: { due_at: 'asc' },
      include: {
        student: { include: { user: { select: { first_name: true, last_name: true } } } },
        copy: { include: { book: true } },
      },
    }),
    prisma.borrowRecord.count({ where }),
  ]);

  const enriched = data.map((b) => {
    const diffTime = Math.abs(now - b.due_at);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { ...b, days_overdue: diffDays, accrued_fine: diffDays * 200 };
  });

  return paginatedResponse(enriched, total, page, limit);
}

async function getMostBorrowed(schoolId, { limit = 10 }) {
  const results = await prisma.borrowRecord.groupBy({
    by: ['book_copy_id'],
    where: { school_id: schoolId },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: Number(limit),
  });

  const enriched = await Promise.all(
    results.map(async (r) => {
      const copy = await prisma.bookCopy.findUnique({
        where: { id: r.book_copy_id },
        include: { book: { select: { id: true, title: true, author: true, category: true } } },
      });
      return { book: copy?.book, borrow_count: r._count.id };
    })
  );

  const grouped = new Map();
  enriched.forEach((r) => {
    if (!r.book) return;
    const existing = grouped.get(r.book.id);
    if (existing) existing.borrow_count += r.borrow_count;
    else grouped.set(r.book.id, { ...r });
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.borrow_count - a.borrow_count)
    .slice(0, limit);
}

async function getStats(schoolId) {
  const now = new Date();
  const [
    totalCopies,
    borrowedCopies,
    returnedRecordCount,
    overdueCopiesCount,
    missingCopiesCount,
    totalBooks,
    activeMembers,
    pendingReservations,
  ] = await Promise.all([
    prisma.bookCopy.count({ where: { school_id: schoolId } }),
    prisma.bookCopy.count({ where: { school_id: schoolId, status: 'BORROWED' } }),
    prisma.borrowRecord.count({ where: { school_id: schoolId, returned_at: { not: null } } }),
    prisma.borrowRecord.count({ where: { school_id: schoolId, returned_at: null, due_at: { lt: now } } }),
    prisma.bookCopy.count({ where: { school_id: schoolId, status: 'LOST' } }),
    prisma.book.count({ where: { school_id: schoolId } }),
    prisma.borrowRecord.count({ where: { school_id: schoolId, returned_at: null } }),
    prisma.reservation.count({ where: { school_id: schoolId, status: 'PENDING' } }),
  ]);

  const outstandingOverdue = await prisma.borrowRecord.findMany({
    where: { school_id: schoolId, returned_at: null, due_at: { lt: now } },
    select: { due_at: true },
  });

  let pendingFees = 0;
  for (const b of outstandingOverdue) {
    const diffTime = Math.abs(now - b.due_at);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    pendingFees += diffDays * 200;
  }

  return {
    borrowedBooks: borrowedCopies,
    returnedBooks: returnedRecordCount,
    overdueBooks: overdueCopiesCount,
    missingBooks: missingCopiesCount,
    totalBooks,
    totalCopies,
    activeMembers,
    pendingReservations,
    pendingFees,
  };
}

// Look up a student by card_number, NFC UID, or student_code.
// Returns { id, name, class, card_number } so the library page
// can use any identifier the librarian has to hand.
async function lookupStudent(query, schoolId) {
  if (!query) throw Object.assign(new Error('Query is required'), { status: 400 });
  const q = String(query).trim();

  // 1. Try card_number (most common — barcode/QR/manual entry)
  let card = await prisma.knottyCard.findFirst({
    where: { card_number: q, school_id: schoolId },
    include: {
      student: {
        include: {
          user: { select: { first_name: true, last_name: true, profile_photo: true } },
          class: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
    },
  });

  // 2. Try NFC UID (hex serial from tag tap)
  if (!card) {
    card = await prisma.knottyCard.findFirst({
      where: { nfc_uid: q, school_id: schoolId },
      include: {
        student: {
          include: {
            user: { select: { first_name: true, last_name: true, profile_photo: true } },
            class: { select: { name: true } },
            level: { select: { name: true } },
          },
        },
      },
    });
  }

  // 3. Try student_code (e.g. KMS001)
  if (!card) {
    const student = await prisma.student.findFirst({
      where: { student_code: { equals: q, mode: 'insensitive' }, school_id: schoolId },
      include: {
        card: true,
        user: { select: { first_name: true, last_name: true, profile_photo: true } },
        class: { select: { name: true } },
        level: { select: { name: true } },
      },
    });
    if (student && student.card) {
      card = { ...student.card, student };
    } else if (student) {
      // Student exists but no card yet — still return their info
      return {
        id: student.id,
        name: `${student.user.first_name} ${student.user.last_name}`,
        photo: student.user.profile_photo,
        class: `${student.level?.name || ''} ${student.class?.name || ''}`.trim(),
        student_code: student.student_code,
        card_number: null,
        has_card: false,
      };
    }
  }

  if (!card) throw Object.assign(new Error('Student not found — check card number, student code, or link the NFC tag in Admin > Cards'), { status: 404 });

  const { student } = card;
  return {
    id: student.id,
    name: `${student.user.first_name} ${student.user.last_name}`,
    photo: student.user.profile_photo,
    class: `${student.level?.name || ''} ${student.class?.name || ''}`.trim(),
    student_code: student.student_code,
    card_number: card.card_number,
    has_card: true,
  };
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

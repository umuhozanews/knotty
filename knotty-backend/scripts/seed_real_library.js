const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/config/database');
const { randomUUID } = require('crypto');

const REAL_BOOKS = [
  {
    title: "New General Mathematics for Senior 4",
    author: "Channon, Smith & Head (REB Curriculum)",
    isbn: "978-0582446731",
    category: "Mathematics",
    location: "Shelf M-01",
    tagPrefix: "MATH-S4",
    total_copies: 5,
    description: "Official Rwandan competency-based curriculum textbook for Senior 4 pure and applied mathematics, covering quadratic functions, logarithms, and trigonometry.",
    published_year: 2021,
    publisher: "Longhorn / REB",
    language: "English"
  },
  {
    title: "Advanced Level Pure Mathematics (P1 & P2)",
    author: "C.J. Tranter",
    isbn: "978-0340053959",
    category: "Mathematics",
    location: "Shelf M-02",
    tagPrefix: "MATH-AL",
    total_copies: 4,
    description: "Comprehensive pure mathematics covering calculus, differential equations, vectors, and complex numbers for advanced high school students.",
    published_year: 2019,
    publisher: "Hodder Education",
    language: "English"
  },
  {
    title: "Calculus and Analytical Geometry (9th Edition)",
    author: "George B. Thomas & Ross L. Finney",
    isbn: "978-0201531749",
    category: "Mathematics",
    location: "Shelf M-03",
    tagPrefix: "CALC-01",
    total_copies: 4,
    description: "Authoritative reference text for differential and integral calculus, multivariable analysis, and limits.",
    published_year: 2018,
    publisher: "Addison-Wesley",
    language: "English"
  },
  {
    title: "Probability & Statistics for Secondary Schools",
    author: "Rwanda Basic Education Board (REB)",
    isbn: "978-9997701423",
    category: "Mathematics",
    location: "Shelf M-04",
    tagPrefix: "STAT-01",
    total_copies: 3,
    description: "Statistical distributions, probability calculations, regression analysis, and hypothesis testing designed for Rwandan secondary schools.",
    published_year: 2022,
    publisher: "REB Publishing",
    language: "English"
  },
  {
    title: "Principles of Physics for Rwandan Schools (Senior 5)",
    author: "Rwanda Basic Education Board",
    isbn: "978-9997702116",
    category: "Physics",
    location: "Shelf P-01",
    tagPrefix: "PHYS-S5",
    total_copies: 5,
    description: "Comprehensive mechanics, thermodynamics, fluid dynamics, and wave phenomena aligned with Rwanda Senior 5 curriculum.",
    published_year: 2022,
    publisher: "REB Publishing",
    language: "English"
  },
  {
    title: "Ordinary Level Physics (4th Edition)",
    author: "A.F. Abbott",
    isbn: "978-0435670108",
    category: "Physics",
    location: "Shelf P-02",
    tagPrefix: "PHYS-OL",
    total_copies: 4,
    description: "Classic foundations of mechanics, heat, light, sound, magnetism, and atomic physics with experiment diagrams.",
    published_year: 2020,
    publisher: "Heinemann",
    language: "English"
  },
  {
    title: "Advanced Physics for High Schools (Mechanics & Waves)",
    author: "Keith Johnson & Tom Duncan",
    isbn: "978-0198392927",
    category: "Physics",
    location: "Shelf P-03",
    tagPrefix: "PHYS-ADV",
    total_copies: 4,
    description: "In-depth treatment of rotational dynamics, simple harmonic motion, optics, and wave-particle duality.",
    published_year: 2021,
    publisher: "Oxford University Press",
    language: "English"
  },
  {
    title: "University Physics with Modern Physics",
    author: "Young & Freedman",
    isbn: "978-0133978049",
    category: "Physics",
    location: "Shelf P-04",
    tagPrefix: "PHYS-UNI",
    total_copies: 3,
    description: "Complete calculus-based physics text with electrostatic theory, electromagnetic waves, and quantum introduction.",
    published_year: 2020,
    publisher: "Pearson",
    language: "English"
  },
  {
    title: "Comprehensive Chemistry for Rwanda Senior 4",
    author: "Longhorn Publishers & REB",
    isbn: "978-9966367812",
    category: "Chemistry",
    location: "Shelf C-01",
    tagPrefix: "CHEM-S4",
    total_copies: 5,
    description: "Chemical bonding, stoichiometry, periodic trends, acid-base equilibria, and organic reaction mechanisms.",
    published_year: 2021,
    publisher: "Longhorn Publishers",
    language: "English"
  },
  {
    title: "Organic Chemistry for Advanced Level Secondary Schools",
    author: "Morrison & Boyd",
    isbn: "978-0136436690",
    category: "Chemistry",
    location: "Shelf C-02",
    tagPrefix: "CHEM-ORG",
    total_copies: 3,
    description: "Functional group chemistry, stereochemistry, aliphatic and aromatic syntheses, and spectroscopic identification.",
    published_year: 2019,
    publisher: "Prentice Hall",
    language: "English"
  },
  {
    title: "General Chemistry: Principles & Modern Applications",
    author: "Petrucci, Herring, Madura & Bissonnette",
    isbn: "978-0132931281",
    category: "Chemistry",
    location: "Shelf C-03",
    tagPrefix: "CHEM-GEN",
    total_copies: 4,
    description: "Thermochemistry, chemical kinetics, electrochemistry, and coordination chemistry with practical lab examples.",
    published_year: 2020,
    publisher: "Pearson",
    language: "English"
  },
  {
    title: "Biology for Rwandan Secondary Schools (Senior 6 CBC)",
    author: "REB & Fountain Publishers",
    isbn: "978-9970194821",
    category: "Biology",
    location: "Shelf B-01",
    tagPrefix: "BIO-S6",
    total_copies: 5,
    description: "Competency-based curriculum textbook covering genetics, molecular biology, human physiology, and environmental ecology.",
    published_year: 2022,
    publisher: "Fountain Publishers",
    language: "English"
  },
  {
    title: "Biological Science 1 and 2 (3rd Edition)",
    author: "D.J. Taylor, N.P.O. Green, G.W. Stout",
    isbn: "978-0521561785",
    category: "Biology",
    location: "Shelf B-02",
    tagPrefix: "BIO-SCI",
    total_copies: 4,
    description: "Classic high school and pre-university biology text with cytology, biochemistry, plant biology, and human systems.",
    published_year: 2018,
    publisher: "Cambridge University Press",
    language: "English"
  },
  {
    title: "Campbell Biology: Concepts & Connections",
    author: "Martha R. Taylor & Eric J. Simon",
    isbn: "978-1292229478",
    category: "Biology",
    location: "Shelf B-03",
    tagPrefix: "BIO-CMP",
    total_copies: 4,
    description: "Visual exploration of cellular life, DNA structure, heredity, evolutionary adaptations, and ecosystem ecology.",
    published_year: 2021,
    publisher: "Pearson",
    language: "English"
  },
  {
    title: "Computer Science for Rwandan Schools: Python & Databases",
    author: "Rwanda Basic Education Board (REB)",
    isbn: "978-9997703816",
    category: "Computer Science",
    location: "Shelf CS-01",
    tagPrefix: "CS-PY",
    total_copies: 6,
    description: "Programming logic in Python 3, relational databases with SQL, web fundamentals, and computer hardware architectures.",
    published_year: 2023,
    publisher: "REB Publishing",
    language: "English"
  },
  {
    title: "Introduction to Algorithms (4th Edition)",
    author: "Cormen, Leiserson, Rivest & Stein",
    isbn: "978-0262046305",
    category: "Computer Science",
    location: "Shelf CS-02",
    tagPrefix: "CS-ALGO",
    total_copies: 3,
    description: "Standard algorithms textbook: sorting, graph algorithms, dynamic programming, and data structures.",
    published_year: 2022,
    publisher: "MIT Press",
    language: "English"
  },
  {
    title: "Web Development Fundamentals: HTML, CSS, JavaScript & Next.js",
    author: "David Flanagan",
    isbn: "978-1491952023",
    category: "Computer Science",
    location: "Shelf CS-03",
    tagPrefix: "CS-WEB",
    total_copies: 4,
    description: "Modern full-stack web engineering guide from client markup and styling to REST APIs and frontend frameworks.",
    published_year: 2022,
    publisher: "O'Reilly Media",
    language: "English"
  },
  {
    title: "Things Fall Apart",
    author: "Chinua Achebe",
    isbn: "978-0385474542",
    category: "Literature",
    location: "Shelf L-01",
    tagPrefix: "LIT-TFA",
    total_copies: 5,
    description: "Masterpiece novel chronicling the life of Okonkwo and the tragic clash of traditional Igbo culture with British colonialism.",
    published_year: 2017,
    publisher: "Anchor Books",
    language: "English"
  },
  {
    title: "The River Between",
    author: "Ngugi wa Thiong'o",
    isbn: "978-0435905484",
    category: "Literature",
    location: "Shelf L-02",
    tagPrefix: "LIT-TRB",
    total_copies: 4,
    description: "Poignant story of Waiyaki striving to reconcile two divided Gikuyu ridges through education amid cultural change.",
    published_year: 2018,
    publisher: "Heinemann African Writers",
    language: "English"
  },
  {
    title: "Petals of Blood",
    author: "Ngugi wa Thiong'o",
    isbn: "978-0143105572",
    category: "Literature",
    location: "Shelf L-03",
    tagPrefix: "LIT-POB",
    total_copies: 4,
    description: "Gripping social novel following four characters in the fictional village of Ilmorog confronting modern transformation.",
    published_year: 2019,
    publisher: "Penguin Classics",
    language: "English"
  },
  {
    title: "Romeo and Juliet",
    author: "William Shakespeare",
    isbn: "978-0743477543",
    category: "Literature",
    location: "Shelf L-04",
    tagPrefix: "LIT-ROM",
    total_copies: 5,
    description: "Timeless tragedy of star-crossed lovers from Verona feuding families, with annotated study notes.",
    published_year: 2020,
    publisher: "Folger Shakespeare Library",
    language: "English"
  },
  {
    title: "Une si longue lettre (So Long a Letter)",
    author: "Mariama Ba",
    isbn: "978-2266009805",
    category: "French",
    location: "Shelf FR-01",
    tagPrefix: "FR-USLL",
    total_copies: 4,
    description: "Celebrated epistolary novel portraying Ramatoulaye's reflections on marriage, womanhood, and social changes in West Africa.",
    published_year: 2018,
    publisher: "Le Serpent a Plumes",
    language: "French"
  },
  {
    title: "History of Rwanda: From Origins to the Post-Genocide Reconstruction",
    author: "National Unity and Reconciliation Commission (NURC)",
    isbn: "978-9997704516",
    category: "History",
    location: "Shelf H-01",
    tagPrefix: "HIST-RW",
    total_copies: 6,
    description: "Comprehensive historical overview of pre-colonial Rwanda, colonial impact, the 1994 Genocide against the Tutsi, and national unity.",
    published_year: 2021,
    publisher: "NURC Kigali",
    language: "English"
  },
  {
    title: "Modern African History: 1800 to Present",
    author: "Kevin Shillington",
    isbn: "978-1137524812",
    category: "History",
    location: "Shelf H-02",
    tagPrefix: "HIST-AFR",
    total_copies: 4,
    description: "Survey of anti-colonial resistance, independence movements, Pan-Africanism, and contemporary socio-economic trajectories.",
    published_year: 2020,
    publisher: "Palgrave Macmillan",
    language: "English"
  },
  {
    title: "Geography of East Africa and the Great Lakes Region",
    author: "REB Secondary Geography Panel",
    isbn: "978-9970195514",
    category: "Geography",
    location: "Shelf G-01",
    tagPrefix: "GEO-EA",
    total_copies: 4,
    description: "Physical topography, climate patterns, volcanic highlands, Lake Kivu hydrology, agriculture, and urban planning in East Africa.",
    published_year: 2022,
    publisher: "REB Publishing",
    language: "English"
  },
  {
    title: "Imigani n'Insubizo by'Ikinyarwanda (Rwandan Proverbs & Idioms)",
    author: "Aloys Bigirumwami",
    isbn: "978-9997705124",
    category: "Kinyarwanda",
    location: "Shelf K-01",
    tagPrefix: "KINY-IMG",
    total_copies: 5,
    description: "Authoritative compendium of traditional Rwandan proverbs, sayings, philosophical reflections, and their cultural contexts.",
    published_year: 2019,
    publisher: "Editions Pallotti-Presse",
    language: "Kinyarwanda"
  },
  {
    title: "Ubusizi Nyarwanda (Traditional Rwandan Poetry & Prose)",
    author: "Alexis Kagame",
    isbn: "978-9997705230",
    category: "Kinyarwanda",
    location: "Shelf K-02",
    tagPrefix: "KINY-UBS",
    total_copies: 4,
    description: "Historical poetic forms including Ibisigo, Indirimbo, and Amazina y'Inka annotated with linguistic commentaries.",
    published_year: 2018,
    publisher: "Editions Universitaires du Rwanda",
    language: "Kinyarwanda"
  },
  {
    title: "English Grammar in Use (5th Edition)",
    author: "Raymond Murphy",
    isbn: "978-1108457651",
    category: "English",
    location: "Shelf E-01",
    tagPrefix: "ENG-EGU",
    total_copies: 5,
    description: "World's best-selling grammar reference and practice book for intermediate to advanced secondary students.",
    published_year: 2021,
    publisher: "Cambridge University Press",
    language: "English"
  }
];

async function seed() {
  console.log("Starting library seeding with authentic Rwandan curriculum books...");
  
  // Find school
  const school = await prisma.school.findFirst();
  if (!school) {
    console.error("No school found in database!");
    process.exit(1);
  }
  const schoolId = school.id;
  console.log(`Using school: ${school.name} (${schoolId})`);

  // Ensure key students have cards with NFC UIDs
  const studentCardConfigs = [
    { code: "KMS269001", cardNum: "KNT-KMS-2026-90001", nfc: "04A3B2C1D0", bal: 6000 },
    { code: "KMS269002", cardNum: "KNT-KMS-2026-90002", nfc: "04F5E6D7C8", bal: 7000 },
    { code: "KMS260003", cardNum: "KNT-KMS-2026-00003", nfc: "0411223344", bal: 8000 },
    { code: "KMS260004", cardNum: "KNT-KMS-2026-00004", nfc: "0422334455", bal: 5000 },
    { code: "KMS260005", cardNum: "KNT-KMS-2026-00005", nfc: "0455667788", bal: 10000 },
    { code: "KMS260006", cardNum: "KNT-KMS-2026-00006", nfc: "0499AABBCC", bal: 3500 },
    { code: "KMS260007", cardNum: "KNT-KMS-2026-00007", nfc: "04CCDDEEFF", bal: 4200 },
    { code: "KMS260008", cardNum: "KNT-KMS-2026-00008", nfc: "0412345678", bal: 6500 },
    { code: "KMS260009", cardNum: "KNT-KMS-2026-00009", nfc: "0487654321", bal: 5500 },
    { code: "KMS260010", cardNum: "KNT-KMS-2026-00010", nfc: "04DEADBEEF", bal: 4800 },
  ];

  for (const cfg of studentCardConfigs) {
    const st = await prisma.student.findFirst({
      where: { student_code: cfg.code },
      include: { card: true, user: true }
    });
    if (st) {
      if (st.card) {
        await prisma.knottyCard.update({
          where: { id: st.card.id },
          data: {
            nfc_uid: cfg.nfc,
            wallet_balance: Math.max(st.card.wallet_balance || 0, cfg.bal),
            is_active: true,
            is_frozen: false,
          }
        });
        console.log(`Updated card for ${st.user.first_name} ${st.user.last_name}: ${st.card.card_number} (NFC: ${cfg.nfc})`);
      } else {
        await prisma.knottyCard.create({
          data: {
            school_id: schoolId,
            student_id: st.id,
            card_number: cfg.cardNum,
            nfc_uid: cfg.nfc,
            wallet_balance: cfg.bal,
            is_active: true,
            is_frozen: false,
          }
        });
        console.log(`Created card for ${st.user.first_name} ${st.user.last_name}: ${cfg.cardNum}`);
      }
    }
  }

  // Insert or update each book
  const insertedBooks = [];
  for (const b of REAL_BOOKS) {
    let book = await prisma.book.findFirst({
      where: {
        school_id: schoolId,
        OR: [
          { isbn: b.isbn },
          { title: b.title }
        ]
      },
      include: { copies: true }
    });

    if (!book) {
      const bookId = randomUUID();
      const copiesData = [];
      for (let i = 1; i <= b.total_copies; i++) {
        copiesData.push({
          school_id: schoolId,
          copy_tag: `${b.tagPrefix}-${String(i).padStart(2, '0')}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
          notes: `Original school copy #${i}`
        });
      }

      book = await prisma.book.create({
        data: {
          id: bookId,
          school_id: schoolId,
          title: b.title,
          author: b.author,
          isbn: b.isbn,
          category: b.category,
          total_copies: b.total_copies,
          description: b.description,
          publisher: b.publisher,
          published_year: b.published_year,
          language: b.language,
          location: b.location,
          subject: b.category,
          copies: {
            create: copiesData
          }
        },
        include: { copies: true }
      });
      console.log(`Created book: ${book.title} with ${book.copies.length} copies.`);
    } else {
      // Update metadata
      book = await prisma.book.update({
        where: { id: book.id },
        data: {
          location: b.location,
          category: b.category,
          subject: b.category,
          description: b.description,
          publisher: b.publisher,
          published_year: b.published_year,
        },
        include: { copies: true }
      });
      // Ensure it has enough copies
      if (book.copies.length < b.total_copies) {
        for (let i = book.copies.length + 1; i <= b.total_copies; i++) {
          const tag = `${b.tagPrefix}-${String(i).padStart(2, '0')}`;
          const existingCopy = await prisma.bookCopy.findUnique({ where: { copy_tag: tag } }).catch(() => null);
          if (!existingCopy) {
            await prisma.bookCopy.create({
              data: {
                school_id: schoolId,
                book_id: book.id,
                copy_tag: tag,
                status: 'AVAILABLE',
                condition: 'GOOD'
              }
            });
          }
        }
        await prisma.book.update({
          where: { id: book.id },
          data: { total_copies: b.total_copies }
        });
      }
      console.log(`Updated book: ${book.title} (${book.copies.length} copies)`);
    }
    insertedBooks.push(book);
  }

  // Create realistic active and overdue loans
  const now = new Date();
  
  // 1. Hirwa Jean (KMS269001) - Active loan: Principles of Physics (due in 5 days)
  const hirwa = await prisma.student.findFirst({ where: { student_code: "KMS269001" } });
  const physBook = await prisma.book.findFirst({ where: { isbn: "978-9997702116" }, include: { copies: true } });
  if (hirwa && physBook && physBook.copies.length > 0) {
    const copy = physBook.copies[0];
    const existingBorrow = await prisma.borrowRecord.findFirst({ where: { book_copy_id: copy.id, returned_at: null } });
    if (!existingBorrow) {
      const borrowDate = new Date(now.getTime() - 2 * 86400000);
      const dueDate = new Date(now.getTime() + 5 * 86400000);
      await prisma.borrowRecord.create({
        data: {
          school_id: schoolId,
          book_copy_id: copy.id,
          student_id: hirwa.id,
          borrowed_at: borrowDate,
          due_at: dueDate,
          notes: "Checked out for Senior 5 Physics practical coursework"
        }
      });
      await prisma.bookCopy.update({ where: { id: copy.id }, data: { status: 'BORROWED' } });
      console.log(`Created active loan for Hirwa Jean: ${physBook.title}`);
    }
  }

  // 2. Uwase Marie (KMS269002) - Active loan: New General Mathematics S4 (due in 4 days)
  const uwase = await prisma.student.findFirst({ where: { student_code: "KMS269002" } });
  const mathBook = await prisma.book.findFirst({ where: { isbn: "978-0582446731" }, include: { copies: true } });
  if (uwase && mathBook && mathBook.copies.length > 0) {
    const copy = mathBook.copies[0];
    const existingBorrow = await prisma.borrowRecord.findFirst({ where: { book_copy_id: copy.id, returned_at: null } });
    if (!existingBorrow) {
      const borrowDate = new Date(now.getTime() - 3 * 86400000);
      const dueDate = new Date(now.getTime() + 4 * 86400000);
      await prisma.borrowRecord.create({
        data: {
          school_id: schoolId,
          book_copy_id: copy.id,
          student_id: uwase.id,
          borrowed_at: borrowDate,
          due_at: dueDate,
          notes: "Algebra revision loan"
        }
      });
      await prisma.bookCopy.update({ where: { id: copy.id }, data: { status: 'BORROWED' } });
      console.log(`Created active loan for Uwase Marie: ${mathBook.title}`);
    }
  }

  // 3. Nkurunziza Eric (KMS260003) - Overdue loan: Things Fall Apart (due 3 days ago, accrued fine 600 RWF)
  const eric = await prisma.student.findFirst({ where: { student_code: "KMS260003" } });
  const tfaBook = await prisma.book.findFirst({ where: { isbn: "978-0385474542" }, include: { copies: true } });
  if (eric && tfaBook && tfaBook.copies.length > 0) {
    const copy = tfaBook.copies[0];
    const existingBorrow = await prisma.borrowRecord.findFirst({ where: { book_copy_id: copy.id, returned_at: null } });
    if (!existingBorrow) {
      const borrowDate = new Date(now.getTime() - 17 * 86400000);
      const dueDate = new Date(now.getTime() - 3 * 86400000); // 3 days overdue
      await prisma.borrowRecord.create({
        data: {
          school_id: schoolId,
          book_copy_id: copy.id,
          student_id: eric.id,
          borrowed_at: borrowDate,
          due_at: dueDate,
          notes: "Literature club reading"
        }
      });
      await prisma.bookCopy.update({ where: { id: copy.id }, data: { status: 'BORROWED' } });
      console.log(`Created overdue loan for Nkurunziza Eric: ${tfaBook.title} (3d overdue)`);
    }
  }

  // 4. Uwimana Grace (KMS260006) - Overdue loan: Organic Chemistry (due 5 days ago, accrued fine 1000 RWF)
  const grace = await prisma.student.findFirst({ where: { student_code: "KMS260006" } });
  const chemBook = await prisma.book.findFirst({ where: { isbn: "978-0136436690" }, include: { copies: true } });
  if (grace && chemBook && chemBook.copies.length > 0) {
    const copy = chemBook.copies[0];
    const existingBorrow = await prisma.borrowRecord.findFirst({ where: { book_copy_id: copy.id, returned_at: null } });
    if (!existingBorrow) {
      const borrowDate = new Date(now.getTime() - 19 * 86400000);
      const dueDate = new Date(now.getTime() - 5 * 86400000); // 5 days overdue
      await prisma.borrowRecord.create({
        data: {
          school_id: schoolId,
          book_copy_id: copy.id,
          student_id: grace.id,
          borrowed_at: borrowDate,
          due_at: dueDate,
          notes: "Advanced organic synthesis reference"
        }
      });
      await prisma.bookCopy.update({ where: { id: copy.id }, data: { status: 'BORROWED' } });
      console.log(`Created overdue loan for Uwimana Grace: ${chemBook.title} (5d overdue)`);
    }
  }

  // 5. Habimana Patrick (KMS260005) - Active loan: Campbell Biology (due in 7 days)
  const patrick = await prisma.student.findFirst({ where: { student_code: "KMS260005" } });
  const bioBook = await prisma.book.findFirst({ where: { isbn: "978-1292229478" }, include: { copies: true } });
  if (patrick && bioBook && bioBook.copies.length > 0) {
    const copy = bioBook.copies[0];
    const existingBorrow = await prisma.borrowRecord.findFirst({ where: { book_copy_id: copy.id, returned_at: null } });
    if (!existingBorrow) {
      const borrowDate = new Date(now.getTime() - 1 * 86400000);
      const dueDate = new Date(now.getTime() + 7 * 86400000);
      await prisma.borrowRecord.create({
        data: {
          school_id: schoolId,
          book_copy_id: copy.id,
          student_id: patrick.id,
          borrowed_at: borrowDate,
          due_at: dueDate,
          notes: "Genetics assignment research"
        }
      });
      await prisma.bookCopy.update({ where: { id: copy.id }, data: { status: 'BORROWED' } });
      console.log(`Created active loan for Habimana Patrick: ${bioBook.title}`);
    }
  }

  // 6. Ingabire Sandra (KMS260008) - Active loan: Computer Science Python (due in 6 days)
  const sandra = await prisma.student.findFirst({ where: { student_code: "KMS260008" } });
  const csBook = await prisma.book.findFirst({ where: { isbn: "978-9997703816" }, include: { copies: true } });
  if (sandra && csBook && csBook.copies.length > 0) {
    const copy = csBook.copies[0];
    const existingBorrow = await prisma.borrowRecord.findFirst({ where: { book_copy_id: copy.id, returned_at: null } });
    if (!existingBorrow) {
      const borrowDate = new Date(now.getTime() - 2 * 86400000);
      const dueDate = new Date(now.getTime() + 6 * 86400000);
      await prisma.borrowRecord.create({
        data: {
          school_id: schoolId,
          book_copy_id: copy.id,
          student_id: sandra.id,
          borrowed_at: borrowDate,
          due_at: dueDate,
          notes: "Python algorithms project"
        }
      });
      await prisma.bookCopy.update({ where: { id: copy.id }, data: { status: 'BORROWED' } });
      console.log(`Created active loan for Ingabire Sandra: ${csBook.title}`);
    }
  }

  // Summary stats
  const totalBooksCount = await prisma.book.count({ where: { school_id: schoolId } });
  const totalCopiesCount = await prisma.bookCopy.count({ where: { school_id: schoolId } });
  const activeLoansCount = await prisma.borrowRecord.count({ where: { school_id: schoolId, returned_at: null } });
  const overdueLoansCount = await prisma.borrowRecord.count({ where: { school_id: schoolId, returned_at: null, due_at: { lt: now } } });

  console.log(`\nLibrary Seeding Complete!`);
  console.log(`Total Titles: ${totalBooksCount}`);
  console.log(`Total Copies: ${totalCopiesCount}`);
  console.log(`Active Loans: ${activeLoansCount}`);
  console.log(`Overdue Loans: ${overdueLoansCount}`);
}

seed()
  .catch((err) => {
    console.error("Seeding error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

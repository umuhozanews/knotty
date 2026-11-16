export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Student {
  id: string;
  initials: string;
  name: string;
  admissionNumber: string;
  class: string;
  grade: string;
  age: number;
  gender: 'M' | 'F';
  status: 'Active' | 'Inactive';
  balance: number;
  attendanceToday?: AttendanceStatus | 'Not scanned';
  disciplineRecordsCount: number;
  libraryBooksCount: number;
  healthVisitsCount: number;
  attendancePoints: number;
  avatarBg?: string;
}

export interface Worker {
  id: string;
  initials: string;
  name: string;
  role: string;
  roleId: string;
  department: string;
  staffId: string;
  status: 'Active' | 'Inactive';
  avatarBg?: string;
}

export interface CanteenProduct {
  id: string;
  name: string;
  price: number;
  category: 'Snacks' | 'Drinks' | 'Meals' | 'Fruits' | 'Bread' | 'Other';
  imageUri?: string;
}

export interface CartItem extends CanteenProduct {
  qty: number;
}

export interface DisciplineRecord {
  id: string;
  studentId: string;
  studentName: string;
  reason: string;
  date: string;
  severity: 'low' | 'medium' | 'high';
}

export interface HealthVisit {
  id: string;
  studentId: string;
  studentName: string;
  complaint: string;
  inSickBay: boolean;
  date: string;
}

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  isbn: string;
  copies: number;
  available: number;
}

export interface BorrowRecord {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  dueDate: string;
  isOverdue: boolean;
  fine: number;
}

export type PermissionLevel = 'M' | 'V' | 'O' | 'S' | 'N';

export interface PermissionRow {
  section: string;
  cells: PermissionLevel[];
}

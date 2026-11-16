import { getSafeBrowserClient } from "../client";
import type { LibraryBorrowRow } from "../database.types";
import type { LibraryBook, LibraryBorrowRecord } from "@/lib/api";

// ── Mappers ──────────────────────────────────────────────────────────────────

function toLibraryBook(row: {
  book_id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  location: string | null;
  total_copies: number;
  available_copies: number;
  created_at: string;
}): LibraryBook {
  return {
    id: row.book_id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    category: row.category,
    location: row.location,
    total_copies: row.total_copies,
    available_copies: Number(row.available_copies),
    borrowed_copies: row.total_copies - Number(row.available_copies),
    created_at: row.created_at,
  };
}

function toBorrowRecord(row: LibraryBorrowRow): LibraryBorrowRecord {
  // legal_name is stored as a single string in student_first; split on first space for display
  const nameParts = (row.student_first ?? "").trim().split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  return {
    id: row.borrow_id,
    borrowed_at: row.borrowed_at,
    due_at: row.due_at,
    returned_at: row.returned_at,
    fine_amount: row.fine_amount,
    fine_waived: row.fine_waived,
    renewed_count: row.renewed_count,
    student: {
      id: row.student_id,
      student_code: row.student_code,
      user: { first_name: firstName, last_name: lastName },
    },
    copy: {
      id: row.copy_id,
      copy_tag: row.copy_tag,
      status: "BORROWED" as const,
      created_at: "",
      book: {
        id: row.book_id,
        title: row.book_title,
        author: row.book_author,
        isbn: row.book_isbn,
        category: null,
        location: row.book_location,
        total_copies: 0,
        created_at: "",
      },
    },
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export const supabaseLibraryService = {
  async listBooks(
    schoolId: string,
    search?: string | null,
    category?: string | null,
    limit = 100
  ): Promise<LibraryBook[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_library_books", {
      p_school_id: schoolId,
      p_search: search ?? null,
      p_category: category ?? null,
      p_limit: limit,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toLibraryBook);
  },

  async getStats(schoolId: string): Promise<{
    totalBooks: number;
    activeMembers: number;
    overdueBooks: number;
    pendingFees: number;
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("get_library_stats", {
      p_school_id: schoolId,
    });

    if (error) throw new Error(error.message);
    const row = (data as { total_books: number; active_borrows: number; overdue_borrows: number; pending_fees: number }[])?.[0];
    return {
      totalBooks: Number(row?.total_books ?? 0),
      activeMembers: Number(row?.active_borrows ?? 0),
      overdueBooks: Number(row?.overdue_borrows ?? 0),
      pendingFees: Number(row?.pending_fees ?? 0),
    };
  },

  async listSchoolBorrows(
    schoolId: string,
    status: "active" | "returned" | "overdue" | "all" = "active",
    limit = 50
  ): Promise<LibraryBorrowRecord[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_school_borrows", {
      p_school_id: schoolId,
      p_status: status,
      p_limit: limit,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toBorrowRecord);
  },

  async lookupStudent(
    schoolId: string,
    identifier: string
  ): Promise<{
    id: string;
    name: string;
    class: string;
    card_number: string | null;
    has_card: boolean;
    student_code: string;
    photo: string | null;
    is_active: boolean;
    is_frozen: boolean;
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("lookup_library_student", {
      p_school_id: schoolId,
      p_identifier: identifier.trim(),
    });

    if (error) throw new Error(error.message);
    const row = (data as {
      student_id: string;
      legal_name: string;
      class_name: string;
      card_number: string | null;
      admission_number: string;
      profile_photo_path: string | null;
      is_card_active: boolean;
      is_card_frozen: boolean;
    }[])?.[0];
    if (!row) throw new Error("Student not found — check card number or student code");

    return {
      id: row.student_id,
      name: row.legal_name,
      class: row.class_name,
      card_number: row.card_number,
      has_card: row.card_number !== null,
      student_code: row.admission_number,
      photo: row.profile_photo_path,
      is_active: row.is_card_active,
      is_frozen: row.is_card_frozen,
    };
  },

  async studentBorrowHistory(
    schoolId: string,
    studentId: string,
    limit = 30
  ): Promise<LibraryBorrowRecord[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("student_borrow_history", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_limit: limit,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toBorrowRecord);
  },

  async createBook(params: {
    schoolId: string;
    title: string;
    author?: string;
    isbn?: string | null;
    category?: string | null;
    location?: string | null;
    totalCopies?: number;
  }): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_library_book", {
      p_school_id: params.schoolId,
      p_title: params.title,
      p_author: params.author ?? "Unknown",
      p_isbn: params.isbn ?? null,
      p_category: params.category ?? null,
      p_location: params.location ?? null,
      p_total_copies: params.totalCopies ?? 1,
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  async borrowBook(params: {
    schoolId: string;
    bookId: string;
    studentId: string;
    dueDays?: number;
  }): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("borrow_book", {
      p_school_id: params.schoolId,
      p_book_id: params.bookId,
      p_student_id: params.studentId,
      p_due_days: params.dueDays ?? 7,
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  async returnBook(params: {
    schoolId: string;
    borrowId?: string | null;
    copyTag?: string | null;
  }): Promise<{ borrowId: string; fineAmount: number; fineChargedToWallet: boolean }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("return_book", {
      p_school_id: params.schoolId,
      p_borrow_id: params.borrowId ?? null,
      p_copy_tag: params.copyTag ?? null,
    });

    if (error) throw new Error(error.message);
    const row = (data as { borrow_id: string; fine_amount: number; fine_charged_to_wallet: boolean }[])?.[0];
    if (!row) throw new Error("Return failed — no result returned");
    return {
      borrowId: row.borrow_id,
      fineAmount: row.fine_amount,
      fineChargedToWallet: row.fine_charged_to_wallet,
    };
  },

  async renewBorrow(
    schoolId: string,
    borrowId: string,
    extraDays = 14
  ): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("renew_borrow", {
      p_school_id: schoolId,
      p_borrow_id: borrowId,
      p_extra_days: extraDays,
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  async waiveFine(schoolId: string, borrowId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("waive_library_fine", {
      p_school_id: schoolId,
      p_borrow_id: borrowId,
    });

    if (error) throw new Error(error.message);
  },

  async listOverdueBorrows(
    schoolId: string,
    limit = 50
  ): Promise<(LibraryBorrowRecord & { days_overdue: number; accrued_fine: number })[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_overdue_borrows", {
      p_school_id: schoolId,
      p_limit: limit,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row: LibraryBorrowRow & { days_overdue: number; accrued_fine: number }) => ({
      ...toBorrowRecord(row),
      days_overdue: row.days_overdue,
      accrued_fine: row.accrued_fine,
    }));
  },
};

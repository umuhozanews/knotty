import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type CardAssignmentRow = Database["public"]["Tables"]["card_assignments"]["Row"];
export type SchoolCardItem = Database["public"]["Functions"]["list_school_cards"]["Returns"][number];

export const supabaseCardService = {
  /**
   * Check if current user has permission to issue cards.
   */
  async canIssueCard(schoolId: string): Promise<boolean> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("can_issue_card", {
      p_school_id: schoolId,
    });

    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  /**
   * Check if current user has permission to manage/replace/suspend cards.
   */
  async canManageCards(schoolId: string): Promise<boolean> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("can_manage_cards", {
      p_school_id: schoolId,
    });

    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  /**
   * Issue a card securely using the issue-card Edge Function.
   * Identifier is HMAC-digested server-side; service_role credentials never touch the browser.
   */
  async issueCard(params: {
    schoolId: string;
    holderKind: "student" | "staff";
    studentId?: string;
    staffRecordId?: string;
    identifierKind: "nfc_uid" | "qr_token";
    identifier: string;
  }): Promise<{ cardAssignmentId: string; status: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.functions.invoke("issue-card", {
      body: {
        school_id: params.schoolId,
        holder_kind: params.holderKind,
        student_id: params.studentId || null,
        staff_record_id: params.staffRecordId || null,
        identifier_kind: params.identifierKind,
        identifier: params.identifier,
      },
    });

    if (error) throw new Error(error.message || "Failed to issue card via Edge Function");
    if (!data?.card_assignment_id) throw new Error(data?.error || "Card issuance failed");

    return {
      cardAssignmentId: data.card_assignment_id,
      status: data.status ?? "issued",
    };
  },

  /**
   * Replace a card securely using the replace-card Edge Function.
   * Revokes the old card and activates the replacement atomically.
   */
  async replaceCard(params: {
    schoolId: string;
    oldCardAssignmentId: string;
    identifierKind: "nfc_uid" | "qr_token";
    identifier: string;
    reason: string;
  }): Promise<{ cardAssignmentId: string; status: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.functions.invoke("replace-card", {
      body: {
        school_id: params.schoolId,
        old_card_assignment_id: params.oldCardAssignmentId,
        identifier_kind: params.identifierKind,
        identifier: params.identifier,
        reason: params.reason,
      },
    });

    if (error) throw new Error(error.message || "Failed to replace card via Edge Function");
    if (!data?.card_assignment_id) throw new Error(data?.error || "Card replacement failed");

    return {
      cardAssignmentId: data.card_assignment_id,
      status: data.status ?? "issued",
    };
  },

  /**
   * Activate an issued card.
   */
  async activateCard(schoolId: string, cardAssignmentId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("activate_card", {
      p_school_id: schoolId,
      p_card_assignment_id: cardAssignmentId,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Transition card lifecycle status ('suspended', 'lost', 'damaged', 'revoked', 'active').
   * Note: 'active' resumes a suspended card. 'stolen' is not supported in the core schema (use 'lost').
   */
  async changeCardStatus(
    schoolId: string,
    cardAssignmentId: string,
    newStatus: "suspended" | "lost" | "damaged" | "revoked" | "active",
    reason: string
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    if (reason.trim().length < 3) {
      throw new Error("A valid audit reason of at least 3 characters is required.");
    }

    const { error } = await client.rpc("change_card_status", {
      p_school_id: schoolId,
      p_card_assignment_id: cardAssignmentId,
      p_new_status: newStatus,
      p_reason: reason.trim(),
    });

    if (error) throw new Error(error.message);
  },

  /**
   * List school cards with holder information via authorized RPC.
   */
  async listSchoolCards(schoolId: string): Promise<SchoolCardItem[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_school_cards", {
      p_school_id: schoolId,
    });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Top up a card's wallet balance.
   */
  async topUpWallet(schoolId: string, cardAssignmentId: string, amount: number): Promise<number> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("top_up_wallet", {
      p_school_id: schoolId,
      p_card_assignment_id: cardAssignmentId,
      p_amount: amount,
    });

    if (error) throw new Error(error.message);
    return data as number;
  },

  /**
   * Link an NFC UID to a card by updating the card_identifiers table.
   * This is a simplified version - in production use the issue-card edge function.
   */
  async lookupCardHolder(schoolId: string, cardNumber: string) {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.rpc("lookup_card_holder", {
      p_school_id: schoolId,
      p_card_number: cardNumber,
    });
    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  },
};

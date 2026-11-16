import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export const supabaseNotificationService = {
  async listMyNotifications(personId: string, limit = 50): Promise<NotificationRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("notifications")
      .select("*")
      .eq("recipient_person_id", personId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async markRead(notificationId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { error } = await client
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    if (error) throw new Error(error.message);
  },

  async markAllRead(personId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { error } = await client
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_person_id", personId)
      .eq("is_read", false);
    if (error) throw new Error(error.message);
  },

  async getUnreadCount(personId: string): Promise<number> {
    const client = getSafeBrowserClient();
    if (!client) return 0;
    const { count } = await client
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_person_id", personId)
      .eq("is_read", false);
    return count ?? 0;
  },
};

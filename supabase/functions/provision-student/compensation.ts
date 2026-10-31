export type AuthUserCleanup = "deleted" | "cleanup_pending";

/** A PostgreSQL SQLSTATE means the RPC transaction returned a database error. */
export function isDefinitiveDatabaseFailure(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) &&
    !code.startsWith("PGRST");
}

/**
 * Compensate for a failed database registration after Auth Admin created the
 * student identity. A failed/throwing Auth delete must be surfaced so an
 * operator can reconcile the orphan instead of reporting an ordinary failure.
 */
export async function deleteUnregisteredAuthUser(
  deleteUser: (userId: string) => Promise<{ error: unknown }>,
  userId: string,
): Promise<AuthUserCleanup> {
  try {
    const { error } = await deleteUser(userId);
    return error ? "cleanup_pending" : "deleted";
  } catch {
    return "cleanup_pending";
  }
}

import { deleteUnregisteredAuthUser, isDefinitiveDatabaseFailure } from "./compensation.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("successful Auth cleanup reports the account was deleted", async () => {
  let deletedUserId = "";
  const result = await deleteUnregisteredAuthUser(async (userId) => {
    deletedUserId = userId;
    return { error: null };
  }, "test-auth-user");

  assertEquals(result, "deleted");
  assertEquals(deletedUserId, "test-auth-user");
});

Deno.test("Auth delete error is marked for reconciliation", async () => {
  const result = await deleteUnregisteredAuthUser(async () => ({
    error: new Error("admin API unavailable"),
  }), "test-auth-user");

  assertEquals(result, "cleanup_pending");
});

Deno.test("thrown Auth delete failure is marked for reconciliation", async () => {
  const result = await deleteUnregisteredAuthUser(async () => {
    throw new Error("network unavailable");
  }, "test-auth-user");

  assertEquals(result, "cleanup_pending");
});

Deno.test("database SQLSTATE is a definitive failed registration", () => {
  assertEquals(isDefinitiveDatabaseFailure({ code: "23505" }), true);
});

Deno.test("PostgREST and transport errors have an ambiguous commit outcome", () => {
  assertEquals(isDefinitiveDatabaseFailure({ code: "PGRST000" }), false);
  assertEquals(isDefinitiveDatabaseFailure(new TypeError("fetch failed")), false);
  assertEquals(isDefinitiveDatabaseFailure(null), false);
});

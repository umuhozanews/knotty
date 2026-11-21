export const MANAGEMENT_ROLES = new Set(["ADMIN", "SCHOOL_MANAGER", "ORGANIZATION_MANAGER", "PLATFORM_ADMIN"]);
export const isManagementRole = (role?: string | null) => MANAGEMENT_ROLES.has(role ?? "");

export const FINANCE_ROLES = new Set([...MANAGEMENT_ROLES, "BURSAR"]);
export const isFinanceRole = (role?: string | null) => FINANCE_ROLES.has(role ?? "");

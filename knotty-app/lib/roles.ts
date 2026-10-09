export const MANAGEMENT_ROLES = new Set(["ADMIN", "SCHOOL_MANAGER", "ORGANIZATION_MANAGER", "PLATFORM_ADMIN"]);
export const isManagementRole = (role?: string | null) => MANAGEMENT_ROLES.has(role ?? "");

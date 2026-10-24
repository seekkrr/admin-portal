const ROLE_ORDER = ["super_admin", "admin", "finance", "moderator"] as const;

const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super admin",
    admin: "Admin",
    finance: "Finance",
    moderator: "Moderator",
};

/** The highest admin role a user holds, as a readable label. */
export function primaryRoleLabel(roles: readonly string[] | undefined): string {
    const r = ROLE_ORDER.find((x) => roles?.includes(x));
    return (r && ROLE_LABELS[r]) || "Staff";
}

export function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + last).toUpperCase() || "?";
}

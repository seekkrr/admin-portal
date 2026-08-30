// Role model for the admin Users page.
//
// A user's `role` is a CUMULATIVE array along a privilege ladder ranked by tier.
// Roles sharing a rank are MUTUALLY EXCLUSIVE siblings — a user holds at most
// one per rank (e.g. moderator XOR finance, both sit between user and admin).
// Selecting a tier sets the array to the ladder path up to it, popping higher
// tiers and switching sibling tracks. "user" is the immovable base.
//
//   rank 0: user            (always present)
//   rank 1: moderator | finance   (same level, cannot be held together)
//   rank 2: admin
//   rank 3: super_admin
export const ROLE_TIERS: readonly (readonly string[])[] = [
    ["user"],
    ["moderator", "finance"],
    ["admin"],
    ["super_admin"],
];

// Functional roles OUTSIDE the ladder — additive, preserved across changes.
export const ADDITIVE_ROLES = ["creator", "business"] as const;

const RANK_OF: Record<string, number> = Object.fromEntries(
    ROLE_TIERS.flatMap((tier, rank) => tier.map((r) => [r, rank])),
);

const dedupe = (arr: string[]): string[] => Array.from(new Set(arr));

/** The single highest-priority ladder role the user holds — drives the "Current" badge. */
export function effectiveRole(roles: string[] = []): string {
    return roles.reduce((top, r) => {
        const rank = RANK_OF[r];
        return rank !== undefined && rank > (RANK_OF[top] ?? -1) ? r : top;
    }, "user");
}

/** Cumulative ladder path up to `target`, preserving the user's existing sibling track. */
function ladderUpTo(target: string, current: string[]): string[] {
    const targetRank = RANK_OF[target] ?? 0;
    const out: string[] = [];
    for (let rank = 0; rank <= targetRank; rank++) {
        const tier = ROLE_TIERS[rank];
        if (!tier) continue;
        if (rank === targetRank) {
            out.push(target);
        } else {
            const held = tier.find((r) => current.includes(r));
            if (held) out.push(held);
            else if (rank === 0) out.push("user");
        }
    }
    return out;
}

/**
 * Build the cumulative role array for a target role given the user's current
 * roles. Mutually-exclusive siblings are never both present; additive roles
 * (creator) are preserved.
 */
export function rolesForTarget(target: string, current: string[] = []): string[] {
    const preserved = current.filter((r) => (ADDITIVE_ROLES as readonly string[]).includes(r));
    const base = RANK_OF[target] === undefined
        ? [...ladderUpTo(effectiveRole(current), current), target] // additive grant on top
        : ladderUpTo(target, current);
    return dedupe([...base, ...preserved]);
}

/** True when applying `target` would not change the user's roles (disable the action). */
export function isRedundantRoleChange(target: string, current: string[] = []): boolean {
    const next = [...rolesForTarget(target, current)].sort();
    const cur = [...new Set(current)].sort();
    return next.length === cur.length && next.every((v, i) => v === cur[i]);
}

import type { PaymentEvent } from "@/types";

/** A payment event's error object as one line of text (or null). */
export function eventErrorText(ev: PaymentEvent): string | null {
    if (!ev.error) return null;
    return typeof ev.error === "object" ? JSON.stringify(ev.error) : String(ev.error);
}

/** The finance suite (transactions, refunds, payouts, payout accounts, payment events). */
export const FINANCE_VIEW_ROLES = ["admin", "super_admin", "finance"];

export function hasAnyRole(roles: readonly string[] | undefined, allowed: readonly string[]): boolean {
    return !!roles?.some((r) => allowed.includes(r));
}

import { formatCurrency } from "@/utils/format";
import type { Coupon } from "@/types";

/** A coupon's discount as `50%`, `₹100`, or `15–30%`. */
export function renderDiscount(c: Pick<Coupon, "discount_type" | "discount_value" | "discount_min" | "discount_max" | "currency">): string {
    if (c.discount_type === "flat") return formatCurrency(c.discount_value ?? 0, c.currency);
    if (c.discount_type === "percent") return `${c.discount_value ?? 0}%`;
    return `${c.discount_min ?? 0}–${c.discount_max ?? 0}%`;
}

export const DISCOUNT_TYPE_LABELS: Record<string, string> = { flat: "Flat amount", percent: "Percent", percent_range: "Percent range" };

export const COUPON_VIEW_ROLES = ["admin", "super_admin", "finance"];
export const COUPON_MANAGE_ROLES = ["admin", "super_admin"];

export function hasRole(roles: readonly string[] | undefined, allowed: readonly string[]): boolean {
    return !!roles?.some((r) => allowed.includes(r));
}

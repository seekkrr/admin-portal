import type { AdminPayoutAccount, PayoutAccountMethod } from "@/types";

export const METHOD_LABELS: Record<string, string> = { bank_transfer: "Bank transfer", upi: "UPI", razorpay_x: "RazorpayX" };

export function methodLabel(method: PayoutAccountMethod | string | null | undefined): string {
    if (!method) return "—";
    return METHOD_LABELS[method] ?? method.replace(/_/g, " ");
}

/** Masked account number (bank) or UPI id — exactly as the server returns it. */
export function maskedDetail(account: Pick<AdminPayoutAccount, "method" | "bank_details" | "upi_id">): string {
    if (account.method === "bank_transfer") return account.bank_details?.account_number_masked ?? "—";
    return account.upi_id ?? "—";
}

export const FINANCE_ROLES = ["admin", "super_admin", "finance"];
export const MANAGE_ROLES = ["admin", "super_admin"];
export const SUPER_ROLES = ["super_admin"];

export function hasRole(roles: readonly string[] | undefined, allowed: readonly string[]): boolean {
    return !!roles?.some((r) => allowed.includes(r));
}

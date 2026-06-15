/**
 * Shared formatting helpers for the financial sections (transactions, refunds,
 * payouts, payout accounts). Kept framework-agnostic and dependency-free.
 */

/**
 * Format a monetary amount that is already in MAJOR units (e.g. 99.99 INR).
 * Backend `amount` fields on transactions/refunds/payouts are stored in major
 * units. (Razorpay `razorpay_fee` / `razorpay_tax` are in paise — divide by 100
 * before passing here, or use `formatPaise`.)
 */
export function formatCurrency(
    amount: number | null | undefined,
    currency = "INR"
): string {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: (currency || "INR").toUpperCase(),
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${amount} ${currency}`;
    }
}

/** Format an amount stored in the smallest unit (paise/cents). */
export function formatPaise(
    minor: number | null | undefined,
    currency = "INR"
): string {
    if (minor === null || minor === undefined || Number.isNaN(minor)) return "—";
    return formatCurrency(minor / 100, currency);
}

/** Format an ISO timestamp as a readable date + time (en-IN). */
export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Format an ISO timestamp as a date only (en-IN). */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/** Truncate a long id/reference to a copy-friendly short form. */
export function shortId(id: string | null | undefined, lead = 6, tail = 4): string {
    if (!id) return "—";
    if (id.length <= lead + tail + 1) return id;
    return `${id.slice(0, lead)}…${id.slice(-tail)}`;
}

/** Render a value or an em-dash placeholder for null/empty. */
export function orDash(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
}

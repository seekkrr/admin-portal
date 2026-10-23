import type { ExperienceGst, ExperiencePaymentStatus } from "@/types/admin-detail";
import type { StatusTone } from "@/components/ui/status";

const round2 = (n: number) => Math.round(n * 100) / 100;

const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const paise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,000 · ₹847.46 · ₹0 (money amounts; "—" when unknown). */
export function inr(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    const v = round2(value);
    return Number.isInteger(v) ? whole.format(v) : paise.format(v);
}

/** "12.5%" / "0%" / "—". */
export function pct(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return `${round2(value)}%`;
}

export interface GstBreakdown {
    /** Taxable value. */
    subtotal: number;
    gst: number;
    total: number;
}

/**
 * The contract's rule for one amount (price × people):
 *  - GST off → total = amount, no tax;
 *  - added on top → gst = round(amount × rate / 100, 2), total = amount + gst;
 *  - included → taxable = round(amount × 100 / (100 + rate), 2), gst = amount − taxable.
 * The server's total is authoritative; this is a preview.
 */
export function gstBreakdown(amount: number, gst: ExperienceGst | null | undefined): GstBreakdown {
    if (!gst?.enabled || !gst.rate_pct) return { subtotal: round2(amount), gst: 0, total: round2(amount) };
    if (gst.inclusive) {
        const taxable = round2((amount * 100) / (100 + gst.rate_pct));
        return { subtotal: taxable, gst: round2(amount - taxable), total: round2(amount) };
    }
    const tax = round2((amount * gst.rate_pct) / 100);
    return { subtotal: round2(amount), gst: tax, total: round2(amount + tax) };
}

/** Live example under the GST switches. */
export function gstExample(price: number, gst: ExperienceGst | null | undefined): string {
    if (!gst?.enabled) return `${inr(price)} per person · no GST`;
    const b = gstBreakdown(price, gst);
    return gst.inclusive
        ? `${inr(price)} incl. GST = ${inr(b.subtotal)} + ${inr(b.gst)} GST (${gst.rate_pct}%)`
        : `${inr(price)} per person → ${inr(b.total)} incl. ${gst.rate_pct}% GST`;
}

/** Short tag next to a price: "+ 18% GST" / "incl. 18% GST" / "No GST". */
export function gstTag(gst: ExperienceGst | null | undefined): string {
    if (!gst?.enabled) return "No GST";
    return gst.inclusive ? `incl. ${gst.rate_pct}% GST` : `+ ${gst.rate_pct}% GST`;
}

export const PAYMENT_STATUS_META: Record<ExperiencePaymentStatus, { label: string; tone: StatusTone }> = {
    not_required: { label: "Free", tone: "neutral" },
    pending: { label: "Awaiting payment", tone: "warn" },
    paid: { label: "Paid", tone: "good" },
    refund_pending: { label: "Refund pending", tone: "warn" },
    refunded: { label: "Refunded", tone: "info" },
    failed: { label: "Failed", tone: "bad" },
};

export const PAYMENT_STATUS_FILTERS: { value: ExperiencePaymentStatus; label: string }[] = [
    { value: "paid", label: "Paid" },
    { value: "refund_pending", label: "Refund pending" },
    { value: "refunded", label: "Refunded" },
    { value: "failed", label: "Failed" },
];

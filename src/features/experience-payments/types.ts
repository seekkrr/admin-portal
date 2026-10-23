import type { ExperiencePaymentStatus } from "@/types/admin-detail";

/** Money totals in rupees (INR). */
export interface FinanceSummary {
    /** Paid by travelers (before refunds). */
    gross: number;
    refunds: number;
    /** SeekKrr's commission (on the taxable value, never on GST). */
    commission: number;
    /** GST collected (paid minus refunded). */
    gst_collected: number;
    /** What the business has earned: taxable value − commission, after refunds. */
    net_owed: number;
    paid_out: number;
    /** net_owed − paid_out: still to pay the business. */
    balance: number;
}

export interface BusinessFinanceRow extends FinanceSummary {
    business_id: string;
    name: string;
    commission_pct: number | null;
}

export interface FinanceOverview {
    summary: FinanceSummary;
    businesses: BusinessFinanceRow[];
}

export interface FinanceRange {
    from?: string;
    to?: string;
}

/** One paid (or refunded) experience booking, as the finance lists show it. */
export interface FinanceBooking {
    id: string;
    code: string | null;
    business_id: string | null;
    business_name: string | null;
    experience_id: string | null;
    experience_title: string | null;
    customer_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
    people: number | null;
    /** Taxable value. */
    subtotal: number | null;
    gst_amount: number | null;
    gst_rate_pct: number | null;
    gst_inclusive: boolean;
    /** What the traveler paid (subtotal + GST). */
    total: number | null;
    commission_pct: number | null;
    commission: number | null;
    net: number | null;
    payment_status: ExperiencePaymentStatus | null;
    booking_status: string | null;
    order_id: string | null;
    payment_id: string | null;
    refund_id: string | null;
    paid_at: string | null;
    refunded_at: string | null;
    starts_at: string | null;
    created_at: string | null;
    source: string | null;
}

export interface FinanceBookingsPage {
    bookings: FinanceBooking[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface FinanceBookingsParams extends FinanceRange {
    business_id?: string;
    status?: string;
    page?: number;
    page_size?: number;
}

/** A manual bank transfer to a business, recorded by an admin. */
export interface BusinessPayout {
    id: string;
    business_id: string | null;
    amount: number;
    reference: string | null;
    /** YYYY-MM-DD */
    paid_on: string | null;
    note: string | null;
    created_at: string | null;
    created_by: string | null;
    created_by_name: string | null;
}

export interface RecordPayoutPayload {
    amount: number;
    reference: string;
    paid_on: string;
    note?: string;
}

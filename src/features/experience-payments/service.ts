/**
 * Experience payments (SeekKrr collects, takes a commission, pays businesses
 * out by bank transfer). Goes through the detail-page `call()` so a route the
 * server doesn't have yet becomes a NotAvailableError ("This isn't available
 * on the server yet").
 */
import { call, qs } from "@/services/admin-detail.service";
import type { ExperiencePaymentStatus } from "@/types/admin-detail";
import type {
    BusinessFinanceRow,
    BusinessPayout,
    FinanceBooking,
    FinanceBookingsPage,
    FinanceBookingsParams,
    FinanceOverview,
    FinanceRange,
    FinanceSummary,
    RecordPayoutPayload,
} from "./types";

type Raw = Record<string, unknown>;

const enc = encodeURIComponent;

const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);
const first = <T>(...values: (T | null | undefined)[]): T | null => values.find((v) => v !== null && v !== undefined) ?? null;

const PAYMENT_STATUSES: ExperiencePaymentStatus[] = ["not_required", "pending", "paid", "refund_pending", "refunded", "failed"];

function summaryOf(raw: unknown): FinanceSummary {
    const r = obj(raw);
    return {
        gross: num(r.gross) ?? 0,
        refunds: num(r.refunds) ?? 0,
        commission: num(r.commission) ?? 0,
        gst_collected: num(r.gst_collected) ?? num(r.gst) ?? 0,
        net_owed: num(r.net_owed) ?? num(r.net) ?? 0,
        paid_out: num(r.paid_out) ?? 0,
        balance: num(r.balance) ?? 0,
    };
}

function businessRowOf(raw: unknown): BusinessFinanceRow {
    const r = obj(raw);
    return {
        ...summaryOf(r),
        business_id: str(r.business_id) ?? str(r.id) ?? "",
        name: str(r.name) ?? str(r.business_name) ?? "Business",
        commission_pct: num(r.commission_pct),
    };
}

/** Tolerates flat or nested shapes (pricing / payment / customer / experience objects). */
export function financeBookingOf(raw: unknown): FinanceBooking {
    const r = obj(raw);
    const pricing = obj(r.pricing);
    const payment = obj(r.payment);
    const customer = obj(first(r.customer, r.user, r.contact));
    const experience = obj(r.experience);
    const business = obj(r.business);
    const status = str(first(payment.status, r.payment_status));
    return {
        id: str(first(r.id, r._id, r.booking_id)) ?? "",
        code: str(r.code),
        business_id: str(first(r.business_id, business.id)),
        business_name: str(first(r.business_name, business.name)),
        experience_id: str(first(r.experience_id, experience.id)),
        experience_title: str(first(r.experience_title, experience.title)),
        customer_id: str(first(r.user_id, customer.id, customer.user_id)),
        customer_name: str(first(customer.name, r.customer_name)),
        customer_phone: str(first(customer.phone, r.customer_phone)),
        customer_email: str(first(customer.email, r.customer_email)),
        people: num(first(r.total_people, r.people, pricing.people)),
        subtotal: num(first(pricing.subtotal, r.subtotal, r.taxable_value)),
        gst_amount: num(first(pricing.gst_amount, r.gst_amount, r.gst)),
        gst_rate_pct: num(first(pricing.gst_rate_pct, r.gst_rate_pct)),
        gst_inclusive: !!first(pricing.gst_inclusive, r.gst_inclusive),
        total: num(first(pricing.total, r.total, payment.amount, r.amount, r.total_amount)),
        commission_pct: num(r.commission_pct),
        commission: num(r.commission),
        net: num(r.net),
        payment_status: status && (PAYMENT_STATUSES as string[]).includes(status) ? (status as ExperiencePaymentStatus) : null,
        booking_status: str(r.status),
        order_id: str(first(payment.order_id, r.order_id, r.razorpay_order_id)),
        payment_id: str(first(payment.payment_id, r.payment_id, r.razorpay_payment_id)),
        refund_id: str(first(payment.refund_id, r.refund_id, r.razorpay_refund_id)),
        paid_at: str(first(payment.paid_at, r.paid_at)),
        refunded_at: str(first(payment.refunded_at, r.refunded_at)),
        starts_at: str(r.starts_at),
        created_at: str(r.created_at),
        source: str(r.source),
    };
}

function payoutOf(raw: unknown): BusinessPayout {
    const r = obj(raw);
    const by = obj(r.created_by_user);
    return {
        id: str(first(r.id, r._id)) ?? "",
        business_id: str(r.business_id),
        amount: num(r.amount) ?? 0,
        reference: str(r.reference),
        paid_on: str(r.paid_on),
        note: str(r.note),
        created_at: str(r.created_at),
        created_by: str(first(r.created_by, by.id)),
        created_by_name: str(first(r.created_by_name, by.name)),
    };
}

export const experiencePaymentsApi = {
    overview: (range: FinanceRange = {}) =>
        call<Raw>({ method: "get", url: `/api/v2/admin/experience-finance${qs({ ...range })}` }).then(
            (d): FinanceOverview => ({
                summary: summaryOf(d.summary),
                businesses: Array.isArray(d.businesses) ? d.businesses.map(businessRowOf) : [],
            })
        ),

    bookings: (params: FinanceBookingsParams = {}) =>
        call<Raw>({ method: "get", url: `/api/v2/admin/experience-finance/bookings${qs({ ...params })}` }).then((d): FinanceBookingsPage => {
            const bookings = Array.isArray(d.bookings) ? d.bookings.map(financeBookingOf) : [];
            const total = num(d.total) ?? bookings.length;
            const pageSize = num(d.page_size) ?? params.page_size ?? (bookings.length || 1);
            return {
                bookings,
                total,
                page: num(d.page) ?? params.page ?? 1,
                page_size: pageSize,
                total_pages: num(d.total_pages) ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
            };
        }),

    payouts: (businessId: string) =>
        call<Raw>({ method: "get", url: `/api/v2/admin/businesses/${enc(businessId)}/payouts` }).then((d) =>
            Array.isArray(d.payouts) ? d.payouts.map(payoutOf) : []
        ),

    recordPayout: (businessId: string, payload: RecordPayoutPayload) =>
        call<Raw>({ method: "post", url: `/api/v2/admin/businesses/${enc(businessId)}/payouts`, data: payload }).then((d) => payoutOf(d.payout)),
};

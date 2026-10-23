import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { Tag } from "@/components/ui/StatusPill";
import { formatDate, formatDateTime } from "@/utils/date";
import { inr, pct } from "../money";
import type { FinanceBooking } from "../types";
import { PaymentStatusPill } from "./PaymentStatusPill";

function RazorpayIds({ b }: { b: FinanceBooking }) {
    const ids = [
        { label: "Order", value: b.order_id },
        { label: "Payment", value: b.payment_id },
        { label: "Refund", value: b.refund_id },
    ].filter((x) => x.value);
    if (!ids.length) return <span className="text-ink-faint">—</span>;
    return (
        <span className="flex max-w-[15rem] flex-col gap-0.5 text-xs">
            {ids.map((x) => (
                <span key={x.label} className="flex min-w-0 items-center gap-1.5">
                    <span className="w-14 shrink-0 text-ink-faint">{x.label}</span>
                    <CopyText value={x.value} mono className="min-w-0" />
                </span>
            ))}
        </span>
    );
}

const money = (v: number | null) => <span className="whitespace-nowrap tabular-nums">{inr(v)}</span>;

/** Paid / refunded experience bookings with the money split and Razorpay ids. */
export function FinanceBookingsTable({
    rows,
    isLoading,
    isFetching,
    error,
    onRetry,
    showBusiness = true,
    footer,
    summary,
    filtered = false,
    storageKey,
    exportName,
    frame,
}: {
    rows: FinanceBooking[];
    isLoading?: boolean;
    isFetching?: boolean;
    error?: unknown;
    onRetry?: () => void;
    showBusiness?: boolean;
    footer?: ReactNode;
    summary?: ReactNode;
    filtered?: boolean;
    storageKey?: string;
    exportName?: string;
    frame?: "card" | "bare";
}) {
    const columns: DataColumn<FinanceBooking>[] = [
        {
            id: "booking",
            header: "Booking",
            hideable: false,
            sortValue: (b) => b.paid_at ?? b.created_at ?? "",
            csv: (b) => b.code ?? b.id,
            cell: (b) => (
                <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-ink">{b.code ?? b.id.slice(-8)}</div>
                    <div className="whitespace-nowrap text-xs text-ink-faint" title={formatDateTime(b.paid_at ?? b.created_at)}>
                        {formatDate(b.paid_at ?? b.created_at)}
                    </div>
                    {b.source === "offline" && <Tag className="mt-1">Offline</Tag>}
                </div>
            ),
        },
        ...(showBusiness
            ? [
                  {
                      id: "business",
                      header: "Business",
                      sortValue: (b: FinanceBooking) => b.business_name ?? "",
                      csv: (b: FinanceBooking) => b.business_name ?? b.business_id ?? "",
                      cell: (b: FinanceBooking) =>
                          b.business_id ? (
                              <Link to={`/collabs/businesses/${encodeURIComponent(b.business_id)}?tab=earnings`} className="font-medium text-accent-700 hover:underline">
                                  {b.business_name ?? "Business"}
                              </Link>
                          ) : (
                              (b.business_name ?? "—")
                          ),
                  } satisfies DataColumn<FinanceBooking>,
              ]
            : []),
        {
            id: "experience",
            header: "Experience",
            sortValue: (b) => b.experience_title ?? "",
            csv: (b) => b.experience_title ?? b.experience_id ?? "",
            cell: (b) => <IdLink kind="experience" id={b.experience_id} label={b.experience_title ?? undefined} className="line-clamp-2" />,
        },
        {
            id: "customer",
            header: "Customer",
            sortValue: (b) => b.customer_name ?? "",
            csv: (b) => b.customer_name ?? b.customer_id ?? "",
            cell: (b) => (
                <div className="min-w-0">
                    {b.customer_id ? <IdLink kind="user" id={b.customer_id} label={b.customer_name ?? undefined} /> : <span className="text-ink">{b.customer_name ?? "—"}</span>}
                    {b.customer_phone && <div className="text-xs text-ink-faint">{b.customer_phone}</div>}
                </div>
            ),
        },
        { id: "subtotal", header: "Subtotal", align: "right", sortValue: (b) => b.subtotal, cell: (b) => money(b.subtotal) },
        {
            id: "gst",
            header: "GST",
            align: "right",
            sortValue: (b) => b.gst_amount,
            cell: (b) => (
                <span className="whitespace-nowrap tabular-nums">
                    {b.gst_amount ? inr(b.gst_amount) : <span className="text-ink-faint">No GST</span>}
                    {!!b.gst_amount && b.gst_rate_pct !== null && <span className="ml-1 text-xs text-ink-faint">{pct(b.gst_rate_pct)}</span>}
                </span>
            ),
        },
        { id: "total", header: "Total", align: "right", sortValue: (b) => b.total, cell: (b) => <span className="font-medium">{money(b.total)}</span> },
        {
            id: "commission",
            header: "Commission",
            align: "right",
            sortValue: (b) => b.commission,
            cell: (b) => (
                <span className="whitespace-nowrap tabular-nums">
                    {inr(b.commission)}
                    {b.commission_pct !== null && <span className="ml-1 text-xs text-ink-faint">{pct(b.commission_pct)}</span>}
                </span>
            ),
        },
        { id: "net", header: "Business gets", align: "right", sortValue: (b) => b.net, cell: (b) => money(b.net) },
        { id: "payment", header: "Payment", sortValue: (b) => b.payment_status ?? "", cell: (b) => <PaymentStatusPill status={b.payment_status} /> },
        {
            id: "razorpay",
            header: "Razorpay",
            csv: (b) => [b.order_id, b.payment_id, b.refund_id].filter(Boolean).join(" "),
            cell: (b) => <RazorpayIds b={b} />,
        },
        {
            id: "refunded",
            header: "Refunded",
            defaultHidden: true,
            sortValue: (b) => b.refunded_at ?? "",
            csv: (b) => formatDateTime(b.refunded_at),
            cell: (b) => <span className="whitespace-nowrap text-ink-muted">{formatDate(b.refunded_at)}</span>,
        },
    ];

    return (
        <DataTable
            label="Experience payments"
            rows={rows}
            columns={columns}
            rowKey={(b) => b.id}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={onRetry}
            frame={frame}
            storageKey={storageKey}
            exportName={exportName}
            summary={summary}
            footer={footer}
            empty={{
                icon: ReceiptText,
                title: filtered ? "No payments match these filters" : "No paid bookings yet",
                description: filtered ? "Try clearing a filter." : "Bookings show here once travelers pay for them.",
            }}
            card={{
                title: (b) => (
                    <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{b.customer_name ?? b.code ?? "Booking"}</span>
                        <span className="shrink-0 tabular-nums">{inr(b.total)}</span>
                    </span>
                ),
                subtitle: (b) => [b.code, showBusiness ? b.business_name : null, b.experience_title, formatDate(b.paid_at ?? b.created_at)].filter(Boolean).join(" · "),
                fields: ["payment", "commission", "net", "razorpay"],
            }}
        />
    );
}

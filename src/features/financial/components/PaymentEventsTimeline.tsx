import { useQuery } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { PanelState } from "@/components/ui/States";
import { CountBadge } from "@/components/ui/StatusPill";
import { paymentEventsService } from "@/features/financial/services/payment-events.service";
import { formatDateTime } from "@/utils/date";
import { shortId } from "@/utils/format";
import { cx } from "@/utils/cx";
import { EventSourceTag } from "./TransactionStatusBadge";
import { eventErrorText } from "./paymentEvents";
import type { PaymentEvent } from "@/types";

interface PaymentEventsTimelineProps {
    transactionId?: string;
    refundId?: string;
    payoutId?: string;
    title?: string;
    /** Max events to fetch (default 50). */
    pageSize?: number;
}

function dotClass(event: PaymentEvent): string {
    const t = (event.event_type || "").toLowerCase();
    if (event.error || t.includes("fail") || t.includes("error")) return "bg-bad";
    if (t.includes("captur") || t.includes("complet") || t.includes("success") || t.includes("verif")) return "bg-good";
    if (t.includes("refund") || t.includes("cancel")) return "bg-warn";
    return "bg-ink-faint";
}

/**
 * Read-only audit timeline of payment events scoped to a single transaction,
 * refund, or payout. Reusable across the financial detail pages.
 */
export function PaymentEventsTimeline({ transactionId, refundId, payoutId, title = "Payment events", pageSize = 50 }: PaymentEventsTimelineProps) {
    const scope = { transaction_id: transactionId, refund_id: refundId, payout_id: payoutId };
    const enabled = Boolean(transactionId || refundId || payoutId);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["payment-events", scope, pageSize],
        queryFn: () => paymentEventsService.list({ ...scope, page: 1, page_size: pageSize }),
        enabled,
        staleTime: 60 * 1000,
    });

    const events = data?.events ?? [];

    return (
        <Panel
            title={
                <span className="flex items-center gap-2">
                    {title}
                    <CountBadge count={data?.total} tone="neutral" />
                </span>
            }
            icon={ReceiptText}
        >
            <PanelState
                isLoading={isLoading && enabled}
                error={error}
                isEmpty={events.length === 0}
                emptyIcon={ReceiptText}
                emptyText="No payment events recorded."
                onRetry={() => refetch()}
            >
                <ol className="relative ml-2 space-y-4 border-l border-line py-1">
                    {events.map((ev) => {
                        const err = eventErrorText(ev);
                        return (
                            <li key={ev._id} className="ml-4">
                                <span className={cx("absolute -left-[6.5px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-surface", dotClass(ev))} aria-hidden />
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-ink">{ev.event_type || "event"}</span>
                                    {ev.source && <EventSourceTag source={ev.source} />}
                                    <span className="text-xs text-ink-faint">{formatDateTime(ev.created_at)}</span>
                                </div>
                                {ev.razorpay_event_type && (
                                    <p className="mt-0.5 text-xs text-ink-muted">
                                        Razorpay: {ev.razorpay_event_type}
                                        {ev.razorpay_event_id ? ` · ${shortId(ev.razorpay_event_id)}` : ""}
                                    </p>
                                )}
                                {err && <p className="mt-1 break-words rounded-lg border border-bad-line bg-bad-soft px-2 py-1 text-xs text-bad">{err}</p>}
                            </li>
                        );
                    })}
                </ol>
            </PanelState>
        </Panel>
    );
}

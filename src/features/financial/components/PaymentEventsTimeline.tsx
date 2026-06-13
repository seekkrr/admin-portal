import { useQuery } from "@tanstack/react-query";
import { ReceiptText, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { paymentEventsService } from "@/features/financial/services/payment-events.service";
import { formatDateTime, shortId } from "@/utils/format";
import type { PaymentEvent } from "@/types";

interface PaymentEventsTimelineProps {
    transactionId?: string;
    refundId?: string;
    payoutId?: string;
    title?: string;
    /** Max events to fetch (default 50). */
    pageSize?: number;
}

const SOURCE_BADGE: Record<string, string> = {
    webhook: "bg-violet-50 text-violet-700 border-violet-200",
    api: "bg-blue-50 text-blue-700 border-blue-200",
    system: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

function eventToneClass(event: PaymentEvent): string {
    const t = (event.event_type || "").toLowerCase();
    if (event.error || t.includes("fail") || t.includes("error")) return "bg-red-400";
    if (t.includes("captur") || t.includes("complet") || t.includes("success") || t.includes("verif")) return "bg-emerald-400";
    if (t.includes("refund") || t.includes("cancel")) return "bg-amber-400";
    return "bg-neutral-300";
}

/**
 * Read-only audit timeline of payment events scoped to a single transaction,
 * refund, or payout. Reusable across the financial detail pages.
 */
export function PaymentEventsTimeline({
    transactionId,
    refundId,
    payoutId,
    title = "Payment Events",
    pageSize = 50,
}: PaymentEventsTimelineProps) {
    const scope = { transaction_id: transactionId, refund_id: refundId, payout_id: payoutId };
    const enabled = Boolean(transactionId || refundId || payoutId);

    const { data, isLoading, error } = useQuery({
        queryKey: ["payment-events", scope, pageSize],
        queryFn: () => paymentEventsService.list({ ...scope, page: 1, page_size: pageSize }),
        enabled,
        staleTime: 60 * 1000,
    });

    const events = data?.events ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-emerald-600" />
                    {title}
                    {data?.total ? (
                        <span className="text-xs font-normal text-neutral-400">({data.total})</span>
                    ) : null}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading && <p className="text-sm text-neutral-400 py-4">Loading audit log…</p>}
                {error && (
                    <p className="text-sm text-red-500 py-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Failed to load payment events.
                    </p>
                )}
                {!isLoading && !error && events.length === 0 && (
                    <p className="text-sm text-neutral-400 py-4">No payment events recorded.</p>
                )}
                {events.length > 0 && (
                    <ol className="relative border-l border-neutral-200 ml-2 space-y-4 py-1">
                        {events.map((ev) => (
                            <li key={ev._id} className="ml-4">
                                <span
                                    className={`absolute -left-[6.5px] mt-1.5 w-3 h-3 rounded-full ring-4 ring-white ${eventToneClass(ev)}`}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-neutral-800">
                                        {ev.event_type || "event"}
                                    </span>
                                    {ev.source && (
                                        <Badge
                                            label={ev.source}
                                            styles={SOURCE_BADGE[ev.source] ?? SOURCE_BADGE.system}
                                        />
                                    )}
                                    <span className="text-xs text-neutral-400">
                                        {formatDateTime(ev.created_at)}
                                    </span>
                                </div>
                                {ev.razorpay_event_type && (
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Razorpay: {ev.razorpay_event_type}
                                        {ev.razorpay_event_id ? ` · ${shortId(ev.razorpay_event_id)}` : ""}
                                    </p>
                                )}
                                {ev.error && (
                                    <p className="text-xs text-red-600 mt-1 bg-red-50 border border-red-100 rounded-lg px-2 py-1">
                                        {typeof ev.error === "object"
                                            ? JSON.stringify(ev.error)
                                            : String(ev.error)}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ReceiptText, Search, ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { paymentEventsService } from "@/features/financial/services/payment-events.service";
import { formatDateTime, shortId } from "@/utils/format";
import type { PaymentEvent } from "@/types";

const CAN_FINANCE = ["admin", "super_admin", "finance"];

const SOURCE_BADGE: Record<string, string> = {
    webhook: "bg-violet-50 text-violet-700 border-violet-200",
    api: "bg-blue-50 text-blue-700 border-blue-200",
    system: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

function RelatedId({ to, value }: { to: string; value: string | null }) {
    if (!value) return <span className="text-neutral-300">—</span>;
    return (
        <Link to={to} className="font-mono text-xs text-emerald-600 hover:underline" title={value}>
            {shortId(value, 6, 4)}
        </Link>
    );
}

function eventError(ev: PaymentEvent): string | null {
    if (!ev.error) return null;
    return typeof ev.error === "object" ? JSON.stringify(ev.error) : String(ev.error);
}

export function PaymentEventsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const canView = roles?.some((r) => CAN_FINANCE.includes(r));

    const [page, setPage] = useState(1);
    const [perPage] = useState(25);
    const [eventType, setEventType] = useState("");
    const [transactionId, setTransactionId] = useState("");
    const [refundId, setRefundId] = useState("");
    const [payoutId, setPayoutId] = useState("");

    const [debEventType, setDebEventType] = useState("");
    const [debTxnId, setDebTxnId] = useState("");
    const [debRefundId, setDebRefundId] = useState("");
    const [debPayoutId, setDebPayoutId] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebEventType(eventType.trim());
            setDebTxnId(transactionId.trim());
            setDebRefundId(refundId.trim());
            setDebPayoutId(payoutId.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [eventType, transactionId, refundId, payoutId]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-payment-events", {
            event_type: debEventType,
            transaction_id: debTxnId,
            refund_id: debRefundId,
            payout_id: debPayoutId,
            page,
        }],
        queryFn: () =>
            paymentEventsService.list({
                event_type: debEventType || undefined,
                transaction_id: debTxnId || undefined,
                refund_id: debRefundId || undefined,
                payout_id: debPayoutId || undefined,
                page,
                page_size: perPage,
            }),
        enabled: !!canView,
        staleTime: 5 * 60 * 1000,
    });

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16 bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                <ShieldAlert className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                <p className="text-sm text-neutral-500 mt-1">
                    You need a finance, admin, or super-admin role to view payment events.
                </p>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading payment events..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load payment events.</div>;

    const events = data?.events ?? [];

    const filterInput =
        "w-full pl-3 pr-3 py-2.5 rounded-xl border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                    <ReceiptText className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Payment Events</h1>
                    <p className="text-sm text-neutral-500">
                        Immutable audit log of gateway and money-movement events
                        {data && <span className="ml-2 text-neutral-400">· {data.total} total</span>}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Event type..."
                            className={`${filterInput} pl-10`}
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value)}
                        />
                    </div>
                    <input
                        type="text"
                        placeholder="Transaction ID..."
                        className={filterInput}
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Refund ID..."
                        className={filterInput}
                        value={refundId}
                        onChange={(e) => setRefundId(e.target.value)}
                    />
                    <input
                        type="text"
                        placeholder="Payout ID..."
                        className={filterInput}
                        value={payoutId}
                        onChange={(e) => setPayoutId(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                <th className="px-4 py-4 text-left">Event</th>
                                <th className="px-4 py-4 text-left">Source</th>
                                <th className="px-4 py-4 text-left">Transaction</th>
                                <th className="px-4 py-4 text-left">Refund</th>
                                <th className="px-4 py-4 text-left">Payout</th>
                                <th className="px-4 py-4 text-left">Razorpay</th>
                                <th className="px-4 py-4 text-left">Created</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                            {events.map((ev) => {
                                const err = eventError(ev);
                                return (
                                    <tr key={ev._id} className="hover:bg-neutral-50/80 transition-colors align-top">
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-neutral-900">{ev.event_type || "event"}</div>
                                            {err && (
                                                <div className="mt-1 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1 max-w-xs break-words">
                                                    {err}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            {ev.source ? (
                                                <Badge label={ev.source} styles={SOURCE_BADGE[ev.source] ?? SOURCE_BADGE.system} />
                                            ) : (
                                                <span className="text-neutral-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <RelatedId to={`/transactions/${ev.transaction_id}`} value={ev.transaction_id} />
                                        </td>
                                        <td className="px-4 py-4">
                                            <RelatedId to={`/refunds/${ev.refund_id}`} value={ev.refund_id} />
                                        </td>
                                        <td className="px-4 py-4">
                                            <RelatedId to={`/payouts/${ev.payout_id}`} value={ev.payout_id} />
                                        </td>
                                        <td className="px-4 py-4 text-neutral-600">
                                            {ev.razorpay_event_type ? (
                                                <div>
                                                    <div className="text-xs">{ev.razorpay_event_type}</div>
                                                    {ev.razorpay_event_id && (
                                                        <div className="text-[11px] text-neutral-400 font-mono">
                                                            {shortId(ev.razorpay_event_id)}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-neutral-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                            {formatDateTime(ev.created_at)}
                                        </td>
                                    </tr>
                                );
                            })}
                            {events.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <ReceiptText className="w-12 h-12 text-neutral-300 mb-4" />
                                            <p>No payment events found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {data && (
                    <Pagination
                        page={data.page}
                        totalPages={data.total_pages}
                        total={data.total}
                        onPageChange={setPage}
                    />
                )}
            </div>
        </div>
    );
}

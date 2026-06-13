import { useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Ban,
    ExternalLink,
    Wallet,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { payoutsService } from "../services/payouts.service";
import { PayoutStatusBadge } from "../components/PayoutAccountStatusBadge";
import { PaymentEventsTimeline } from "@/features/financial/components/PaymentEventsTimeline";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@/store/auth.store";
import { formatDateTime, formatDate, formatCurrency, shortId, orDash } from "@/utils/format";

const CAN_FINANCE = ["admin", "super_admin", "finance"];
const CAN_MANAGE = ["admin", "super_admin"];

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                {label}
            </dt>
            <dd className="mt-1 text-sm text-neutral-800 break-words">{children}</dd>
        </div>
    );
}

const inputCls =
    "w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:bg-white focus:border-transparent";

export function PayoutDetailPage() {
    const { payoutId: payoutIdParam } = useParams<{ payoutId: string }>();
    const payoutId = payoutIdParam ?? "";
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = roles?.some((r) => CAN_FINANCE.includes(r));
    const canManage = roles?.some((r) => CAN_MANAGE.includes(r));

    const [showProcess, setShowProcess] = useState(false);
    const [reference, setReference] = useState("");
    const [refError, setRefError] = useState("");
    const [showFail, setShowFail] = useState(false);
    const [failReason, setFailReason] = useState("");
    const [failError, setFailError] = useState("");
    const [confirmCancel, setConfirmCancel] = useState(false);

    const { data: payout, isLoading, error } = useQuery({
        queryKey: ["payout-detail", payoutId],
        queryFn: () => payoutsService.getById(payoutId),
        enabled: !!payoutId && !!canView,
        staleTime: 5 * 60 * 1000,
    });

    const creatorId = payout?.creator_id ?? "";
    const { data: summary } = useQuery({
        queryKey: ["payout-creator-summary", creatorId],
        queryFn: () => payoutsService.creatorSummary(creatorId),
        enabled: !!creatorId && !!canView,
        staleTime: 5 * 60 * 1000,
    });

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
        queryClient.invalidateQueries({ queryKey: ["payout-detail", payoutId] });
        queryClient.invalidateQueries({ queryKey: ["payment-events"] });
        if (creatorId) {
            queryClient.invalidateQueries({ queryKey: ["payout-creator-summary", creatorId] });
        }
    };

    const errMsg = (err: unknown, fallback: string) => {
        // The api interceptor rejects with a plain Error whose `message` carries
        // the backend's error/details string.
        const m = (err as { message?: string })?.message;
        return m && m.trim() ? m : fallback;
    };

    const processMutation = useMutation({
        mutationFn: () => payoutsService.process(payoutId, { reference_number: reference.trim() }),
        onSuccess: () => {
            invalidateAll();
            toast.success("Payout processed");
            setShowProcess(false);
            setReference("");
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to process payout")),
    });

    const failMutation = useMutation({
        mutationFn: () => payoutsService.fail(payoutId, { reason: failReason.trim() }),
        onSuccess: () => {
            invalidateAll();
            toast.success("Payout marked as failed");
            setShowFail(false);
            setFailReason("");
        },
        onError: (err: unknown) => toast.error(errMsg(err, "Failed to mark payout as failed")),
    });

    const cancelMutation = useMutation({
        mutationFn: () => payoutsService.cancel(payoutId),
        onSuccess: () => {
            invalidateAll();
            toast.success("Payout cancelled");
            setConfirmCancel(false);
        },
        onError: (err: unknown) => {
            toast.error(errMsg(err, "Failed to cancel payout"));
            setConfirmCancel(false);
        },
    });

    if (!canView) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">You do not have permission to view payouts.</p>
                <Link to="/payouts" className="text-emerald-600 hover:underline">
                    Back to Payouts
                </Link>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading payout..." />;
    if (error || !payout) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load payout or it does not exist.</p>
                <Link to="/payouts" className="text-emerald-600 hover:underline">
                    Back to Payouts
                </Link>
            </div>
        );
    }

    const canProcess =
        canManage && (payout.status === "pending" || payout.status === "processing");
    const canFail =
        canManage &&
        (payout.status === "pending" || payout.status === "processing");
    const canCancel = canManage && payout.status === "pending";

    const submitProcess = () => {
        if (reference.trim().length < 3) {
            setRefError("Reference number must be at least 3 characters.");
            return;
        }
        processMutation.mutate();
    };

    const submitFail = () => {
        if (failReason.trim().length < 3) {
            setFailError("Reason must be at least 3 characters.");
            return;
        }
        failMutation.mutate();
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link
                    to="/payouts"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Payouts
                </Link>
                <div className="flex items-center gap-2 flex-wrap">
                    {canProcess && (
                        <button
                            onClick={() => {
                                setReference(payout.reference_number ?? "");
                                setRefError("");
                                setShowProcess(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Process
                        </button>
                    )}
                    {canFail && (
                        <button
                            onClick={() => {
                                setFailReason("");
                                setFailError("");
                                setShowFail(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                            <XCircle className="w-4 h-4" />
                            Mark Failed
                        </button>
                    )}
                    {canCancel && (
                        <button
                            onClick={() => setConfirmCancel(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                        >
                            <Ban className="w-4 h-4" />
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Header card */}
            <Card>
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-xl font-bold text-neutral-900 font-mono">
                                {orDash(payout.payout_reference)}
                            </h1>
                            <p className="text-sm text-neutral-500 mt-0.5">
                                {formatCurrency(payout.amount, payout.currency)} ·{" "}
                                <span className="capitalize">
                                    {(payout.payout_method || "—")
                                        .toString()
                                        .replace(/_/g, " ")}
                                </span>
                            </p>
                        </div>
                        <PayoutStatusBadge status={payout.status} />
                    </div>
                </CardContent>
            </Card>

            {/* Creator summary */}
            {summary && (
                <Card>
                    <CardHeader className="border-b border-neutral-100 pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                            Creator Payout Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-xl border border-neutral-100 bg-neutral-50/40 p-4">
                                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Total Earnings
                                </p>
                                <p className="text-lg font-bold text-neutral-800 mt-1">
                                    {formatCurrency(summary.total_earnings, payout.currency)}
                                </p>
                            </div>
                            <div className="rounded-xl border border-neutral-100 bg-neutral-50/40 p-4">
                                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Total Paid
                                </p>
                                <p className="text-lg font-bold text-emerald-700 mt-1">
                                    {formatCurrency(summary.total_paid, payout.currency)}
                                </p>
                            </div>
                            <div className="rounded-xl border border-neutral-100 bg-neutral-50/40 p-4">
                                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Pending Balance
                                </p>
                                <p className="text-lg font-bold text-amber-700 mt-1">
                                    {formatCurrency(summary.pending_balance, payout.currency)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Details */}
            <Card>
                <CardHeader className="border-b border-neutral-100 pb-4">
                    <CardTitle className="text-base">Payout Details</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                        <Field label="Creator">
                            <Link
                                to={`/creators/${payout.creator_id}`}
                                className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-mono"
                            >
                                {shortId(payout.creator_id)}
                                <ExternalLink className="w-3 h-3" />
                            </Link>
                        </Field>
                        <Field label="Initiated By">
                            {payout.initiated_by ? (
                                <span className="font-mono">{shortId(payout.initiated_by)}</span>
                            ) : (
                                "—"
                            )}
                        </Field>
                        <Field label="Amount">
                            {formatCurrency(payout.amount, payout.currency)}
                        </Field>
                        <Field label="Reference Number (UTR/NEFT)">
                            {orDash(payout.reference_number)}
                        </Field>
                        <Field label="UPI ID (masked)">
                            <span className="font-mono">{orDash(payout.upi_id)}</span>
                        </Field>
                        <Field label="Bank Account (masked)">
                            {payout.bank_account ? (
                                <span className="font-mono text-xs break-all">
                                    {JSON.stringify(payout.bank_account)}
                                </span>
                            ) : (
                                "—"
                            )}
                        </Field>
                        <Field label="Period Start">{formatDate(payout.period_start)}</Field>
                        <Field label="Period End">{formatDate(payout.period_end)}</Field>
                        <Field label="Created">{formatDateTime(payout.created_at)}</Field>
                        <Field label="Processed At">{formatDateTime(payout.processed_at)}</Field>
                        <Field label="Razorpay Payout ID">
                            {orDash(payout.razorpay_payout_id)}
                        </Field>
                        <Field label="Razorpay Fund Account">
                            {orDash(payout.razorpay_fund_account_id)}
                        </Field>
                        <Field label="Razorpay Contact">
                            {orDash(payout.razorpay_contact_id)}
                        </Field>
                        {payout.notes && (
                            <div className="sm:col-span-2">
                                <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Notes
                                </dt>
                                <dd className="mt-1 text-sm text-neutral-700 whitespace-pre-wrap">
                                    {payout.notes}
                                </dd>
                            </div>
                        )}
                        {payout.failure_reason && (
                            <div className="sm:col-span-2">
                                <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Failure Reason
                                </dt>
                                <dd className="mt-1 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    {payout.failure_reason}
                                </dd>
                            </div>
                        )}
                        {payout.earnings_snapshot && (
                            <div className="sm:col-span-2">
                                <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                                    Earnings Snapshot
                                </dt>
                                <dd className="mt-1">
                                    <pre className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2 overflow-x-auto">
                                        {JSON.stringify(payout.earnings_snapshot, null, 2)}
                                    </pre>
                                </dd>
                            </div>
                        )}
                    </dl>
                </CardContent>
            </Card>

            {/* Audit timeline */}
            <PaymentEventsTimeline payoutId={payoutId} title="Payout Events" />

            {/* Process modal */}
            {showProcess && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[3px] animate-fade-in p-4"
                    onClick={() => setShowProcess(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl ring-1 ring-neutral-900/5 w-full max-w-md p-6 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-neutral-900 mb-1">Process Payout</h3>
                        <p className="text-sm text-neutral-500 mb-4">
                            Enter the bank reference (UTR / NEFT) to mark this{" "}
                            {formatCurrency(payout.amount, payout.currency)} disbursement as
                            processed.
                        </p>
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                            Reference Number
                        </label>
                        <input
                            className={inputCls}
                            value={reference}
                            placeholder="UTR / NEFT reference"
                            onChange={(e) => {
                                setReference(e.target.value);
                                if (refError) setRefError("");
                            }}
                        />
                        {refError && <p className="text-xs text-red-600 mt-1">{refError}</p>}
                        <div className="flex gap-2.5 mt-5">
                            <button
                                onClick={() => setShowProcess(false)}
                                className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-all flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitProcess}
                                disabled={processMutation.isPending}
                                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex-1 flex items-center justify-center gap-2"
                            >
                                {processMutation.isPending && (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                )}
                                Confirm & Process
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fail modal (type-CONFIRM) */}
            <ConfirmModal
                open={showFail}
                title="Mark Payout as Failed"
                message="Record this disbursement as failed. This is irreversible and will be logged in the audit trail."
                confirmLabel="Mark Failed"
                confirmStyle="bg-red-600 hover:bg-red-700"
                theme="danger"
                onConfirm={submitFail}
                onCancel={() => setShowFail(false)}
                isPending={failMutation.isPending}
                disabledConfirm={failReason.trim().length < 3}
            >
                <div className="mb-3">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">
                        Failure Reason
                    </label>
                    <textarea
                        value={failReason}
                        onChange={(e) => {
                            setFailReason(e.target.value);
                            if (failError) setFailError("");
                        }}
                        rows={3}
                        placeholder="Why did this payout fail?"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:bg-white focus:border-transparent resize-none"
                    />
                    {failError && <p className="text-xs text-red-600 mt-1">{failError}</p>}
                </div>
            </ConfirmModal>

            {/* Cancel confirm (type-CONFIRM) */}
            <ConfirmModal
                open={confirmCancel}
                title="Cancel Payout"
                message="Cancel this pending payout? This cannot be undone."
                confirmLabel="Cancel Payout"
                confirmStyle="bg-red-600 hover:bg-red-700"
                theme="danger"
                onConfirm={() => cancelMutation.mutate()}
                onCancel={() => setConfirmCancel(false)}
                isPending={cancelMutation.isPending}
            />
        </div>
    );
}

import { type ReactNode, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, RefreshCw, Award, DollarSign, Eye,
    TrendingUp, CreditCard, Shield, CheckCircle2,
    AlertTriangle, Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/features/users/components/Badge";
import { ConfirmModal } from "@/features/users/components/ConfirmModal";
import { creatorsService } from "../services/creators.service";
import { PayoutForm } from "../components/PayoutForm";
import type { PayoutAccountRequest } from "../services/creators.service";
import { useState } from "react";

// ---- Creator verification statuses ----
const CREATOR_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    pending: { label: "Pending", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    approved: { label: "Approved", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
    suspended: { label: "Suspended", dot: "bg-neutral-500", bg: "bg-neutral-100 text-neutral-700 border-neutral-300" },
};

// ---- Discriminated union for confirm actions ----
type ConfirmAction =
    | { type: "status-change"; payload: { status: "pending" | "approved" | "rejected" | "suspended" } };

export function CreatorEditPage() {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [editingPayout, setEditingPayout] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

    // ---- Fetch creator details ----
    const { data, isLoading, error } = useQuery({
        queryKey: ["creator-detail", userId],
        queryFn: () => creatorsService.getCreatorDetails(userId!),
        enabled: !!userId,
    });

    const creator = data?.creator_profile;
    const user = data?.user_profile;
    const stats = data?.stats;
    const payout = data?.payout_account;
    const sc = creator ? statusConfig[creator.status] ?? statusConfig.pending : null;

    // ---- Status mutation ----
    const statusMutation = useMutation({
        mutationFn: ({ status }: { status: "pending" | "approved" | "rejected" | "suspended" }) =>
            creatorsService.updateCreatorStatus(userId!, status),
        onSuccess: () => {
            toast.success("Creator status updated");
            queryClient.invalidateQueries({ queryKey: ["creator-detail", userId] });
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
            setConfirmAction(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmAction(null);
        },
    });

    // ---- Payout mutations ----
    const addPayoutMutation = useMutation({
        mutationFn: (data: PayoutAccountRequest) =>
            creatorsService.addPayoutAccount(userId!, data),
        onSuccess: () => {
            toast.success("Payout account added");
            queryClient.invalidateQueries({ queryKey: ["creator-detail", userId] });
            setEditingPayout(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const updatePayoutMutation = useMutation({
        mutationFn: (data: PayoutAccountRequest) =>
            creatorsService.updatePayoutAccount(userId!, data),
        onSuccess: () => {
            toast.success("Payout account updated");
            queryClient.invalidateQueries({ queryKey: ["creator-detail", userId] });
            setEditingPayout(false);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const handlePayoutSubmit = useCallback(
        (data: PayoutAccountRequest) => {
            if (payout) {
                updatePayoutMutation.mutate(data);
            } else {
                addPayoutMutation.mutate(data);
            }
        },
        [payout, addPayoutMutation, updatePayoutMutation]
    );

    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        if (confirmAction.type === "status-change") {
            statusMutation.mutate({ status: confirmAction.payload.status });
        }
    }, [confirmAction, statusMutation]);

    const payoutPending = addPayoutMutation.isPending || updatePayoutMutation.isPending;

    // ---- Render ----
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-red-500 gap-3">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm">Failed to load creator details</p>
                <button
                    onClick={() => navigate("/creators")}
                    className="text-sm text-indigo-600 hover:underline"
                >
                    Back to Creators
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[960px] mx-auto space-y-6 animate-fade-in">
            {/* Back Button + Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate("/creators")}
                    className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-neutral-900">
                        {user?.first_name} {user?.last_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        {sc && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {sc.label}
                            </span>
                        )}
                        {creator?.is_verified && (
                            <Badge label="Verified" styles="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        )}
                        <span className="text-xs text-neutral-400 font-mono ml-2">{userId}</span>
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Creator Stats
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                        icon={<Award className="w-5 h-5 text-indigo-500" />}
                        label="Total Quests"
                        value={stats?.total_quests ?? 0}
                    />
                    <StatCard
                        icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
                        label="Total Earnings"
                        value={`₹${(stats?.total_earnings ?? 0).toLocaleString("en-IN")}`}
                    />
                    <StatCard
                        icon={<Eye className="w-5 h-5 text-violet-500" />}
                        label="Impressions"
                        value={(stats?.impressions ?? 0).toLocaleString()}
                    />
                </div>
            </section>

            {/* Creator Status Management */}
            <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Verification Status
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CREATOR_STATUSES.map((status) => {
                        const cfg = statusConfig[status];
                        const isCurrent = creator?.status === status;
                        return (
                            <button
                                key={status}
                                disabled={isCurrent || statusMutation.isPending}
                                onClick={() =>
                                    setConfirmAction({
                                        type: "status-change",
                                        payload: { status },
                                    })
                                }
                                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all
                                    ${isCurrent
                                        ? `${cfg?.bg ?? ""} cursor-default`
                                        : "border-neutral-200 hover:border-teal-300 hover:bg-teal-50/50 text-neutral-700"
                                    }
                                    disabled:opacity-50`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${cfg?.dot ?? ""}`} />
                                    <span className="capitalize">{cfg?.label ?? status}</span>
                                </div>
                                {isCurrent && (
                                    <CheckCircle2 className="w-4 h-4 text-current opacity-60" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Payout Management */}
            <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Payout Account
                    </h2>
                    {payout && !editingPayout && (
                        <button
                            onClick={() => setEditingPayout(true)}
                            className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
                        >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                    )}
                </div>

                {editingPayout || !payout ? (
                    <PayoutForm
                        existingPayout={payout ?? null}
                        isPending={payoutPending}
                        onSubmit={handlePayoutSubmit}
                        onCancel={() => {
                            if (payout) {
                                setEditingPayout(false);
                            } else {
                                navigate("/creators");
                            }
                        }}
                    />
                ) : (
                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5 space-y-3 text-sm">
                        <PayoutRow label="Method" value={<span className="capitalize">{payout.method}</span>} />
                        {payout.method === "bank" && payout.bank_details && (
                            <>
                                <PayoutRow label="Account Holder" value={payout.bank_details.account_holder} />
                                <PayoutRow label="Account Number" value={<span className="font-mono">••{String(payout.bank_details.account_number).slice(-4)}</span>} />
                                <PayoutRow label="IFSC Code" value={<span className="font-mono">{payout.bank_details.ifsc_code}</span>} />
                            </>
                        )}
                        {payout.method === "upi" && payout.upi_id && (
                            <PayoutRow label="UPI ID" value={<span className="font-mono">{payout.upi_id}</span>} />
                        )}
                        <PayoutRow label="Currency" value={payout.currency} />
                    </div>
                )}
            </section>

            {/* Status Change Confirmation Modal */}
            <ConfirmModal
                open={confirmAction?.type === "status-change"}
                title="Change Creator Status"
                message={`You are about to change this creator's status to "${confirmAction?.type === "status-change"
                    ? confirmAction.payload.status
                    : ""
                    }". This will take effect immediately.`}
                confirmLabel="Change Status"
                confirmStyle="bg-teal-600 hover:bg-teal-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={statusMutation.isPending}
            />

            {/* Loading overlay for mutations */}
            {(statusMutation.isPending || payoutPending) && !confirmAction && (
                <div className="fixed inset-0 z-40 bg-white/60 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                </div>
            )}
        </div>
    );
}

// ---- Stat Card ----
function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
    return (
        <div className="bg-gradient-to-br from-neutral-50 to-white rounded-xl border border-neutral-200 p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-white border border-neutral-100 flex items-center justify-center shadow-sm">
                {icon}
            </div>
            <div>
                <div className="text-xl font-bold text-neutral-900">{value}</div>
                <div className="text-xs text-neutral-500">{label}</div>
            </div>
        </div>
    );
}

// ---- Payout Row ----
function PayoutRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-neutral-500">{label}</span>
            <span className="font-medium text-neutral-800">{value}</span>
        </div>
    );
}

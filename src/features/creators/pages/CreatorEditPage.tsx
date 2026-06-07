import { type ReactNode, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, RefreshCw, Award, DollarSign,
    TrendingUp, Shield, CheckCircle2,
    AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/features/users/components/Badge";
import { ConfirmModal } from "@/features/users/components/ConfirmModal";
import { AccessDenied } from "@components/AccessDenied";
import { useAuthStore } from "@store/auth.store";
import { creatorsService } from "../services/creators.service";

// ---- Creator verification statuses ----
const CREATOR_STATUSES = ["active", "suspended", "rejected"] as const;

const statusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    active: { label: "Active", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
    suspended: { label: "Suspended", dot: "bg-neutral-500", bg: "bg-neutral-100 text-neutral-700 border-neutral-300" },
};

type ConfirmAction =
    | { type: "status-change"; payload: { status: "active" | "rejected" | "suspended" } }
    | { type: "verify"; payload: { is_verified: boolean } };

const ALLOWED_ROLES = ["admin", "super_admin", "finance"];

export function CreatorEditPage() {
    const { creatorId } = useParams<{ creatorId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuthStore();
    const hasAccess = !!currentUser && currentUser.role?.some(r => ALLOWED_ROLES.includes(r as any));

    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

    // ---- Fetch creator by creator ID ----
    const { data: creator, isLoading, error } = useQuery({
        queryKey: ["creator-detail", creatorId],
        queryFn: () => creatorsService.getCreator(creatorId!),
        enabled: !!creatorId,
    });

    const sc = creator ? statusConfig[creator.status] ?? statusConfig.active : null;
    const displayName = creator?.name ?? creatorId ?? "Creator";

    // ---- Update mutation (status + is_verified) ----
    const updateMutation = useMutation({
        mutationFn: (updates: { status?: string; is_verified?: boolean }) =>
            creatorsService.updateCreator(creatorId!, updates),
        onSuccess: () => {
            toast.success("Creator updated");
            queryClient.invalidateQueries({ queryKey: ["creator-detail", creatorId] });
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
            setConfirmAction(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmAction(null);
        },
    });

    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        if (confirmAction.type === "status-change") {
            updateMutation.mutate({ status: confirmAction.payload.status });
        } else if (confirmAction.type === "verify") {
            updateMutation.mutate({ is_verified: confirmAction.payload.is_verified });
        }
    }, [confirmAction, updateMutation]);

    // ---- Render ----
    if (!hasAccess) {
        return <AccessDenied message="Only admins and finance can access this page." />;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
            </div>
        );
    }

    if (error || !creator) {
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
                    <h1 className="text-2xl font-bold text-neutral-900">{displayName}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        {sc && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {sc.label}
                            </span>
                        )}
                        {creator.is_verified && (
                            <Badge label="Verified" styles="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        )}
                        <span className="text-xs text-neutral-400 font-mono ml-2">{creatorId}</span>
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
                        value={creator.total_quests ?? 0}
                    />
                    <StatCard
                        icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
                        label="Total Earnings"
                        value={`₹${(creator.total_earnings ?? 0).toLocaleString("en-IN")}`}
                    />
                    <StatCard
                        icon={<Award className="w-5 h-5 text-violet-500" />}
                        label="Rating"
                        value={creator.rating ?? "—"}
                    />
                </div>
            </section>

            {/* Creator Status Management */}
            <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Verification Status
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {CREATOR_STATUSES.map((status) => {
                        const cfg = statusConfig[status];
                        const isCurrent = creator.status === status;
                        return (
                            <button
                                key={status}
                                disabled={isCurrent || updateMutation.isPending}
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

                {/* Verification toggle */}
                <div className="pt-4 border-t border-neutral-100">
                    <button
                        disabled={updateMutation.isPending}
                        onClick={() => setConfirmAction({ type: "verify", payload: { is_verified: !creator.is_verified } })}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
                            creator.is_verified
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {creator.is_verified ? "Verified — click to unverify" : "Not verified — click to verify"}
                    </button>
                </div>
            </section>

            {/* Status Change Confirmation Modal */}
            <ConfirmModal
                open={confirmAction?.type === "status-change"}
                title="Change Creator Status"
                message={`Change this creator's status to "${confirmAction?.type === "status-change" ? confirmAction.payload.status : ""}"?`}
                confirmLabel="Change Status"
                confirmStyle="bg-teal-600 hover:bg-teal-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={updateMutation.isPending}
                theme="warning"
            />

            <ConfirmModal
                open={confirmAction?.type === "verify"}
                title={confirmAction?.type === "verify" && confirmAction.payload.is_verified ? "Verify Creator" : "Unverify Creator"}
                message={confirmAction?.type === "verify" && confirmAction.payload.is_verified
                    ? "Mark this creator as verified? They will be eligible for payouts."
                    : "Remove verification from this creator?"}
                confirmLabel={confirmAction?.type === "verify" && confirmAction.payload.is_verified ? "Verify" : "Unverify"}
                confirmStyle="bg-emerald-600 hover:bg-emerald-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={updateMutation.isPending}
            />

            {/* Loading overlay */}
            {updateMutation.isPending && !confirmAction && (
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

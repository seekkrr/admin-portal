import { type ReactNode, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    X, RefreshCw, TrendingUp,
    DollarSign, Award, CheckCircle2, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { creatorsService } from "../services/creators.service";

// ---- Status/Verification styles ----
const creatorStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    active: { label: "Active", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
    suspended: { label: "Suspended", dot: "bg-neutral-500", bg: "bg-neutral-100 text-neutral-700 border-neutral-300" },
};

interface CreatorDetailModalProps {
    open: boolean;
    creatorId: string | null;
    displayName: string;
    onClose: () => void;
}

export function CreatorDetailModal({
    open, creatorId, displayName, onClose,
}: CreatorDetailModalProps) {
    const queryClient = useQueryClient();

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    const { data: creator, isLoading, error } = useQuery({
        queryKey: ["creator-detail", creatorId],
        queryFn: () => creatorsService.getCreator(creatorId ?? ""),
        enabled: open && !!creatorId,
    });

    const updateMutation = useMutation({
        mutationFn: ({ status, is_verified }: { status?: string; is_verified?: boolean }) =>
            creatorsService.updateCreator(creatorId ?? "", { status, is_verified }),
        onSuccess: () => {
            toast.success("Creator updated");
            queryClient.invalidateQueries({ queryKey: ["creator-detail", creatorId] });
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
        },
        onError: (err: Error) => toast.error(err.message),
    });

    if (!open || !creatorId) return null;

    const sc = creator ? creatorStatusConfig[creator.status] ?? creatorStatusConfig.active : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 animate-slide-up overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-gradient-to-r from-teal-50/50 to-white">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900">{displayName}</h3>
                        {creator && sc && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                    {sc.label}
                                </span>
                                {creator.is_verified && (
                                    <Badge label="Verified" styles="bg-emerald-50 text-emerald-700 border-emerald-200" />
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500 text-sm">Failed to load creator details</div>
                    ) : creator ? (
                        <>
                            {/* Stats */}
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> Stats
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <StatCard icon={<Award className="w-4 h-4 text-indigo-500" />} label="Quests" value={creator.total_quests ?? 0} />
                                    <StatCard icon={<DollarSign className="w-4 h-4 text-emerald-500" />} label="Earnings" value={`₹${(creator.total_earnings ?? 0).toLocaleString("en-IN")}`} />
                                    <StatCard icon={<Award className="w-4 h-4 text-violet-500" />} label="Rating" value={creator.rating ?? "—"} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <StatCard icon={<DollarSign className="w-4 h-4 text-orange-500" />} label="Pending Payout" value={`₹${(creator.pending_payouts ?? 0).toLocaleString("en-IN")}`} />
                                    <StatCard icon={<Award className="w-4 h-4 text-teal-500" />} label="Travelers" value={creator.travelers_served ?? 0} />
                                </div>
                            </div>

                            {/* Bio */}
                            {creator.tagline && (
                                <div>
                                    <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">Tagline</h4>
                                    <p className="text-sm text-neutral-700 italic">"{creator.tagline}"</p>
                                </div>
                            )}

                            {/* Admin Actions */}
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Admin Actions
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {(["active", "suspended", "rejected"] as const).map((s) => (
                                        <button
                                            key={s}
                                            disabled={creator.status === s || updateMutation.isPending}
                                            onClick={() => updateMutation.mutate({ status: s })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                                                creator.status === s
                                                    ? (creatorStatusConfig[s]?.bg ?? "") + " cursor-default"
                                                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                                            }`}
                                        >
                                            {creator.status === s ? `✓ ${creatorStatusConfig[s]?.label ?? s}` : `Set ${creatorStatusConfig[s]?.label ?? s}`}
                                        </button>
                                    ))}
                                    <button
                                        disabled={updateMutation.isPending}
                                        onClick={() => updateMutation.mutate({ is_verified: !creator.is_verified })}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-40"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {creator.is_verified ? "Unverify" : "Verify"}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---- Small Stat Card ----
function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
    return (
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
            <div className="flex items-center justify-center mb-1.5">{icon}</div>
            <div className="text-lg font-bold text-neutral-900">{value}</div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">{label}</div>
        </div>
    );
}


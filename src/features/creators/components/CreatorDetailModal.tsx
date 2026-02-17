import { type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    X, ExternalLink, RefreshCw, TrendingUp,
    DollarSign, Eye, Award, CreditCard,
} from "lucide-react";
import { Badge } from "@/features/users/components/Badge";
import { creatorsService } from "../services/creators.service";

// ---- Status/Verification styles ----
const creatorStatusConfig: Record<string, { label: string; dot: string; bg: string }> = {
    pending: { label: "Pending", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    approved: { label: "Approved", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Rejected", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200" },
    suspended: { label: "Suspended", dot: "bg-neutral-500", bg: "bg-neutral-100 text-neutral-700 border-neutral-300" },
};

interface CreatorDetailModalProps {
    open: boolean;
    userId: string | null;
    userName: string;
    onClose: () => void;
}

/**
 * Read-only quick-view modal for a creator's stats and payout summary.
 * "Manage Creator" navigates to the full edit page.
 */
export function CreatorDetailModal({
    open, userId, userName, onClose,
}: CreatorDetailModalProps) {
    const navigate = useNavigate();

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["creator-detail", userId],
        queryFn: () => creatorsService.getCreatorDetails(userId!),
        enabled: open && !!userId,
    });

    if (!open || !userId) return null;

    const creator = data?.creator_profile;
    const stats = data?.stats;
    const payout = data?.payout_account;
    const sc = creator ? creatorStatusConfig[creator.status] ?? creatorStatusConfig.pending : null;

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
                        <h3 className="text-lg font-bold text-neutral-900">{userName}</h3>
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
                    ) : (
                        <>
                            {/* Stats */}
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" /> Stats
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <StatCard icon={<Award className="w-4 h-4 text-indigo-500" />} label="Quests" value={stats?.total_quests ?? 0} />
                                    <StatCard icon={<DollarSign className="w-4 h-4 text-emerald-500" />} label="Earnings" value={`₹${(stats?.total_earnings ?? 0).toLocaleString("en-IN")}`} />
                                    <StatCard icon={<Eye className="w-4 h-4 text-violet-500" />} label="Impressions" value={(stats?.impressions ?? 0).toLocaleString()} />
                                </div>
                            </div>

                            {/* Payout Summary */}
                            <div>
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" /> Payout
                                </h4>
                                {payout ? (
                                    <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 text-sm space-y-1.5">
                                        <div className="flex justify-between">
                                            <span className="text-neutral-500">Method</span>
                                            <span className="font-medium text-neutral-800 capitalize">{payout.method}</span>
                                        </div>
                                        {payout.method === "bank" && payout.bank_details && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">Account Holder</span>
                                                    <span className="font-medium text-neutral-800">{payout.bank_details.account_holder}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">IFSC</span>
                                                    <span className="font-mono text-neutral-800">{payout.bank_details.ifsc_code}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-neutral-500">Account</span>
                                                    <span className="font-mono text-neutral-800">••{String(payout.bank_details.account_number).slice(-4)}</span>
                                                </div>
                                            </>
                                        )}
                                        {payout.method === "upi" && payout.upi_id && (
                                            <div className="flex justify-between">
                                                <span className="text-neutral-500">UPI ID</span>
                                                <span className="font-mono text-neutral-800">{payout.upi_id}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-neutral-500">Currency</span>
                                            <span className="font-medium text-neutral-800">{payout.currency}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-neutral-400 italic">No payout account configured</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            onClose();
                            navigate(`/creators/${userId}`);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                        <ExternalLink className="w-4 h-4" /> Manage Creator
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

import { useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Tag, Power, Trash2, ShieldAlert, Receipt } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { couponsService } from "../services/coupons.service";
import { formatCurrency, formatDateTime, orDash } from "@/utils/format";

const CAN_VIEW_ROLES = ["admin", "super_admin", "finance"];
const CAN_MANAGE_ROLES = ["admin", "super_admin"];

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="w-40 shrink-0 font-medium text-neutral-500">{label}</span>
            <span className="text-neutral-800 break-all">{value}</span>
        </div>
    );
}

/** Render a coupon's discount as `50%`, `₹100`, or `15–30%`. */
function renderDiscount(discountType: string, value: number | null, min: number | null, max: number | null, currency: string): string {
    if (discountType === "flat") return formatCurrency(value ?? 0, currency);
    if (discountType === "percent") return `${value ?? 0}%`;
    return `${min ?? 0}–${max ?? 0}%`;
}

export function CouponDetailPage() {
    const { couponId: param } = useParams<{ couponId: string }>();
    const couponId = param ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = roles?.some((r) => CAN_VIEW_ROLES.includes(r));
    const canManage = roles?.some((r) => CAN_MANAGE_ROLES.includes(r));

    const [showDelete, setShowDelete] = useState(false);
    const [redemptionsPage, setRedemptionsPage] = useState(1);

    const { data: coupon, isLoading, error } = useQuery({
        queryKey: ["coupon-detail", couponId],
        queryFn: () => couponsService.getById(couponId),
        enabled: !!couponId && !!canView,
        staleTime: 60 * 1000,
    });

    const redemptionsQuery = useQuery({
        queryKey: ["coupon-redemptions", couponId, redemptionsPage],
        queryFn: () => couponsService.listRedemptions(couponId, { page: redemptionsPage, page_size: 20 }),
        enabled: !!couponId && !!canView,
        staleTime: 60 * 1000,
    });

    const toggleActiveMutation = useMutation({
        mutationFn: () => couponsService.update(couponId, { is_active: !coupon?.is_active }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["coupon-detail", couponId] });
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon updated");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update coupon"),
    });

    const deleteMutation = useMutation({
        mutationFn: () => couponsService.remove(couponId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon deleted");
            navigate("/coupons", { replace: true });
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete coupon");
            setShowDelete(false);
        },
    });

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16 bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                <ShieldAlert className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                <p className="text-sm text-neutral-500 mt-1">
                    You need a finance, admin, or super-admin role to view this coupon.
                </p>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading coupon..." />;
    if (error || !coupon) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load coupon or it does not exist.</p>
                <Link to="/coupons" className="text-violet-600 hover:underline">Back to Coupons</Link>
            </div>
        );
    }

    const redemptions = redemptionsQuery.data?.redemptions ?? [];
    const redemptionsTotalPages = redemptionsQuery.data?.total_pages ?? 1;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Link
                    to="/coupons"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                {canManage && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => toggleActiveMutation.mutate()}
                            disabled={toggleActiveMutation.isPending}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50"
                        >
                            <Power className="w-4 h-4" />
                            {coupon.is_active ? "Expire" : "Activate"}
                        </button>
                        <button
                            onClick={() => setShowDelete(true)}
                            disabled={deleteMutation.isPending}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                        <div className="bg-violet-100 text-violet-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                            <Tag className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-neutral-900 font-mono">{coupon.code}</h1>
                            <p className="text-neutral-500 mt-1 flex items-center gap-2 flex-wrap">
                                <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                        coupon.is_active
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-neutral-50 text-neutral-600 border-neutral-200"
                                    }`}
                                >
                                    {coupon.is_active ? "Active" : "Inactive"}
                                </span>
                                <span>{coupon.name}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Discount</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Type" value={<span className="capitalize">{coupon.discount_type.replace(/_/g, " ")}</span>} />
                    <DetailRow
                        label="Value"
                        value={renderDiscount(
                            coupon.discount_type,
                            coupon.discount_value,
                            coupon.discount_min,
                            coupon.discount_max,
                            coupon.currency
                        )}
                    />
                    <DetailRow
                        label="Applies to"
                        value={
                            coupon.link_item === "all" ? (
                                "All quests"
                            ) : coupon.link_id ? (
                                <Link to={`/quests/${coupon.link_id}`} className="font-mono text-xs text-violet-600 hover:underline">
                                    {coupon.link_id}
                                </Link>
                            ) : (
                                orDash(null)
                            )
                        }
                    />
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Limits & Usage</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Per-user limit" value={String(coupon.per_user_limit)} />
                    <DetailRow label="Max redemptions" value={coupon.max_redemptions !== null ? String(coupon.max_redemptions) : "Unlimited"} />
                    <DetailRow label="Redeemed so far" value={String(coupon.redemption_count)} />
                    <DetailRow label="Expires" value={coupon.expires_at ? formatDateTime(coupon.expires_at) : "Never"} />
                    <DetailRow label="Currency" value={orDash(coupon.currency)} />
                    <DetailRow label="Created" value={formatDateTime(coupon.created_at)} />
                    <DetailRow label="ID" value={<span className="font-mono text-xs">{coupon._id}</span>} />
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-violet-600" />
                        Redemptions
                    </h3>
                </div>
                {redemptionsQuery.isLoading ? (
                    <div className="p-6 text-center text-neutral-500 text-sm">Loading redemptions...</div>
                ) : redemptionsQuery.error ? (
                    <div className="p-6 text-center text-red-500 text-sm">Failed to load redemptions.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-neutral-200 text-sm">
                            <thead className="bg-neutral-50/60 border-b border-neutral-100">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">User</th>
                                    <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">Before</th>
                                    <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">Discount</th>
                                    <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">Final</th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">Redeemed</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {redemptions.map((r, idx) => (
                                    <tr key={`${r.user_id}-${r.created_at}-${idx}`} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <Link to={`/users/${r.user_id}`} className="font-mono text-xs text-violet-600 hover:underline">
                                                {r.user_id}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-right text-neutral-600">
                                            {formatCurrency(r.amount_before_discount, coupon.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-neutral-600">
                                            {formatCurrency(r.discount_amount, coupon.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-neutral-900">
                                            {formatCurrency(r.final_amount_after_discount, coupon.currency)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-neutral-500">
                                            {formatDateTime(r.created_at)}
                                        </td>
                                    </tr>
                                ))}
                                {redemptions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center text-neutral-500">
                                            No redemptions yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {redemptionsTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 text-sm text-neutral-500">
                        <span>
                            Page {redemptionsPage} of {redemptionsTotalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRedemptionsPage((p) => Math.max(1, p - 1))}
                                disabled={redemptionsPage <= 1}
                                className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setRedemptionsPage((p) => Math.min(redemptionsTotalPages, p + 1))}
                                disabled={redemptionsPage >= redemptionsTotalPages}
                                className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            <ConfirmModal
                open={showDelete}
                theme="danger"
                title="Delete Coupon"
                message={`Are you sure you want to delete "${coupon.code}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => setShowDelete(false)}
                isPending={deleteMutation.isPending}
            />
        </div>
    );
}

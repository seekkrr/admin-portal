import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Power, Receipt, Tag as TagIcon, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { couponsService } from "../services/coupons.service";
import { COUPON_MANAGE_ROLES, COUPON_VIEW_ROLES, DISCOUNT_TYPE_LABELS, hasRole, renderDiscount } from "../components/couponDisplay";
import { formatCurrency, orDash } from "@/utils/format";
import { formatDateTime } from "@/utils/date";
import type { CouponRedemption } from "@/types";

const REDEMPTIONS_PER_PAGE = 20;

export function CouponDetailPage() {
    const { couponId: param } = useParams<{ couponId: string }>();
    const couponId = param ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const roles = useAuthStore((s) => s.user?.role);

    const canView = hasRole(roles, COUPON_VIEW_ROLES);
    const canManage = hasRole(roles, COUPON_MANAGE_ROLES);

    const [showDelete, setShowDelete] = useState(false);
    const [redemptionsPage, setRedemptionsPage] = useState(1);

    const { data: coupon, isLoading, error, refetch } = useQuery({
        queryKey: ["coupon-detail", couponId],
        queryFn: () => couponsService.getById(couponId),
        enabled: !!couponId && canView,
        staleTime: 60 * 1000,
    });

    const redemptionsQuery = useQuery({
        queryKey: ["coupon-redemptions", couponId, redemptionsPage],
        queryFn: () => couponsService.listRedemptions(couponId, { page: redemptionsPage, page_size: REDEMPTIONS_PER_PAGE }),
        enabled: !!couponId && canView,
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    usePageTitle(coupon?.code ?? null);

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

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view this coupon." />;
    if (isLoading) return <LoadingState label="Loading coupon…" />;
    if (error || !coupon) {
        return (
            <Panel>
                <ErrorState title="Couldn't load this coupon" error={error ?? new Error("It may have been deleted.")} onRetry={error ? () => refetch() : undefined} />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/coupons" icon={ArrowLeft} variant="ghost">
                        Back to coupons
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const redemptions = redemptionsQuery.data?.redemptions ?? [];
    const columns: DataColumn<CouponRedemption>[] = [
        { id: "user", header: "User", hideable: false, csv: (r) => r.user_id, cell: (r) => <IdLink kind="user" id={r.user_id} /> },
        {
            id: "before",
            header: "Before",
            align: "right",
            sortValue: (r) => r.amount_before_discount,
            cell: (r) => <span className="tabular-nums text-ink-muted">{formatCurrency(r.amount_before_discount, coupon.currency)}</span>,
        },
        {
            id: "discount",
            header: "Discount",
            align: "right",
            sortValue: (r) => r.discount_amount,
            cell: (r) => <span className="tabular-nums text-ink-muted">{formatCurrency(r.discount_amount, coupon.currency)}</span>,
        },
        {
            id: "final",
            header: "Final",
            align: "right",
            sortValue: (r) => r.final_amount_after_discount,
            cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.final_amount_after_discount, coupon.currency)}</span>,
        },
        { id: "transaction", header: "Transaction", defaultHidden: true, csv: (r) => r.transaction_id ?? "", cell: (r) => <IdLink kind="transaction" id={r.transaction_id} /> },
        {
            id: "redeemed",
            header: "Redeemed",
            sortValue: (r) => r.created_at,
            csv: (r) => formatDateTime(r.created_at),
            cell: (r) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(r.created_at)}</span>,
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={TagIcon}
                title={<span className="font-mono">{coupon.code}</span>}
                badge={<StatusPill status={coupon.is_active ? "active" : "inactive"} tone={coupon.is_active ? "good" : "neutral"} />}
                description={coupon.name}
                actions={
                    canManage && (
                        <Button icon={Power} onClick={() => toggleActiveMutation.mutate()} loading={toggleActiveMutation.isPending}>
                            {coupon.is_active ? "Turn off" : "Activate"}
                        </Button>
                    )
                }
                menu={[{ label: "Delete coupon", icon: Trash2, danger: true, hidden: !canManage, onSelect: () => setShowDelete(true) }]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Discount">
                    <DetailList>
                        <DetailRow label="Type" value={DISCOUNT_TYPE_LABELS[coupon.discount_type] ?? coupon.discount_type} />
                        <DetailRow label="Value" value={renderDiscount(coupon)} />
                        <DetailRow label="Applies to" value={coupon.link_item === "all" ? "All quests" : <IdLink kind="quest" id={coupon.link_id} short={false} />} />
                    </DetailList>
                </Panel>

                <Panel title="Limits and usage">
                    <DetailList>
                        <DetailRow label="Per-user limit" value={String(coupon.per_user_limit)} />
                        <DetailRow label="Max redemptions" value={coupon.max_redemptions !== null ? String(coupon.max_redemptions) : "Unlimited"} />
                        <DetailRow label="Redeemed so far" value={coupon.redemption_count.toLocaleString("en-IN")} />
                        <DetailRow label="Expires" value={coupon.expires_at ? formatDateTime(coupon.expires_at) : "Never"} />
                        <DetailRow label="Currency" value={orDash(coupon.currency)} />
                        <DetailRow label="Created" value={formatDateTime(coupon.created_at)} />
                        <DetailRow label="ID" value={<CopyText value={coupon._id} mono truncate={false} />} />
                    </DetailList>
                </Panel>
            </div>

            <section className="space-y-3" aria-labelledby="coupon-redemptions">
                <h2 id="coupon-redemptions" className="flex items-center gap-2 text-base font-semibold text-ink">
                    <Receipt className="h-4 w-4 text-accent-600" aria-hidden />
                    Redemptions
                </h2>
                <DataTable
                    label="Redemptions"
                    rows={redemptions}
                    columns={columns}
                    rowKey={(r) => `${r.user_id}-${r.created_at}-${r.transaction_id ?? ""}`}
                    isLoading={redemptionsQuery.isLoading}
                    isFetching={redemptionsQuery.isFetching && !!redemptionsQuery.data}
                    error={redemptionsQuery.error}
                    onRetry={() => redemptionsQuery.refetch()}
                    empty={{ icon: Receipt, title: "No redemptions yet." }}
                    storageKey="coupon-redemptions"
                    exportName={`coupon-${coupon.code}-redemptions`}
                    summary={redemptionsQuery.data ? `${redemptions.length} of ${redemptionsQuery.data.total.toLocaleString("en-IN")}` : undefined}
                    card={{
                        title: (r) => formatCurrency(r.final_amount_after_discount, coupon.currency),
                        subtitle: (r) => formatDateTime(r.created_at),
                        fields: ["user", "before", "discount"],
                    }}
                    footer={
                        redemptionsQuery.data && (
                            <Pagination
                                page={redemptionsPage}
                                totalPages={redemptionsQuery.data.total_pages}
                                total={redemptionsQuery.data.total}
                                pageSize={REDEMPTIONS_PER_PAGE}
                                onPageChange={setRedemptionsPage}
                            />
                        )
                    }
                />
            </section>

            <ConfirmDialog
                open={showDelete}
                tone="danger"
                title="Delete coupon?"
                description={`"${coupon.code}" is deleted and stops working at checkout.`}
                confirmLabel="Delete"
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => setShowDelete(false)}
                isPending={deleteMutation.isPending}
            />
        </div>
    );
}

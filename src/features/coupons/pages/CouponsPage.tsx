import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Field";
import { IdLink } from "@/components/ui/IdLink";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { couponsService } from "../services/coupons.service";
import { CouponCreateModal } from "../components/CouponCreateModal";
import { COUPON_MANAGE_ROLES, COUPON_VIEW_ROLES, DISCOUNT_TYPE_LABELS, hasRole, renderDiscount } from "../components/couponDisplay";
import { formatDate } from "@/utils/date";
import type { Coupon } from "@/types";

const PER_PAGE = 20;

const ACTIVE_OPTIONS: FilterOption[] = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
];

const LINK_OPTIONS: FilterOption[] = [
    { value: "all", label: "All quests" },
    { value: "quest", label: "Specific quest" },
];

export function CouponsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const canView = hasRole(roles, COUPON_VIEW_ROLES);
    const canManage = hasRole(roles, COUPON_MANAGE_ROLES);

    // Filters, search and page live in the address.
    const { state, set, reset } = useUrlState({ code: "", active: "", link: "", page: 1 });
    const [codeInput, setCodeInput] = useDebouncedUrlInput(state.code, (code) => set({ code }, { replace: true }));
    const isActive = state.active === "true" || state.active === "false" ? state.active : "";
    const linkItem = state.link === "all" || state.link === "quest" ? state.link : "";
    const page = Math.max(1, state.page);

    const [showCreate, setShowCreate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-coupons", { code: state.code, is_active: isActive, link_item: linkItem, page }],
        queryFn: () =>
            couponsService.list({
                code: state.code || undefined,
                is_active: isActive,
                link_item: linkItem,
                page,
                page_size: PER_PAGE,
            }),
        enabled: canView,
        staleTime: 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => couponsService.update(id, { is_active }),
        onSuccess: (_, { is_active }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            queryClient.invalidateQueries({ queryKey: ["coupon-detail"] });
            toast.success(is_active ? "Coupon activated" : "Coupon turned off");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update coupon"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => couponsService.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon deleted");
            setConfirmDelete(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete coupon");
            setConfirmDelete(null);
        },
    });

    if (!canView) return <AccessDenied message="You need a finance, admin, or super-admin role to view coupons." />;

    const coupons = data?.coupons ?? [];

    const columns: DataColumn<Coupon>[] = [
        {
            id: "code",
            header: "Code",
            hideable: false,
            sortValue: (c) => c.code,
            cell: (c) => (
                <Link to={`/coupons/${c._id}`} className="font-mono text-xs font-semibold text-ink hover:text-accent-700 hover:underline">
                    {c.code}
                </Link>
            ),
        },
        { id: "name", header: "Name", sortValue: (c) => c.name, cell: (c) => <span className="text-ink">{c.name}</span> },
        {
            id: "type",
            header: "Type",
            sortValue: (c) => c.discount_type,
            csv: (c) => DISCOUNT_TYPE_LABELS[c.discount_type] ?? c.discount_type,
            cell: (c) => <Tag tone="info">{DISCOUNT_TYPE_LABELS[c.discount_type] ?? c.discount_type}</Tag>,
        },
        {
            id: "discount",
            header: "Discount",
            sortValue: (c) => c.discount_value ?? c.discount_max ?? 0,
            csv: (c) => renderDiscount(c),
            cell: (c) => <span className="whitespace-nowrap font-medium tabular-nums">{renderDiscount(c)}</span>,
        },
        {
            id: "link",
            header: "Applies to",
            sortValue: (c) => c.link_item,
            csv: (c) => (c.link_item === "all" ? "All quests" : (c.link_id ?? "")),
            cell: (c) => (c.link_item === "all" ? <span className="text-ink-muted">All quests</span> : <IdLink kind="quest" id={c.link_id} />),
        },
        {
            id: "active",
            header: "Active",
            sortValue: (c) => c.is_active,
            csv: (c) => (c.is_active ? "active" : "inactive"),
            cell: (c) =>
                canManage ? (
                    <Switch
                        size="sm"
                        hideLabel
                        checked={c.is_active}
                        label={`${c.code} is ${c.is_active ? "active" : "inactive"}`}
                        disabled={toggleActiveMutation.isPending}
                        onChange={(next) => toggleActiveMutation.mutate({ id: c._id, is_active: next })}
                    />
                ) : (
                    <StatusPill status={c.is_active ? "active" : "inactive"} tone={c.is_active ? "good" : "neutral"} />
                ),
        },
        {
            id: "redemptions",
            header: "Redemptions",
            align: "right",
            sortValue: (c) => c.redemption_count,
            csv: (c) => c.redemption_count,
            cell: (c) => (
                <span className="tabular-nums text-ink-muted">
                    {c.redemption_count.toLocaleString("en-IN")}
                    {c.max_redemptions ? ` / ${c.max_redemptions.toLocaleString("en-IN")}` : ""}
                </span>
            ),
        },
        {
            id: "expires",
            header: "Expires",
            sortValue: (c) => c.expires_at ?? "",
            csv: (c) => (c.expires_at ? formatDate(c.expires_at) : "Never"),
            cell: (c) => <span className="whitespace-nowrap text-ink-muted">{c.expires_at ? formatDate(c.expires_at) : "Never"}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (isActive) chips.push({ key: "active", label: chipLabel("Status", isActive, ACTIVE_OPTIONS), onRemove: () => set({ active: "" }) });
    if (linkItem) chips.push({ key: "link", label: chipLabel("Applies to", linkItem, LINK_OPTIONS), onRemove: () => set({ link: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={TagIcon}
                title="Quest coupons"
                description={
                    <>
                        Discount codes for quest bookings
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                primaryAction={
                    canManage && (
                        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
                            New coupon
                        </Button>
                    )
                }
            />

            <FilterBar
                search={{ value: codeInput, onChange: setCodeInput, placeholder: "Filter by code…" }}
                chips={chips}
                onReset={() => {
                    setCodeInput("");
                    reset();
                }}
            >
                <FilterSelect label="Status" value={isActive} onChange={(v) => set({ active: v })} options={ACTIVE_OPTIONS} allLabel="All statuses" />
                <FilterSelect label="Applies to" value={linkItem} onChange={(v) => set({ link: v })} options={LINK_OPTIONS} allLabel="Any link" />
            </FilterBar>

            <DataTable
                label="Coupons"
                rows={coupons}
                columns={columns}
                rowKey={(c) => c._id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: TagIcon,
                    title: "No coupons match these filters.",
                    description: chips.length || state.code ? "Try clearing a filter." : undefined,
                }}
                onRowClick={(c) => navigate(`/coupons/${c._id}`)}
                rowActions={(c) => (
                    <>
                        <IconButton icon={Eye} size="sm" label={`View ${c.code}`} onClick={() => navigate(`/coupons/${c._id}`)} />
                        {canManage && (
                            <IconButton icon={Trash2} size="sm" label={`Delete ${c.code}`} className="hover:bg-bad-soft hover:text-bad" onClick={() => setConfirmDelete(c)} />
                        )}
                    </>
                )}
                storageKey="coupons"
                exportName="coupons"
                summary={data ? `${coupons.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (c) => <span className="font-mono">{c.code}</span>,
                    subtitle: (c) => c.name,
                    fields: ["discount", "active", "redemptions", "expires"],
                }}
                footer={
                    data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                }
            />

            <CouponCreateModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={(id) => navigate(`/coupons/${id}`)} />

            <ConfirmDialog
                open={!!confirmDelete}
                tone="danger"
                title="Delete coupon?"
                description={`"${confirmDelete?.code ?? ""}" is deleted and stops working at checkout.`}
                confirmLabel="Delete"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />
        </div>
    );
}

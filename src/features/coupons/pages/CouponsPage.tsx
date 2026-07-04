import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tag, Search, Plus, Eye, Power, Trash2, ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { couponsService } from "../services/coupons.service";
import { CouponCreateModal } from "../components/CouponCreateModal";
import { formatCurrency, formatDate, orDash } from "@/utils/format";
import type { Coupon } from "@/types";

const CAN_VIEW_ROLES = ["admin", "super_admin", "finance"];
const CAN_MANAGE_ROLES = ["admin", "super_admin"];

const ACTIVE_OPTIONS: { value: string; label: string; dot?: string }[] = [
    { value: "", label: "All statuses" },
    { value: "true", label: "Active", dot: "bg-emerald-400" },
    { value: "false", label: "Inactive", dot: "bg-neutral-400" },
];

const LINK_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "Any link" },
    { value: "all", label: "All quests" },
    { value: "quest", label: "Specific quest" },
];

/** Render a coupon's discount as `50%`, `₹100`, or `15–30%`. */
function renderDiscount(c: Coupon): string {
    if (c.discount_type === "flat") return formatCurrency(c.discount_value ?? 0, c.currency);
    if (c.discount_type === "percent") return `${c.discount_value ?? 0}%`;
    return `${c.discount_min ?? 0}–${c.discount_max ?? 0}%`;
}

export function CouponsPage() {
    const roles = useAuthStore((s) => s.user?.role);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const canView = roles?.some((r) => CAN_VIEW_ROLES.includes(r));
    const canManage = roles?.some((r) => CAN_MANAGE_ROLES.includes(r));

    const [page, setPage] = useState(1);
    const [perPage] = useState(20);
    const [code, setCode] = useState("");
    const [debouncedCode, setDebouncedCode] = useState("");
    const [isActive, setIsActive] = useState("");
    const [linkItem, setLinkItem] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCode(code.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [code]);

    const { data, isLoading, error } = useQuery({
        queryKey: [
            "admin-coupons",
            { code: debouncedCode, is_active: isActive, link_item: linkItem, page },
        ],
        queryFn: () =>
            couponsService.list({
                code: debouncedCode || undefined,
                is_active: isActive as "" | "true" | "false",
                link_item: linkItem as "" | "quest" | "all",
                page,
                page_size: perPage,
            }),
        enabled: !!canView,
        staleTime: 60 * 1000,
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
            couponsService.update(id, { is_active }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            queryClient.invalidateQueries({ queryKey: ["coupon-detail"] });
            toast.success("Coupon updated");
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

    if (!canView) {
        return (
            <div className="animate-fade-in max-w-md mx-auto mt-16 bg-white rounded-2xl border border-neutral-200 shadow-sm p-8 text-center">
                <ShieldAlert className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-neutral-900">Access denied</h2>
                <p className="text-sm text-neutral-500 mt-1">
                    You need a finance, admin, or super-admin role to view coupons.
                </p>
            </div>
        );
    }

    if (isLoading) return <LoadingFallback message="Loading coupons..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load coupons.</div>;

    const coupons = data?.coupons ?? [];

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">Coupons</h1>
                        <p className="text-sm text-neutral-500">
                            Discount codes across the platform
                            {data && <span className="ml-2 text-neutral-400">· {data.total} total</span>}
                        </p>
                    </div>
                </div>
                {canManage && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors self-start"
                    >
                        <Plus className="w-4 h-4" />
                        New Coupon
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Filter by code..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") setPage(1); }}
                        />
                    </div>
                    <FilterDropdown
                        value={isActive}
                        onChange={(val) => { setIsActive(val); setPage(1); }}
                        options={ACTIVE_OPTIONS}
                        placeholder="All statuses"
                    />
                    <FilterDropdown
                        value={linkItem}
                        onChange={(val) => { setLinkItem(val); setPage(1); }}
                        options={LINK_OPTIONS}
                        placeholder="Any link"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                <th className="px-4 py-4 text-left">Code</th>
                                <th className="px-4 py-4 text-left">Name</th>
                                <th className="px-4 py-4 text-left">Type</th>
                                <th className="px-4 py-4 text-left">Discount</th>
                                <th className="px-4 py-4 text-left">Link</th>
                                <th className="px-4 py-4 text-left">Active</th>
                                <th className="px-4 py-4 text-right">Redemptions</th>
                                <th className="px-4 py-4 text-left">Expires</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                            {coupons.map((c) => (
                                <tr key={c._id} className="group hover:bg-neutral-50/80 transition-colors">
                                    <td className="px-4 py-4">
                                        <Link
                                            to={`/coupons/${c._id}`}
                                            className="font-mono text-xs font-semibold text-neutral-900 hover:text-violet-600"
                                        >
                                            {c.code}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4 text-neutral-700">{c.name}</td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                                            {c.discount_type.replace(/_/g, " ")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 font-medium text-neutral-900 whitespace-nowrap">
                                        {renderDiscount(c)}
                                    </td>
                                    <td className="px-4 py-4 text-neutral-600">
                                        {c.link_item === "all" ? (
                                            "All quests"
                                        ) : c.link_id ? (
                                            <Link
                                                to={`/quests/${c.link_id}`}
                                                className="font-mono text-xs text-violet-600 hover:underline"
                                            >
                                                {c.link_id}
                                            </Link>
                                        ) : (
                                            orDash(null)
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        {canManage ? (
                                            <button
                                                onClick={() =>
                                                    toggleActiveMutation.mutate({ id: c._id, is_active: !c.is_active })
                                                }
                                                disabled={toggleActiveMutation.isPending}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                                                    c.is_active
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                                                }`}
                                                title={c.is_active ? "Expire coupon" : "Activate coupon"}
                                            >
                                                <Power className="w-3 h-3" />
                                                {c.is_active ? "Active" : "Inactive"}
                                            </button>
                                        ) : (
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                    c.is_active
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-neutral-50 text-neutral-600 border-neutral-200"
                                                }`}
                                            >
                                                {c.is_active ? "Active" : "Inactive"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right text-neutral-600">
                                        {c.redemption_count}
                                        {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-neutral-500">
                                        {c.expires_at ? formatDate(c.expires_at) : "Never"}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => navigate(`/coupons/${c._id}`)}
                                                title="View details"
                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-violet-600 hover:bg-violet-50 transition-all active:scale-95"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {canManage && (
                                                <button
                                                    onClick={() => setConfirmDelete(c)}
                                                    title="Delete coupon"
                                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {coupons.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Tag className="w-12 h-12 text-neutral-300 mb-4" />
                                            <p>No coupons found matching your criteria.</p>
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

            <CouponCreateModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onSuccess={(id) => navigate(`/coupons/${id}`)}
            />

            <ConfirmModal
                open={!!confirmDelete}
                theme="danger"
                title="Delete Coupon"
                message={`Delete coupon "${confirmDelete?.code}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />
        </div>
    );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Globe, Search, MapPin, Plus, Map, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@store/auth.store";
import type { RegionsListResponse, RegionType } from "@/types";
import { FilterDropdown } from "@/components/FilterDropdown";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Badge } from "@/components/ui/Badge";
import { useBulkSelection, runBulk } from "@/hooks/useBulkSelection";
import { RegionCreateModal } from "../components/RegionCreateModal";
import { Pagination } from "@/components/ui/Pagination";

type TypeFilter = "all" | RegionType;
const EDIT_ROLES = ["admin", "super_admin"];


export function RegionsPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const CAN_EDIT = !!user?.role?.some((r) => EDIT_ROLES.includes(r));

    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [searchInput, setSearchInput] = useState("");
    const [q, setQ] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

    // Create modal state
    const [showCreate, setShowCreate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

    // Debounce search
    useEffect(() => {
        const t = window.setTimeout(() => {
            if (q !== searchInput.trim()) {
                setQ(searchInput.trim());
                setPage(1);
            }
        }, 400);
        return () => window.clearTimeout(t);
    }, [searchInput, q]);



    const { data, isLoading, error } = useQuery<RegionsListResponse>({
        queryKey: ["admin-regions", { q, type: typeFilter, page }],
        queryFn: () => {
            if (q) return regionsService.search(q, page, pageSize);
            return regionsService.list({
                type: typeFilter === "all" ? undefined : typeFilter,
                page,
                page_size: pageSize,
            });
        },
        staleTime: 5 * 60 * 1000,
    });





    const deleteMutation = useMutation({
        mutationFn: (id: string) => regionsService.remove(id, false),
        onSuccess: () => {
            toast.success("Region deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            setConfirmDelete(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const regions = data?.regions ?? [];
    const sel = useBulkSelection(regions.map((r) => r.id));
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const bulkDelete = useMutation({
        mutationFn: (ids: string[]) => runBulk(ids, (id) => regionsService.remove(id, false)),
        onSuccess: ({ ok, failed }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            toast.success(`Deleted ${ok} region${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} could not be deleted (may have quests attached)`);
            sel.clear();
            setConfirmBulkDelete(false);
        },
        onError: () => { toast.error("Bulk delete failed"); setConfirmBulkDelete(false); },
    });

    const totalPages = data?.total_pages ?? 1;
    const currentPage = data?.page ?? page;


    if (isLoading) return <LoadingFallback message="Loading regions..." />;

    if (error) {
        return <div className="p-6 text-center text-red-500">Failed to load regions.</div>;
    }



    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600">
                            <Globe className="w-5 h-5" />
                        </span>
                        Regions & Geographic Configuration
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Manage cities, hotspots and their geographic settings
                        {data && (
                            <span className="ml-2 text-neutral-400">· {data.total ?? regions.length} total</span>
                        )}
                    </p>
                </div>
                {CAN_EDIT && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-colors self-start"
                    >
                        <Plus className="w-4 h-4" />
                        New Region
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[260px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search regions..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-shadow"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <FilterDropdown
                            options={[
                                { label: "All Types", value: "all" },
                                { label: "City", value: "city" },
                                { label: "Hotspot", value: "hotspot" },
                            ]}
                            value={typeFilter}
                            onChange={(val) => {
                                setTypeFilter(val as TypeFilter);
                                setPage(1);
                            }}
                            theme="cyan"
                            placeholder="All Types"
                            icon={<Map className="w-4 h-4 text-cyan-500" />}
                        />
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {sel.count > 0 && CAN_EDIT && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-cyan-50 rounded-xl border border-cyan-100 animate-slide-up">
                        <span className="text-sm font-semibold text-cyan-700">
                            {sel.count} selected
                        </span>
                        <div className="h-4 w-px bg-cyan-200" />
                        <button
                            onClick={() => setConfirmBulkDelete(true)}
                            disabled={bulkDelete.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                        <button
                            onClick={sel.clear}
                            className="ml-auto text-xs text-neutral-500 hover:text-neutral-700"
                        >
                            Deselect all
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="border-b border-neutral-200/60 bg-neutral-50/80 backdrop-blur-sm">
                            <tr className="text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                                {CAN_EDIT && (
                                    <th className="px-4 py-4 text-left">
                                        <input
                                            type="checkbox"
                                            className="rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                                            checked={sel.allSelected}
                                            ref={(el) => { if (el) el.indeterminate = sel.someSelected; }}
                                            onChange={(e) => sel.toggleAll(e.target.checked)}
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-4 text-left">Name</th>
                                <th className="px-4 py-4 text-left">Type</th>
                                <th className="px-4 py-4 text-left">Slug</th>
                                <th className="px-4 py-4 text-right">Markers</th>
                                <th className="px-4 py-4 text-right">Weight</th>
                                <th className="px-4 py-4 text-left">Active</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-200">
                            {regions.map((region) => (
                                <tr key={region.id} className="group hover:bg-neutral-50/80 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200">
                                    {CAN_EDIT && (
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                                                checked={sel.selected.has(region.id)}
                                                onChange={(e) => sel.toggle(region.id, e.target.checked)}
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-4">
                                        <Link to={`/regions/${region.id}`} className="font-medium text-cyan-700 hover:text-cyan-900">
                                            {region.name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-4">
                                        <Badge 
                                            label={region.type} 
                                            styles={
                                                region.type === "city"
                                                    ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                            } 
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-neutral-500 font-mono text-xs">{region.slug}</td>
                                    <td className="px-4 py-4 text-right text-neutral-700">{region.marker_count}</td>
                                    <td className="px-4 py-4 text-right text-neutral-700">{region.admin_weight ?? "—"}</td>
                                    <td className="px-4 py-4">
                                        <Badge 
                                            label={region.is_active ? "Active" : "Inactive"} 
                                            styles={
                                                region.is_active
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-neutral-100 text-neutral-500 border-neutral-200"
                                            } 
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => navigate(`/regions/${region.id}`)}
                                                title="View details"
                                                className="p-1.5 rounded-lg text-neutral-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all active:scale-95"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {CAN_EDIT && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmDelete({ id: region.id, name: region.name });
                                                    }}
                                                    title="Delete region"
                                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {regions.length === 0 && (
                                <tr>
                                    <td colSpan={CAN_EDIT ? 8 : 7} className="px-4 py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <MapPin className="w-12 h-12 text-neutral-300 mb-4" />
                                            <p>No regions found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        total={data?.total ?? regions.length}
                        onPageChange={setPage}
                        theme="cyan"
                    />
                )}
            </div>

            {/* Removed BulkActionBar */}

            <RegionCreateModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onSuccess={(id) => navigate(`/regions/${id}`)}
            />

            <ConfirmModal
                open={!!confirmDelete}
                title="Delete Region"
                message={`Are you sure you want to delete "${confirmDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />

            <ConfirmModal
                open={confirmBulkDelete}
                title="Delete Regions"
                message={`Delete ${sel.count} region${sel.count === 1 ? "" : "s"}? Regions with attached quests will be skipped. This cannot be undone.`}
                confirmLabel={`Delete ${sel.count}`}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => bulkDelete.mutate(sel.ids)}
                onCancel={() => setConfirmBulkDelete(false)}
                isPending={bulkDelete.isPending}
            />
        </div>
    );
}


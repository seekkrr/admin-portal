import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, ListFilter } from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthStore } from "@/store/auth.store";
import { timelineFiltersService } from "../services/timelineFilters.service";
import type { TimelineFilterItem } from "@/types";

const ALLOWED = ["admin", "super_admin", "moderator"];

export function TimelineFiltersPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const hasAccess = !!user?.role?.some((r) => ALLOWED.includes(r));

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["admin-timeline-filters"],
        queryFn: () => timelineFiltersService.list(),
        enabled: hasAccess,
    });

    const [rows, setRows] = useState<TimelineFilterItem[]>([]);
    useEffect(() => { if (data) setRows(data); }, [data]);

    if (!hasAccess) {
        return <AccessDenied message="You need an admin or moderator role to manage timeline filters." />;
    }

    const patch = (id: string, p: Partial<TimelineFilterItem>) =>
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

    const save = async (row: TimelineFilterItem) => {
        if (!row.label.trim()) { toast.error("Label is required"); return; }
        try {
            await timelineFiltersService.update(row.id, {
                key: row.key, label: row.label, icon: row.icon, color: row.color,
                order: row.order, is_active: row.is_active,
            });
            toast.success("Saved");
            queryClient.invalidateQueries({ queryKey: ["admin-timeline-filters"] });
        } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    };

    const add = async () => {
        try {
            const label = "New Filter";
            await timelineFiltersService.create({
                label, key: `filter-${Date.now()}`, color: "#003634", order: rows.length,
            });
            toast.success("Filter added");
            queryClient.invalidateQueries({ queryKey: ["admin-timeline-filters"] });
        } catch (e) { toast.error(e instanceof Error ? e.message : "Add failed"); }
    };

    const remove = async (id: string) => {
        try {
            await timelineFiltersService.remove(id);
            toast.success("Deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-timeline-filters"] });
        } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
    };

    return (
        <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Timeline Filters</h1>
                    <p className="text-neutral-500 text-sm mt-0.5">Chips shown on the app's Timeline feed</p>
                </div>
                <button onClick={add} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:brightness-105">
                    <Plus className="w-4 h-4" /> Add filter
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4">
                {isLoading ? (
                    <p className="py-10 text-center text-neutral-400 text-sm">Loading…</p>
                ) : isError ? (
                    <div className="py-10 text-center">
                        <p className="text-red-500 text-sm mb-2">Couldn't load filters.</p>
                        <button onClick={() => refetch()} className="text-indigo-600 text-sm font-medium hover:underline">Retry</button>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="py-10 text-center text-neutral-400">
                        <ListFilter className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">No filters yet. Add one.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                            <span className="col-span-3">Label</span>
                            <span className="col-span-3">Key</span>
                            <span className="col-span-2">Icon</span>
                            <span className="col-span-1">Color</span>
                            <span className="col-span-1">Order</span>
                            <span className="col-span-1 text-center">Active</span>
                            <span className="col-span-1"></span>
                        </div>
                        {rows.map((r) => (
                            <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
                                <input className="col-span-3 h-9 rounded-lg border border-neutral-200 px-2 text-sm" value={r.label}
                                    onChange={(e) => patch(r.id, { label: e.target.value })} placeholder="Label" />
                                <input className="col-span-3 h-9 rounded-lg border border-neutral-200 px-2 text-sm font-mono" value={r.key}
                                    onChange={(e) => patch(r.id, { key: e.target.value })} placeholder="key" />
                                <input className="col-span-2 h-9 rounded-lg border border-neutral-200 px-2 text-sm" value={r.icon ?? ""}
                                    onChange={(e) => patch(r.id, { icon: e.target.value })} placeholder="icon" />
                                <input type="color" className="col-span-1 h-9 w-full rounded-lg border border-neutral-200" value={r.color || "#003634"}
                                    onChange={(e) => patch(r.id, { color: e.target.value })} />
                                <input type="number" className="col-span-1 h-9 rounded-lg border border-neutral-200 px-2 text-sm" value={r.order}
                                    onChange={(e) => patch(r.id, { order: parseInt(e.target.value || "0", 10) })} />
                                <label className="col-span-1 flex items-center justify-center">
                                    <input type="checkbox" checked={r.is_active} onChange={(e) => patch(r.id, { is_active: e.target.checked })} />
                                </label>
                                <div className="col-span-1 flex items-center justify-end gap-1">
                                    <button onClick={() => save(r)} title="Save" className="p-2 rounded-lg text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50">
                                        <Save className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => remove(r.id)} title="Delete" className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

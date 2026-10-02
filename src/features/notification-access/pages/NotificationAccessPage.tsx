import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check, X } from "lucide-react";
import { FilterDropdown } from "@/components/FilterDropdown";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthStore } from "@/store/auth.store";
import { notificationAccessService } from "../services/notificationAccess.service";

const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DECIDE = ["admin", "super_admin"];

const STATUS_OPTIONS = [
    { value: "pending", label: "Pending", dot: "bg-blue-500" },
    { value: "approved", label: "Approved", dot: "bg-green-500" },
    { value: "rejected", label: "Rejected", dot: "bg-red-500" },
];

export function NotificationAccessPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const hasAccess = !!user?.role?.some((r) => ALLOWED_ROLES.includes(r));
    const canDecide = !!user?.role?.some((r) => CAN_DECIDE.includes(r));
    const [status, setStatus] = useState("pending");

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["notif-access-requests", status],
        queryFn: () => notificationAccessService.list(status),
        enabled: hasAccess,
        staleTime: 15_000,
    });

    if (!hasAccess) {
        return <AccessDenied message="You need an admin or moderator role to manage notification access." />;
    }

    const rows = data ?? [];

    const decide = async (creatorId: string, to: "approved" | "rejected" | "none") => {
        try {
            await notificationAccessService.setAccess(creatorId, to);
            toast.success(`Access ${to === "none" ? "reset" : to}`);
            queryClient.invalidateQueries({ queryKey: ["notif-access-requests"] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update access");
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Notification Access</h1>
                <p className="text-neutral-500 text-sm mt-0.5">Approve which creators can send push notifications to their event attendees</p>
            </div>

            <FilterDropdown options={STATUS_OPTIONS} value={status} onChange={setStatus}
                placeholder="Pending" theme="indigo" />

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-neutral-50">
                        <tr className="border-b border-neutral-200">
                            <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Creator</th>
                            <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Email</th>
                            <th className="py-3.5 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {isLoading ? (
                            <tr><td colSpan={3} className="py-16 text-center text-neutral-400 text-sm">Loading…</td></tr>
                        ) : isError ? (
                            <tr><td colSpan={3} className="py-16 text-center">
                                <p className="text-red-500 text-sm mb-2">Couldn't load requests.</p>
                                <button onClick={() => refetch()} className="text-violet-600 text-sm font-medium hover:underline">Retry</button>
                            </td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={3} className="py-16 text-center text-neutral-400">
                                <BellRing className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">No {status} requests.</p>
                            </td></tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} className="hover:bg-neutral-50/60">
                                    <td className="py-3.5 px-4 font-medium text-neutral-900">{r.name ?? r.user_id ?? "—"}</td>
                                    <td className="py-3.5 px-4 text-sm text-neutral-500">{r.email ?? "—"}</td>
                                    <td className="py-3.5 px-4 text-right">
                                        {canDecide ? (
                                            <div className="flex items-center justify-end gap-2">
                                                {status !== "approved" && (
                                                    <button onClick={() => decide(r.id, "approved")}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200">
                                                        <Check className="w-4 h-4" /> Approve
                                                    </button>
                                                )}
                                                {status !== "rejected" && (
                                                    <button onClick={() => decide(r.id, "rejected")}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200">
                                                        <X className="w-4 h-4" /> {status === "approved" ? "Revoke" : "Reject"}
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-neutral-400">View only</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

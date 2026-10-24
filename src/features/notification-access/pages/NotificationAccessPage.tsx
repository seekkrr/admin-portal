import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check, X } from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { notificationAccessService, type NotificationAccessRequest } from "../services/notificationAccess.service";

const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DECIDE = ["admin", "super_admin"];

type StatusTab = "pending" | "approved" | "rejected";
const STATUS_TABS: { value: StatusTab; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
];

type Decision = "approved" | "rejected" | "none";

export function NotificationAccessPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const hasAccess = !!user?.role?.some((r) => ALLOWED_ROLES.includes(r));
    const canDecide = !!user?.role?.some((r) => CAN_DECIDE.includes(r));

    const { state, set } = useUrlState({ status: "pending" });
    const status: StatusTab = STATUS_TABS.some((t) => t.value === state.status) ? (state.status as StatusTab) : "pending";
    const [confirm, setConfirm] = useState<{ row: NotificationAccessRequest; to: Decision } | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["notif-access-requests", status],
        queryFn: () => notificationAccessService.list(status),
        enabled: hasAccess,
        staleTime: 15_000,
    });

    const decide = useMutation({
        mutationFn: ({ creatorId, to }: { creatorId: string; to: Decision }) => notificationAccessService.setAccess(creatorId, to),
        onSuccess: (_, { to }) => {
            toast.success(`Access ${to === "none" ? "reset" : to}`);
            queryClient.invalidateQueries({ queryKey: ["notif-access-requests"] });
            queryClient.invalidateQueries({ queryKey: ["today", "notification-access"] });
            setConfirm(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to update access");
            setConfirm(null);
        },
    });

    if (!hasAccess) {
        return <AccessDenied message="You need an admin or moderator role to manage notification access." />;
    }

    const rows = data ?? [];
    const nameOf = (r: NotificationAccessRequest) => r.name ?? r.email ?? r.user_id ?? r.id;

    const columns: DataColumn<NotificationAccessRequest>[] = [
        {
            id: "creator",
            header: "Creator",
            hideable: false,
            sortValue: (r) => nameOf(r),
            cell: (r) => (
                <Link to={`/creators/${r.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {nameOf(r)}
                </Link>
            ),
        },
        { id: "email", header: "Email", sortValue: (r) => r.email ?? "", cell: (r) => <span className="text-ink-muted">{r.email ?? "—"}</span> },
        { id: "user", header: "User", csv: (r) => r.user_id ?? "", cell: (r) => <IdLink kind="user" id={r.user_id} /> },
        { id: "access", header: "Access", sortValue: (r) => r.notification_access, cell: (r) => <StatusPill status={r.notification_access || status} /> },
    ];

    const busyFor = (r: NotificationAccessRequest) => decide.isPending && decide.variables?.creatorId === r.id;

    const rowActions = (r: NotificationAccessRequest) =>
        canDecide ? (
            <>
                {status !== "approved" && (
                    <Button size="sm" variant="secondary" icon={Check} loading={busyFor(r) && decide.variables?.to === "approved"} disabled={decide.isPending} onClick={() => decide.mutate({ creatorId: r.id, to: "approved" })}>
                        Approve
                    </Button>
                )}
                {status !== "rejected" && (
                    <Button size="sm" variant="ghost" icon={X} disabled={decide.isPending} onClick={() => setConfirm({ row: r, to: "rejected" })} className="text-bad hover:bg-bad-soft hover:text-bad">
                        {status === "approved" ? "Revoke" : "Reject"}
                    </Button>
                )}
            </>
        ) : (
            <span className="text-xs text-ink-faint">View only</span>
        );

    return (
        <div className="space-y-5">
            <PageHeader icon={BellRing} title="Notification access" description="Approve which creators can send push notifications to their event attendees" />

            <Tabs label="Request status" variant="pill" tabs={STATUS_TABS} value={status} onChange={(v) => set({ status: v })} />

            <DataTable
                label="Notification access requests"
                rows={rows}
                columns={columns}
                rowKey={(r) => r.id}
                isLoading={isLoading}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: BellRing, title: status === "pending" ? "No requests waiting. You're up to date." : `No ${status} creators.` }}
                rowActions={rowActions}
                storageKey="notification-access"
                exportName="notification-access"
                summary={data ? `${rows.length.toLocaleString("en-IN")} ${status}` : undefined}
                card={{ title: (r) => nameOf(r), subtitle: (r) => r.email ?? undefined, fields: ["user", "access"] }}
            />

            <ConfirmDialog
                open={!!confirm}
                title={status === "approved" ? "Revoke notification access?" : "Reject notification access?"}
                description={
                    confirm &&
                    (status === "approved"
                        ? `${nameOf(confirm.row)} can no longer send push notifications to their attendees.`
                        : `${nameOf(confirm.row)} won't be able to send push notifications to their attendees.`)
                }
                confirmLabel={status === "approved" ? "Revoke" : "Reject"}
                tone="danger"
                isPending={decide.isPending}
                onConfirm={() => confirm && decide.mutate({ creatorId: confirm.row.id, to: confirm.to })}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

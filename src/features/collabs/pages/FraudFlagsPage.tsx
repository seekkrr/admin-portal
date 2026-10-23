import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Siren, Check, KeyRound, Repeat, MapPinOff } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { formatDateTime } from "@/utils/date";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { MarkerLink } from "../components/CollabPickers";
import { humanize, totalPagesOf } from "../utils";
import type { FraudFlag, FraudFlagStatus } from "../types";

const TYPE_META: Record<string, { label: string; icon: typeof Siren; help: string }> = {
    code_lockout: { label: "Code lockout", icon: KeyRound, help: "Too many wrong redeem codes at a place" },
    redeem_without_checkin: { label: "Redeem without check-in", icon: MapPinOff, help: "Redemption with no nearby check-in" },
    repeat_pairing: { label: "Repeat pairing", icon: Repeat, help: "Same creator × business redeemed repeatedly" },
};

const STATUSES: FraudFlagStatus[] = ["open", "resolved"];

function detailsText(flag: FraudFlag): string {
    return Object.entries(flag.details ?? {})
        .map(([k, v]) => `${humanize(k)}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
        .join("; ");
}

function FlagDetails({ flag }: { flag: FraudFlag }) {
    const entries = Object.entries(flag.details ?? {});
    if (entries.length === 0) return <span className="text-ink-faint">—</span>;
    return (
        <div className="space-y-0.5 text-xs">
            {entries.map(([k, v]) => (
                <div key={k} className="flex flex-wrap gap-1.5">
                    <span className="text-ink-muted">{humanize(k)}:</span>
                    {k === "marker_id" && typeof v === "string" ? (
                        <MarkerLink id={v} />
                    ) : (
                        <span className="break-all font-medium text-ink">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function FraudFlagsPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const { state, set } = useUrlState({ status: "open", page: 1 });
    const status: FraudFlagStatus = STATUSES.includes(state.status as FraudFlagStatus) ? (state.status as FraudFlagStatus) : "open";
    const page = Math.max(1, state.page);
    const [resolving, setResolving] = useState<FraudFlag | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["collabs-fraud-flags", status, page],
        queryFn: () => collabsAdminService.listFraudFlags({ status, page }),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const resolve = useMutation({
        mutationFn: ({ id, note }: { id: string; note: string }) => collabsAdminService.resolveFraudFlag(id, note),
        onSuccess: () => {
            toast.success("Fraud flag resolved");
            setResolving(null);
            queryClient.invalidateQueries({ queryKey: ["collabs-fraud-flags"] });
            queryClient.invalidateQueries({ queryKey: ["collabs-analytics"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to resolve flag"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to review fraud flags." />;

    const flags = data?.flags ?? [];

    const columns: DataColumn<FraudFlag>[] = [
        {
            id: "signal",
            header: "Signal",
            hideable: false,
            sortValue: (f) => TYPE_META[f.type]?.label ?? f.type,
            cell: (f) => {
                const meta = TYPE_META[f.type];
                const Icon = meta?.icon ?? Siren;
                return (
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bad-soft text-bad">
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div>
                            <div className="font-medium text-ink">{meta?.label ?? humanize(f.type)}</div>
                            {meta && <div className="text-xs text-ink-faint">{meta.help}</div>}
                        </div>
                    </div>
                );
            },
        },
        { id: "business", header: "Business", csv: (f) => f.business_id ?? "", cell: (f) => <IdLink kind="business" id={f.business_id} /> },
        {
            id: "creator",
            header: "Creator",
            csv: (f) => f.creator_user_id ?? "",
            cell: (f) =>
                f.creator_user_id ? (
                    <div className="flex flex-col items-start gap-0.5">
                        <IdLink kind="user" id={f.creator_user_id} />
                        <Link to={`/collabs/applications?creator_user_id=${f.creator_user_id}`} className="text-xs text-accent-700 hover:underline">
                            Collab requests
                        </Link>
                    </div>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        { id: "details", header: "Details", csv: detailsText, cell: (f) => <FlagDetails flag={f} /> },
        {
            id: "raised",
            header: "Raised",
            sortValue: (f) => f.created_at ?? "",
            csv: (f) => formatDateTime(f.created_at),
            cell: (f) => <span className="whitespace-nowrap text-ink-muted">{formatDateTime(f.created_at)}</span>,
        },
        { id: "status", header: "Status", sortValue: (f) => f.status, cell: (f) => <StatusPill status={f.status} /> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader icon={Siren} title="Fraud flags" description="Automatic signals: code lockouts, redemptions without a nearby check-in, repeated pairings" />

            <Tabs<FraudFlagStatus>
                label="Flag status"
                value={status}
                onChange={(v) => set({ status: v })}
                tabs={[
                    { value: "open", label: "Open", count: status === "open" ? data?.total : undefined },
                    { value: "resolved", label: "Resolved" },
                ]}
            />

            <DataTable
                label="Fraud flags"
                rows={flags}
                columns={columns}
                rowKey={(f) => f.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Siren, title: `No ${status} fraud flags` }}
                rowActions={(f) =>
                    f.status === "open" ? (
                        <Button size="sm" variant="secondary" icon={Check} onClick={() => setResolving(f)}>
                            Resolve
                        </Button>
                    ) : null
                }
                storageKey="fraud-flags"
                exportName="fraud-flags"
                summary={data ? `${flags.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (f) => TYPE_META[f.type]?.label ?? humanize(f.type),
                    subtitle: (f) => TYPE_META[f.type]?.help,
                    fields: ["business", "creator", "raised", "details"],
                }}
                footer={
                    data && (
                        <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} pageSize={data.page_size} onPageChange={(p) => set({ page: p })} />
                    )
                }
            />

            <ConfirmDialog
                open={!!resolving}
                title="Resolve fraud flag?"
                description={resolving ? `${TYPE_META[resolving.type]?.label ?? humanize(resolving.type)} — mark as reviewed.` : undefined}
                level="reason"
                reasonLabel="Note"
                reasonPlaceholder="e.g. Business changed its redeem code; creator warned"
                reasonMaxLength={1000}
                confirmLabel="Resolve"
                isPending={resolve.isPending}
                onCancel={() => setResolving(null)}
                onConfirm={(note) => resolving && resolve.mutate({ id: resolving.id, note: note ?? "" })}
            />
        </div>
    );
}

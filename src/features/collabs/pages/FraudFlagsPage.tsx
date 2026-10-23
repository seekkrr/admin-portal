import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Siren, Check, KeyRound, Repeat, MapPinOff } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Pagination } from "@/components/ui/Pagination";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { MonoId, PageHeader, PanelState, ReasonModal, SegmentedTabs, StatusPill, Toolbar, btnSmApprove, thClass } from "../components/CollabsUi";
import { MarkerLink } from "../components/CollabPickers";
import { fmtDateTime, humanize, totalPagesOf } from "../utils";
import type { FraudFlag, FraudFlagStatus } from "../types";

const TYPE_META: Record<string, { label: string; icon: typeof Siren; help: string }> = {
    code_lockout: { label: "Code lockout", icon: KeyRound, help: "Too many wrong redeem codes at a place" },
    redeem_without_checkin: { label: "Redeem without check-in", icon: MapPinOff, help: "Redemption with no nearby check-in" },
    repeat_pairing: { label: "Repeat pairing", icon: Repeat, help: "Same creator × business redeemed repeatedly" },
};

function FlagDetails({ flag }: { flag: FraudFlag }) {
    const entries = Object.entries(flag.details ?? {});
    if (entries.length === 0) return <span className="text-neutral-400">—</span>;
    return (
        <div className="space-y-0.5 text-xs">
            {entries.map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                    <span className="text-neutral-500">{humanize(k)}:</span>
                    {k === "marker_id" && typeof v === "string" ? (
                        <MarkerLink id={v} />
                    ) : (
                        <span className="text-neutral-800 font-medium">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function FraudFlagsPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<FraudFlagStatus>("open");
    const [page, setPage] = useState(1);
    const [resolving, setResolving] = useState<FraudFlag | null>(null);

    const { data, isLoading, error, refetch } = useQuery({
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

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                icon={Siren}
                title="Fraud Flags"
                gradient="from-red-500 to-red-600"
                subtitle="Automatic signals: code lockouts, redemptions without a nearby check-in, repeated pairings"
            />

            <Toolbar>
                <SegmentedTabs<FraudFlagStatus>
                    value={status}
                    onChange={(v) => {
                        setStatus(v);
                        setPage(1);
                    }}
                    tabs={[
                        { value: "open", label: "Open", count: status === "open" ? data?.total : undefined },
                        { value: "resolved", label: "Resolved" },
                    ]}
                />
            </Toolbar>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState isLoading={isLoading && !data} error={error} isEmpty={flags.length === 0} emptyIcon={Siren} emptyText={`No ${status} fraud flags`} onRetry={() => refetch()}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Signal</th>
                                    <th className={thClass}>Business</th>
                                    <th className={thClass}>Creator</th>
                                    <th className={thClass}>Details</th>
                                    <th className={thClass}>Raised</th>
                                    <th className={`${thClass} text-right`}>Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {flags.map((f) => {
                                    const meta = TYPE_META[f.type];
                                    const Icon = meta?.icon ?? Siren;
                                    return (
                                        <tr key={f.id} className="hover:bg-neutral-50/60 align-top">
                                            <td className="px-4 py-3">
                                                <div className="flex items-start gap-2">
                                                    <span className="mt-0.5 w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                                        <Icon className="w-3.5 h-3.5" />
                                                    </span>
                                                    <div>
                                                        <div className="font-medium text-neutral-900">{meta?.label ?? humanize(f.type)}</div>
                                                        {meta && <div className="text-[11px] text-neutral-400">{meta.help}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {f.business_id ? (
                                                    <Link to={`/collabs/businesses/${f.business_id}`} className="text-teal-700 hover:underline">
                                                        <MonoId id={f.business_id} />
                                                    </Link>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {f.creator_user_id ? (
                                                    <Link to={`/collabs/applications?creator_user_id=${f.creator_user_id}`} className="text-teal-700 hover:underline">
                                                        <MonoId id={f.creator_user_id} />
                                                    </Link>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <FlagDetails flag={f} />
                                            </td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDateTime(f.created_at)}</td>
                                            <td className="px-4 py-3 text-right">
                                                {f.status === "open" ? (
                                                    <button type="button" onClick={() => setResolving(f)} className={btnSmApprove}>
                                                        <Check className="w-3.5 h-3.5" /> Resolve
                                                    </button>
                                                ) : (
                                                    <StatusPill status={f.status} />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
                {data && <Pagination page={page} totalPages={totalPagesOf(data)} total={data.total} onPageChange={setPage} theme="rose" />}
            </div>

            <ReasonModal
                open={!!resolving}
                title="Resolve fraud flag"
                description={resolving ? `${TYPE_META[resolving.type]?.label ?? humanize(resolving.type)} — mark as reviewed.` : undefined}
                label="Note"
                placeholder="e.g. Business changed its redeem code; creator warned"
                maxLength={1000}
                confirmLabel="Resolve"
                tone="primary"
                isPending={resolve.isPending}
                onCancel={() => setResolving(null)}
                onConfirm={(note) => resolving && resolve.mutate({ id: resolving.id, note })}
            />
        </div>
    );
}

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, Check, X, ExternalLink, BadgeCheck, Save, ShieldBan, RefreshCw, SlidersHorizontal } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Field, SelectInput } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { Notice } from "../components/AdminBits";
import { humanize, socialProfileUrl } from "../utils";
import type { CreatorTier, PendingHandleVerification, SetTierResult } from "../types";

type SuspendChoice = "unchanged" | "suspend" | "lift";

export function CollabCreatorsPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const tierCardRef = useRef<HTMLDivElement>(null);
    const [userId, setUserId] = useState("");
    const [tier, setTier] = useState<CreatorTier>("verified");
    const [suspend, setSuspend] = useState<SuspendChoice>("unchanged");
    const [tierResult, setTierResult] = useState<SetTierResult | null>(null);

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ["collabs-creator-verifications"],
        queryFn: collabsAdminService.pendingVerifications,
        enabled: isStaff,
    });

    const verify = useMutation({
        mutationFn: ({ item, verified }: { item: PendingHandleVerification; verified: boolean }) =>
            collabsAdminService.verifyHandle(item.user_id, item.platform, verified),
        onSuccess: (res) => {
            toast.success(
                res.verified ? `${humanize(res.platform)} handle verified — creator tier is now ${res.tier}` : `${humanize(res.platform)} handle rejected`
            );
            queryClient.invalidateQueries({ queryKey: ["collabs-creator-verifications"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update handle"),
    });

    const setTierMutation = useMutation({
        mutationFn: () => collabsAdminService.setTier(userId.trim(), tier, suspend === "unchanged" ? undefined : suspend === "suspend"),
        onSuccess: (res) => {
            setTierResult(res);
            toast.success("Creator updated");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update creator"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to manage collab creators." />;

    const pending = data ?? [];
    const validUserId = /^[a-f0-9]{24}$/i.test(userId.trim());

    const prefill = (uid: string) => {
        setUserId(uid);
        setTierResult(null);
        tierCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const columns: DataColumn<PendingHandleVerification>[] = [
        {
            id: "creator",
            header: "Creator",
            hideable: false,
            sortValue: (p) => p.display_name ?? "",
            csv: (p) => `${p.display_name ?? ""} ${p.user_id}`.trim(),
            cell: (p) => (
                <div className="min-w-0">
                    <div className="font-medium text-ink">{p.display_name ?? "Unnamed creator"}</div>
                    <IdLink kind="user" id={p.user_id} />
                </div>
            ),
        },
        { id: "platform", header: "Platform", sortValue: (p) => p.platform, cell: (p) => <Tag tone="info">{humanize(p.platform)}</Tag> },
        {
            id: "handle",
            header: "Handle",
            sortValue: (p) => p.handle,
            cell: (p) => {
                const url = socialProfileUrl(p.platform, p.handle);
                return url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-700 hover:underline">
                        {p.handle} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                ) : (
                    p.handle
                );
            },
        },
        { id: "code", header: "Bio code", csv: (p) => p.code ?? "", cell: (p) => <span className="font-mono text-xs">{p.code ?? "—"}</span> },
    ];

    return (
        <div className="space-y-5">
            <PageHeader icon={UserCheck} title="Collab creators" description="Handle verification fallback, tier overrides and collab suspensions" />

            <Panel
                title={`Handle verification queue${data ? ` (${pending.length})` : ""}`}
                icon={BadgeCheck}
                description="Handles whose automatic bio-code check needs a person. Open the profile, confirm the code is in the bio (or a screenshot sent to support), then verify. Verifying upgrades the creator to the verified tier."
                bodyClassName="p-0"
                actions={
                    <Button size="sm" variant="secondary" icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                        Refresh
                    </Button>
                }
            >
                <DataTable
                    label="Handles waiting for review"
                    rows={pending}
                    columns={columns}
                    rowKey={(p) => `${p.user_id}-${p.platform}`}
                    isLoading={isLoading}
                    error={error}
                    onRetry={() => refetch()}
                    empty={{ icon: BadgeCheck, title: "No handles waiting for review" }}
                    rowActions={(p) => {
                        const busy = verify.isPending && verify.variables?.item === p;
                        return (
                            <>
                                <IconButton icon={SlidersHorizontal} size="sm" label={`Set tier for ${p.display_name ?? "this creator"}`} onClick={() => prefill(p.user_id)} />
                                <Button size="sm" variant="secondary" icon={X} disabled={busy} onClick={() => verify.mutate({ item: p, verified: false })}>
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    icon={Check}
                                    disabled={busy}
                                    loading={busy && verify.variables?.verified}
                                    onClick={() => verify.mutate({ item: p, verified: true })}
                                >
                                    Verify
                                </Button>
                            </>
                        );
                    }}
                    toolbar={false}
                    frame="bare"
                    card={{ title: (p) => p.display_name ?? "Unnamed creator", subtitle: (p) => humanize(p.platform), fields: ["handle", "code"] }}
                />
            </Panel>

            <div ref={tierCardRef}>
                <Panel title="Tier and suspension" icon={ShieldBan}>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="space-y-4">
                            <Field label="Creator" htmlFor="tier-user" required hint="Search by name or email, or paste the user ID.">
                                <EntityPicker
                                    id="tier-user"
                                    type="user"
                                    label="Creator"
                                    value={userId}
                                    onChange={(id) => {
                                        setUserId(id);
                                        setTierResult(null);
                                    }}
                                />
                            </Field>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label="Tier" required>
                                    <SelectInput value={tier} onChange={(e) => setTier(e.target.value as CreatorTier)}>
                                        <option value="community">Community</option>
                                        <option value="verified">Verified</option>
                                    </SelectInput>
                                </Field>
                                <Field label="Collab suspension">
                                    <SelectInput value={suspend} onChange={(e) => setSuspend(e.target.value as SuspendChoice)}>
                                        <option value="unchanged">Don't change</option>
                                        <option value="suspend">Suspend from collabs</option>
                                        <option value="lift">Lift suspension</option>
                                    </SelectInput>
                                </Field>
                            </div>
                            {suspend === "suspend" && (
                                <Notice tone="bad">Suspending also turns off “open to collab”, hiding the creator from business matching.</Notice>
                            )}
                            <Button variant="primary" icon={Save} onClick={() => setTierMutation.mutate()} disabled={!validUserId} loading={setTierMutation.isPending}>
                                Apply
                            </Button>
                        </div>
                        <div>
                            {tierResult ? (
                                <div className="space-y-3 rounded-control border border-accent-200 bg-accent-50/50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Updated</p>
                                    <DetailList>
                                        <DetailRow label="User" value={<IdLink kind="user" id={tierResult.user_id} short={false} />} />
                                        <DetailRow
                                            label="Tier"
                                            value={<StatusPill status={tierResult.tier === "verified" ? "verified" : "free"} label={humanize(tierResult.tier)} />}
                                        />
                                        {tierResult.suspended !== undefined && (
                                            <DetailRow
                                                label="Suspended"
                                                value={tierResult.suspended ? <StatusPill status="suspended" /> : <StatusPill status="active" label="Not suspended" />}
                                            />
                                        )}
                                        {tierResult.open_to_collab === false && <DetailRow label="Open to collab" value="Turned off" />}
                                    </DetailList>
                                </div>
                            ) : (
                                <div className="flex h-full min-h-[120px] items-center justify-center rounded-control border border-dashed border-line-strong p-4 text-center text-sm text-ink-faint">
                                    Verified tier unlocks collabs that require verified creators. Use suspension for repeated no-shows or abuse.
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    );
}

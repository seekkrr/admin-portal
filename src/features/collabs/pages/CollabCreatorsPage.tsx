import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck, Check, X, ExternalLink, BadgeCheck, Save, ShieldBan, RefreshCw } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import {
    Chip, DetailRow, Field, LoadingButtonIcon, MonoId, PageHeader, PanelState, SectionCard, StatusPill, btnPrimary, btnSmApprove,
    btnSmNeutral, btnSmReject, inputClass, thClass,
} from "../components/CollabsUi";
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
                res.verified
                    ? `${humanize(res.platform)} handle verified — creator tier is now ${res.tier}`
                    : `${humanize(res.platform)} handle rejected`
            );
            queryClient.invalidateQueries({ queryKey: ["collabs-creator-verifications"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update handle"),
    });

    const setTierMutation = useMutation({
        mutationFn: () =>
            collabsAdminService.setTier(userId.trim(), tier, suspend === "unchanged" ? undefined : suspend === "suspend"),
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

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                icon={UserCheck}
                title="Collab Creators"
                gradient="from-violet-500 to-violet-600"
                subtitle="Handle verification fallback, tier overrides and collab suspensions"
            />

            <SectionCard
                title={`Handle verification queue${data ? ` (${pending.length})` : ""}`}
                icon={BadgeCheck}
                bodyClassName="p-0"
                actions={
                    <button type="button" onClick={() => refetch()} className={btnSmNeutral}>
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
                    </button>
                }
            >
                <p className="px-6 pt-4 text-xs text-neutral-500">
                    Handles whose automatic bio-code check needs manual review. Open the profile, confirm the code appears in the bio (or a screenshot
                    sent to support), then approve. Approving a handle upgrades the creator to the verified tier.
                </p>
                <PanelState isLoading={isLoading} error={error} isEmpty={pending.length === 0} emptyIcon={BadgeCheck} emptyText="No handles waiting for review" onRetry={() => refetch()}>
                    <div className="overflow-x-auto mt-2">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Creator</th>
                                    <th className={thClass}>Platform</th>
                                    <th className={thClass}>Handle</th>
                                    <th className={thClass}>Bio code</th>
                                    <th className={`${thClass} text-right`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {pending.map((p) => {
                                    const url = socialProfileUrl(p.platform, p.handle);
                                    const busy = verify.isPending && verify.variables?.item === p;
                                    return (
                                        <tr key={`${p.user_id}-${p.platform}`} className="hover:bg-neutral-50/60">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900">{p.display_name ?? "Unnamed creator"}</div>
                                                <MonoId id={p.user_id} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <Chip tone="violet">{humanize(p.platform)}</Chip>
                                            </td>
                                            <td className="px-4 py-3">
                                                {url ? (
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline">
                                                        {p.handle} <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                ) : (
                                                    p.handle
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">{p.code ?? "—"}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => prefill(p.user_id)} className={btnSmNeutral}>
                                                        Tier…
                                                    </button>
                                                    <button type="button" disabled={busy} onClick={() => verify.mutate({ item: p, verified: false })} className={btnSmReject}>
                                                        <X className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                    <button type="button" disabled={busy} onClick={() => verify.mutate({ item: p, verified: true })} className={btnSmApprove}>
                                                        <Check className="w-3.5 h-3.5" /> Verify
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
            </SectionCard>

            <div ref={tierCardRef}>
                <SectionCard title="Tier & suspension" icon={ShieldBan}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Field label="Creator user id" htmlFor="tier-user" required hint={userId && !validUserId ? "Expected a 24-character id." : "Find ids in Users, Collab Requests or the queue above."}>
                                <input
                                    id="tier-user"
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    className={`${inputClass} font-mono`}
                                    placeholder="64f…"
                                />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Tier" htmlFor="tier-tier" required>
                                    <select id="tier-tier" value={tier} onChange={(e) => setTier(e.target.value as CreatorTier)} className={inputClass}>
                                        <option value="community">Community</option>
                                        <option value="verified">Verified</option>
                                    </select>
                                </Field>
                                <Field label="Collab suspension" htmlFor="tier-suspend">
                                    <select id="tier-suspend" value={suspend} onChange={(e) => setSuspend(e.target.value as SuspendChoice)} className={inputClass}>
                                        <option value="unchanged">Don't change</option>
                                        <option value="suspend">Suspend from collabs</option>
                                        <option value="lift">Lift suspension</option>
                                    </select>
                                </Field>
                            </div>
                            {suspend === "suspend" && (
                                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                                    Suspending also turns off “open to collab”, hiding the creator from business matching.
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={() => setTierMutation.mutate()}
                                disabled={!validUserId || setTierMutation.isPending}
                                className={btnPrimary}
                            >
                                <LoadingButtonIcon loading={setTierMutation.isPending} icon={Save} /> Apply
                            </button>
                        </div>
                        <div>
                            {tierResult ? (
                                <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Updated</p>
                                    <DetailRow label="User" value={<MonoId id={tierResult.user_id} short={false} />} />
                                    <DetailRow label="Tier" value={<StatusPill status={tierResult.tier === "verified" ? "verified" : "free"} label={humanize(tierResult.tier)} />} />
                                    {tierResult.suspended !== undefined && (
                                        <DetailRow label="Suspended" value={tierResult.suspended ? <StatusPill status="suspended" /> : <StatusPill status="active" label="Not suspended" />} />
                                    )}
                                    {tierResult.open_to_collab === false && <DetailRow label="Open to collab" value="Turned off" />}
                                </div>
                            ) : (
                                <div className="h-full min-h-[120px] rounded-xl border border-dashed border-neutral-200 flex items-center justify-center text-sm text-neutral-400 p-4 text-center">
                                    Verified tier unlocks collabs that require verified creators. Use suspension for repeated no-shows or abuse.
                                </div>
                            )}
                        </div>
                    </div>
                </SectionCard>
            </div>
        </div>
    );
}

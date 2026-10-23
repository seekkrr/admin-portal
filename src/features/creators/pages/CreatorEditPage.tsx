import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, Banknote, CheckCircle2, IndianRupee, Shield, Star, TrendingUp, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { AccessDenied } from "@components/AccessDenied";
import { useAuthStore } from "@store/auth.store";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { humanizeStatus } from "@/components/ui/status";
import { formatCurrency } from "@/utils/format";
import { formatDate, formatDateTime } from "@/utils/date";
import { cx } from "@/utils/cx";
import { creatorsService } from "../services/creators.service";

// ---- Creator verification statuses ----
const CREATOR_STATUSES = ["active", "suspended", "rejected"] as const;

type ConfirmAction =
    | { type: "status-change"; payload: { status: "active" | "rejected" | "suspended" } }
    | { type: "verify"; payload: { is_verified: boolean } };

const ALLOWED_ROLES = ["admin", "super_admin", "finance"];

export function CreatorEditPage() {
    const { creatorId: creatorIdParam } = useParams<{ creatorId: string }>();
    const creatorId = creatorIdParam ?? "";
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuthStore();
    const hasAccess = !!currentUser && currentUser.role?.some((r) => ALLOWED_ROLES.includes(r));

    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

    const { data: creator, isLoading, error, refetch } = useQuery({
        queryKey: ["creator-detail", creatorId],
        queryFn: () => creatorsService.getCreator(creatorId),
        enabled: !!creatorId && hasAccess,
    });

    const displayName = creator?.name ?? creatorId ?? "Creator";
    usePageTitle(creator ? displayName : null);

    const updateMutation = useMutation({
        mutationFn: (updates: { status?: string; is_verified?: boolean }) => creatorsService.updateCreator(creatorId, updates),
        onSuccess: () => {
            toast.success("Creator updated");
            queryClient.invalidateQueries({ queryKey: ["creator-detail", creatorId] });
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
            setConfirmAction(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmAction(null);
        },
    });

    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        if (confirmAction.type === "status-change") {
            updateMutation.mutate({ status: confirmAction.payload.status });
        } else {
            updateMutation.mutate({ is_verified: confirmAction.payload.is_verified });
        }
    }, [confirmAction, updateMutation]);

    if (!hasAccess) {
        return <AccessDenied message="Only admins and finance can access this page." />;
    }

    if (isLoading) return <LoadingState label="Loading creator…" />;

    if (error || !creator) {
        return (
            <div className="rounded-card border border-line bg-surface shadow-card">
                <ErrorState
                    error={error ?? new Error("Creator not found.")}
                    title="Couldn't load this creator"
                    onRetry={error ? () => refetch() : undefined}
                />
                <div className="flex justify-center pb-8">
                    <ButtonLink to="/creators" size="sm" variant="ghost">
                        Back to creators
                    </ButtonLink>
                </div>
            </div>
        );
    }

    const verifyOn = confirmAction?.type === "verify" && confirmAction.payload.is_verified;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Video}
                title={displayName}
                badge={
                    <span className="flex flex-wrap items-center gap-2">
                        <StatusPill status={creator.status} />
                        {creator.is_verified && (
                            <Tag tone="good">
                                <CheckCircle2 className="h-3 w-3" aria-hidden /> Verified
                            </Tag>
                        )}
                    </span>
                }
                description={creator.tagline ?? undefined}
                actions={
                    <ButtonLink to={`/payouts?createForCreator=${creatorId}&amount=${creator.pending_payouts ?? 0}`} variant="secondary" icon={Banknote}>
                        Create payout
                    </ButtonLink>
                }
            />

            <Panel title="Creator stats" icon={TrendingUp}>
                <StatGrid cols={5}>
                    <StatTile icon={Award} label="Quests" value={(creator.total_quests ?? 0).toLocaleString("en-IN")} />
                    <StatTile icon={IndianRupee} label="Earnings" value={formatCurrency(creator.total_earnings ?? 0)} />
                    <StatTile icon={Banknote} label="Pending payout" value={formatCurrency(creator.pending_payouts ?? 0)} />
                    <StatTile icon={Users} label="Travelers" value={(creator.travelers_served ?? 0).toLocaleString("en-IN")} />
                    <StatTile icon={Star} label="Rating" value={creator.rating ?? "—"} hint={creator.review_count ? `${creator.review_count} reviews` : undefined} />
                </StatGrid>
            </Panel>

            <Panel title="Profile">
                <DetailList>
                    <DetailRow label="Creator ID" value={<CopyText value={creatorId} mono truncate={false} />} />
                    <DetailRow label="User" value={<IdLink kind="user" id={creator.user_id} label={creator.name ?? undefined} />} />
                    {creator.creator_bio && <DetailRow label="Bio" value={<span className="whitespace-pre-line">{creator.creator_bio}</span>} />}
                    {creator.top_themes && creator.top_themes.length > 0 && (
                        <DetailRow
                            label="Top themes"
                            value={
                                <span className="flex flex-wrap gap-1.5">
                                    {creator.top_themes.map((t) => (
                                        <Tag key={t}>{t}</Tag>
                                    ))}
                                </span>
                            }
                        />
                    )}
                    <DetailRow label="Joined" value={formatDate(creator.created_at)} />
                    <DetailRow label="Stats updated" value={formatDateTime(creator.stats_last_updated)} />
                </DetailList>
            </Panel>

            <Panel title="Verification status" icon={Shield} description="Only verified creators are eligible for payouts.">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {CREATOR_STATUSES.map((status) => {
                        const isCurrent = creator.status === status;
                        return (
                            <button
                                key={status}
                                type="button"
                                disabled={isCurrent || updateMutation.isPending}
                                onClick={() => setConfirmAction({ type: "status-change", payload: { status } })}
                                aria-pressed={isCurrent}
                                className={cx(
                                    "flex items-center justify-between rounded-control border px-4 py-3 text-sm font-medium transition-colors disabled:cursor-default",
                                    isCurrent ? "border-accent-300 bg-accent-50 text-accent-700" : "border-line text-ink hover:border-accent-300 hover:bg-accent-50/50 disabled:opacity-50"
                                )}
                            >
                                <StatusPill status={status} />
                                {isCurrent && <span className="text-xs">Current</span>}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-4 border-t border-line pt-4">
                    <Button
                        variant={creator.is_verified ? "secondary" : "primary"}
                        icon={CheckCircle2}
                        disabled={updateMutation.isPending}
                        onClick={() => setConfirmAction({ type: "verify", payload: { is_verified: !creator.is_verified } })}
                    >
                        {creator.is_verified ? "Remove verification" : "Verify creator"}
                    </Button>
                </div>
            </Panel>

            <ConfirmDialog
                open={confirmAction?.type === "status-change"}
                title="Change creator status?"
                description={`This creator's status becomes "${confirmAction?.type === "status-change" ? humanizeStatus(confirmAction.payload.status) : ""}".`}
                confirmLabel="Change status"
                tone="warning"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={updateMutation.isPending}
            />

            <ConfirmDialog
                open={confirmAction?.type === "verify"}
                title={verifyOn ? "Verify creator?" : "Remove verification?"}
                description={verifyOn ? "Mark this creator as verified? They will be eligible for payouts." : "Remove verification from this creator?"}
                confirmLabel={verifyOn ? "Verify" : "Remove verification"}
                tone={verifyOn ? "primary" : "warning"}
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={updateMutation.isPending}
            />
        </div>
    );
}

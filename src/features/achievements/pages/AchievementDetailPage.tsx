import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { CopyText } from "@/components/ui/CopyText";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { humanizeStatus } from "@/components/ui/status";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/utils/date";
import { achievementsService } from "../services/achievements.service";
import { AchievementFormModal } from "../components/AchievementFormModal";
import { RARITY_TONE, triggerLabel } from "../components/achievementForm";
import type { Achievement } from "@/types";

export function AchievementDetailPage() {
    const { achievementId: achievementIdParam } = useParams<{ achievementId: string }>();
    const achievementId = achievementIdParam ?? "";
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const IS_SUPER = !!user?.role?.includes("super_admin");

    // A snapshot, so a background refetch doesn't reset the form while editing.
    const [editing, setEditing] = useState<Achievement | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);

    const { data: achievement, isLoading, error, refetch } = useQuery<Achievement>({
        queryKey: ["achievement-detail", achievementId],
        queryFn: () => achievementsService.getById(achievementId),
        enabled: !!achievementId,
        staleTime: 60 * 1000,
    });
    usePageTitle(achievement?.title);

    const deleteMutation = useMutation({
        mutationFn: (hard: boolean) => achievementsService.remove(achievementId, hard),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement deleted");
            navigate("/achievements");
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete achievement");
            setConfirmDelete(false);
        },
    });

    if (isLoading) return <LoadingState label="Loading achievement…" />;

    if (error || !achievement) {
        return (
            <Panel>
                {error ? (
                    <ErrorState error={error} title="Couldn't load this achievement" onRetry={() => refetch()} />
                ) : (
                    <EmptyState
                        icon={Trophy}
                        title="This achievement doesn't exist."
                        action={
                            <Link to="/achievements" className="text-sm font-medium text-accent-700 hover:underline">
                                Back to achievements
                            </Link>
                        }
                    />
                )}
            </Panel>
        );
    }

    const rarityTag = <Tag tone={RARITY_TONE[achievement.rarity]}>{humanizeStatus(achievement.rarity)}</Tag>;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Trophy}
                title={achievement.title}
                badge={
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-normal">
                        {rarityTag}
                        <Tag tone={achievement.is_active ? "good" : "neutral"}>{achievement.is_active ? "Active" : "Inactive"}</Tag>
                    </span>
                }
                description={`${triggerLabel(achievement.trigger_type)} · ${achievement.trigger_threshold.toLocaleString("en-IN")} · ${achievement.rewards_points.toLocaleString("en-IN")} points`}
                actions={
                    CAN_MANAGE && (
                        <>
                            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(achievement)}>
                                Edit
                            </Button>
                            <Button
                                variant="danger"
                                icon={Trash2}
                                onClick={() => {
                                    setHardDelete(false);
                                    setConfirmDelete(true);
                                }}
                            >
                                Delete
                            </Button>
                        </>
                    )
                }
            />

            <Panel title="Details">
                <div className="flex flex-col gap-5 sm:flex-row">
                    {achievement.icon_url && (
                        <img
                            src={achievement.icon_url}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-card border border-line bg-surface-muted object-cover"
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                        />
                    )}
                    <DetailList className="min-w-0 flex-1">
                        <DetailRow label="Description" value={achievement.description ? <span className="whitespace-pre-wrap">{achievement.description}</span> : "—"} />
                        <DetailRow label="Trigger" value={triggerLabel(achievement.trigger_type)} />
                        <DetailRow label="Threshold" value={achievement.trigger_threshold.toLocaleString("en-IN")} />
                        <DetailRow label="Reward points" value={achievement.rewards_points.toLocaleString("en-IN")} />
                        <DetailRow label="Rarity" value={rarityTag} />
                        <DetailRow
                            label="Perks"
                            value={
                                achievement.perks.length > 0 ? (
                                    <ul className="list-inside list-disc space-y-0.5">
                                        {achievement.perks.map((p, i) => (
                                            <li key={`${p}-${i}`}>{p}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    "—"
                                )
                            }
                        />
                        <DetailRow label="Active" value={achievement.is_active ? "Yes" : "No"} />
                        <DetailRow
                            label="Icon"
                            value={
                                achievement.icon_url ? (
                                    <a href={achievement.icon_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-700 hover:underline">
                                        Open icon <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                    </a>
                                ) : (
                                    "—"
                                )
                            }
                        />
                        <DetailRow label="Created" value={formatDateTime(achievement.created_at)} />
                        <DetailRow label="Updated" value={formatDateTime(achievement.updated_at)} />
                        <DetailRow label="ID" value={<CopyText value={achievement._id} mono truncate={false} />} />
                    </DetailList>
                </div>
            </Panel>

            <AchievementFormModal open={!!editing} achievement={editing} onClose={() => setEditing(null)} />

            <ConfirmDialog
                open={confirmDelete}
                title={hardDelete ? "Permanently delete achievement?" : "Delete achievement?"}
                description={hardDelete ? `"${achievement.title}" is removed for good.` : `"${achievement.title}" is hidden and can no longer be earned.`}
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hardDelete ? "type" : "simple"}
                typeToConfirm={achievement.title.trim() || "DELETE"}
                isPending={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate(hardDelete)}
                onCancel={() => {
                    setConfirmDelete(false);
                    setHardDelete(false);
                }}
            >
                {IS_SUPER && <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Can't be undone." />}
            </ConfirmDialog>
        </div>
    );
}

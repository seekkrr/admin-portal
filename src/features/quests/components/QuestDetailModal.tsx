import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Eye, IndianRupee, Layers, Map as MapIcon, Star, Tag as TagIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DetailList, DetailRow } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { questsService } from "../services/quests.service";
import { formatDuration } from "../utils/formatters";
import { QuestStatusPill } from "./QuestStatusPill";
import type { QuestStatus } from "@/types";

// ---- Props ----
interface QuestDetailModalProps {
    open: boolean;
    questId: string | null;
    questTitle: string;
    questStatus: QuestStatus;
    onClose: () => void;
    onStatusChange?: (questId: string, status: QuestStatus) => void;
    canDelete?: boolean;
    onDelete?: (questId: string) => void;
}

function SectionLabel({ children }: { children: string }) {
    return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>;
}

/** Read-only quick view of a quest, opened from the quests list. */
export function QuestDetailModal({ open, questId, questTitle, questStatus, onClose }: QuestDetailModalProps) {
    const navigate = useNavigate();

    const { data: quest, isLoading, error, refetch } = useQuery({
        queryKey: ["quest-detail", questId],
        queryFn: () => questsService.getQuestDetail(questId ?? ""),
        enabled: open && !!questId,
        staleTime: 30_000,
    });

    return (
        <Modal
            open={open && !!questId}
            onClose={onClose}
            icon={MapIcon}
            title={questTitle || "Untitled quest"}
            description={
                <span className="flex flex-wrap items-center gap-2">
                    <QuestStatusPill status={questStatus} />
                    {quest && quest.view_count > 0 && <Tag>{quest.view_count.toLocaleString("en-IN")} views</Tag>}
                </span>
            }
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        variant="primary"
                        icon={Eye}
                        onClick={() => {
                            onClose();
                            navigate(`/quests/${questId}`);
                        }}
                    >
                        Open quest
                    </Button>
                </>
            }
        >
            {isLoading ? (
                <LoadingState label="Loading quest…" />
            ) : error ? (
                <ErrorState error={error} title="Couldn't load the quest" onRetry={() => refetch()} compact />
            ) : quest ? (
                <>
                    <StatGrid cols={3}>
                        <StatTile icon={TagIcon} label="Theme" value={<span className="capitalize">{quest.theme?.[0] ?? "—"}</span>} />
                        <StatTile icon={Star} label="Difficulty" value={<span className="capitalize">{quest.difficulty ?? "—"}</span>} />
                        <StatTile icon={Clock} label="Duration" value={formatDuration(quest.duration_minutes)} />
                        <StatTile icon={IndianRupee} label="Price" value={quest.price > 0 ? `₹${quest.price.toLocaleString("en-IN")}` : "Free"} />
                        <StatTile icon={Eye} label="Views" value={(quest.view_count ?? 0).toLocaleString("en-IN")} />
                        <StatTile icon={Layers} label="Places" value={quest.total_markers ?? 0} />
                    </StatGrid>

                    {quest.description && (
                        <div>
                            <SectionLabel>Description</SectionLabel>
                            <p className="whitespace-pre-line rounded-card border border-line bg-surface-muted p-4 text-sm leading-relaxed text-ink">{quest.description}</p>
                        </div>
                    )}

                    <DetailList>
                        {quest.creator_summary?.id && (
                            <DetailRow label="Creator" value={<IdLink kind="creator" id={quest.creator_summary.id} label={quest.creator_summary.name ?? undefined} />} />
                        )}
                        {quest.region_summary?.id && (
                            <DetailRow label="Region" value={<IdLink kind="region" id={quest.region_summary.id} label={quest.region_summary.name ?? undefined} />} />
                        )}
                    </DetailList>

                    {quest.total_markers > 0 && (
                        <div>
                            <SectionLabel>{`Places (${quest.total_markers})`}</SectionLabel>
                            <ol className="divide-y divide-line rounded-card border border-line">
                                {quest.marker_summaries.slice(0, 4).map((m) => (
                                    <li key={m.marker_id} className="flex items-center gap-2.5 px-3 py-2.5">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                                            {m.order ?? "·"}
                                        </span>
                                        <IdLink kind="place" id={m.marker_id} label={m.name ?? "Unnamed place"} className="truncate text-sm" />
                                    </li>
                                ))}
                                {quest.total_markers > 4 && <li className="px-3 py-2 text-center text-xs text-ink-muted">+{quest.total_markers - 4} more</li>}
                            </ol>
                        </div>
                    )}

                    {quest.cloudinary_assets.length > 0 && (
                        <div>
                            <SectionLabel>{`Media (${quest.cloudinary_assets.length})`}</SectionLabel>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {quest.cloudinary_assets.slice(0, 5).map((asset) => (
                                    <img
                                        key={asset.public_id}
                                        src={asset.secure_url}
                                        alt={asset.alt_text || ""}
                                        className="h-16 w-16 shrink-0 rounded-control border border-line object-cover"
                                    />
                                ))}
                                {quest.cloudinary_assets.length > 5 && (
                                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-control border border-line text-xs text-ink-muted">
                                        +{quest.cloudinary_assets.length - 5}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : null}
        </Modal>
    );
}

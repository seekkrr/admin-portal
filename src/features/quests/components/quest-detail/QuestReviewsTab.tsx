import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Star } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button, IconButton } from "@/components/ui/Button";
import { Tag } from "@/components/ui/StatusPill";
import { SectionState } from "@/components/detail/DetailStates";
import { count } from "@/components/detail/detailFormat";
import { questDetailApi } from "@/services/admin-detail.service";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { QuestReviewRow } from "@/types/admin-detail";

const LIMIT = 20;

/** Reviews of the quest (hidden ones too); hide or show them. */
export function QuestReviewsTab({ questId, canEdit }: { questId: string; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const [limit, setLimit] = useState(LIMIT);
    const reviews = useQuery({
        queryKey: ["quest-reviews", questId, limit],
        queryFn: () => questDetailApi.reviews(questId, { page: 1, limit }),
        placeholderData: (prev) => prev,
        retry: false,
    });
    const moderate = useMutation({
        mutationFn: ({ review, visible }: { review: QuestReviewRow; visible: boolean }) => questDetailApi.setReviewVisible(review._id, visible),
        onSuccess: (_, { visible }) => {
            toast.success(visible ? "Review shown" : "Review hidden");
            queryClient.invalidateQueries({ queryKey: ["quest-reviews", questId] });
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const items = reviews.data?.reviews ?? [];

    return (
        <Panel title={`Reviews${reviews.data ? ` (${count(reviews.data.total)})` : ""}`} icon={Star} bodyClassName="p-0">
            <SectionState isLoading={reviews.isLoading} error={reviews.error} isEmpty={items.length === 0} emptyText="No reviews yet" emptyIcon={Star} what="Reviews" onRetry={() => reviews.refetch()}>
                <ul className="divide-y divide-line">
                    {items.map((r) => (
                        <li key={r._id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-medium text-warn" aria-label={`${r.rating ?? 0} stars`}>
                                        {"★".repeat(Math.round(r.rating ?? 0)) || "—"}
                                    </span>
                                    {r.user_id && (
                                        <Link to={`/users/${r.user_id}`} className="text-xs text-accent-700 hover:underline">
                                            Reviewer
                                        </Link>
                                    )}
                                    <span className="text-xs text-ink-faint" title={formatDateTime(r.created_at)}>
                                        {formatRelative(r.created_at)}
                                    </span>
                                    {r.is_visible === false && <Tag tone="bad">Hidden</Tag>}
                                </div>
                                {r.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{r.comment}</p>}
                                {r.creator_response && <p className="mt-2 rounded-control bg-surface-muted px-3 py-2 text-xs text-ink-muted">Creator: {r.creator_response}</p>}
                            </div>
                            {canEdit && (
                                <IconButton
                                    icon={r.is_visible === false ? Eye : EyeOff}
                                    size="sm"
                                    label={r.is_visible === false ? "Show review" : "Hide review"}
                                    loading={moderate.isPending && moderate.variables?.review._id === r._id}
                                    onClick={() => moderate.mutate({ review: r, visible: r.is_visible === false })}
                                />
                            )}
                        </li>
                    ))}
                </ul>
                {(reviews.data?.total ?? 0) > items.length && (
                    <div className="border-t border-line px-4 py-3 text-center">
                        <Button size="sm" variant="secondary" loading={reviews.isFetching} onClick={() => setLimit((l) => Math.min(100, l + LIMIT))} disabled={limit >= 100}>
                            Show more
                        </Button>
                    </div>
                )}
            </SectionState>
        </Panel>
    );
}

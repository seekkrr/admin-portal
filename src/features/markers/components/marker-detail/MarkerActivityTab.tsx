import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Heart, MapPin, Sparkles, Star, Footprints } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { IconButton } from "@/components/ui/Button";
import { Tag } from "@/components/ui/StatusPill";
import { StatTiles } from "@/components/detail/StatTiles";
import { SectionState } from "@/components/detail/DetailStates";
import { count } from "@/components/detail/detailFormat";
import { placeDetailApi, questDetailApi } from "@/services/admin-detail.service";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { Marker } from "@/types";
import type { MarkerExtras, PlaceReview } from "@/types/admin-detail";

/** Check-ins, likes and reviews at a glance, with the latest reviews (hide / show). */
export function MarkerActivityTab({ marker, canEdit }: { marker: Marker & MarkerExtras; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const reviews = useQuery({
        queryKey: ["marker-reviews", marker.id],
        queryFn: () => placeDetailApi.reviews(marker.id, 10),
        retry: false,
    });
    const moderate = useMutation({
        mutationFn: ({ review, visible }: { review: PlaceReview; visible: boolean }) => questDetailApi.setReviewVisible(review._id, visible),
        onSuccess: (_, { visible }) => {
            toast.success(visible ? "Review shown" : "Review hidden");
            queryClient.invalidateQueries({ queryKey: ["marker-reviews", marker.id] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className="space-y-5">
            <StatTiles
                items={[
                    { label: "Check-ins", value: count(marker.checkins_count), icon: MapPin },
                    { label: "Rating", value: marker.rating ? marker.rating.toFixed(1) : "—", icon: Star },
                    { label: "Reviews", value: count(marker.review_count), icon: Star },
                    { label: "Likes", value: count(marker.likes_count), icon: Heart },
                    { label: "Used in quests", value: count(marker.usage_count), icon: Footprints },
                    { label: "Open collabs", value: count(marker.collab_open_count), icon: Sparkles },
                ]}
            />
            <Panel title="Latest reviews" icon={Star} bodyClassName="p-0">
                <SectionState
                    isLoading={reviews.isLoading}
                    error={reviews.error}
                    isEmpty={(reviews.data?.reviews.length ?? 0) === 0}
                    emptyText="No reviews yet"
                    emptyIcon={Star}
                    what="Reviews"
                    onRetry={() => reviews.refetch()}
                >
                    <ul className="divide-y divide-line">
                        {(reviews.data?.reviews ?? []).map((r) => (
                            <li key={r._id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="font-medium text-ink">{"★".repeat(Math.round(r.rating ?? 0)) || "—"}</span>
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
                    {(reviews.data?.total ?? 0) > (reviews.data?.reviews.length ?? 0) && (
                        <p className="border-t border-line px-4 py-3 text-center text-xs text-ink-faint">
                            Showing the latest {reviews.data?.reviews.length} of {count(reviews.data?.total)}. All reviews are on the Reviews page.
                        </p>
                    )}
                </SectionState>
            </Panel>
        </div>
    );
}

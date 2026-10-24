import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, MessageSquareReply, Send, Star, Trash2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { reviewsService } from "../services/reviews.service";
import { ReviewStars } from "../components/ReviewStars";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextArea } from "@/components/ui/Field";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/utils/date";

const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];

export function ReviewDetailPage() {
    const { reviewId: reviewIdParam } = useParams<{ reviewId: string }>();
    const reviewId = reviewIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canModerate = !!user?.role?.some((r) => CAN_MODERATE_ROLES.includes(r as string));
    const canDelete = !!user?.role?.some((r) => CAN_DELETE_ROLES.includes(r as string));

    const [response, setResponse] = useState("");
    const [confirmModerate, setConfirmModerate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { data: review, isLoading, error, refetch } = useQuery({
        queryKey: ["review-detail", reviewId],
        queryFn: () => reviewsService.getById(reviewId),
        enabled: !!reviewId,
    });

    usePageTitle(review ? `${review.rating}-star review` : null);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["review-detail", reviewId] });
        queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    };

    const moderateMut = useMutation({
        mutationFn: (isVisible: boolean) => reviewsService.moderate(reviewId, isVisible),
        onSuccess: (updated) => {
            invalidate();
            toast.success(updated.is_visible ? "Review is now visible" : "Review hidden");
            setConfirmModerate(false);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to update visibility");
            setConfirmModerate(false);
        },
    });

    const respondMut = useMutation({
        mutationFn: () => reviewsService.respond(reviewId, response),
        onSuccess: () => {
            invalidate();
            toast.success("Response submitted");
            setResponse("");
        },
        onError: (err: Error) => toast.error(err.message || "Failed to submit response"),
    });

    const deleteMut = useMutation({
        mutationFn: () => reviewsService.remove(reviewId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
            toast.success("Review deleted");
            navigate("/reviews", { replace: true });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to delete review");
            setConfirmDelete(false);
        },
    });

    if (isLoading) return <LoadingState label="Loading review…" />;

    if (error || !review) {
        return (
            <Panel>
                <ErrorState title="Couldn't load this review" error={error ?? new Error("It may have been deleted.")} onRetry={error ? () => refetch() : undefined} />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/reviews" variant="secondary">
                        Back to reviews
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    return (
        <div className="max-w-3xl space-y-5">
            <PageHeader
                icon={Star}
                title={<ReviewStars rating={review.rating} size="md" />}
                badge={<StatusPill status={review.is_visible ? "visible" : "hidden"} />}
                description={`Posted ${formatDateTime(review.created_at)}`}
                actions={
                    canDelete && (
                        <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(true)} disabled={deleteMut.isPending} className="hover:border-bad-line hover:text-bad">
                            Delete
                        </Button>
                    )
                }
                primaryAction={
                    canModerate &&
                    (review.is_visible ? (
                        <Button variant="secondary" icon={EyeOff} onClick={() => setConfirmModerate(true)} disabled={moderateMut.isPending}>
                            Hide review
                        </Button>
                    ) : (
                        <Button variant="primary" icon={Eye} onClick={() => setConfirmModerate(true)} disabled={moderateMut.isPending}>
                            Show review
                        </Button>
                    ))
                }
            />

            <Panel title="Review">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {review.comment || <span className="italic text-ink-faint">No comment provided.</span>}
                </p>
                <DetailList className="mt-5 border-t border-line pt-4">
                    <DetailRow label="Quest" value={<IdLink kind="quest" id={review.quest_id} short={false} />} />
                    <DetailRow label="Reviewer" value={<IdLink kind="user" id={review.user_id} short={false} />} />
                    <DetailRow label="Creator" value={<IdLink kind="user" id={review.creator_id} short={false} />} />
                    <DetailRow label="Verified booking" value={review.is_verified ? "Yes" : "No"} />
                    <DetailRow label="Last updated" value={formatDateTime(review.updated_at)} />
                </DetailList>
            </Panel>

            <Panel title="Creator response" icon={MessageSquareReply}>
                <div className="space-y-4">
                    {review.creator_response ? (
                        <div className="rounded-control border border-accent-200 bg-accent-50/50 p-4">
                            <p className="whitespace-pre-wrap text-sm text-ink">{review.creator_response}</p>
                            {review.creator_responded_at && <p className="mt-2 text-xs text-ink-muted">Responded {formatDateTime(review.creator_responded_at)}</p>}
                        </div>
                    ) : (
                        <p className="text-sm text-ink-muted">No response yet.</p>
                    )}

                    <Field label="Write a response">
                        <TextArea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} placeholder="Write a response to this review…" />
                    </Field>
                    <div className="flex justify-end">
                        <Button variant="primary" icon={Send} onClick={() => respondMut.mutate()} loading={respondMut.isPending} disabled={response.trim().length === 0}>
                            Submit response
                        </Button>
                    </div>
                </div>
            </Panel>

            <ConfirmDialog
                open={confirmModerate}
                title={review.is_visible ? "Hide review?" : "Show review?"}
                description={review.is_visible ? "The review disappears from the app. You can show it again later." : "The review becomes visible in the app again."}
                confirmLabel={review.is_visible ? "Hide" : "Show"}
                tone={review.is_visible ? "warning" : "primary"}
                onConfirm={() => moderateMut.mutate(!review.is_visible)}
                onCancel={() => setConfirmModerate(false)}
                isPending={moderateMut.isPending}
            />

            <ConfirmDialog
                open={confirmDelete}
                title="Delete review?"
                description="The review is removed from the app and the admin lists."
                confirmLabel="Delete"
                tone="danger"
                onConfirm={() => deleteMut.mutate()}
                onCancel={() => setConfirmDelete(false)}
                isPending={deleteMut.isPending}
            />
        </div>
    );
}

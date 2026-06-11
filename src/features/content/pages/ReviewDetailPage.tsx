import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Star, Eye, EyeOff, Send, Clock, Trash2, AlertCircle, ExternalLink } from "lucide-react";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@store/auth.store";
import { reviewsService } from "../services/reviews.service";

const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];

function Stars({ rating }: { rating: number }) {
    return (
        <span className="flex items-center gap-1" aria-label={`${rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    className={`h-5 w-5 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`}
                />
            ))}
        </span>
    );
}

export function ReviewDetailPage() {
    const { reviewId } = useParams<{ reviewId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canModerate = user?.role?.some((r) => CAN_MODERATE_ROLES.includes(r as string));
    const canDelete = user?.role?.some((r) => CAN_DELETE_ROLES.includes(r as string));

    const [response, setResponse] = useState("");
    const [confirmModerate, setConfirmModerate] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const {
        data: review,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["review-detail", reviewId],
        queryFn: () => reviewsService.getById(reviewId!),
        enabled: !!reviewId,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["review-detail", reviewId] });
        queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    };

    const moderateMut = useMutation({
        mutationFn: (isVisible: boolean) => reviewsService.moderate(reviewId!, isVisible),
        onSuccess: (updated) => {
            invalidate();
            toast.success(updated.is_visible ? "Review is now visible" : "Review hidden");
            setConfirmModerate(false);
        },
        onError: () => {
            toast.error("Failed to update visibility");
            setConfirmModerate(false);
        },
    });

    const respondMut = useMutation({
        mutationFn: () => reviewsService.respond(reviewId!, response),
        onSuccess: () => {
            invalidate();
            toast.success("Response submitted");
            setResponse("");
        },
        onError: () => toast.error("Failed to submit response"),
    });

    const deleteMut = useMutation({
        mutationFn: () => reviewsService.remove(reviewId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
            toast.success("Review deleted");
            navigate("/reviews", { replace: true });
        },
        onError: () => {
            toast.error("Failed to delete review");
            setConfirmDelete(false);
        },
    });

    if (isLoading) return <LoadingFallback message="Loading review..." />;

    if (error || !review) {
        return (
            <div className="p-6 text-center">
                <p className="mb-4 text-red-500">Failed to load review or it does not exist.</p>
                <Link to="/reviews" className="text-orange-600 hover:underline">
                    Back to Reviews
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in mx-auto max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
                <Link
                    to="/reviews"
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Link>
                <div className="flex items-center gap-2">
                    {canModerate && (
                        <button
                            onClick={() => setConfirmModerate(true)}
                            disabled={moderateMut.isPending}
                            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-colors disabled:opacity-50 ${
                                review.is_visible
                                    ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                        >
                            {review.is_visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {review.is_visible ? "Hide Review" : "Show Review"}
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            disabled={deleteMut.isPending}
                            className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    )}
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/80 backdrop-blur-xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <Star className="h-5 w-5 fill-amber-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-neutral-900">Review</h1>
                                <div className="mt-1">
                                    <Stars rating={review.rating} />
                                </div>
                            </div>
                            <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    review.is_visible
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-neutral-200 text-neutral-600"
                                }`}
                            >
                                {review.is_visible ? "Visible" : "Hidden"}
                            </span>
                        </div>

                        <p className="mt-4 whitespace-pre-wrap text-neutral-700">
                            {review.comment || <span className="italic text-neutral-400">No comment provided.</span>}
                        </p>

                        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div className="flex justify-between gap-2 sm:block">
                            <dt className="text-neutral-500">Quest ID</dt>
                            <dd className="font-mono text-xs text-neutral-700">
                                {review.quest_id ? (
                                    <Link
                                        to={`/quests/${review.quest_id}`}
                                        className="inline-flex items-center gap-1 text-orange-600 hover:underline"
                                    >
                                        {review.quest_id}
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                ) : (
                                    "—"
                                )}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-2 sm:block">
                            <dt className="text-neutral-500">User ID</dt>
                            <dd className="font-mono text-xs text-neutral-700">{review.user_id ?? "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2 sm:block">
                            <dt className="text-neutral-500">Creator ID</dt>
                            <dd className="font-mono text-xs text-neutral-700">{review.creator_id ?? "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2 sm:block">
                            <dt className="text-neutral-500">Verified</dt>
                            <dd className="text-neutral-700">{review.is_verified ? "Yes" : "No"}</dd>
                        </div>
                        {review.created_at && (
                            <div className="flex items-center gap-1.5 text-neutral-500 sm:col-span-2">
                                <Clock className="h-3.5 w-3.5" />
                                {new Date(review.created_at).toLocaleString()}
                            </div>
                        )}
                        </dl>
                    </div>
                </div>
            </div>

            {/* Creator response */}
            <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/80 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                <div className="border-b border-neutral-100 bg-neutral-50/50 p-5 sm:px-6 sm:py-4">
                    <h3 className="text-base font-semibold text-neutral-900">Creator Response</h3>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                    {review.creator_response ? (
                        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                            <p className="whitespace-pre-wrap text-sm text-neutral-700">{review.creator_response}</p>
                            {review.creator_responded_at && (
                                <p className="mt-2 text-xs text-neutral-500">
                                    Responded {new Date(review.creator_responded_at).toLocaleString()}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-neutral-500">No response yet.</p>
                    )}

                    <div>
                        <textarea
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            rows={4}
                            placeholder="Write a response to this review..."
                            className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={() => respondMut.mutate()}
                                disabled={respondMut.isPending || response.trim().length === 0}
                                className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {respondMut.isPending ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Submit Response
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Moderate confirm */}
            {confirmModerate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-neutral-900">
                                {review.is_visible ? "Hide Review" : "Show Review"}
                            </h3>
                            <p className="mt-2 text-sm text-neutral-600">
                                {review.is_visible
                                    ? "This review will be hidden from public view."
                                    : "This review will become publicly visible again."}
                            </p>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmModerate(false)}
                                    disabled={moderateMut.isPending}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => moderateMut.mutate(!review.is_visible)}
                                    disabled={moderateMut.isPending}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                                >
                                    {moderateMut.isPending && (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    )}
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                        <div className="p-6">
                            <div className="mb-4 flex items-center gap-3 text-red-600">
                                <AlertCircle className="h-6 w-6" />
                                <h3 className="text-lg font-bold text-neutral-900">Delete Review</h3>
                            </div>
                            <p className="text-neutral-600">
                                Are you sure you want to delete this review? This action cannot be undone.
                            </p>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    disabled={deleteMut.isPending}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => deleteMut.mutate()}
                                    disabled={deleteMut.isPending}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                                >
                                    {deleteMut.isPending && (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    )}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

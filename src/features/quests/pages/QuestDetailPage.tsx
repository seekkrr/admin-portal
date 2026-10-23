import { lazy, Suspense, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Compass, Copy, MessageSquareWarning, Pause, Play, Trash2, XCircle } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/Field";
import { ChangeHistoryPanel } from "@/components/detail/ChangeHistoryPanel";
import { useAdminAccess } from "@/components/detail/useAdminAccess";
import { useDetailTab } from "@/components/detail/useDetailTab";
import { rupees } from "@/components/detail/detailFormat";
import { usePageTitle } from "@/hooks/usePageTitle";
import { questsService } from "../services/quests.service";
import { formatDuration } from "../utils/formatters";
import { QuestDetailsTab } from "../components/quest-detail/QuestDetailsTab";
import { QuestStopsTab } from "../components/quest-detail/QuestStopsTab";
import { QuestMediaTab } from "../components/quest-detail/QuestMediaTab";
import { QuestBookingsTab } from "../components/quest-detail/QuestBookingsTab";
import { QuestReviewsTab } from "../components/quest-detail/QuestReviewsTab";
import { QuestReviewHistoryPanel } from "../components/quest-detail/QuestReviewHistoryPanel";

// The immersive map pulls in mapbox-gl (~1.7 MB); load it only when its tab opens.
const ExploreMap = lazy(() => import("../components/explore/ExploreMap").then((m) => ({ default: m.ExploreMap })));

const TABS = ["details", "stops", "media", "bookings", "reviews", "map", "history"] as const;
type Tab = (typeof TABS)[number];

type ReviewAction = "approve" | "requestChanges" | "reject" | "pause" | "unpause";

const ACTION_COPY: Record<ReviewAction, { title: string; text: string; confirm: string; reason?: string }> = {
    approve: { title: "Approve and publish?", text: "The quest goes live for travellers straight away.", confirm: "Approve & publish" },
    requestChanges: { title: "Request changes?", text: "The creator gets your note and can edit and resubmit.", confirm: "Request changes", reason: "What needs to change" },
    reject: { title: "Reject this quest?", text: "The creator is told why. They can't resubmit a rejected quest.", confirm: "Reject", reason: "Reason" },
    pause: { title: "Pause this quest?", text: "It leaves the app; people who booked keep access.", confirm: "Pause" },
    unpause: { title: "Unpause this quest?", text: "It shows in the app again.", confirm: "Unpause" },
};

/** One quest: details, ordered stops, photos, bookings, reviews, map and change history. */
export function QuestDetailPage() {
    const { questId = "" } = useParams<{ questId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isStaff, isAdmin } = useAdminAccess();
    const [tab, setTab] = useDetailTab<Tab>(TABS, "details");
    const [action, setAction] = useState<ReviewAction | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [hard, setHard] = useState(false);

    const { data: quest, isLoading, error, refetch } = useQuery({
        queryKey: ["quest-detail", questId],
        queryFn: () => questsService.getQuestDetail(questId),
        enabled: isStaff && !!questId,
    });
    usePageTitle(quest?.title);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
        queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
        queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
        queryClient.invalidateQueries({ queryKey: ["quest-review-history", questId] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "quest", questId] });
    };

    const review = useMutation({
        mutationFn: ({ kind, text }: { kind: ReviewAction; text?: string }) => {
            switch (kind) {
                case "approve":
                    return questsService.approve(questId);
                case "requestChanges":
                    return questsService.requestChanges(questId, text ?? "");
                case "reject":
                    return questsService.reject(questId, text ?? "");
                case "pause":
                    return questsService.pause(questId);
                case "unpause":
                    return questsService.unpause(questId);
            }
        },
        onSuccess: (_, { kind }) => {
            toast.success(
                kind === "approve" ? "Approved and published" : kind === "requestChanges" ? "Changes requested" : kind === "reject" ? "Quest rejected" : kind === "pause" ? "Quest paused" : "Quest unpaused"
            );
            setAction(null);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const remove = useMutation({
        mutationFn: () => questsService.deleteQuest(questId, hard),
        onSuccess: () => {
            toast.success(hard ? "Quest permanently deleted" : "Quest deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            navigate("/quests", { replace: true });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (!isStaff) return <AccessDenied message="Only admins and moderators can manage quests." />;
    if (isLoading) return <LoadingState label="Loading quest…" />;
    if (error || !quest) return <ErrorState title="Couldn't load this quest" error={error ?? new Error("Quest not found.")} onRetry={() => refetch()} />;

    const s = quest.status;
    const reviewButtons: { kind: ReviewAction; label: string; icon: typeof CheckCircle2; variant: "primary" | "secondary" }[] = [];
    if (s === "Under Review") {
        reviewButtons.push({ kind: "approve", label: "Approve", icon: CheckCircle2, variant: "primary" });
        reviewButtons.push({ kind: "requestChanges", label: "Request changes", icon: MessageSquareWarning, variant: "secondary" });
    }
    if (s === "Under Review" || s === "Changes Requested") reviewButtons.push({ kind: "reject", label: "Reject", icon: XCircle, variant: "secondary" });
    if (s === "Published") reviewButtons.push({ kind: "pause", label: "Pause", icon: Pause, variant: "secondary" });
    if (s === "Paused") reviewButtons.push({ kind: "unpause", label: "Unpause", icon: Play, variant: "primary" });
    const cover = quest.cloudinary_assets?.[0]?.secure_url;
    const copy = action ? ACTION_COPY[action] : null;
    const statusKey = s.toLowerCase().replace(/ /g, "_");

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-4">
                {cover ? (
                    <img src={cover} alt="" className="h-14 w-14 shrink-0 rounded-card border border-line object-cover" />
                ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-brand-900 text-white">
                        <Compass className="h-6 w-6" aria-hidden />
                    </span>
                )}
                <PageHeader
                    className="min-w-0 flex-1"
                    title={quest.title || "Untitled quest"}
                    badge={<StatusPill status={statusKey === "under_review" ? "in_review" : statusKey} label={s} />}
                    description={
                        <span className="flex flex-wrap gap-1.5">
                            <Tag>{quest.total_markers} stops</Tag>
                            <Tag>{rupees(quest.price)}</Tag>
                            {quest.duration_minutes ? <Tag>{formatDuration(quest.duration_minutes)}</Tag> : null}
                            {quest.difficulty && <Tag>{quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1)}</Tag>}
                            {quest.region_summary?.name && <Tag tone="brand">{quest.region_summary.name}</Tag>}
                        </span>
                    }
                    actions={
                        isStaff && reviewButtons.length > 0 ? (
                            <>
                                {reviewButtons.map((b) => (
                                    <Button key={b.kind} size="sm" variant={b.variant} icon={b.icon} onClick={() => setAction(b.kind)}>
                                        {b.label}
                                    </Button>
                                ))}
                            </>
                        ) : undefined
                    }
                    menu={[
                        {
                            label: "Copy quest ID",
                            icon: Copy,
                            onSelect: () => {
                                navigator.clipboard
                                    .writeText(quest.id)
                                    .then(() => toast.success("Quest ID copied"))
                                    .catch(() => toast.error("Couldn't copy"));
                            },
                        },
                        { label: "Delete quest", icon: Trash2, danger: true, hidden: !isAdmin, onSelect: () => setDeleting(true) },
                    ]}
                />
            </div>

            <Tabs<Tab>
                label="Quest sections"
                idPrefix="quest"
                value={tab}
                onChange={setTab}
                tabs={[
                    { value: "details", label: "Details" },
                    { value: "stops", label: "Stops", count: quest.total_markers },
                    { value: "media", label: "Media" },
                    { value: "bookings", label: "Bookings" },
                    { value: "reviews", label: "Reviews", count: quest.review_count },
                    { value: "map", label: "Explore map" },
                    { value: "history", label: "Change history" },
                ]}
            />

            <div role="tabpanel" id={`quest-panel-${tab}`} aria-labelledby={`quest-tab-${tab}`}>
                {tab === "details" && <QuestDetailsTab quest={quest} canEdit={isStaff} onSaved={refresh} />}
                {tab === "stops" && <QuestStopsTab quest={quest} canEdit={isAdmin} onSaved={refresh} />}
                {tab === "media" && <QuestMediaTab quest={quest} canEdit={isStaff} onSaved={refresh} />}
                {tab === "bookings" && <QuestBookingsTab questId={quest.id} />}
                {tab === "reviews" && <QuestReviewsTab questId={quest.id} canEdit={isStaff} />}
                {tab === "map" && (
                    <Suspense fallback={<LoadingState label="Loading the map…" />}>
                        <ExploreMap questId={quest.id} detail={quest} focusMarkerId={null} />
                    </Suspense>
                )}
                {tab === "history" && (
                    <div className="space-y-5">
                        <QuestReviewHistoryPanel questId={quest.id} />
                        <ChangeHistoryPanel entityType="quest" entityId={quest.id} />
                    </div>
                )}
            </div>

            {copy && action && (
                <ConfirmDialog
                    open
                    title={copy.title}
                    description={copy.text}
                    confirmLabel={copy.confirm}
                    tone={action === "reject" ? "danger" : action === "pause" ? "warning" : "primary"}
                    level={copy.reason ? "reason" : "simple"}
                    reasonLabel={copy.reason}
                    reasonMinLength={copy.reason ? 1 : 0}
                    reasonMaxLength={2000}
                    isPending={review.isPending}
                    onConfirm={(text) => review.mutate({ kind: action, text })}
                    onCancel={() => setAction(null)}
                />
            )}
            <ConfirmDialog
                open={deleting}
                title={hard ? "Permanently delete this quest?" : "Delete this quest?"}
                description={hard ? "The quest and its data are removed for good." : "The quest is removed from the app and the creator's list."}
                confirmLabel={hard ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hard ? "type" : "simple"}
                typeToConfirm={quest.title ?? "DELETE"}
                isPending={remove.isPending}
                onConfirm={() => remove.mutate()}
                onCancel={() => {
                    setDeleting(false);
                    setHard(false);
                }}
            >
                <Checkbox checked={hard} onChange={setHard} label="Delete permanently" hint="Can't be undone." />
            </ConfirmDialog>
        </div>
    );
}

export default QuestDetailPage;

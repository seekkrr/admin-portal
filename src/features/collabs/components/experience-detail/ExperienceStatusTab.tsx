import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Eye, EyeOff, Pause, RotateCcw, Send, Signpost } from "lucide-react";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Notice } from "@/components/detail/DetailStates";
import { calendarDate, count } from "@/components/detail/detailFormat";
import { DetailApiError, experienceDetailApi } from "@/services/admin-detail.service";
import { formatDateTime } from "@/utils/date";
import type { ExperienceDetail, ExperienceStatus } from "@/types/admin-detail";

type Action = { kind: "status"; status: ExperienceStatus } | { kind: "hide" } | { kind: "unhide" };

const STATUS_COPY: Record<ExperienceStatus, { label: string; title: string; text: string }> = {
    published: { label: "Publish", title: "Publish this experience?", text: "It shows in the app and people can book open slots." },
    paused: { label: "Pause", title: "Pause bookings?", text: "It stays visible to the business but people can't book it. Existing bookings stay." },
    archived: { label: "Archive", title: "Archive this experience?", text: "It disappears from the app and the business's list. Existing bookings stay." },
    draft: { label: "Back to draft", title: "Move back to draft?", text: "It leaves the app until it's published again." },
};

/** Publish / pause / archive, and hide or restore it (admin). */
export function ExperienceStatusTab({
    experience,
    canEdit,
    onChanged,
}: {
    experience: ExperienceDetail;
    canEdit: boolean;
    onChanged: (next: ExperienceDetail) => void;
}) {
    const [action, setAction] = useState<Action | null>(null);
    const [missing, setMissing] = useState<string[]>([]);
    const s = experience.status;

    const setStatus = useMutation({
        mutationFn: (status: ExperienceStatus) => experienceDetailApi.setStatus(experience.business_id, experience.id, status),
        onSuccess: (next, status) => {
            toast.success(status === "published" ? "Published" : status === "paused" ? "Paused" : status === "archived" ? "Archived" : "Moved to draft");
            setMissing([]);
            setAction(null);
            onChanged(next);
        },
        onError: (e: Error) => {
            const gaps = e instanceof DetailApiError ? (e.details as { missing?: string[] } | null)?.missing : undefined;
            setMissing(Array.isArray(gaps) ? gaps : []);
            setAction(null);
            toast.error(e.message);
        },
    });
    const hide = useMutation({
        mutationFn: ({ hidden, reason }: { hidden: boolean; reason?: string }) => experienceDetailApi.setHidden(experience.id, hidden, reason),
        onSuccess: (next, { hidden }) => {
            toast.success(hidden ? "Hidden from the app" : "Shown in the app again");
            setAction(null);
            onChanged(next);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const moves: ExperienceStatus[] =
        s === "draft" ? ["published", "archived"] : s === "published" ? ["paused", "archived"] : s === "paused" ? ["published", "archived"] : ["draft"];
    const icon = { published: Send, paused: Pause, archived: Archive, draft: RotateCcw } as const;

    return (
        <div className="space-y-5">
            <Panel title="Status" icon={Signpost} actions={<StatusPill status={s} />}>
                <div className="space-y-4">
                    <DetailList>
                        <DetailRow label="Bookings" value={`${count(experience.stats?.bookings)} (${count(experience.stats?.people)} people)`} />
                        <DetailRow label="Next date" value={calendarDate(experience.next_date)} />
                        <DetailRow label="Upcoming slots" value={experience.upcoming_slots !== undefined ? count(experience.upcoming_slots) : "—"} />
                        <DetailRow label="Created" value={formatDateTime(experience.created_at)} />
                        <DetailRow label="Updated" value={formatDateTime(experience.updated_at)} />
                    </DetailList>
                    {missing.length > 0 && (
                        <Notice tone="warn" title="Before it can be published, add:">
                            <ul className="list-disc pl-4">
                                {missing.map((m) => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        </Notice>
                    )}
                    {canEdit && (
                        <div className="flex flex-wrap gap-2">
                            {moves.map((m) => (
                                <Button
                                    key={m}
                                    variant={m === "published" ? "primary" : "secondary"}
                                    icon={icon[m]}
                                    loading={setStatus.isPending && setStatus.variables === m}
                                    onClick={() => setAction({ kind: "status", status: m })}
                                >
                                    {s === "paused" && m === "published" ? "Resume" : STATUS_COPY[m].label}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </Panel>

            <Panel
                title="Visibility"
                icon={experience.hidden_by_admin ? EyeOff : Eye}
                actions={experience.hidden_by_admin ? <Tag tone="bad">Hidden by SeekKrr</Tag> : <Tag tone="good">Visible</Tag>}
                description={
                    experience.hidden_by_admin
                        ? "Hidden from the app. The business still sees it, marked hidden."
                        : "Hide it if it breaks the rules; the business keeps it and sees that it's hidden."
                }
            >
                {canEdit &&
                    (experience.hidden_by_admin ? (
                        <Button variant="primary" icon={Eye} onClick={() => setAction({ kind: "unhide" })}>
                            Show in the app
                        </Button>
                    ) : (
                        <Button variant="secondary" icon={EyeOff} onClick={() => setAction({ kind: "hide" })}>
                            Hide from the app
                        </Button>
                    ))}
            </Panel>

            {action?.kind === "status" && (
                <ConfirmDialog
                    open
                    title={STATUS_COPY[action.status].title}
                    description={STATUS_COPY[action.status].text}
                    confirmLabel={s === "paused" && action.status === "published" ? "Resume" : STATUS_COPY[action.status].label}
                    tone={action.status === "archived" ? "warning" : "primary"}
                    isPending={setStatus.isPending}
                    onConfirm={() => setStatus.mutate(action.status)}
                    onCancel={() => setAction(null)}
                />
            )}
            <ConfirmDialog
                open={action?.kind === "hide"}
                title="Hide this experience?"
                description="It disappears from the app right away. The reason is kept in the change history."
                confirmLabel="Hide"
                tone="warning"
                level="reason"
                reasonPlaceholder="e.g. Misleading photos"
                reasonMinLength={3}
                isPending={hide.isPending}
                onConfirm={(reason) => hide.mutate({ hidden: true, reason })}
                onCancel={() => setAction(null)}
            />
            <ConfirmDialog
                open={action?.kind === "unhide"}
                title="Show this experience again?"
                description="If it's published and its business is live, it shows in the app again."
                confirmLabel="Show"
                level="reason"
                reasonLabel="Note"
                reasonMinLength={0}
                isPending={hide.isPending}
                onConfirm={(reason) => hide.mutate({ hidden: false, reason })}
                onCancel={() => setAction(null)}
            />
        </div>
    );
}

import { ConfirmDialog, type ConfirmTone } from "@/components/ui/ConfirmDialog";

export type QuestActionType = "approve" | "requestChanges" | "reject" | "pause" | "unpause";

interface QuestActionModalProps {
    open: boolean;
    action: QuestActionType | null;
    questTitle: string;
    isPending?: boolean;
    onConfirm: (text: string) => void;
    onCancel: () => void;
}

const ACTION_CONFIG: Record<
    QuestActionType,
    {
        title: string;
        message: (title: string) => string;
        confirmLabel: string;
        tone: ConfirmTone;
        /** The text is sent to the creator (comment / reason). */
        needsText: boolean;
        textLabel?: string;
        textPlaceholder?: string;
    }
> = {
    approve: {
        title: "Approve quest?",
        message: (t) => `Approve and publish "${t}"? This makes the quest live for users.`,
        confirmLabel: "Approve and publish",
        tone: "primary",
        needsText: false,
    },
    requestChanges: {
        title: "Request changes",
        message: (t) => `Request changes on "${t}". The creator sees your comment.`,
        confirmLabel: "Send request",
        tone: "warning",
        needsText: true,
        textLabel: "Comment",
        textPlaceholder: "Describe what needs to be changed…",
    },
    reject: {
        title: "Reject quest",
        message: (t) => `Reject "${t}". The creator sees your reason.`,
        confirmLabel: "Reject quest",
        tone: "danger",
        needsText: true,
        textLabel: "Reason",
        textPlaceholder: "Explain why this quest is being rejected…",
    },
    pause: {
        title: "Pause quest?",
        message: (t) => `Pause "${t}"? Users can't book or start it until it's unpaused.`,
        confirmLabel: "Pause quest",
        tone: "warning",
        needsText: false,
    },
    unpause: {
        title: "Unpause quest?",
        message: (t) => `Unpause "${t}"? The quest becomes live again for users.`,
        confirmLabel: "Unpause quest",
        tone: "primary",
        needsText: false,
    },
};

/**
 * Review decisions on a quest. Request changes and reject send a comment to
 * the creator, so they ask for one (ConfirmDialog "reason" level).
 */
export function QuestActionModal({ open, action, questTitle, isPending, onConfirm, onCancel }: QuestActionModalProps) {
    const cfg = action ? ACTION_CONFIG[action] : null;
    return (
        <ConfirmDialog
            open={open && !!cfg}
            title={cfg?.title ?? ""}
            description={cfg?.message(questTitle)}
            confirmLabel={cfg?.confirmLabel ?? "Confirm"}
            tone={cfg?.tone ?? "primary"}
            level={cfg?.needsText ? "reason" : "simple"}
            reasonLabel={cfg?.textLabel}
            reasonPlaceholder={cfg?.textPlaceholder}
            reasonMinLength={cfg?.needsText ? 1 : 0}
            reasonMaxLength={2000}
            isPending={isPending}
            onConfirm={(reason) => onConfirm((reason ?? "").trim())}
            onCancel={onCancel}
        />
    );
}

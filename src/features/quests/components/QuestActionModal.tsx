import { useState, useEffect, type ReactNode } from "react";
import { CheckCircle, XCircle, AlertCircle, Pause, Play, RefreshCw } from "lucide-react";

export type QuestActionType =
    | "approve"
    | "requestChanges"
    | "reject"
    | "pause"
    | "unpause";

interface QuestActionModalProps {
    open: boolean;
    action: QuestActionType | null;
    questTitle: string;
    isPending?: boolean;
    onConfirm: (text: string) => void;
    onCancel: () => void;
}

const ACTION_CONFIG: Record<QuestActionType, {
    title: string;
    message: (title: string) => string;
    confirmLabel: string;
    confirmStyle: string;
    icon: ReactNode;
    needsText: boolean;
    textLabel?: string;
    textPlaceholder?: string;
}> = {
    approve: {
        title: "Approve Quest",
        message: (t) => `Approve and publish "${t}"? This makes the quest live for users.`,
        confirmLabel: "Approve & Publish",
        confirmStyle: "bg-emerald-600 hover:bg-emerald-700 text-white",
        icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        needsText: false,
    },
    requestChanges: {
        title: "Request Changes",
        message: (t) => `Request changes on "${t}". Add a comment explaining what needs to be fixed.`,
        confirmLabel: "Send Request",
        confirmStyle: "bg-orange-600 hover:bg-orange-700 text-white",
        icon: <AlertCircle className="w-5 h-5 text-orange-500" />,
        needsText: true,
        textLabel: "Comment (required)",
        textPlaceholder: "Describe what needs to be changed...",
    },
    reject: {
        title: "Reject Quest",
        message: (t) => `Reject "${t}". Provide a reason so the creator understands the decision.`,
        confirmLabel: "Reject Quest",
        confirmStyle: "bg-red-600 hover:bg-red-700 text-white",
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        needsText: true,
        textLabel: "Reason (required)",
        textPlaceholder: "Explain why this quest is being rejected...",
    },
    pause: {
        title: "Pause Quest",
        message: (t) => `Pause "${t}"? Users will not be able to book or start this quest until it is unpaused.`,
        confirmLabel: "Pause Quest",
        confirmStyle: "bg-amber-600 hover:bg-amber-700 text-white",
        icon: <Pause className="w-5 h-5 text-amber-500" />,
        needsText: false,
    },
    unpause: {
        title: "Unpause Quest",
        message: (t) => `Unpause "${t}"? The quest will become live again for users.`,
        confirmLabel: "Unpause Quest",
        confirmStyle: "bg-emerald-600 hover:bg-emerald-700 text-white",
        icon: <Play className="w-5 h-5 text-emerald-500" />,
        needsText: false,
    },
};

export function QuestActionModal({
    open, action, questTitle, isPending, onConfirm, onCancel,
}: QuestActionModalProps) {
    const [text, setText] = useState("");

    useEffect(() => {
        if (open) setText("");
    }, [open, action]);

    useEffect(() => {
        if (!open) return;
        const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onCancel]);

    if (!open || !action) return null;

    const cfg = ACTION_CONFIG[action];
    const canConfirm = !cfg.needsText || text.trim().length >= 1;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-4">
                    {cfg.icon}
                    <h3 className="text-lg font-bold text-neutral-900">{cfg.title}</h3>
                </div>
                <p className="text-sm text-neutral-600 mb-4 leading-relaxed">
                    {cfg.message(questTitle)}
                </p>
                {cfg.needsText && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {cfg.textLabel}
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={cfg.textPlaceholder}
                            rows={4}
                            className="w-full text-sm text-neutral-700 bg-neutral-50 rounded-xl border border-neutral-200 p-3 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-y"
                            autoFocus
                        />
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        disabled={isPending}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(text.trim())}
                        disabled={!canConfirm || isPending}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${cfg.confirmStyle}`}
                    >
                        {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                        {cfg.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

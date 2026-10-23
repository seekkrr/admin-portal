import type { ReactNode } from "react";
import { ConfirmDialog, type ConfirmTone } from "./ConfirmDialog";

export interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: ReactNode;
    confirmLabel: string;
    /** Legacy colour classes; only used to pick the button tone now. */
    confirmStyle: string;
    onConfirm: () => void;
    onCancel: () => void;
    isPending?: boolean;
    children?: ReactNode;
    theme?: "danger" | "warning" | "info";
    disabledConfirm?: boolean;
    /**
     * Make the admin type a word before confirming. `true` asks for "DELETE";
     * a string asks for that text (e.g. the record's name). Permanent deletes
     * ("Hard delete", "Permanently delete", "Delete forever") ask automatically.
     */
    requireTyping?: boolean | string;
}

const PERMANENT_RE = /hard delete|permanent|forever/i;

function toneOf(confirmStyle: string, theme: ConfirmModalProps["theme"]): ConfirmTone {
    if (/\b(bg-red|bg-rose)/.test(confirmStyle)) return "danger";
    if (/\b(bg-amber|bg-orange|bg-yellow)/.test(confirmStyle)) return "warning";
    if (/\bbg-/.test(confirmStyle)) return "primary";
    return theme === "danger" ? "danger" : theme === "warning" ? "warning" : "primary";
}

/**
 * Legacy confirmation API, kept so existing pages keep working. It now
 * delegates to ConfirmDialog: a simple confirm for normal actions, and typing
 * only for permanent deletes (or when `requireTyping` is set).
 */
export function ConfirmModal({
    open,
    title,
    message,
    confirmLabel,
    confirmStyle,
    onConfirm,
    onCancel,
    isPending,
    children,
    theme = "danger",
    disabledConfirm,
    requireTyping,
}: ConfirmModalProps) {
    const permanent = PERMANENT_RE.test(`${confirmLabel} ${title}`);
    const word = typeof requireTyping === "string" && requireTyping.trim() ? requireTyping.trim() : requireTyping || permanent ? "DELETE" : undefined;
    return (
        <ConfirmDialog
            open={open}
            title={title}
            description={message}
            confirmLabel={confirmLabel}
            tone={toneOf(confirmStyle, theme)}
            level={word ? "type" : "simple"}
            typeToConfirm={word}
            isPending={isPending}
            confirmDisabled={disabledConfirm}
            onConfirm={() => onConfirm()}
            onCancel={onCancel}
        >
            {children}
        </ConfirmDialog>
    );
}

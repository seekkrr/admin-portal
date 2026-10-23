import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * Confirmation levels (plan: "One design"):
 *  - "simple": a plain "Approve 5 places?" with Confirm / Cancel — normal actions
 *  - "reason": a reason box — when the reason is sent to someone (reject, resolve)
 *  - "type":   type the record's name — ONLY for permanent deletes
 */
export type ConfirmLevel = "simple" | "reason" | "type";
export type ConfirmTone = "primary" | "danger" | "warning";

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description?: ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
    level?: ConfirmLevel;
    /** level "type": the exact text to type (the record's name, or e.g. "DELETE"). */
    typeToConfirm?: string;
    /** level "reason" */
    reasonLabel?: string;
    reasonPlaceholder?: string;
    /** Minimum reason length; 0 makes the reason optional. */
    reasonMinLength?: number;
    reasonMaxLength?: number;
    isPending?: boolean;
    /** Extra condition that keeps Confirm disabled. */
    confirmDisabled?: boolean;
    onConfirm: (reason?: string) => void;
    onCancel: () => void;
    /** Extra content (options, warnings) shown above the input. */
    children?: ReactNode;
}

const TONE_ICON = {
    primary: { icon: Info, cls: "bg-brand-50 text-brand-700" },
    warning: { icon: AlertTriangle, cls: "bg-warn-soft text-warn" },
    danger: { icon: ShieldAlert, cls: "bg-bad-soft text-bad" },
} as const;

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    tone = "primary",
    level = "simple",
    typeToConfirm,
    reasonLabel = "Reason",
    reasonPlaceholder,
    reasonMinLength = 0,
    reasonMaxLength = 500,
    isPending,
    confirmDisabled,
    onConfirm,
    onCancel,
    children,
}: ConfirmDialogProps) {
    const [text, setText] = useState("");
    const inputId = useId();
    const hintId = useId();
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (open) setText("");
    }, [open]);

    const word = (typeToConfirm ?? "").trim();
    const blocked = (level === "type" && word.length > 0 && text.trim() !== word) || (level === "reason" && text.trim().length < reasonMinLength);

    const submit = () => {
        if (blocked || isPending || confirmDisabled) return;
        onConfirm(level === "reason" ? text.trim() : undefined);
    };

    const { icon: Icon, cls } = TONE_ICON[tone];

    return (
        <Modal
            open={open}
            onClose={() => !isPending && onCancel()}
            dismissible={!isPending}
            title={
                <span className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${cls}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {title}
                </span>
            }
            size="md"
            initialFocusRef={level === "simple" ? confirmRef : undefined}
            footer={
                <>
                    <Button variant="secondary" onClick={onCancel} disabled={isPending}>
                        {cancelLabel}
                    </Button>
                    <Button
                        ref={confirmRef}
                        variant={tone === "danger" ? "danger" : "primary"}
                        onClick={submit}
                        loading={isPending}
                        disabled={blocked || confirmDisabled}
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {description && <div className="text-sm leading-relaxed text-ink-muted">{description}</div>}
            {children}
            {(level === "type" && word) || level === "reason" ? (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    {level === "type" && word && (
                        <div>
                            <label htmlFor={inputId} className="mb-1.5 block text-sm text-ink-muted">
                                This can't be undone. Type <span className="select-all font-mono font-semibold text-ink">{word}</span> to confirm.
                            </label>
                            <input
                                id={inputId}
                                type="text"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                disabled={isPending}
                                className="h-10 w-full rounded-control border border-line-strong bg-surface px-3 font-mono text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-bad/40"
                                autoFocus
                            />
                        </div>
                    )}
                    {level === "reason" && (
                        <div>
                            <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
                                {reasonLabel} {reasonMinLength > 0 && <span className="text-bad">*</span>}
                            </label>
                            <textarea
                                id={inputId}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                maxLength={reasonMaxLength}
                                placeholder={reasonPlaceholder}
                                aria-describedby={hintId}
                                disabled={isPending}
                                rows={3}
                                className="w-full resize-none rounded-control border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
                                autoFocus
                            />
                            <p id={hintId} className="mt-1 text-xs text-ink-faint">
                                {reasonMinLength > 0 ? `At least ${reasonMinLength} characters.` : "Optional."}
                            </p>
                        </div>
                    )}
                    <button type="submit" hidden aria-hidden tabIndex={-1} />
                </form>
            ) : null}
        </Modal>
    );
}

import type { ReactNode } from "react";
import { Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/utils/cx";

/**
 * Sticky "unsaved changes" bar under an inline form. It sits above the phone
 * bottom bar and stays in view while the form scrolls. Hidden when nothing
 * changed.
 */
export function SaveBar({
    dirty,
    saving,
    invalid,
    onSave,
    onDiscard,
    message = "You have unsaved changes",
    saveLabel = "Save changes",
    className,
}: {
    dirty: boolean;
    saving?: boolean;
    /** Keeps Save disabled (e.g. a required field is empty). */
    invalid?: boolean;
    onSave: () => void;
    onDiscard: () => void;
    message?: ReactNode;
    saveLabel?: string;
    className?: string;
}) {
    if (!dirty) return null;
    return (
        <div
            className={cx(
                "sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 animate-slide-up md:bottom-4",
                className
            )}
        >
            <div
                role="region"
                aria-label="Unsaved changes"
                className="flex flex-col gap-2 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:justify-between"
            >
                <p className="text-sm text-ink-muted">{message}</p>
                <div className="flex gap-2">
                    <Button variant="ghost" icon={Undo2} onClick={onDiscard} disabled={saving} className="flex-1 sm:flex-none">
                        Discard
                    </Button>
                    <Button variant="primary" icon={Save} onClick={onSave} loading={saving} disabled={invalid} className="flex-1 sm:flex-none">
                        {saveLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

import { useState, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * A value you can copy: clicking the text or the icon puts it on the clipboard
 * and shows "Copied" for a moment.
 */
export function CopyText({
    value,
    display,
    mono = false,
    truncate = true,
    className = "",
    title,
}: {
    value: string | null | undefined;
    display?: string;
    mono?: boolean;
    /** Ellipsize long values; pass false to always show the whole value. */
    truncate?: boolean;
    className?: string;
    title?: string;
}) {
    const [copied, setCopied] = useState(false);
    if (!value) return <span className="text-ink-faint">—</span>;

    const copy = async (e: MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied to clipboard", { duration: 1200 });
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error("Couldn't copy to clipboard");
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            title={title ?? `Copy ${value}`}
            className={`group/copy inline-flex max-w-full items-center gap-1 rounded px-1 -mx-1 text-left hover:bg-brand-50 hover:text-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${mono ? "font-mono" : ""} ${className}`}
        >
            <span className={truncate ? "truncate" : "whitespace-nowrap"}>{display ?? value}</span>
            {copied ? (
                <Check className="h-3 w-3 shrink-0 text-good" aria-label="Copied" />
            ) : (
                <Copy className="h-3 w-3 shrink-0 opacity-40 group-hover/copy:opacity-100" aria-hidden />
            )}
        </button>
    );
}

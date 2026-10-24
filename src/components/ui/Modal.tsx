import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import { useOverlay } from "@/hooks/useOverlay";
import { cx } from "@/utils/cx";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

const WIDTHS: Record<ModalSize, string> = {
    sm: "md:max-w-sm",
    md: "md:max-w-md",
    lg: "md:max-w-lg",
    xl: "md:max-w-xl",
    "2xl": "md:max-w-2xl",
};

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    children?: ReactNode;
    footer?: ReactNode;
    size?: ModalSize;
    /** Element to focus first (defaults to the first focusable field/button). */
    initialFocusRef?: RefObject<HTMLElement | null>;
    /** Block closing (e.g. while saving). */
    dismissible?: boolean;
    bodyClassName?: string;
}

/**
 * Centered dialog on tablets/desktops, a bottom sheet on phones.
 * Escape closes, focus is trapped inside and returns to the opener.
 */
export function Modal({
    open,
    onClose,
    title,
    description,
    icon: Icon,
    children,
    footer,
    size = "lg",
    initialFocusRef,
    dismissible = true,
    bodyClassName,
}: ModalProps) {
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descId = useId();
    const close = () => {
        if (dismissible) onClose();
    };
    useOverlay(open, ref, { onClose: close, initialFocusRef });

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4">
            <div className="absolute inset-0 bg-brand-950/45 backdrop-blur-[2px] animate-fade-in" onClick={close} aria-hidden />
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                className={cx(
                    "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface shadow-pop focus:outline-none",
                    "rounded-t-2xl animate-slide-in-up md:rounded-card md:animate-scale-in",
                    WIDTHS[size]
                )}
            >
                <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
                    {Icon && (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700">
                            <Icon className="h-4.5 w-4.5" aria-hidden />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="text-base font-semibold leading-snug text-ink sm:text-lg">
                            {title}
                        </h2>
                        {description && (
                            <p id={descId} className="mt-0.5 text-sm text-ink-muted">
                                {description}
                            </p>
                        )}
                    </div>
                    {dismissible && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="-mr-1.5 -mt-1 rounded-control p-2 text-ink-faint transition-colors hover:bg-brand-50 hover:text-ink"
                        >
                            <X className="h-5 w-5" aria-hidden />
                        </button>
                    )}
                </div>
                <div className={cx("min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5", bodyClassName)}>{children}</div>
                {footer && (
                    <div className="safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface-muted px-5 py-3.5 sm:flex-row sm:justify-end">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

export interface DrawerProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    subtitle?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    /** Width on tablets/desktops; always full screen on phones. */
    width?: "md" | "lg" | "xl";
    side?: "right" | "left";
    initialFocusRef?: RefObject<HTMLElement | null>;
    dismissible?: boolean;
    bodyClassName?: string;
}

const DRAWER_WIDTHS = { md: "md:max-w-md", lg: "md:max-w-xl", xl: "md:max-w-3xl" } as const;

/** Side panel for editing or details. Full screen on phones. */
export function Drawer({
    open,
    onClose,
    title,
    subtitle,
    children,
    footer,
    width = "lg",
    side = "right",
    initialFocusRef,
    dismissible = true,
    bodyClassName,
}: DrawerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const close = () => {
        if (dismissible) onClose();
    };
    useOverlay(open, ref, { onClose: close, initialFocusRef });

    if (!open) return null;

    return createPortal(
        <div className={cx("fixed inset-0 z-[60] flex", side === "right" ? "justify-end" : "justify-start")}>
            <div className="absolute inset-0 bg-brand-950/45 backdrop-blur-[2px] animate-fade-in" onClick={close} aria-hidden />
            <aside
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cx(
                    "relative flex h-full w-full flex-col bg-surface shadow-pop focus:outline-none",
                    side === "right" ? "animate-slide-in-right" : "animate-slide-in-left",
                    DRAWER_WIDTHS[width]
                )}
            >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                        <h2 id={titleId} className="truncate text-base font-semibold leading-snug text-ink sm:text-lg">
                            {title}
                        </h2>
                        {subtitle && <div className="mt-0.5 text-xs text-ink-muted">{subtitle}</div>}
                    </div>
                    {dismissible && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="-mr-1.5 rounded-control p-2 text-ink-faint transition-colors hover:bg-brand-50 hover:text-ink"
                        >
                            <X className="h-5 w-5" aria-hidden />
                        </button>
                    )}
                </div>
                <div className={cx("min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5", bodyClassName)}>{children}</div>
                {footer && <div className="safe-bottom shrink-0 border-t border-line bg-surface-muted px-5 py-3.5">{footer}</div>}
            </aside>
        </div>,
        document.body
    );
}

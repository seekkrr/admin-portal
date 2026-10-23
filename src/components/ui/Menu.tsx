import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./buttonStyles";

export interface MenuItem {
    label: string;
    icon?: LucideIcon;
    onSelect?: () => void;
    /** Navigate to this route instead of calling onSelect. */
    to?: string;
    danger?: boolean;
    disabled?: boolean;
    hidden?: boolean;
}

export interface MenuProps {
    items: MenuItem[];
    /** Accessible name of the trigger (default "More actions"). */
    label?: string;
    /** Custom trigger content; defaults to a "⋯" icon. */
    trigger?: ReactNode;
    triggerVariant?: ButtonVariant;
    size?: ButtonSize;
    align?: "left" | "right";
    className?: string;
}

/**
 * Overflow / dropdown menu. Keyboard: Enter/Space/↓ opens, ↑↓ Home End move,
 * Escape closes and returns focus to the trigger, Tab closes.
 *
 * The list opens in a layer on top of the page (fixed position), so it is
 * never clipped by a table, a card or a dialog, and it opens upwards when
 * there's no room below the trigger.
 */
export function Menu({ items, label = "More actions", trigger, triggerVariant = "secondary", size = "md", align = "right", className }: MenuProps) {
    const visible = items.filter((i) => !i.hidden);
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [pos, setPos] = useState<CSSProperties | null>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const menuId = useId();
    const navigate = useNavigate();

    const close = useCallback((refocus = true) => {
        setOpen(false);
        if (refocus) triggerRef.current?.focus();
    }, []);

    const focusItem = (index: number) => {
        const enabled = visible.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
        if (enabled.length === 0) return;
        const n = ((index % visible.length) + visible.length) % visible.length;
        const target = enabled.includes(n) ? n : enabled[0];
        if (target !== undefined) itemRefs.current[target]?.focus();
    };

    const place = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const below = window.innerHeight - r.bottom;
        const up = below < 280 && r.top > below;
        const next: CSSProperties = { position: "fixed" };
        if (up) next.bottom = window.innerHeight - r.top + 6;
        else next.top = r.bottom + 6;
        if (align === "right") next.right = Math.max(8, window.innerWidth - r.right);
        else next.left = Math.max(8, r.left);
        next.maxHeight = Math.max(160, (up ? r.top : below) - 16);
        setPos(next);
    }, [align]);

    useLayoutEffect(() => {
        if (!open) return;
        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        return () => {
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
        };
    }, [open, place]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent | TouchEvent) => {
            const t = e.target as Node;
            if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        const raf = window.requestAnimationFrame(() => focusItem(0));
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
            window.cancelAnimationFrame(raf);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (visible.length === 0) return null;

    const onMenuKeyDown = (e: ReactKeyboardEvent) => {
        const current = itemRefs.current.findIndex((el) => el === document.activeElement);
        if (e.key === "ArrowDown") {
            e.preventDefault();
            focusItem(current + 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            focusItem(current - 1);
        } else if (e.key === "Home") {
            e.preventDefault();
            focusItem(0);
        } else if (e.key === "End") {
            e.preventDefault();
            focusItem(visible.length - 1);
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
        } else if (e.key === "Tab") {
            setOpen(false);
        }
    };

    const select = (item: MenuItem) => {
        if (item.disabled) return;
        close(false);
        if (item.to) navigate(item.to);
        else item.onSelect?.();
    };

    return (
        <div ref={rootRef} className={cx("relative inline-flex", className)}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                aria-label={trigger ? undefined : label}
                title={trigger ? undefined : label}
                onClick={() => setOpen((v) => !v)}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && !open) {
                        e.preventDefault();
                        setOpen(true);
                    }
                }}
                className={buttonClass(triggerVariant, size, { iconOnly: !trigger, className: trigger ? undefined : "px-0" })}
            >
                {trigger ?? <MoreHorizontal className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} aria-hidden />}
            </button>
            {open &&
                pos &&
                createPortal(
                    <div
                        ref={listRef}
                        id={menuId}
                        role="menu"
                        aria-label={label}
                        onKeyDown={onMenuKeyDown}
                        style={pos}
                        className={cx(
                            "z-[70] min-w-[200px] max-w-[min(320px,calc(100vw-2rem))] overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop animate-scale-in",
                            align === "right" ? "origin-top-right" : "origin-top-left"
                        )}
                    >
                        {visible.map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    ref={(el) => {
                                        itemRefs.current[i] = el;
                                    }}
                                    type="button"
                                    role="menuitem"
                                    tabIndex={-1}
                                    disabled={item.disabled}
                                    onClick={() => select(item)}
                                    className={cx(
                                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                                        item.danger
                                            ? "text-bad hover:bg-bad-soft focus:bg-bad-soft"
                                            : "text-ink hover:bg-brand-50 focus:bg-brand-50"
                                    )}
                                >
                                    {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
                                    <span className="truncate">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>,
                    document.body
                )}
        </div>
    );
}

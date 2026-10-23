import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu as MenuIcon, MessagesSquare, Search, Sun, X } from "lucide-react";
import { findNavMatch, navGroupsForRoles } from "@/config/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useOverlay } from "@/hooks/useOverlay";
import { cx } from "@/utils/cx";
import { NavList } from "./NavList";
import { initialsOf, primaryRoleLabel } from "./roleLabel";

interface MobileNavDrawerProps {
    open: boolean;
    onClose: () => void;
    onLogout: () => void;
    closedGroups: Record<string, boolean>;
    onToggleGroup: (group: string) => void;
    counts?: Record<string, number>;
}

/** Phone menu: a scrollable, grouped, role-filtered drawer. */
export function MobileNavDrawer({ open, onClose, onLogout, closedGroups, onToggleGroup, counts }: MobileNavDrawerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const roles = useAuthStore((s) => s.user?.role);
    const user = useAuthStore((s) => s.user);
    const { pathname } = useLocation();
    const groups = useMemo(() => navGroupsForRoles(roles), [roles]);
    const activeTo = findNavMatch(pathname)?.item.to ?? null;
    useOverlay(open, ref, { onClose });

    // Close when the route changes (a link was followed).
    const lastPath = useRef(pathname);
    useEffect(() => {
        if (pathname !== lastPath.current) {
            lastPath.current = pathname;
            if (open) onClose();
        }
    }, [pathname, open, onClose]);

    // Bring the active item into view when the drawer opens.
    useEffect(() => {
        if (!open) return;
        const raf = window.requestAnimationFrame(() => {
            ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "center" });
        });
        return () => window.cancelAnimationFrame(raf);
    }, [open]);

    if (!open) return null;
    const name = user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email || "Signed in" : "";

    return createPortal(
        <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-brand-950/45 animate-fade-in" onClick={onClose} aria-hidden />
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className="absolute inset-y-0 left-0 flex w-[86vw] max-w-sm flex-col bg-surface shadow-pop animate-slide-in-left"
            >
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
                    <img src="/seekkrr-logo.svg" alt="SeekKrr" className="h-7" />
                    <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-control p-2 text-ink-muted hover:bg-brand-50 hover:text-ink">
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                    <NavList groups={groups} activeTo={activeTo} counts={counts} closedGroups={closedGroups} onToggleGroup={onToggleGroup} onNavigate={onClose} />
                </div>
                {user && (
                    <div className="safe-bottom shrink-0 border-t border-line px-4 py-3">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white" aria-hidden>
                                {initialsOf(name)}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink">{name}</p>
                                <p className="text-xs text-ink-muted">{primaryRoleLabel(user.role)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium text-bad hover:bg-bad-soft"
                            >
                                <LogOut className="h-4 w-4" aria-hidden /> Log out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

interface BottomBarProps {
    onOpenSearch: () => void;
    onOpenMenu: () => void;
    menuOpen: boolean;
    todayCount?: number;
}

/** Phone bottom bar: Today, Search, Chat, Menu. */
export function BottomBar({ onOpenSearch, onOpenMenu, menuOpen, todayCount }: BottomBarProps) {
    const { pathname } = useLocation();
    const item = "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:bg-brand-50";
    const on = "text-brand-900";
    const off = "text-ink-faint hover:text-ink-muted";
    const isToday = pathname === "/today" || pathname === "/";
    const isChat = pathname === "/chat" || pathname.startsWith("/chat/");

    return (
        <nav aria-label="Quick" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md md:hidden">
            <div className="flex h-16 items-stretch">
                <Link to="/today" aria-current={isToday ? "page" : undefined} className={cx(item, isToday ? on : off)}>
                    <span className="relative">
                        <Sun className="h-5 w-5" aria-hidden />
                        {!!todayCount && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-highlight ring-2 ring-surface" aria-hidden />}
                    </span>
                    Today
                </Link>
                <button type="button" onClick={onOpenSearch} className={cx(item, off)}>
                    <Search className="h-5 w-5" aria-hidden />
                    Search
                </button>
                <Link to="/chat" aria-current={isChat ? "page" : undefined} className={cx(item, isChat ? on : off)}>
                    <MessagesSquare className="h-5 w-5" aria-hidden />
                    Chat
                </Link>
                <button type="button" onClick={onOpenMenu} aria-expanded={menuOpen} aria-haspopup="dialog" className={cx(item, menuOpen ? on : off)}>
                    <MenuIcon className="h-5 w-5" aria-hidden />
                    Menu
                </button>
            </div>
        </nav>
    );
}

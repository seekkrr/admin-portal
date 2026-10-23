import { Link, useLocation } from "react-router-dom";
import { LogOut, MessagesSquare, Search } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { ButtonLink, IconButton } from "@/components/ui/Button";
import { initialsOf, primaryRoleLabel } from "./roleLabel";

interface AppHeaderProps {
    onOpenSearch: () => void;
    onOpenMenu: () => void;
    onLogout: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Top bar: logo, search (Ctrl/Cmd+K), Chat, who's signed in, logout. */
export function AppHeader({ onOpenSearch, onOpenMenu, onLogout }: AppHeaderProps) {
    const user = useAuthStore((s) => s.user);
    const { pathname } = useLocation();
    const name = user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email || "Signed in" : "";
    const role = primaryRoleLabel(user?.role);
    const onChat = pathname === "/chat" || pathname.startsWith("/chat/");

    return (
        <header className="sticky top-0 z-40 h-14 border-b border-line bg-surface/90 backdrop-blur-md">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-brand-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
            >
                Skip to content
            </a>
            <div className="flex h-full items-center gap-3 px-4 sm:px-6">
                <Link to="/today" className="flex shrink-0 items-center gap-2 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500" aria-label="SeekKrr Admin — Today">
                    <img src="/seekkrr-logo.svg" alt="SeekKrr" className="h-7" />
                    <span className="hidden rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 sm:inline">Admin</span>
                </Link>

                {/* Search — a wide button on tablets/desktops (phones use the bottom bar) */}
                <button
                    type="button"
                    onClick={onOpenSearch}
                    aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
                    className="ml-2 hidden h-9 w-full max-w-md items-center gap-2 rounded-control border border-line-strong bg-surface-muted px-3 text-sm text-ink-faint transition-colors hover:border-brand-200 hover:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 md:flex"
                >
                    <Search className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate text-left">Search people, businesses, places…</span>
                    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] font-medium text-ink-faint">{isMac ? "⌘K" : "Ctrl K"}</kbd>
                </button>

                <div className="ml-auto flex items-center gap-2">
                    <div className="hidden md:block">
                        <ButtonLink to="/chat" size="sm" variant={onChat ? "primary" : "secondary"} icon={MessagesSquare} aria-current={onChat ? "page" : undefined}>
                            Chat
                        </ButtonLink>
                    </div>

                    {user && (
                        <div className="hidden items-center gap-2.5 border-l border-line pl-3 md:flex">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white" aria-hidden>
                                {initialsOf(name)}
                            </span>
                            <span className="hidden min-w-0 flex-col leading-tight lg:flex">
                                <span className="max-w-[12rem] truncate text-sm font-medium text-ink">{name}</span>
                                <span className="text-xs text-ink-muted">{role}</span>
                            </span>
                            <IconButton icon={LogOut} label="Log out" size="sm" onClick={onLogout} />
                        </div>
                    )}

                    {/* Phone: avatar opens the menu drawer (which has logout) */}
                    {user && (
                        <button
                            type="button"
                            onClick={onOpenMenu}
                            aria-label={`${name}, ${role}. Open menu`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white md:hidden"
                        >
                            {initialsOf(name)}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

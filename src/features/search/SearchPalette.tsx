import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Clock, CornerDownLeft, Globe, Loader2, Map as MapIcon, MapPin, Search, Ticket, User, X, type LucideIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { navGroupsForRoles, type NavItem } from "@/config/navigation";
import { useOverlay } from "@/hooks/useOverlay";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { safeStorage } from "@/utils/storage";
import { cx } from "@/utils/cx";
import { errorMessage } from "@/utils/errors";
import { searchService, SEARCH_TYPES, SEARCH_TYPE_LABELS, type SearchHit, type SearchType } from "./search.service";

const RECENT_KEY = "seekkrr_admin_recent_searches";
const MAX_RECENT = 6;
const SEARCH_ROLES = ["admin", "super_admin", "moderator"];

const TYPE_ICONS: Record<SearchType, LucideIcon> = {
    user: User,
    business: Building2,
    place: MapPin,
    quest: MapIcon,
    experience: Ticket,
    region: Globe,
};

type Option =
    | { kind: "recent"; id: string; query: string }
    | { kind: "page"; id: string; item: NavItem; group: string }
    | { kind: "hit"; id: string; hit: SearchHit };

function loadRecent(): string[] {
    const v = safeStorage.get<unknown>(RECENT_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
}

function matchesPage(item: NavItem, group: string, q: string): boolean {
    const hay = [item.label, group, ...(item.keywords ?? [])].join(" ").toLowerCase();
    return q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((w) => hay.includes(w));
}

/**
 * Header search (Ctrl/Cmd+K): finds people, businesses, places, quests,
 * experiences and regions through GET /api/v2/admin/search, plus any page in
 * the menu. Arrow keys move, Enter opens, Escape closes.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
    if (!open) return null;
    return <PaletteBody onClose={onClose} />;
}

function PaletteBody({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const roles = useAuthStore((s) => s.user?.role);
    const canSearch = !!roles?.some((r) => SEARCH_ROLES.includes(r));
    const dialogRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState("");
    const [recent, setRecent] = useState<string[]>(loadRecent);
    const [active, setActive] = useState(0);
    const debounced = useDebouncedValue(query.trim(), 250);
    const listboxId = useId();
    const titleId = useId();

    useOverlay(true, dialogRef, { onClose, initialFocusRef: inputRef });

    const searchEnabled = canSearch && debounced.length >= 2;
    const { data, isFetching, error } = useQuery({
        queryKey: ["admin-search", debounced],
        queryFn: ({ signal }) => searchService.search(debounced, signal),
        enabled: searchEnabled,
        staleTime: 30_000,
        retry: false,
    });

    const groups = useMemo(() => navGroupsForRoles(roles), [roles]);
    const q = query.trim();

    const pageOptions: Option[] = useMemo(() => {
        const all = groups.flatMap((g) => g.items.map((item) => ({ item, group: g.group })));
        const list = q ? all.filter(({ item, group }) => matchesPage(item, group, q)) : all.filter(({ item }) => ["/today", "/users", "/markers", "/collabs/businesses", "/quests"].includes(item.to));
        return list.slice(0, q ? 6 : 5).map(({ item, group }) => ({ kind: "page" as const, id: `page:${item.to}`, item, group }));
    }, [groups, q]);

    const hitGroups: { type: SearchType; options: Option[] }[] = useMemo(() => {
        if (!data || !data.available || debounced !== q) return [];
        return SEARCH_TYPES.map((type) => ({
            type,
            options: (data.results[type] ?? []).map((hit) => ({ kind: "hit" as const, id: `hit:${type}:${hit.id}`, hit })),
        })).filter((g) => g.options.length > 0);
    }, [data, debounced, q]);

    const recentOptions: Option[] = q ? [] : recent.map((r) => ({ kind: "recent" as const, id: `recent:${r}`, query: r }));

    const sections: { key: string; label: string; options: Option[]; action?: ReactNode }[] = [];
    if (recentOptions.length) {
        sections.push({
            key: "recent",
            label: "Recent searches",
            options: recentOptions,
            action: (
                <button
                    type="button"
                    onClick={() => {
                        setRecent([]);
                        safeStorage.remove(RECENT_KEY);
                        inputRef.current?.focus();
                    }}
                    className="text-xs font-medium text-ink-faint hover:text-ink"
                >
                    Clear
                </button>
            ),
        });
    }
    hitGroups.forEach((g) => sections.push({ key: g.type, label: SEARCH_TYPE_LABELS[g.type], options: g.options }));
    if (pageOptions.length) sections.push({ key: "pages", label: q ? "Pages" : "Jump to", options: pageOptions });

    const flat = sections.flatMap((s) => s.options);

    useEffect(() => {
        setActive(0);
    }, [q, data]);

    useEffect(() => {
        const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const remember = (text: string) => {
        const t = text.trim();
        if (t.length < 2) return;
        const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
        setRecent(next);
        safeStorage.set(RECENT_KEY, next);
    };

    const choose = (opt: Option | undefined) => {
        if (!opt) return;
        if (opt.kind === "recent") {
            setQuery(opt.query);
            inputRef.current?.focus();
            return;
        }
        if (q) remember(q);
        onClose();
        navigate(opt.kind === "page" ? opt.item.to : opt.hit.url_path);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            choose(flat[active]);
        }
    };

    const waiting = searchEnabled && (isFetching || debounced !== q);
    const unavailable = !!data && !data.available;
    let status: ReactNode = null;
    if (q.length >= 2 && canSearch) {
        if (unavailable) {
            status = "Search for people, places and businesses is coming soon. You can already jump to any page.";
        } else if (error) {
            status = `Search didn't work: ${errorMessage(error)}`;
        } else if (!waiting && hitGroups.length === 0) {
            status = `No people, businesses or places match “${q}”.`;
        }
    } else if (q.length === 1 && canSearch) {
        status = "Type at least 2 letters to search.";
    } else if (q && !canSearch) {
        status = "Your role can jump to pages; searching records is for admins and moderators.";
    }

    let index = -1;

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-start justify-center md:px-4 md:pt-[10vh]">
            <div className="absolute inset-0 bg-brand-950/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative flex h-full w-full flex-col overflow-hidden bg-surface shadow-pop animate-scale-in md:h-auto md:max-h-[70vh] md:max-w-xl md:rounded-card"
            >
                <h2 id={titleId} className="sr-only">
                    Search
                </h2>
                <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                    <button type="button" onClick={onClose} aria-label="Close search" className="rounded-control p-2 text-ink-muted hover:bg-brand-50 md:hidden">
                        <ArrowLeft className="h-5 w-5" aria-hidden />
                    </button>
                    {waiting ? (
                        <Loader2 className="ml-1 hidden h-5 w-5 shrink-0 animate-spin text-ink-faint md:block" aria-hidden />
                    ) : (
                        <Search className="ml-1 hidden h-5 w-5 shrink-0 text-ink-faint md:block" aria-hidden />
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={flat.length > 0}
                        aria-controls={listboxId}
                        aria-activedescendant={flat[active] ? `${listboxId}-${active}` : undefined}
                        aria-autocomplete="list"
                        aria-label={canSearch ? "Search people, businesses, places, quests and pages" : "Search pages"}
                        placeholder={canSearch ? "Search people, businesses, places…" : "Jump to a page…"}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        autoComplete="off"
                        spellCheck={false}
                        className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none md:text-[15px]"
                    />
                    {query ? (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                inputRef.current?.focus();
                            }}
                            aria-label="Clear"
                            className="rounded-control p-2 text-ink-faint hover:bg-brand-50 hover:text-ink"
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </button>
                    ) : (
                        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-faint md:inline">Esc</kbd>
                    )}
                </div>

                <div ref={listRef} id={listboxId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
                    {status && (
                        <p className="px-3 py-3 text-sm text-ink-muted" role="status">
                            {status}
                        </p>
                    )}
                    {sections.map((section) => (
                        <div key={section.key} role="group" aria-labelledby={`${listboxId}-g-${section.key}`} className="mb-1">
                            <div className="flex items-center justify-between px-3 pb-1 pt-2">
                                <span id={`${listboxId}-g-${section.key}`} className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                                    {section.label}
                                </span>
                                {section.action}
                            </div>
                            {section.options.map((opt) => {
                                index += 1;
                                const i = index;
                                const selected = i === active;
                                let icon: ReactNode;
                                let title: ReactNode;
                                let sub: ReactNode = null;
                                if (opt.kind === "recent") {
                                    icon = <Clock className="h-4 w-4" aria-hidden />;
                                    title = opt.query;
                                } else if (opt.kind === "page") {
                                    const Icon = opt.item.icon;
                                    icon = <Icon className="h-4 w-4" aria-hidden />;
                                    title = opt.item.label;
                                    sub = opt.group;
                                } else {
                                    const Icon = TYPE_ICONS[opt.hit.type] ?? Search;
                                    icon = opt.hit.image_url ? (
                                        <img src={opt.hit.image_url} alt="" className="h-full w-full rounded-md object-cover" loading="lazy" />
                                    ) : (
                                        <Icon className="h-4 w-4" aria-hidden />
                                    );
                                    title = opt.hit.title;
                                    sub = opt.hit.subtitle;
                                }
                                return (
                                    <div
                                        key={opt.id}
                                        id={`${listboxId}-${i}`}
                                        role="option"
                                        aria-selected={selected}
                                        data-index={i}
                                        onMouseMove={() => setActive(i)}
                                        onClick={() => choose(opt)}
                                        className={cx(
                                            "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5",
                                            selected ? "bg-brand-50 text-ink" : "text-ink"
                                        )}
                                    >
                                        <span
                                            className={cx(
                                                "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md",
                                                selected ? "bg-brand-900 text-white" : "bg-surface-muted text-ink-muted"
                                            )}
                                        >
                                            {icon}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{title}</span>
                                            {sub && <span className="block truncate text-xs text-ink-muted">{sub}</span>}
                                        </span>
                                        {selected && <CornerDownLeft className="hidden h-4 w-4 shrink-0 text-ink-faint md:block" aria-hidden />}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                <div className="hidden items-center gap-4 border-t border-line bg-surface-muted px-4 py-2 text-xs text-ink-faint md:flex">
                    <span>
                        <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> move
                    </span>
                    <span>
                        <kbd className="font-sans">Enter</kbd> open
                    </span>
                    <span>
                        <kbd className="font-sans">Esc</kbd> close
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
}

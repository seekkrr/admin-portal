import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { searchService, SEARCH_TYPE_LABELS, type SearchHit, type SearchType } from "@/features/search/search.service";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cx } from "@/utils/cx";
import { shortIdOf } from "@/utils/entity";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const NOUN: Record<SearchType, string> = {
    user: "person",
    business: "business",
    place: "place",
    quest: "quest",
    experience: "experience",
    region: "region",
};

export interface EntityPickerProps {
    /** What to pick: user, quest, region, place, business or experience. */
    type: SearchType;
    /** Selected id ("" = nothing). */
    value: string;
    onChange: (id: string, hit: SearchHit | null) => void;
    /** Accessible name ("Quest"). */
    label: string;
    placeholder?: string;
    disabled?: boolean;
    /** "field" fills its column (forms); "filter" is compact and sits in a FilterBar. */
    variant?: "field" | "filter";
    id?: string;
    invalid?: boolean;
    className?: string;
    "aria-describedby"?: string;
}

type Option = { kind: "hit"; hit: SearchHit } | { kind: "raw"; id: string };

/**
 * Find a record by name, email or id through the admin search
 * (GET /api/v2/admin/search?types=<type>) instead of pasting raw ids. Pasting
 * a 24-character id still works, and is the fallback when the server has no
 * search yet. The list opens in a layer above dialogs, so it also works inside
 * Modal / Drawer and sideways-scrolling filter bars.
 */
export function EntityPicker({
    type,
    value,
    onChange,
    label,
    placeholder,
    disabled,
    variant = "field",
    id,
    invalid,
    className,
    "aria-describedby": describedBy,
}: EntityPickerProps) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const listId = `${inputId}-list`;
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [picked, setPicked] = useState<SearchHit | null>(null);
    const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const q = useDebouncedValue(text.trim(), 250);

    // Label for an id that came from the address or the record (not picked here).
    const known = picked && picked.id === value ? picked : null;
    const label$ = useQuery({
        queryKey: ["entity-label", type, value],
        queryFn: async () => {
            const hits = await searchService.searchType(type, value, 3);
            return hits?.find((h) => h.id === value) ?? null;
        },
        enabled: !!value && !known && OBJECT_ID.test(value),
        staleTime: 10 * 60_000,
        retry: false,
    });
    const selected = known ?? label$.data ?? null;

    const results = useQuery({
        queryKey: ["entity-search", type, q],
        queryFn: ({ signal }) => searchService.searchType(type, q, 8, signal),
        enabled: open && q.length >= 2,
        staleTime: 30_000,
        retry: false,
    });
    const unavailable = results.data === null;
    const hits = results.data ?? [];
    const trimmed = text.trim();
    const options: Option[] = [
        ...(OBJECT_ID.test(trimmed) && !hits.some((h) => h.id === trimmed) ? [{ kind: "raw" as const, id: trimmed }] : []),
        ...(q === trimmed ? hits.map((hit) => ({ kind: "hit" as const, hit })) : []),
    ];

    const place = useCallback(() => {
        const el = wrapRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const width = Math.min(Math.max(r.width, 288), window.innerWidth - 16);
        const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
        setRect({ top: r.bottom + 4, left, width });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        place();
        const onMove = () => place();
        window.addEventListener("resize", onMove);
        window.addEventListener("scroll", onMove, true);
        return () => {
            window.removeEventListener("resize", onMove);
            window.removeEventListener("scroll", onMove, true);
        };
    }, [open, place]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent | TouchEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t)) return;
            if (document.getElementById(listId)?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
        };
    }, [open, listId]);

    useEffect(() => setActive(0), [q, trimmed]);

    const choose = (opt: Option) => {
        if (opt.kind === "hit") {
            setPicked(opt.hit);
            onChange(opt.hit.id, opt.hit);
        } else {
            setPicked(null);
            onChange(opt.id, null);
        }
        setText("");
        setOpen(false);
    };

    const clear = () => {
        setPicked(null);
        onChange("", null);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            else setActive((i) => Math.min(i + 1, Math.max(0, options.length - 1)));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter") {
            const opt = options[active];
            if (open && opt) {
                e.preventDefault();
                choose(opt);
            }
        } else if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
        }
    };

    const isFilter = variant === "filter";
    const boxCls = cx(
        "flex h-10 min-w-0 items-center gap-2 rounded-control border bg-surface text-sm transition-colors",
        isFilter ? "w-56 shrink-0" : "w-full",
        invalid ? "border-bad" : "border-line-strong",
        disabled && "cursor-not-allowed bg-surface-muted text-ink-faint"
    );

    // ── Selected: the record's name with a clear button ──
    if (value) {
        return (
            <div className={cx(boxCls, isFilter && "border-accent-300 bg-accent-50 text-accent-700", "pl-3 pr-1", className)} title={value}>
                <span className="min-w-0 flex-1 truncate">
                    {selected ? (
                        <>
                            <span className={cx("font-medium", !isFilter && "text-ink")}>{selected.title}</span>
                            {selected.subtitle && <span className="text-ink-faint"> · {selected.subtitle}</span>}
                        </>
                    ) : label$.isLoading ? (
                        <span className="text-ink-faint">Loading…</span>
                    ) : (
                        <span className="font-mono text-xs">{shortIdOf(value)}</span>
                    )}
                </span>
                {!disabled && (
                    <button
                        type="button"
                        onClick={clear}
                        aria-label={`Clear ${label.toLowerCase()}`}
                        className="shrink-0 rounded-md p-1.5 text-ink-faint hover:bg-brand-50 hover:text-ink"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                )}
            </div>
        );
    }

    const showList = open && trimmed.length >= 2 && rect;
    const searching = results.isFetching || (q !== trimmed && trimmed.length >= 2);

    return (
        <div ref={wrapRef} className={cx("relative", isFilter ? "w-56 shrink-0" : "w-full", className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded={!!showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
                aria-label={label}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                value={text}
                placeholder={placeholder ?? `Find a ${NOUN[type]} by name or ID…`}
                onChange={(e) => {
                    setText(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => text.trim().length >= 2 && setOpen(true)}
                onKeyDown={onKeyDown}
                className={cx(
                    "h-10 w-full rounded-control border bg-surface pl-9 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-not-allowed disabled:bg-surface-muted",
                    invalid ? "border-bad" : "border-line-strong"
                )}
            />
            {searching && open && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint" aria-hidden />}
            {showList &&
                createPortal(
                    <div
                        id={listId}
                        role="listbox"
                        aria-label={`${SEARCH_TYPE_LABELS[type]} found`}
                        style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
                        className="z-[70] max-h-72 overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop animate-scale-in"
                    >
                        {options.map((opt, i) => (
                            <div
                                key={opt.kind === "hit" ? opt.hit.id : `raw:${opt.id}`}
                                id={`${listId}-${i}`}
                                role="option"
                                aria-selected={i === active}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => choose(opt)}
                                className={cx("cursor-pointer rounded-lg px-3 py-2 text-sm", i === active ? "bg-brand-50" : "hover:bg-surface-muted")}
                            >
                                {opt.kind === "hit" ? (
                                    <>
                                        <div className="truncate font-medium text-ink">{opt.hit.title}</div>
                                        {opt.hit.subtitle && <div className="truncate text-xs text-ink-muted">{opt.hit.subtitle}</div>}
                                    </>
                                ) : (
                                    <div className="truncate text-ink">
                                        Use ID <span className="font-mono text-xs">{opt.id}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {options.length === 0 && (
                            <p className="px-3 py-2.5 text-sm text-ink-muted">
                                {unavailable
                                    ? "Search isn't available on this server yet. Paste the 24-character ID."
                                    : searching
                                      ? "Searching…"
                                      : results.isError
                                        ? "Couldn't search right now."
                                        : `No ${SEARCH_TYPE_LABELS[type].toLowerCase()} match “${trimmed}”.`}
                            </p>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
}

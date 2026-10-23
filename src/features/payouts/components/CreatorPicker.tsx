import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cx } from "@/utils/cx";
import { shortIdOf } from "@/utils/entity";
import { creatorLookupService, type CreatorOption } from "../services/creator-lookup.service";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

type Option = { kind: "creator"; creator: CreatorOption } | { kind: "raw"; id: string };

/**
 * Find a creator by name (or paste a creator id) — payouts key on the creator
 * PROFILE id, so the shared EntityPicker (users) can't be used. Same look and
 * keyboard behaviour as EntityPicker; the list opens in a layer above dialogs.
 */
export function CreatorPicker({
    value,
    onChange,
    label = "Creator",
    placeholder = "Find a creator by name or ID…",
    variant = "field",
    disabled,
    invalid,
    id,
    "aria-describedby": describedBy,
}: {
    value: string;
    onChange: (creatorId: string) => void;
    label?: string;
    placeholder?: string;
    variant?: "field" | "filter";
    disabled?: boolean;
    invalid?: boolean;
    id?: string;
    "aria-describedby"?: string;
}) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const listId = `${inputId}-list`;
    const wrapRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [picked, setPicked] = useState<CreatorOption | null>(null);
    const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const q = useDebouncedValue(text.trim(), 250);

    const known = picked && picked.id === value ? picked : null;
    const label$ = useQuery({
        queryKey: ["creator-label", value],
        queryFn: () => creatorLookupService.get(value),
        enabled: !!value && !known && OBJECT_ID.test(value),
        staleTime: 10 * 60_000,
        retry: false,
    });
    const selected = known ?? label$.data ?? null;

    const results = useQuery({
        queryKey: ["creator-search", q],
        queryFn: () => creatorLookupService.search(q),
        enabled: open && q.length >= 2 && !OBJECT_ID.test(q),
        staleTime: 30_000,
        retry: false,
    });
    const trimmed = text.trim();
    const hits = q === trimmed ? (results.data ?? []) : [];
    const options: Option[] = [
        ...(OBJECT_ID.test(trimmed) ? [{ kind: "raw" as const, id: trimmed }] : []),
        ...hits.map((creator) => ({ kind: "creator" as const, creator })),
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
            if (wrapRef.current?.contains(t) || document.getElementById(listId)?.contains(t)) return;
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
        if (opt.kind === "creator") {
            setPicked(opt.creator);
            onChange(opt.creator.id);
        } else {
            setPicked(null);
            onChange(opt.id);
        }
        setText("");
        setOpen(false);
    };

    const clear = () => {
        setPicked(null);
        onChange("");
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

    if (value) {
        return (
            <div
                title={value}
                className={cx(
                    "flex h-10 min-w-0 items-center gap-2 rounded-control border pl-3 pr-1 text-sm",
                    isFilter ? "w-56 shrink-0 border-accent-300 bg-accent-50 text-accent-700" : "w-full bg-surface",
                    !isFilter && (invalid ? "border-bad" : "border-line-strong"),
                    disabled && "bg-surface-muted text-ink-faint"
                )}
            >
                <span className="min-w-0 flex-1 truncate">
                    {selected?.name ? (
                        <span className={cx("font-medium", !isFilter && "text-ink")}>{selected.name}</span>
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
        <div ref={wrapRef} className={cx("relative", isFilter ? "w-56 shrink-0" : "w-full")}>
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
                placeholder={placeholder}
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
                        aria-label="Creators found"
                        style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
                        className="z-[70] max-h-72 overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop animate-scale-in"
                    >
                        {options.map((opt, i) => (
                            <div
                                key={opt.kind === "creator" ? opt.creator.id : `raw:${opt.id}`}
                                id={`${listId}-${i}`}
                                role="option"
                                aria-selected={i === active}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => choose(opt)}
                                className={cx("cursor-pointer rounded-lg px-3 py-2 text-sm", i === active ? "bg-brand-50" : "hover:bg-surface-muted")}
                            >
                                {opt.kind === "creator" ? (
                                    <>
                                        <div className="truncate font-medium text-ink">{opt.creator.name || "Unnamed creator"}</div>
                                        <div className="truncate text-xs capitalize text-ink-muted">
                                            {opt.creator.status} · <span className="font-mono normal-case">{shortIdOf(opt.creator.id)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="truncate text-ink">
                                        Use creator ID <span className="font-mono text-xs">{opt.id}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {options.length === 0 && (
                            <p className="px-3 py-2.5 text-sm text-ink-muted">
                                {searching ? "Searching…" : results.isError ? "Couldn't search right now. Paste the creator ID." : `No creators match “${trimmed}”.`}
                            </p>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
}

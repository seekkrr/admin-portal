import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download, X, type LucideIcon } from "lucide-react";
import { safeStorage } from "@/utils/storage";
import { cx } from "@/utils/cx";
import { Button, IconButton } from "./Button";
import { Checkbox } from "./Field";
import { EmptyState, ErrorState, SkeletonRows } from "./States";

export type CsvValue = string | number | boolean | null | undefined;

export interface DataColumn<T> {
    id: string;
    /** Plain label: column header, column chooser, CSV header and phone-card label. */
    header: string;
    /** Optional custom header content (defaults to `header`). */
    headerContent?: ReactNode;
    cell: (row: T) => ReactNode;
    /** Enables sorting (of the rows on screen) by this column. */
    sortValue?: (row: T) => string | number | boolean | null | undefined;
    /** CSV value; defaults to `sortValue`. `false` leaves the column out of the export. */
    csv?: ((row: T) => CsvValue) | false;
    align?: "left" | "right" | "center";
    className?: string;
    headerClassName?: string;
    /** Can be hidden from the column chooser (default true). */
    hideable?: boolean;
    defaultHidden?: boolean;
}

export interface DataTableBulkAction {
    label: string;
    icon?: LucideIcon;
    onClick: (ids: string[]) => void;
    tone?: "default" | "danger";
    disabled?: boolean;
}

export interface DataTableCard<T> {
    /** Main line of the card (usually the name). */
    title: (row: T) => ReactNode;
    subtitle?: (row: T) => ReactNode;
    /** Ids of the 3–4 columns shown on the card. */
    fields: string[];
}

export interface DataTableProps<T> {
    rows: T[];
    columns: DataColumn<T>[];
    rowKey: (row: T) => string;
    /** Accessible name of the table ("Users"). */
    label: string;
    /** Phone layout (below md): each row becomes a card. */
    card: DataTableCard<T>;
    /** First load — shows placeholders. */
    isLoading?: boolean;
    /** Background refresh — dims the rows. */
    isFetching?: boolean;
    error?: unknown;
    onRetry?: () => void;
    empty?: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode };
    onRowClick?: (row: T) => void;
    rowClassName?: (row: T) => string | undefined;
    /** Row selection (controlled). Omit to hide checkboxes. */
    selectedIds?: Set<string>;
    onSelectionChange?: (next: Set<string>) => void;
    bulkActions?: DataTableBulkAction[];
    bulkBusy?: boolean;
    /** Per-row actions: last column on wide screens, card header on phones. */
    rowActions?: (row: T) => ReactNode;
    /** Remembers hidden columns in this browser. */
    storageKey?: string;
    /** File name prefix; enables "Export CSV" of the rows on screen. */
    exportName?: string;
    /** Left side of the bar above the table ("20 of 1,240 users"). */
    summary?: ReactNode;
    /** Under the rows (pagination). */
    footer?: ReactNode;
    /** Show the bar with summary / Columns / Export (default true). */
    toolbar?: boolean;
    /** "bare" drops the card frame (when the table sits inside a Panel). */
    frame?: "card" | "bare";
}

const INTERACTIVE = "a,button,input,select,textarea,label,[role='switch'],[role='menu'],[role='menuitem'],[data-row-ignore]";

function fromInteractive(e: MouseEvent | KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    const current = e.currentTarget as HTMLElement;
    const hit = target?.closest(INTERACTIVE);
    return !!hit && hit !== current && current.contains(hit);
}

function csvCell(v: CsvValue): string {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // Spreadsheet formula injection guard.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, header: string[], lines: CsvValue[][]) {
    const body = [header.map(csvCell).join(","), ...lines.map((l) => l.map(csvCell).join(","))].join("\r\n");
    const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type SortState = { id: string; dir: "asc" | "desc" } | null;

function compare(a: unknown, b: unknown): number {
    const na = a === null || a === undefined || a === "";
    const nb = b === null || b === undefined || b === "";
    if (na && nb) return 0;
    if (na) return 1; // blanks last
    if (nb) return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

/**
 * The one list: sortable columns, column chooser, row selection with a bulk
 * bar, CSV export of the rows on screen, loading / empty / error states, and a
 * card layout on phones that shows the 3–4 fields that matter.
 */
export function DataTable<T>({
    rows,
    columns,
    rowKey,
    label,
    card,
    isLoading,
    isFetching,
    error,
    onRetry,
    empty,
    onRowClick,
    rowClassName,
    selectedIds,
    onSelectionChange,
    bulkActions = [],
    bulkBusy,
    rowActions,
    storageKey,
    exportName,
    summary,
    footer,
    toolbar = true,
    frame = "card",
}: DataTableProps<T>) {
    const selectable = !!selectedIds && !!onSelectionChange;
    const selected = useMemo(() => selectedIds ?? new Set<string>(), [selectedIds]);
    const [sort, setSort] = useState<SortState>(null);
    const [hidden, setHidden] = useState<Set<string>>(() => {
        const saved = storageKey ? safeStorage.get<string[] | null>(`dt-cols:${storageKey}`, null) : null;
        return new Set(saved ?? columns.filter((c) => c.defaultHidden).map((c) => c.id));
    });
    const [chooserOpen, setChooserOpen] = useState(false);
    const chooserRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (storageKey) safeStorage.set(`dt-cols:${storageKey}`, Array.from(hidden));
    }, [hidden, storageKey]);

    useEffect(() => {
        if (!chooserOpen) return;
        const onDown = (e: Event) => {
            if (chooserRef.current && !chooserRef.current.contains(e.target as Node)) setChooserOpen(false);
        };
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") setChooserOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [chooserOpen]);

    const visibleColumns = useMemo(() => columns.filter((c) => c.hideable === false || !hidden.has(c.id)), [columns, hidden]);
    const hideableColumns = columns.filter((c) => c.hideable !== false);

    const sortedRows = useMemo(() => {
        if (!sort) return rows;
        const col = columns.find((c) => c.id === sort.id);
        if (!col?.sortValue) return rows;
        const get = col.sortValue;
        const out = [...rows].sort((a, b) => compare(get(a), get(b)));
        return sort.dir === "desc" ? out.reverse() : out;
    }, [rows, sort, columns]);

    const pageIds = useMemo(() => rows.map(rowKey), [rows, rowKey]);
    const selectedOnPage = selectable ? pageIds.filter((id) => selected.has(id)).length : 0;
    const allOnPage = selectable && pageIds.length > 0 && selectedOnPage === pageIds.length;
    const someOnPage = selectedOnPage > 0 && !allOnPage;

    const toggleRow = (id: string, checked: boolean) => {
        if (!selectable) return;
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        onSelectionChange?.(next);
    };

    const togglePage = (checked: boolean) => {
        if (!selectable) return;
        const next = new Set(selected);
        pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
        onSelectionChange?.(next);
    };

    const cycleSort = (id: string) => {
        setSort((s) => (!s || s.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
    };

    const exportCsv = () => {
        const cols = visibleColumns.filter((c) => c.csv !== false && (c.csv || c.sortValue));
        const lines = sortedRows.map((r) => cols.map((c) => (c.csv ? c.csv(r) : c.sortValue?.(r))));
        const stamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`${exportName}-${stamp}.csv`, cols.map((c) => c.header), lines);
    };

    const openRow = (row: T, e: MouseEvent | KeyboardEvent) => {
        if (!onRowClick || fromInteractive(e)) return;
        onRowClick(row);
    };

    const rowKeyDown = (row: T, e: KeyboardEvent) => {
        if (!onRowClick || fromInteractive(e)) return;
        if (e.key === "Enter") {
            e.preventDefault();
            onRowClick(row);
        }
    };

    const cardFields = card.fields.map((id) => columns.find((c) => c.id === id)).filter((c): c is DataColumn<T> => !!c);
    const showBar = toolbar && (!!summary || !!exportName || hideableColumns.length > 0);
    const hasRows = rows.length > 0;
    const selectedCount = selectable ? selected.size : 0;

    let body: ReactNode;
    if (isLoading && !hasRows) {
        body = <SkeletonRows />;
    } else if (error && !hasRows) {
        body = <ErrorState error={error} onRetry={onRetry} />;
    } else if (!hasRows) {
        body = <EmptyState icon={empty?.icon} title={empty?.title ?? "Nothing here yet"} description={empty?.description} action={empty?.action} />;
    } else {
        body = (
            <div className={cx("transition-opacity", isFetching && "opacity-60")}>
                {/* Tablet / desktop: table */}
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm" aria-label={label}>
                        <thead>
                            <tr className="border-b border-line bg-surface-muted">
                                {selectable && (
                                    <th scope="col" className="w-11 px-4 py-3">
                                        <Checkbox
                                            checked={allOnPage}
                                            indeterminate={someOnPage}
                                            onChange={togglePage}
                                            aria-label={allOnPage ? "Deselect all rows on this page" : "Select all rows on this page"}
                                        />
                                    </th>
                                )}
                                {visibleColumns.map((c) => {
                                    const active = sort?.id === c.id;
                                    const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined;
                                    const alignCls = c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left";
                                    return (
                                        <th
                                            key={c.id}
                                            scope="col"
                                            aria-sort={ariaSort}
                                            className={cx("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted", alignCls, c.headerClassName)}
                                        >
                                            {c.sortValue ? (
                                                <button
                                                    type="button"
                                                    onClick={() => cycleSort(c.id)}
                                                    className={cx(
                                                        "-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase tracking-wide hover:text-ink",
                                                        active && "text-ink",
                                                        c.align === "right" && "flex-row-reverse"
                                                    )}
                                                >
                                                    {c.headerContent ?? c.header}
                                                    {active ? (
                                                        sort.dir === "asc" ? (
                                                            <ArrowUp className="h-3 w-3" aria-hidden />
                                                        ) : (
                                                            <ArrowDown className="h-3 w-3" aria-hidden />
                                                        )
                                                    ) : (
                                                        <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden />
                                                    )}
                                                </button>
                                            ) : (
                                                (c.headerContent ?? c.header)
                                            )}
                                        </th>
                                    );
                                })}
                                {rowActions && (
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {sortedRows.map((row) => {
                                const id = rowKey(row);
                                const isSelected = selectable && selected.has(id);
                                return (
                                    <tr
                                        key={id}
                                        onClick={onRowClick ? (e) => openRow(row, e) : undefined}
                                        onKeyDown={onRowClick ? (e) => rowKeyDown(row, e) : undefined}
                                        tabIndex={onRowClick ? 0 : undefined}
                                        className={cx(
                                            "group transition-colors hover:bg-surface-muted",
                                            onRowClick && "cursor-pointer focus:outline-none focus-visible:bg-accent-50",
                                            isSelected && "bg-accent-50/60",
                                            rowClassName?.(row)
                                        )}
                                    >
                                        {selectable && (
                                            <td className="px-4 py-3" data-row-ignore>
                                                <Checkbox checked={isSelected} onChange={(v) => toggleRow(id, v)} aria-label="Select row" />
                                            </td>
                                        )}
                                        {visibleColumns.map((c) => (
                                            <td
                                                key={c.id}
                                                className={cx(
                                                    "px-4 py-3 align-middle text-ink",
                                                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                                                    c.className
                                                )}
                                            >
                                                {c.cell(row)}
                                            </td>
                                        ))}
                                        {rowActions && (
                                            <td className="px-4 py-3 text-right" data-row-ignore>
                                                <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Phone: cards */}
                <ul className="divide-y divide-line md:hidden" aria-label={label}>
                    {sortedRows.map((row) => {
                        const id = rowKey(row);
                        const isSelected = selectable && selected.has(id);
                        return (
                            <li
                                key={id}
                                onClick={onRowClick ? (e) => openRow(row, e) : undefined}
                                onKeyDown={onRowClick ? (e) => rowKeyDown(row, e) : undefined}
                                tabIndex={onRowClick ? 0 : undefined}
                                className={cx(
                                    "px-4 py-3.5",
                                    onRowClick && "cursor-pointer active:bg-surface-muted focus:outline-none focus-visible:bg-accent-50",
                                    isSelected && "bg-accent-50/60",
                                    rowClassName?.(row)
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    {selectable && (
                                        <span className="pt-0.5" data-row-ignore>
                                            <Checkbox checked={isSelected} onChange={(v) => toggleRow(id, v)} aria-label="Select row" />
                                        </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="break-words text-[15px] font-medium leading-snug text-ink">{card.title(row)}</div>
                                        {card.subtitle && <div className="mt-0.5 truncate text-xs text-ink-muted">{card.subtitle(row)}</div>}
                                    </div>
                                    {rowActions && (
                                        <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5" data-row-ignore>
                                            {rowActions(row)}
                                        </div>
                                    )}
                                </div>
                                {cardFields.length > 0 && (
                                    <dl className={cx("mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2", selectable && "pl-7")}>
                                        {cardFields.map((c) => (
                                            <div key={c.id} className="min-w-0">
                                                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{c.header}</dt>
                                                <dd className="mt-0.5 min-w-0 text-sm text-ink">{c.cell(row)}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }

    return (
        <div className={cx("bg-surface", frame === "card" && "overflow-hidden rounded-card border border-line shadow-card")}>
            {showBar && (
                <div className="flex min-h-[3rem] items-center justify-between gap-3 border-b border-line px-4 py-2">
                    <div className="min-w-0 truncate text-sm text-ink-muted" aria-live="polite">
                        {summary}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {hideableColumns.length > 0 && (
                            <div ref={chooserRef} className="relative hidden md:block">
                                <Button size="sm" variant="ghost" icon={Columns3} aria-expanded={chooserOpen} aria-haspopup="true" onClick={() => setChooserOpen((v) => !v)}>
                                    Columns
                                </Button>
                                {chooserOpen && (
                                    <div
                                        role="group"
                                        aria-label="Show columns"
                                        className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-card border border-line bg-surface p-2 shadow-pop animate-scale-in"
                                    >
                                        <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Show columns</p>
                                        <div className="max-h-72 space-y-0.5 overflow-y-auto">
                                            {hideableColumns.map((c) => (
                                                <div key={c.id} className="rounded-lg px-2 py-1.5 hover:bg-surface-muted">
                                                    <Checkbox
                                                        checked={!hidden.has(c.id)}
                                                        onChange={(v) =>
                                                            setHidden((prev) => {
                                                                const next = new Set(prev);
                                                                if (v) next.delete(c.id);
                                                                else next.add(c.id);
                                                                return next;
                                                            })
                                                        }
                                                        label={c.header}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {exportName && (
                            <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv} disabled={!hasRows} title="Download the rows on screen as a CSV file">
                                <span className="hidden sm:inline">Export CSV</span>
                                <span className="sm:hidden">CSV</span>
                            </Button>
                        )}
                    </div>
                </div>
            )}
            {body}
            {footer}

            {selectable && selectedCount > 0 && bulkActions.length > 0 && (
                <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 md:bottom-6">
                    <div
                        role="region"
                        aria-label="Bulk actions"
                        className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-card border border-line bg-surface px-3 py-2 shadow-pop animate-slide-up"
                    >
                        <span className="shrink-0 rounded-lg bg-brand-900 px-2.5 py-1 text-xs font-semibold tabular-nums text-white">{selectedCount} selected</span>
                        {bulkActions.map((a) => (
                            <Button
                                key={a.label}
                                size="sm"
                                variant={a.tone === "danger" ? "danger" : "secondary"}
                                icon={a.icon}
                                disabled={a.disabled || bulkBusy}
                                onClick={() => a.onClick(Array.from(selected))}
                                className="shrink-0"
                            >
                                {a.label}
                            </Button>
                        ))}
                        <IconButton icon={X} size="sm" label="Clear selection" onClick={() => onSelectionChange?.(new Set())} disabled={bulkBusy} />
                    </div>
                </div>
            )}
        </div>
    );
}

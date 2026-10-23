import { useState } from "react";
import type { FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePaginationRange } from "@/hooks/usePagination";
import { cx } from "@/utils/cx";

/** @deprecated Pagination has one neutral style now; the theme is ignored. */
export type PaginationTheme = "indigo" | "orange" | "teal" | "emerald" | "rose" | "amber" | "cyan" | "violet";

export interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
    /** Rows per page; when given the bar shows "21–40 of 1,234". */
    pageSize?: number;
    /** @deprecated ignored — one neutral style everywhere. */
    theme?: PaginationTheme;
    className?: string;
}

const navBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-control border border-line-strong bg-surface text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

/** The one pagination bar. Compact (‹ Page 2 of 9 ›) on phones. */
export function Pagination({ page, totalPages, total, onPageChange, pageSize, className }: PaginationProps) {
    const paginationRange = usePaginationRange(totalPages, page);
    const [goToPage, setGoToPage] = useState("");

    if (totalPages <= 1) return null;

    const handleGoToPage = (e: FormEvent) => {
        e.preventDefault();
        const p = parseInt(goToPage, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
            onPageChange(p);
            setGoToPage("");
        }
    };

    const summary =
        pageSize && total > 0
            ? `${((page - 1) * pageSize + 1).toLocaleString("en-IN")}–${Math.min(page * pageSize, total).toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}`
            : `Page ${page} of ${totalPages}`;

    return (
        <nav aria-label="Pagination" className={cx("flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3", className)}>
            <span className="hidden text-sm text-ink-muted sm:inline">{summary}</span>

            {/* Phone: compact */}
            <div className="flex w-full items-center justify-between gap-2 sm:hidden">
                <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className={navBtn} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-ink-muted" aria-live="polite">
                    Page {page} of {totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className={navBtn}
                    aria-label="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Tablet/desktop */}
            <div className="hidden items-center gap-3 sm:flex">
                {totalPages > 7 && (
                    <form onSubmit={handleGoToPage} className="hidden items-center gap-2 lg:flex">
                        <label htmlFor="pagination-go-to" className="text-sm text-ink-muted">
                            Go to
                        </label>
                        <input
                            id="pagination-go-to"
                            type="number"
                            min={1}
                            max={totalPages}
                            value={goToPage}
                            onChange={(e) => setGoToPage(e.target.value)}
                            placeholder="#"
                            className="h-9 w-16 rounded-control border border-line-strong bg-surface px-2 text-center text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
                        />
                    </form>
                )}
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className={navBtn} aria-label="Previous page">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    {paginationRange.map((p, idx) =>
                        p === "..." ? (
                            <span key={`ellipsis-${idx}`} className="select-none px-2 text-ink-faint" aria-hidden>
                                …
                            </span>
                        ) : (
                            <button
                                key={p}
                                type="button"
                                onClick={() => onPageChange(p as number)}
                                aria-current={page === p ? "page" : undefined}
                                aria-label={`Page ${p}`}
                                className={cx(
                                    "inline-flex h-9 min-w-9 items-center justify-center rounded-control px-2.5 text-sm tabular-nums transition-colors",
                                    page === p ? "bg-brand-900 font-semibold text-white" : "font-medium text-ink-muted hover:bg-brand-50 hover:text-ink"
                                )}
                            >
                                {p}
                            </button>
                        )
                    )}
                    <button
                        type="button"
                        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className={navBtn}
                        aria-label="Next page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </nav>
    );
}

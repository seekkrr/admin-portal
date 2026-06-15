import { useState, FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePaginationRange } from "@/hooks/usePagination";

export interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
    const paginationRange = usePaginationRange(page, totalPages);
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

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50/30 gap-4 sm:gap-0">
            <span className="text-sm text-neutral-500 text-center sm:text-left">
                Page <span className="font-medium text-neutral-700">{page}</span> of <span className="font-medium text-neutral-700">{totalPages}</span>
                <span className="ml-2 text-neutral-400">({total} total)</span>
            </span>
            <div className="flex items-center justify-center sm:justify-end gap-3 sm:gap-4">
                <form onSubmit={handleGoToPage} className="hidden sm:flex items-center gap-2">
                    <span className="text-sm text-neutral-500">Go to</span>
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={goToPage}
                        onChange={(e) => setGoToPage(e.target.value)}
                        placeholder="Pg"
                        className="w-14 h-9 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-center shadow-sm"
                    />
                </form>
                <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                    className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                {paginationRange.map((p, idx) =>
                    p === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-neutral-400 text-sm select-none">…</span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p as number)}
                            aria-current={p === page ? "page" : undefined}
                            className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${p === page
                                ? "bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                                : "text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300 border border-neutral-200"
                                }`}
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                    className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
        </div>
    );
}

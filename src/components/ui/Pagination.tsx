import { useState } from "react";
import type { FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePaginationRange } from "@/hooks/usePagination";

export type PaginationTheme = "indigo" | "orange" | "teal" | "emerald" | "rose" | "amber" | "cyan" | "violet";

export interface PaginationProps {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
    theme?: PaginationTheme;
}

const themeStyles: Record<PaginationTheme, { active: string; focus: string }> = {
    indigo: { active: "bg-indigo-50 text-indigo-600 font-semibold", focus: "focus:ring-indigo-500" },
    orange: { active: "bg-orange-50 text-orange-600 font-semibold", focus: "focus:ring-orange-500" },
    teal: { active: "bg-teal-50 text-teal-600 font-semibold", focus: "focus:ring-teal-500" },
    emerald: { active: "bg-emerald-50 text-emerald-600 font-semibold", focus: "focus:ring-emerald-500" },
    rose: { active: "bg-rose-50 text-rose-600 font-semibold", focus: "focus:ring-rose-500" },
    amber: { active: "bg-amber-50 text-amber-600 font-semibold", focus: "focus:ring-amber-500" },
    cyan: { active: "bg-cyan-50 text-cyan-600 font-semibold", focus: "focus:ring-cyan-500" },
    violet: { active: "bg-violet-50 text-violet-600 font-semibold", focus: "focus:ring-violet-500" },
};

export function Pagination({ page, totalPages, onPageChange, theme = "indigo" }: PaginationProps) {
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

    const currentTheme = themeStyles[theme];

    return (
        <div className="p-4 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between bg-white gap-4 sm:gap-0">
            <span className="text-sm text-neutral-500 text-center sm:text-left">
                Showing Page {page} of {totalPages}
            </span>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
                <form onSubmit={handleGoToPage} className="hidden sm:flex items-center gap-2">
                    <span className="text-sm text-neutral-500">Go to</span>
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={goToPage}
                        onChange={(e) => setGoToPage(e.target.value)}
                        placeholder="Page #"
                        className={`w-22 h-9 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-700 focus:outline-none focus:ring-2 ${currentTheme.focus} focus:border-transparent text-center transition-all`}
                    />
                </form>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    {paginationRange.map((p, idx) =>
                        p === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-3 py-2 text-neutral-400 select-none">…</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => onPageChange(p as number)}
                                className={`px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none ${
                                    page === p
                                        ? currentTheme.active
                                        : "text-neutral-600 hover:bg-neutral-100 font-medium"
                                }`}
                            >
                                {p}
                            </button>
                        )
                    )}
                    <button
                        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="p-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

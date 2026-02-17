import { useMemo } from "react";

/**
 * Generates an array of page numbers (and ellipsis markers) for pagination UI.
 * Shows up to 7 pages; uses "..." for gaps when total is larger.
 */
export function usePaginationRange(totalPages: number, currentPage: number): (number | "...")[] {
    return useMemo(() => {
        const pages: (number | "...")[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push("...");
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    }, [totalPages, currentPage]);
}

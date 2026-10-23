import type { ReactNode } from "react";
import { Banknote } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { calendarDate } from "@/components/detail/detailFormat";
import { formatDateTime, formatRelative } from "@/utils/date";
import { inr } from "../money";
import type { BusinessPayout } from "../types";

/** Bank transfers recorded for one business, newest first. */
export function PayoutsTable({
    rows,
    isLoading,
    error,
    onRetry,
    emptyAction,
    frame = "bare",
}: {
    rows: BusinessPayout[];
    isLoading?: boolean;
    error?: unknown;
    onRetry?: () => void;
    emptyAction?: ReactNode;
    frame?: "card" | "bare";
}) {
    const sorted = [...rows].sort((a, b) => (b.paid_on ?? b.created_at ?? "").localeCompare(a.paid_on ?? a.created_at ?? ""));
    const columns: DataColumn<BusinessPayout>[] = [
        { id: "paid_on", header: "Paid on", hideable: false, sortValue: (p) => p.paid_on ?? "", cell: (p) => <span className="whitespace-nowrap font-medium text-ink">{calendarDate(p.paid_on)}</span> },
        { id: "amount", header: "Amount", align: "right", sortValue: (p) => p.amount, cell: (p) => <span className="whitespace-nowrap font-medium tabular-nums">{inr(p.amount)}</span> },
        { id: "reference", header: "Reference", sortValue: (p) => p.reference ?? "", cell: (p) => <CopyText value={p.reference} mono /> },
        { id: "note", header: "Note", csv: (p) => p.note ?? "", cell: (p) => <span className="line-clamp-2 text-ink-muted">{p.note || "—"}</span> },
        {
            id: "recorded",
            header: "Recorded",
            sortValue: (p) => p.created_at ?? "",
            csv: (p) => formatDateTime(p.created_at),
            cell: (p) => (
                <span className="whitespace-nowrap text-xs text-ink-muted" title={formatDateTime(p.created_at)}>
                    {formatRelative(p.created_at)}
                    {(p.created_by_name || p.created_by) && (
                        <>
                            {" · "}
                            {p.created_by ? <IdLink kind="user" id={p.created_by} label={p.created_by_name ?? undefined} /> : p.created_by_name}
                        </>
                    )}
                </span>
            ),
        },
    ];
    return (
        <DataTable
            label="Payouts"
            rows={sorted}
            columns={columns}
            rowKey={(p) => p.id || `${p.paid_on}-${p.amount}-${p.reference}`}
            isLoading={isLoading}
            error={error}
            onRetry={onRetry}
            toolbar={false}
            frame={frame}
            empty={{ icon: Banknote, title: "No payouts recorded yet", action: emptyAction }}
            card={{
                title: (p) => (
                    <span className="flex items-baseline justify-between gap-2">
                        <span>{calendarDate(p.paid_on)}</span>
                        <span className="tabular-nums">{inr(p.amount)}</span>
                    </span>
                ),
                subtitle: (p) => p.note || null,
                fields: ["reference", "recorded"],
            }}
        />
    );
}

import { StatusPill, Tag } from "@/components/ui/StatusPill";
import type { StatusTone } from "@/components/ui/status";
import type { TransactionStatus, RefundStatus } from "@/types";

// Statuses the portal-wide map doesn't know, or reads differently for money.
const TRANSACTION_TONE: Partial<Record<TransactionStatus, StatusTone>> = {
    authorized: "good",
    expired: "bad",
    refunded: "info",
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
    return <StatusPill status={status} tone={TRANSACTION_TONE[status]} />;
}

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
    return <StatusPill status={status} />;
}

const SOURCE_TONE: Record<string, StatusTone> = { webhook: "info", api: "brand", system: "neutral" };

/** Where a payment event came from (webhook / api / system). */
export function EventSourceTag({ source }: { source: string | null | undefined }) {
    if (!source) return <span className="text-ink-faint">—</span>;
    return (
        <Tag tone={SOURCE_TONE[source] ?? "neutral"} className="capitalize">
            {source}
        </Tag>
    );
}

/** `key: value` chips for metadata / acquirer data objects. */
export function KeyValueTags({ entries }: { entries: [string, unknown][] }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {entries.map(([k, v]) => (
                <Tag key={k} className="max-w-full whitespace-normal break-all">
                    <span className="text-ink-faint">{k}:</span> {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </Tag>
            ))}
        </div>
    );
}

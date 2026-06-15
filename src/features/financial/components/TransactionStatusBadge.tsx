import { Badge } from "@/components/ui/Badge";
import type { TransactionStatus, RefundStatus } from "@/types";

const TRANSACTION_STATUS_STYLES: Record<TransactionStatus, string> = {
    captured: "bg-emerald-50 text-emerald-700 border-emerald-200",
    authorized: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    expired: "bg-red-50 text-red-700 border-red-200",
    refunded: "bg-violet-50 text-violet-700 border-violet-200",
};

const REFUND_STATUS_STYLES: Record<RefundStatus, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    initiated: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
    return (
        <Badge
            label={status}
            styles={TRANSACTION_STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}
        />
    );
}

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
    return (
        <Badge
            label={status}
            styles={REFUND_STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200"}
        />
    );
}

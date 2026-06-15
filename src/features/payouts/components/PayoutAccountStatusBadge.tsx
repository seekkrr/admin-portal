import { Badge } from "@/components/ui/Badge";
import type { PayoutAccountStatus, PayoutStatus } from "@/types";

const ACCOUNT_STATUS_BADGE: Record<PayoutAccountStatus, string> = {
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending_verification: "bg-amber-50 text-amber-700 border-amber-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    disabled: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const PAYOUT_STATUS_BADGE: Record<PayoutStatus, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export function PayoutAccountStatusBadge({ status }: { status: PayoutAccountStatus }) {
    return (
        <Badge
            label={status}
            styles={ACCOUNT_STATUS_BADGE[status] ?? ACCOUNT_STATUS_BADGE.disabled}
        />
    );
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
    return (
        <Badge
            label={status}
            styles={PAYOUT_STATUS_BADGE[status] ?? PAYOUT_STATUS_BADGE.cancelled}
        />
    );
}

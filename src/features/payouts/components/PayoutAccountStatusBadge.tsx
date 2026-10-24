import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusTone } from "@/components/ui/status";
import type { PayoutAccountStatus, PayoutStatus } from "@/types";

const ACCOUNT_TONE: Record<PayoutAccountStatus, StatusTone> = {
    verified: "good",
    pending_verification: "warn",
    rejected: "bad",
    disabled: "neutral",
};

const ACCOUNT_LABEL: Partial<Record<PayoutAccountStatus, string>> = { pending_verification: "Needs verification" };

export function PayoutAccountStatusBadge({ status }: { status: PayoutAccountStatus }) {
    return <StatusPill status={status} tone={ACCOUNT_TONE[status]} label={ACCOUNT_LABEL[status]} />;
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
    return <StatusPill status={status} />;
}

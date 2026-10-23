import { StatusPill } from "@/components/ui/StatusPill";
import type { ExperiencePaymentStatus } from "@/types/admin-detail";
import { PAYMENT_STATUS_META } from "../money";

/** Paid / Refund pending / Refunded / Failed / Awaiting payment / Free. */
export function PaymentStatusPill({ status, className }: { status: ExperiencePaymentStatus | null | undefined; className?: string }) {
    if (!status) return <span className="text-ink-faint">—</span>;
    const meta = PAYMENT_STATUS_META[status];
    return <StatusPill status={status} label={meta?.label} tone={meta?.tone} className={className} />;
}

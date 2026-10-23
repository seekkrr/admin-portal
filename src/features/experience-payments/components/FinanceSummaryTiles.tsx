import { ArrowDownLeft, Banknote, BadgePercent, Landmark, ReceiptText, Scale, Wallet } from "lucide-react";
import { StatTile } from "@/components/ui/Stat";
import { inr, pct } from "../money";
import type { FinanceSummary } from "../types";

/**
 * Gross · Refunds · Commission · GST collected · Net owed · Paid out · Balance.
 * Commission is on the price before GST, whether GST is on or off; GST is never
 * commissioned and never part of what the business is owed.
 */
export function FinanceSummaryTiles({
    summary,
    commissionPct,
    owedLabel = "Net owed",
}: {
    summary: FinanceSummary;
    /** One business's commission rate (shown under Commission). */
    commissionPct?: number | null;
    owedLabel?: string;
}) {
    const balanceHint =
        summary.balance > 0.004 ? "Still to pay" : summary.balance < -0.004 ? "Paid more than owed" : "All paid";
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            <StatTile label="Gross" icon={ReceiptText} value={inr(summary.gross)} hint="Paid by travelers" />
            <StatTile label="Refunds" icon={ArrowDownLeft} value={inr(summary.refunds)} hint={summary.refunds ? "Back to travelers" : "None"} />
            <StatTile
                label="Commission"
                icon={BadgePercent}
                value={inr(summary.commission)}
                hint={commissionPct !== undefined ? `${pct(commissionPct)} of the price before GST` : "On the price before GST"}
            />
            <StatTile label="GST collected" icon={Landmark} value={inr(summary.gst_collected)} hint="Not commissioned" />
            <StatTile label={owedLabel} icon={Scale} value={inr(summary.net_owed)} hint="After commission and refunds" />
            <StatTile label="Paid out" icon={Banknote} value={inr(summary.paid_out)} hint="Bank transfers" />
            <StatTile
                label="Balance"
                icon={Wallet}
                value={inr(summary.balance)}
                hint={balanceHint}
                hintTone={summary.balance > 0.004 ? "warn" : summary.balance < -0.004 ? "bad" : "good"}
            />
        </div>
    );
}

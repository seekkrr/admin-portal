import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, ReceiptText } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Notice, SectionState } from "@/components/detail/DetailStates";
import { experiencePaymentsApi } from "@/features/experience-payments/service";
import { inr, pct } from "@/features/experience-payments/money";
import type { DateRange } from "@/features/experience-payments/dateRange";
import type { FinanceSummary } from "@/features/experience-payments/types";
import { DateRangeFilter } from "@/features/experience-payments/components/DateRangeFilter";
import { FinanceSummaryTiles } from "@/features/experience-payments/components/FinanceSummaryTiles";
import { FinanceBookingsTable } from "@/features/experience-payments/components/FinanceBookingsTable";
import { PayoutsTable } from "@/features/experience-payments/components/PayoutsTable";
import { RecordPayoutModal } from "@/features/experience-payments/components/RecordPayoutModal";
import type { AdminBusiness } from "../../types";

const PAGE_SIZE = 20;
const ZERO: FinanceSummary = { gross: 0, refunds: 0, commission: 0, gst_collected: 0, net_owed: 0, paid_out: 0, balance: 0 };

/** What this business earned from experiences, what SeekKrr kept, and the bank transfers made to it. */
export function BusinessEarningsTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const [range, setRange] = useState<DateRange>({ from: "", to: "" });
    const [page, setPage] = useState(1);
    const [recording, setRecording] = useState(false);
    const params = { from: range.from || undefined, to: range.to || undefined };

    const overview = useQuery({
        queryKey: ["experience-finance", "overview", range.from, range.to],
        queryFn: () => experiencePaymentsApi.overview(params),
        placeholderData: (prev) => prev,
        retry: false,
    });
    // The balance to pay is all-time, whatever period is shown.
    const allTime = useQuery({
        queryKey: ["experience-finance", "overview", "", ""],
        queryFn: () => experiencePaymentsApi.overview({}),
        retry: false,
    });
    const payouts = useQuery({
        queryKey: ["business-payouts", business.id],
        queryFn: () => experiencePaymentsApi.payouts(business.id),
        retry: false,
    });
    const bookings = useQuery({
        queryKey: ["experience-finance", "bookings", { business: business.id, ...params, page }],
        queryFn: () => experiencePaymentsApi.bookings({ business_id: business.id, ...params, page, page_size: PAGE_SIZE }),
        placeholderData: (prev) => prev,
        retry: false,
    });

    const row = overview.data?.businesses.find((b) => b.business_id === business.id) ?? null;
    const balance = allTime.data ? (allTime.data.businesses.find((b) => b.business_id === business.id)?.balance ?? 0) : null;
    const commissionPct = row?.commission_pct ?? (typeof business.commission_pct === "number" ? business.commission_pct : null);
    const data = bookings.data;

    const recordButton = canEdit ? (
        <Button size="sm" variant="primary" icon={Banknote} onClick={() => setRecording(true)}>
            Record payout
        </Button>
    ) : null;

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <DateRangeFilter
                        value={range}
                        onChange={(r) => {
                            setRange(r);
                            setPage(1);
                        }}
                    />
                </div>
                {recordButton}
            </div>

            <Notice title="How the money moves">
                Travelers pay SeekKrr when they book. SeekKrr keeps {commissionPct === null ? "its commission" : `a ${pct(commissionPct)} commission`} on the price
                before GST (with or without GST) and pays the rest to {business.name} by bank transfer. GST is never commissioned or paid out. Record each
                transfer here.
            </Notice>

            <SectionState isLoading={overview.isLoading} error={overview.error} what="Earnings" onRetry={() => overview.refetch()}>
                <FinanceSummaryTiles summary={row ?? ZERO} commissionPct={commissionPct} owedLabel="Owed to business" />
                {overview.data && !row && <p className="mt-2 text-sm text-ink-muted">No paid bookings for {business.name} in this period.</p>}
            </SectionState>

            <Panel
                title="Payouts"
                icon={Banknote}
                description={balance !== null ? `Balance still to pay: ${inr(balance)}` : "Bank transfers to this business."}
                actions={recordButton}
                bodyClassName="p-0"
            >
                <SectionState isLoading={payouts.isLoading} error={payouts.error} what="Payouts" onRetry={() => payouts.refetch()}>
                    <PayoutsTable rows={payouts.data ?? []} />
                </SectionState>
            </Panel>

            <Panel title={`Paid bookings${data ? ` (${data.total.toLocaleString("en-IN")})` : ""}`} icon={ReceiptText} bodyClassName="p-0">
                <SectionState isLoading={bookings.isLoading} error={bookings.error} what="Paid bookings" onRetry={() => bookings.refetch()}>
                    <FinanceBookingsTable
                        rows={data?.bookings ?? []}
                        isFetching={bookings.isFetching && !!data}
                        showBusiness={false}
                        frame="bare"
                        filtered={!!range.from || !!range.to}
                        storageKey="business-earnings-bookings"
                        exportName={`earnings-${business.slug || business.id}`}
                        summary={data ? `${data.bookings.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                        footer={
                            data && data.total_pages > 1 ? (
                                <Pagination page={page} totalPages={data.total_pages} total={data.total} pageSize={data.page_size} onPageChange={setPage} />
                            ) : undefined
                        }
                    />
                </SectionState>
            </Panel>

            {canEdit && (
                <RecordPayoutModal open={recording} onClose={() => setRecording(false)} businessId={business.id} businessName={business.name} balance={balance} />
            )}
        </div>
    );
}

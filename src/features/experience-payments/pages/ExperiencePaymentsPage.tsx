import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, HandCoins, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Panel } from "@/components/ui/Panel";
import { Pagination } from "@/components/ui/Pagination";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { SectionState } from "@/components/detail/DetailStates";
import { useUrlState } from "@/hooks/useUrlState";
import { experiencePaymentsApi } from "../service";
import { inr, pct, PAYMENT_STATUS_FILTERS } from "../money";
import { rangeLabel } from "../dateRange";
import type { BusinessFinanceRow } from "../types";
import { DateRangeFilter } from "../components/DateRangeFilter";
import { FinanceSummaryTiles } from "../components/FinanceSummaryTiles";
import { FinanceBookingsTable } from "../components/FinanceBookingsTable";

const PAGE_SIZE = 25;

const earningsPath = (businessId: string) => `/collabs/businesses/${encodeURIComponent(businessId)}?tab=earnings`;

const money = (v: number) => <span className="whitespace-nowrap tabular-nums">{inr(v)}</span>;

/**
 * Money → Experience payments: what travelers paid for experiences, SeekKrr's
 * commission (on the price before GST), GST collected, and what each business
 * is owed and has been paid out.
 */
export function ExperiencePaymentsPage() {
    const navigate = useNavigate();
    const { state, set } = useUrlState({ from: "", to: "", business: "", status: "", page: 1 });
    const range = { from: state.from || undefined, to: state.to || undefined };
    const status = PAYMENT_STATUS_FILTERS.some((s) => s.value === state.status) ? state.status : "";
    const page = Math.max(1, state.page);

    const overview = useQuery({
        queryKey: ["experience-finance", "overview", range.from ?? "", range.to ?? ""],
        queryFn: () => experiencePaymentsApi.overview(range),
        placeholderData: (prev) => prev,
        retry: false,
    });
    const bookings = useQuery({
        queryKey: ["experience-finance", "bookings", { ...range, business: state.business, status, page }],
        queryFn: () =>
            experiencePaymentsApi.bookings({ ...range, business_id: state.business || undefined, status: status || undefined, page, page_size: PAGE_SIZE }),
        placeholderData: (prev) => prev,
        retry: false,
    });

    const businessColumns: DataColumn<BusinessFinanceRow>[] = [
        {
            id: "business",
            header: "Business",
            hideable: false,
            sortValue: (r) => r.name,
            cell: (r) => (
                <Link to={earningsPath(r.business_id)} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {r.name}
                </Link>
            ),
        },
        { id: "commission_pct", header: "Commission %", align: "right", sortValue: (r) => r.commission_pct, cell: (r) => <span className="tabular-nums">{pct(r.commission_pct)}</span> },
        { id: "gross", header: "Gross", align: "right", sortValue: (r) => r.gross, cell: (r) => money(r.gross) },
        { id: "refunds", header: "Refunds", align: "right", sortValue: (r) => r.refunds, cell: (r) => money(r.refunds) },
        { id: "commission", header: "Commission", align: "right", sortValue: (r) => r.commission, cell: (r) => money(r.commission) },
        { id: "gst", header: "GST collected", align: "right", sortValue: (r) => r.gst_collected, cell: (r) => money(r.gst_collected) },
        { id: "net_owed", header: "Net owed", align: "right", sortValue: (r) => r.net_owed, cell: (r) => money(r.net_owed) },
        { id: "paid_out", header: "Paid out", align: "right", sortValue: (r) => r.paid_out, cell: (r) => money(r.paid_out) },
        {
            id: "balance",
            header: "Balance",
            align: "right",
            sortValue: (r) => r.balance,
            cell: (r) => (
                <Link
                    to={earningsPath(r.business_id)}
                    className={`whitespace-nowrap font-semibold tabular-nums hover:underline ${r.balance > 0.004 ? "text-warn" : r.balance < -0.004 ? "text-bad" : "text-ink"}`}
                >
                    {inr(r.balance)}
                </Link>
            ),
        },
    ];

    const dateChips: FilterChip[] = [];
    if (state.from || state.to) dateChips.push({ key: "range", label: rangeLabel({ from: state.from, to: state.to }), onRemove: () => set({ from: "", to: "" }) });
    const bookingFilters = !!state.business || !!status;
    const data = bookings.data;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={HandCoins}
                title="Experience payments"
                description="What travelers paid for experiences, SeekKrr's commission and what each business is owed."
            />

            <FilterBar chips={dateChips} onReset={() => set({ from: "", to: "" })}>
                <DateRangeFilter value={{ from: state.from, to: state.to }} onChange={(r) => set({ from: r.from, to: r.to })} />
            </FilterBar>

            <SectionState isLoading={overview.isLoading} error={overview.error} what="Experience payment totals" onRetry={() => overview.refetch()}>
                {overview.data && <FinanceSummaryTiles summary={overview.data.summary} />}
            </SectionState>

            <Panel title="By business" icon={Building2} description="Commission is on the price before GST, with or without GST. Open a business to record a payout." bodyClassName="p-0">
                <SectionState isLoading={overview.isLoading} error={overview.error} what="Totals by business" onRetry={() => overview.refetch()}>
                    <DataTable
                        label="Experience payments by business"
                        rows={overview.data?.businesses ?? []}
                        columns={businessColumns}
                        rowKey={(r) => r.business_id || r.name}
                        isFetching={overview.isFetching && !!overview.data}
                        frame="bare"
                        storageKey="experience-payments-businesses"
                        exportName="experience-payments-by-business"
                        summary={overview.data ? `${overview.data.businesses.length} businesses` : undefined}
                        onRowClick={(r) => r.business_id && navigate(earningsPath(r.business_id))}
                        empty={{ icon: Building2, title: "No experience payments in this period" }}
                        card={{
                            title: (r) => r.name,
                            subtitle: (r) => `Commission ${pct(r.commission_pct)}`,
                            fields: ["net_owed", "paid_out", "balance", "gross"],
                        }}
                    />
                </SectionState>
            </Panel>

            <Panel title={`Bookings${data ? ` (${data.total.toLocaleString("en-IN")})` : ""}`} icon={ReceiptText} bodyClassName="p-0">
                <div className="border-b border-line px-4 py-3 sm:px-5">
                    <FilterBar
                        chips={[
                            ...(state.business ? [{ key: "business", label: "One business", onRemove: () => set({ business: "" }) }] : []),
                            ...(status ? [{ key: "status", label: chipLabel("Payment", status, PAYMENT_STATUS_FILTERS), onRemove: () => set({ status: "" }) }] : []),
                        ]}
                        onReset={() => set({ business: "", status: "" })}
                    >
                        <EntityPicker type="business" variant="filter" label="Business" placeholder="Business…" value={state.business} onChange={(id) => set({ business: id })} />
                        <FilterSelect label="Payment" value={status} onChange={(v) => set({ status: v })} options={PAYMENT_STATUS_FILTERS} allLabel="All payments" />
                    </FilterBar>
                </div>
                <SectionState isLoading={bookings.isLoading} error={bookings.error} what="Experience bookings" onRetry={() => bookings.refetch()}>
                    <FinanceBookingsTable
                        rows={data?.bookings ?? []}
                        isFetching={bookings.isFetching && !!data}
                        frame="bare"
                        filtered={bookingFilters || !!state.from || !!state.to}
                        storageKey="experience-payments-bookings"
                        exportName="experience-payments"
                        summary={data ? `${data.bookings.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                        footer={
                            data && data.total_pages > 1 ? (
                                <Pagination page={page} totalPages={data.total_pages} total={data.total} pageSize={data.page_size} onPageChange={(p) => set({ page: p })} />
                            ) : undefined
                        }
                    />
                </SectionState>
            </Panel>
        </div>
    );
}

export default ExperiencePaymentsPage;

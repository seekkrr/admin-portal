import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Eye, MapPin, MapPinPlus, X } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { markersService } from "../services/markers.service";
import { ButtonLink, IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tag } from "@/components/ui/StatusPill";
import { PlaceRequestStatus } from "../components/PlaceRequestStatus";
import { IdLink } from "@/components/ui/IdLink";
import { useUrlState } from "@/hooks/useUrlState";
import { runBulk } from "@/hooks/useBulkSelection";
import { formatDate } from "@/utils/date";
import type { MarkerApplication } from "@/types";

const PER_PAGE = 20;
const REVIEW_ROLES = ["admin", "super_admin", "moderator"];

const STATUS_OPTIONS: FilterOption[] = [
    { value: "pending", label: "Pending" },
    { value: "under_review", label: "Under review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
];

const isOpen = (a: Pick<MarkerApplication, "status">) => a.status === "pending" || a.status === "under_review";

type Pending = { kind: "approve" | "reject"; ids: string[]; title?: string };

export function MarkerApplicationsPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const canReview = !!user?.role?.some((r) => REVIEW_ROLES.includes(r));

    // Status (default: pending) and page live in the address. "all" = no status filter.
    const { state, set } = useUrlState({ status: "pending", page: 1 });
    const status = state.status === "all" || STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "pending";
    const page = Math.max(1, state.page);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [pending, setPending] = useState<Pending | null>(null);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-marker-applications", { status, page }],
        queryFn: () =>
            markersService.listApplications({
                status: status === "all" ? undefined : status,
                page,
                page_size: PER_PAGE,
            }),
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });

    const afterChange = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-marker-applications"] });
        queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
        queryClient.invalidateQueries({ queryKey: ["today", "place-requests"] });
    };

    const decide = useMutation({
        mutationFn: ({ kind, ids, reason }: { kind: Pending["kind"]; ids: string[]; reason?: string }) =>
            runBulk(ids, (id) => (kind === "approve" ? markersService.approveApplication(id) : markersService.rejectApplication(id, reason))),
        onSuccess: ({ ok, failed }, { kind }) => {
            afterChange();
            const verb = kind === "approve" ? "Approved" : "Rejected";
            if (ok > 0) toast.success(`${verb} ${ok} place request${ok === 1 ? "" : "s"}`);
            if (failed > 0) toast.error(`${failed} couldn't be ${kind === "approve" ? "approved" : "rejected"}`);
            setSelected(new Set());
            setPending(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setPending(null);
        },
    });

    const applications = data?.applications ?? [];

    const columns: DataColumn<MarkerApplication>[] = [
        {
            id: "title",
            header: "Proposed place",
            hideable: false,
            sortValue: (a) => a.proposed_title,
            cell: (a) => (
                <Link to={`/markers/applications/${a.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                    {a.proposed_title}
                </Link>
            ),
        },
        {
            id: "category",
            header: "Category",
            sortValue: (a) => a.proposed_categories?.[0] ?? "",
            csv: (a) => (a.proposed_categories ?? []).join(", "),
            cell: (a) =>
                a.proposed_categories && a.proposed_categories.length > 0 ? (
                    <Tag title={a.proposed_categories.join(", ")} className="max-w-[200px] capitalize">
                        <span className="truncate">
                            {a.proposed_categories[0]} {a.proposed_categories.length > 1 ? `+${a.proposed_categories.length - 1}` : ""}
                        </span>
                    </Tag>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        {
            id: "submitter",
            header: "Submitted by",
            csv: (a) => a.user_id,
            cell: (a) => <IdLink kind="user" id={a.user_id} />,
        },
        { id: "status", header: "Status", sortValue: (a) => a.status, cell: (a) => <PlaceRequestStatus status={a.status} /> },
        {
            id: "submitted",
            header: "Submitted",
            sortValue: (a) => a.created_at ?? "",
            csv: (a) => formatDate(a.created_at),
            cell: (a) => <span className="whitespace-nowrap text-ink-muted">{formatDate(a.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (status !== "pending") {
        chips.push({
            key: "status",
            label: status === "all" ? "Status: All" : chipLabel("Status", status, STATUS_OPTIONS),
            onRemove: () => set({ status: "pending" }),
        });
    }

    const count = pending?.ids.length ?? 0;
    const many = count > 1;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={MapPinPlus}
                title="Place requests"
                description={
                    <>
                        New places people asked to add
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} shown by this filter</span>}
                    </>
                }
                actions={
                    <ButtonLink to="/markers" variant="secondary" icon={MapPin}>
                        All places
                    </ButtonLink>
                }
            />

            <FilterBar chips={chips} onReset={() => set({ status: "pending" })}>
                <FilterSelect
                    label="Status"
                    value={status === "all" ? "" : status}
                    onChange={(v) => set({ status: v || "all" })}
                    options={STATUS_OPTIONS}
                    allLabel="All statuses"
                />
            </FilterBar>

            <DataTable
                label="Place requests"
                rows={applications}
                columns={columns}
                rowKey={(a) => a.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: MapPinPlus,
                    title: status === "pending" ? "No place requests. You're up to date." : "No place requests match this filter.",
                }}
                onRowClick={(a) => navigate(`/markers/applications/${a.id}`)}
                selectedIds={canReview ? selected : undefined}
                onSelectionChange={canReview ? setSelected : undefined}
                bulkActions={[
                    { label: "Approve", icon: Check, onClick: (ids) => setPending({ kind: "approve", ids }) },
                    { label: "Reject", icon: X, tone: "danger", onClick: (ids) => setPending({ kind: "reject", ids }) },
                ]}
                bulkBusy={decide.isPending}
                rowActions={(a) => (
                    <>
                        {canReview && isOpen(a) && (
                            <>
                                <IconButton
                                    icon={Check}
                                    size="sm"
                                    label={`Approve ${a.proposed_title}`}
                                    className="hover:bg-good-soft hover:text-good"
                                    onClick={() => setPending({ kind: "approve", ids: [a.id], title: a.proposed_title })}
                                />
                                <IconButton
                                    icon={X}
                                    size="sm"
                                    label={`Reject ${a.proposed_title}`}
                                    className="hover:bg-bad-soft hover:text-bad"
                                    onClick={() => setPending({ kind: "reject", ids: [a.id], title: a.proposed_title })}
                                />
                            </>
                        )}
                        <IconButton icon={Eye} size="sm" label={`Open ${a.proposed_title}`} onClick={() => navigate(`/markers/applications/${a.id}`)} />
                    </>
                )}
                storageKey="place-requests"
                exportName="place-requests"
                summary={data ? `${applications.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (a) => a.proposed_title,
                    subtitle: (a) => (a.proposed_categories?.length ? a.proposed_categories.join(", ") : undefined),
                    fields: ["status", "submitter", "submitted"],
                }}
                footer={
                    data && <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                }
            />

            <ConfirmDialog
                open={pending?.kind === "approve"}
                title={many ? `Approve ${count} place requests?` : "Approve place request?"}
                description={
                    many
                        ? "Each one becomes a live place in the app."
                        : `“${pending?.title ?? "This request"}” becomes a live place in the app.`
                }
                confirmLabel={many ? `Approve ${count}` : "Approve"}
                onConfirm={() => pending && decide.mutate({ kind: "approve", ids: pending.ids })}
                onCancel={() => setPending(null)}
                isPending={decide.isPending}
            />

            <ConfirmDialog
                open={pending?.kind === "reject"}
                title={many ? `Reject ${count} place requests?` : "Reject place request?"}
                description={
                    many
                        ? "The people who asked see this reason."
                        : `The person who asked for “${pending?.title ?? "this place"}” sees this reason.`
                }
                level="reason"
                reasonLabel="Reason"
                reasonPlaceholder="e.g. This place already exists, or the location is wrong."
                reasonMinLength={3}
                reasonMaxLength={1000}
                confirmLabel={many ? `Reject ${count}` : "Reject"}
                tone="danger"
                onConfirm={(reason) => pending && decide.mutate({ kind: "reject", ids: pending.ids, reason })}
                onCancel={() => setPending(null)}
                isPending={decide.isPending}
            />
        </div>
    );
}

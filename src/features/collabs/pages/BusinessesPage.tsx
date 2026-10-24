import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Plus, BadgeCheck, Globe, Star } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate } from "@/utils/date";
import { businessesService } from "../services/businesses.service";
import { useCollabAccess } from "../roles";
import { useBusinessCategories } from "../hooks";
import { FeatureChips } from "../components/CollabsUi";
import { RegionName } from "../components/CollabPickers";
import { BusinessFormFields } from "../components/BusinessFormFields";
import { createPayloadFromDraft, emptyBusinessDraft, slugError, type BusinessDraft } from "../businessDraft";
import { featuresOf } from "../utils";
import type { AdminBusiness, BusinessStatus, ListBusinessesParams } from "../types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: FilterOption[] = [
    { value: "pending_claim", label: "No owner yet" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
];

const VERIFIED_OPTIONS: FilterOption[] = [
    { value: "true", label: "Verified" },
    { value: "false", label: "Not verified" },
];

const COLUMNS: DataColumn<AdminBusiness>[] = [
    {
        id: "name",
        header: "Business",
        hideable: false,
        sortValue: (b) => b.name,
        cell: (b) => (
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                    {b.name}
                    {b.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent-600" aria-label="Verified" />}
                </div>
                <div className="mt-0.5 max-w-[280px] truncate text-xs text-ink-faint">{b.categories.length ? b.categories.join(", ") : (b.tagline ?? b.slug)}</div>
            </div>
        ),
    },
    {
        id: "region",
        header: "Region",
        csv: (b) => b.region_id,
        cell: (b) => (
            <span className="text-ink-muted">
                <RegionName id={b.region_id} />
            </span>
        ),
    },
    { id: "status", header: "Status", sortValue: (b) => b.status, cell: (b) => <StatusPill status={b.status} /> },
    {
        id: "plan",
        header: "Plan",
        sortValue: (b) => b.plan_code ?? "free",
        cell: (b) => <span className="capitalize text-ink-muted">{b.plan_code?.replace(/_/g, " ") ?? "free"}</span>,
    },
    {
        id: "features",
        header: "Features",
        csv: (b) => {
            const f = featuresOf(b);
            return [f.collabs && "Collabs", f.experiences && "Experiences"].filter(Boolean).join(" + ") || "None";
        },
        cell: (b) => (
            <div className="flex flex-wrap gap-1">
                <FeatureChips business={b} />
            </div>
        ),
    },
    {
        id: "website",
        header: "Website",
        csv: (b) => [b.show_on_website ? "Listed" : "Hidden", b.website_featured ? "Featured" : ""].filter(Boolean).join(", "),
        cell: (b) => (
            <div className="flex flex-wrap gap-1">
                {b.website_featured && (
                    <Tag tone="warn">
                        <Star className="h-3 w-3" aria-hidden /> Featured
                    </Tag>
                )}
                {b.show_on_website ? (
                    <Tag tone="brand">
                        <Globe className="h-3 w-3" aria-hidden /> Listed
                    </Tag>
                ) : (
                    <Tag>Hidden</Tag>
                )}
            </div>
        ),
    },
    { id: "places", header: "Places", align: "right", sortValue: (b) => b.marker_ids.length, cell: (b) => <span className="tabular-nums text-ink-muted">{b.marker_ids.length}</span> },
    {
        id: "created",
        header: "Created",
        sortValue: (b) => b.created_at ?? "",
        csv: (b) => formatDate(b.created_at),
        cell: (b) => <span className="whitespace-nowrap text-ink-muted">{formatDate(b.created_at)}</span>,
    },
];

export function BusinessesPage() {
    const { isStaff, isAdmin } = useCollabAccess();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    // Filters, search and page live in the address (?status=active&q=ara&page=2).
    const { state, set, reset } = useUrlState({ q: "", status: "", verified: "", category: "", page: 1 });
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    const status = STATUS_OPTIONS.some((o) => o.value === state.status) ? state.status : "";
    const verified = state.verified === "true" || state.verified === "false" ? state.verified : "";
    const category = state.category;
    const page = Math.max(1, state.page);
    const [createOpen, setCreateOpen] = useState(false);
    const [draft, setDraft] = useState<BusinessDraft>(emptyBusinessDraft);

    const { data: categories = [] } = useBusinessCategories();
    const categoryOptions: FilterOption[] = categories.flatMap((c) => [
        { value: c.name, label: c.name },
        ...c.sub_categories.map((s) => ({ value: s, label: `${c.name} › ${s}` })),
    ]);

    const params: ListBusinessesParams = {
        status: (status || undefined) as BusinessStatus | undefined,
        verified: verified === "" ? undefined : verified === "true",
        search: state.q || undefined,
        category: category || undefined,
        page,
        page_size: PAGE_SIZE,
    };

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["collabs-businesses", params],
        queryFn: () => businessesService.list(params),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const create = useMutation({
        mutationFn: () => businessesService.create(createPayloadFromDraft(draft)),
        onSuccess: (business) => {
            toast.success(business.owner_user_id ? `${business.name} is live` : `${business.name} created — assign an owner to make it live`);
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
            setCreateOpen(false);
            setDraft(emptyBusinessDraft());
            navigate(`/collabs/businesses/${business.id}`);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create business"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view businesses." />;

    const businesses = data?.businesses ?? [];
    const canSubmitCreate = !!draft.name.trim() && !slugError(draft.public_slug);

    const chips: FilterChip[] = [];
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (verified) chips.push({ key: "verified", label: chipLabel("Verified", verified, VERIFIED_OPTIONS), onRemove: () => set({ verified: "" }) });
    if (category) chips.push({ key: "category", label: chipLabel("Category", category, categoryOptions), onRemove: () => set({ category: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Store}
                title="Businesses"
                description={data ? `${data.total.toLocaleString("en-IN")} business profiles` : "Business profiles on SeekKrr"}
                primaryAction={
                    isAdmin && (
                        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                            Create business
                        </Button>
                    )
                }
            />

            <FilterBar
                search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search name, contact email or phone…" }}
                chips={chips}
                onReset={() => {
                    setSearchInput("");
                    reset();
                }}
            >
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <FilterSelect label="Verified" value={verified} onChange={(v) => set({ verified: v })} options={VERIFIED_OPTIONS} allLabel="Verified: any" />
                <FilterSelect label="Category" value={category} onChange={(v) => set({ category: v })} options={categoryOptions} allLabel="All categories" />
            </FilterBar>

            <DataTable
                label="Businesses"
                rows={businesses}
                columns={COLUMNS}
                rowKey={(b) => b.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Store, title: "No businesses found", description: chips.length || state.q ? "Try clearing a filter." : undefined }}
                onRowClick={(b) => navigate(`/collabs/businesses/${b.id}`)}
                storageKey="businesses"
                exportName="businesses"
                summary={data ? `${businesses.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (b) => (
                        <span className="inline-flex items-center gap-1.5">
                            {b.name}
                            {b.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-accent-600" aria-label="Verified" />}
                        </span>
                    ),
                    subtitle: (b) => (b.categories.length ? b.categories.join(", ") : (b.tagline ?? b.slug)),
                    fields: ["status", "region", "features", "places"],
                }}
                footer={
                    data && (
                        <Pagination page={page} totalPages={data.total_pages || 1} total={data.total} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p })} />
                    )
                }
            />

            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                dismissible={!create.isPending}
                title="Create business on behalf"
                icon={Store}
                size="2xl"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={create.isPending}>
                            Cancel
                        </Button>
                        <Button variant="primary" icon={Plus} onClick={() => create.mutate()} loading={create.isPending} disabled={!canSubmitCreate}>
                            Create business
                        </Button>
                    </>
                }
            >
                <p className="rounded-control border border-accent-100 bg-accent-50/60 p-3 text-sm text-ink-muted">
                    Add the owner's user ID or email and the business goes live straight away, with Partner Portal access for them. Without an owner it waits as{" "}
                    <strong className="text-ink">no owner yet</strong>.
                </p>
                <BusinessFormFields draft={draft} onChange={setDraft} mode="create" idPrefix="biz-create" />
            </Modal>
        </div>
    );
}

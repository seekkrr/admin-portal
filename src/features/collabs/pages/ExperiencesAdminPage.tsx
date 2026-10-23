import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, ImageOff, Plus, Ticket, UserPlus } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button, IconButton } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect, type FilterChip, type FilterOption } from "@/components/ui/FilterBar";
import { chipLabel } from "@/components/ui/filters";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate } from "@/utils/date";
import { experiencesAdminService } from "../services/experiences-admin.service";
import { NewExperienceModal, SetupHostModal } from "../components/ExperienceSetupModals";
import { useCollabAccess } from "../roles";
import { OBJECT_ID_RE, partnerPortalUrl, totalPagesOf } from "../utils";
import type { AdminExperience, ExperienceStatus, ListExperiencesParams } from "../types";

const STATUS_OPTIONS: FilterOption[] = [
    { value: "published", label: "Published" },
    { value: "draft", label: "Draft" },
    { value: "paused", label: "Paused" },
    { value: "archived", label: "Archived" },
];

const coverOf = (e: AdminExperience) => e.cover_url || e.media?.[0] || null;
const businessNameOf = (e: AdminExperience) => e.business?.name || e.business_name || null;

/** `/collabs/experiences?focus=<id>` (older search links) opens the experience's page. */
export function ExperiencesAdminPage() {
    const [searchParams] = useSearchParams();
    const focusId = searchParams.get("focus");
    if (focusId) return <Navigate to={`/collabs/experiences/${encodeURIComponent(focusId)}`} replace />;
    return <ExperiencesList />;
}

function ExperiencesList() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { state, set, reset } = useUrlState({ q: "", status: "", business_id: "", page: 1 });
    const status = STATUS_OPTIONS.some((o) => o.value === state.status) ? (state.status as ExperienceStatus) : "";
    const page = Math.max(1, state.page);
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    const [target, setTarget] = useState<AdminExperience | null>(null);
    const [hostOpen, setHostOpen] = useState(false);
    // undefined = closed; "" = open without a business picked.
    const [newForBusiness, setNewForBusiness] = useState<string | undefined>(undefined);

    const params: ListExperiencesParams = {
        status: status || undefined,
        business_id: state.business_id || undefined,
        q: state.q || undefined,
        page,
    };
    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-experiences", params],
        queryFn: () => experiencesAdminService.list(params),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const toggleHidden = useMutation({
        mutationFn: (e: AdminExperience) => experiencesAdminService.setHidden(e.id, !e.hidden_by_admin),
        onSuccess: (_updated, e) => {
            toast.success(e.hidden_by_admin ? "Experience is visible again" : "Experience hidden from the app");
            setTarget(null);
            queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update the experience"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view experiences." />;

    const experiences = data?.experiences ?? [];
    const totalPages = data?.page_size ? totalPagesOf({ total: data.total, page_size: data.page_size }) : 1;
    const hiding = target ? !target.hidden_by_admin : false;
    const open = (e: AdminExperience) => navigate(`/collabs/experiences/${e.id}`);

    const columns: DataColumn<AdminExperience>[] = [
        {
            id: "experience",
            header: "Experience",
            hideable: false,
            sortValue: (e) => e.title,
            csv: (e) => e.title,
            cell: (e) => {
                const cover = coverOf(e);
                return (
                    <div className="flex items-center gap-3">
                        {cover ? (
                            <img src={cover} alt="" className="h-10 w-14 shrink-0 rounded-lg border border-line object-cover" />
                        ) : (
                            <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-faint">
                                <ImageOff className="h-4 w-4" aria-hidden />
                            </span>
                        )}
                        <div className="min-w-0">
                            <Link to={`/collabs/experiences/${e.id}`} className="block max-w-[220px] truncate font-medium text-ink hover:text-accent-700 hover:underline">
                                {e.title || "Untitled"}
                            </Link>
                            <div className="max-w-[220px] truncate text-xs text-ink-faint">{[e.region_name, e.tagline].filter(Boolean).join(" · ") || "—"}</div>
                        </div>
                    </div>
                );
            },
        },
        {
            id: "business",
            header: "Business",
            sortValue: (e) => businessNameOf(e) ?? "",
            csv: (e) => businessNameOf(e) ?? e.business_id,
            cell: (e) => <IdLink kind="business" id={e.business_id} label={businessNameOf(e) ?? "Open business"} />,
        },
        { id: "status", header: "Status", sortValue: (e) => e.status, cell: (e) => <StatusPill status={e.status} /> },
        {
            id: "visibility",
            header: "Visibility",
            sortValue: (e) => e.hidden_by_admin,
            csv: (e) => (e.hidden_by_admin ? "Hidden" : "Visible"),
            cell: (e) =>
                e.hidden_by_admin ? (
                    <Tag tone="bad">
                        <EyeOff className="h-3 w-3" aria-hidden /> Hidden
                    </Tag>
                ) : (
                    <Tag tone="brand">
                        <Eye className="h-3 w-3" aria-hidden /> Visible
                    </Tag>
                ),
        },
        {
            id: "bookings",
            header: "Bookings",
            align: "right",
            sortValue: (e) => e.stats?.bookings ?? 0,
            cell: (e) => <span className="tabular-nums text-ink-muted">{(e.stats?.bookings ?? 0).toLocaleString("en-IN")}</span>,
        },
        {
            id: "updated",
            header: "Updated",
            sortValue: (e) => e.updated_at ?? e.created_at ?? "",
            csv: (e) => formatDate(e.updated_at ?? e.created_at),
            cell: (e) => <span className="whitespace-nowrap text-ink-muted">{formatDate(e.updated_at ?? e.created_at)}</span>,
        },
    ];

    const chips: FilterChip[] = [];
    if (status) chips.push({ key: "status", label: chipLabel("Status", status, STATUS_OPTIONS), onRemove: () => set({ status: "" }) });
    if (state.business_id) chips.push({ key: "business", label: "Business filter", onRemove: () => set({ business_id: "" }) });

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Ticket}
                title="Experiences"
                description={
                    <>
                        Bookable experiences listed by businesses
                        {data && <span className="text-ink-faint"> · {data.total.toLocaleString("en-IN")} total</span>}
                    </>
                }
                actions={
                    <Button variant="secondary" icon={UserPlus} onClick={() => setHostOpen(true)}>
                        Set up a host
                    </Button>
                }
                primaryAction={
                    <Button variant="primary" icon={Plus} onClick={() => setNewForBusiness(OBJECT_ID_RE.test(state.business_id) ? state.business_id : "")}>
                        New experience
                    </Button>
                }
            />

            <FilterBar
                search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search title…" }}
                chips={chips}
                onReset={() => {
                    setSearchInput("");
                    reset();
                }}
            >
                <FilterSelect label="Status" value={status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} allLabel="All statuses" />
                <EntityPicker type="business" variant="filter" label="Business" value={state.business_id} onChange={(id) => set({ business_id: id })} placeholder="Business…" />
            </FilterBar>

            <DataTable
                label="Experiences"
                rows={experiences}
                columns={columns}
                rowKey={(e) => e.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: Ticket, title: "No experiences found", description: chips.length || state.q ? "Try clearing a filter." : undefined }}
                onRowClick={open}
                rowActions={(e) => (
                    <>
                        <div className="hidden items-center gap-0.5 md:flex">
                            <IconButton
                                icon={ExternalLink}
                                size="sm"
                                label={`Open ${e.title || "experience"} in the Partner Portal`}
                                title="Edit content, photos and slots in the Partner Portal (admin view)"
                                onClick={() => window.open(partnerPortalUrl(e.business_id, e.id), "_blank", "noopener,noreferrer")}
                            />
                            <IconButton
                                icon={e.hidden_by_admin ? Eye : EyeOff}
                                size="sm"
                                label={e.hidden_by_admin ? `Unhide ${e.title || "experience"}` : `Hide ${e.title || "experience"}`}
                                className={e.hidden_by_admin ? undefined : "hover:bg-bad-soft hover:text-bad"}
                                onClick={() => setTarget(e)}
                            />
                        </div>
                        <div className="md:hidden">
                            <Menu
                                label={`Actions for ${e.title || "experience"}`}
                                triggerVariant="ghost"
                                size="sm"
                                items={[
                                    { label: "Open", icon: Ticket, to: `/collabs/experiences/${e.id}` },
                                    {
                                        label: "Open in Partner Portal",
                                        icon: ExternalLink,
                                        onSelect: () => window.open(partnerPortalUrl(e.business_id, e.id), "_blank", "noopener,noreferrer"),
                                    },
                                    { label: e.hidden_by_admin ? "Unhide" : "Hide", icon: e.hidden_by_admin ? Eye : EyeOff, danger: !e.hidden_by_admin, onSelect: () => setTarget(e) },
                                ]}
                            />
                        </div>
                    </>
                )}
                storageKey="experiences"
                exportName="experiences"
                summary={data ? `${experiences.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (e) => e.title || "Untitled",
                    subtitle: (e) => businessNameOf(e) ?? undefined,
                    fields: ["status", "visibility", "bookings", "updated"],
                }}
                footer={
                    data && totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={data.total} pageSize={data.page_size} onPageChange={(p) => set({ page: p })} />
                }
            />

            <ConfirmDialog
                open={!!target}
                title={hiding ? "Hide this experience?" : "Unhide this experience?"}
                description={
                    hiding ? (
                        <>
                            <strong className="text-ink">{target?.title || "This experience"}</strong> disappears from the app and can't be booked. The business
                            still sees it in the Partner Portal, marked as hidden by SeekKrr. Existing bookings are kept.
                        </>
                    ) : (
                        <>
                            <strong className="text-ink">{target?.title || "This experience"}</strong> shows in the app again if the business has it published.
                        </>
                    )
                }
                confirmLabel={hiding ? "Hide" : "Unhide"}
                tone={hiding ? "danger" : "primary"}
                isPending={toggleHidden.isPending}
                onConfirm={() => target && toggleHidden.mutate(target)}
                onCancel={() => setTarget(null)}
            />

            <SetupHostModal
                open={hostOpen}
                onClose={() => setHostOpen(false)}
                onNewExperience={(business) => {
                    setHostOpen(false);
                    setNewForBusiness(business.id);
                }}
            />
            <NewExperienceModal
                open={newForBusiness !== undefined}
                initialBusinessId={newForBusiness}
                onClose={() => setNewForBusiness(undefined)}
                onShowInList={(bid) => {
                    setSearchInput("");
                    set({ status: "", q: "", business_id: bid });
                }}
            />
        </div>
    );
}

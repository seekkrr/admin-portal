import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Inbox, CheckCircle, XCircle, ExternalLink, Mail, Phone, MapPin, Store, Link as LinkIcon, MessageSquare, ArrowRight } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { FilterBar } from "@/components/ui/FilterBar";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Drawer } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DetailList, DetailRow } from "@/components/ui/Panel";
import { CountBadge, StatusPill, Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate, formatDateTime } from "@/utils/date";
import { businessesService } from "../services/businesses.service";
import { useCollabAccess } from "../roles";
import { MarkerLink, RegionName } from "../components/CollabPickers";
import { DrawerSection, Notice } from "../components/AdminBits";
import { humanize } from "../utils";
import type { AdminBusiness, AdminBusinessApplication, BusinessApplicationStatus } from "../types";

const PAGE_SIZE = 20;
type TabValue = BusinessApplicationStatus | "all";
const TABS: TabValue[] = ["pending", "approved", "rejected", "all"];

function socialHref(link: string): string {
    const bare = link.replace(/^https?:\/\//, "");
    if (/^[^/\s]+@[^/\s]+\.[^/\s]+$/.test(bare)) return `mailto:${bare}`;
    return link.startsWith("http") ? link : `https://${link}`;
}

export function BusinessApplicationsPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const { state, set } = useUrlState({ tab: "pending", q: "", page: 1 });
    const tab: TabValue = TABS.includes(state.tab as TabValue) ? (state.tab as TabValue) : "pending";
    const page = Math.max(1, state.page);
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    const [selected, setSelected] = useState<AdminBusinessApplication | null>(null);
    const [approvedBusiness, setApprovedBusiness] = useState<AdminBusiness | null>(null);
    const [rejecting, setRejecting] = useState(false);

    const params = { status: tab === "all" ? undefined : tab, search: state.q || undefined, page, page_size: PAGE_SIZE };
    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["collabs-business-applications", params],
        queryFn: () => businessesService.listApplications(params),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const openDrawer = (app: AdminBusinessApplication) => {
        setSelected(app);
        setApprovedBusiness(null);
    };

    const approve = useMutation({
        mutationFn: (id: string) => businessesService.approveApplication(id),
        onSuccess: ({ application, business }) => {
            toast.success(`Approved — ${business.name} is now a business profile`);
            setSelected(application);
            setApprovedBusiness(business);
            queryClient.invalidateQueries({ queryKey: ["collabs-business-applications"] });
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to approve application"),
    });

    const reject = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) => businessesService.rejectApplication(id, reason),
        onSuccess: (application) => {
            toast.success("Application rejected");
            setRejecting(false);
            setSelected(application);
            queryClient.invalidateQueries({ queryKey: ["collabs-business-applications"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to reject application"),
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to review business applications." />;

    const apps = data?.applications ?? [];
    const busy = approve.isPending || reject.isPending;

    const columns: DataColumn<AdminBusinessApplication>[] = [
        {
            id: "business",
            header: "Business",
            hideable: false,
            sortValue: (a) => a.business_name,
            cell: (a) => (
                <div className="min-w-0">
                    <div className="font-medium text-ink">{a.business_name}</div>
                    <div className="mt-0.5 text-xs text-ink-faint">
                        {a.categories.length ? [...a.categories, ...(a.sub_categories ?? [])].join(", ") : "No categories"} · via {a.source}
                    </div>
                </div>
            ),
        },
        {
            id: "contact",
            header: "Contact",
            sortValue: (a) => a.contact_name,
            csv: (a) => (a.email ? `${a.contact_name} <${a.email}>` : `${a.contact_name} (${a.phone})`),
            cell: (a) => (
                <div className="min-w-0">
                    <div className="text-ink">{a.contact_name}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-ink-faint">{a.email || a.phone}</div>
                </div>
            ),
        },
        {
            id: "place",
            header: "Place",
            csv: (a) => (a.claimed_marker_id ? "Existing place" : a.maps_url ? "Maps link" : ""),
            cell: (a) =>
                a.claimed_marker_id ? (
                    <Tag tone="brand">
                        <MapPin className="h-3 w-3" aria-hidden /> Existing place
                    </Tag>
                ) : a.maps_url ? (
                    <Tag tone="warn">
                        <LinkIcon className="h-3 w-3" aria-hidden /> Maps link
                    </Tag>
                ) : (
                    <span className="text-ink-faint">—</span>
                ),
        },
        {
            id: "plan",
            header: "Plan",
            sortValue: (a) => a.requested_plan ?? "",
            csv: (a) => (a.requested_plan ? humanize(a.requested_plan) : ""),
            cell: (a) => <span className="text-ink-muted">{a.requested_plan ? humanize(a.requested_plan) : "—"}</span>,
        },
        { id: "status", header: "Status", sortValue: (a) => a.status, cell: (a) => <StatusPill status={a.status} /> },
        {
            id: "applied",
            header: "Applied",
            sortValue: (a) => a.applied_at ?? "",
            csv: (a) => formatDate(a.applied_at),
            cell: (a) => <span className="whitespace-nowrap text-ink-muted">{formatDate(a.applied_at)}</span>,
        },
    ];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Inbox}
                title="Business applications"
                badge={data?.pending_count ? <CountBadge count={data.pending_count} /> : undefined}
                description={data ? `${data.total.toLocaleString("en-IN")} applications` : "Businesses asking to join"}
            />

            <Tabs<TabValue>
                label="Application status"
                value={tab}
                onChange={(v) => set({ tab: v })}
                tabs={[
                    { value: "pending", label: "Pending", count: data?.pending_count },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                    { value: "all", label: "All" },
                ]}
            />

            <FilterBar
                search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search business, contact or email…" }}
                onReset={() => setSearchInput("")}
            />

            <DataTable
                label="Business applications"
                rows={apps}
                columns={columns}
                rowKey={(a) => a.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: Inbox,
                    title: tab === "pending" && !state.q ? "No pending applications. The queue is clear." : "No applications found",
                    description: state.q ? "Try a different search." : undefined,
                }}
                onRowClick={openDrawer}
                storageKey="business-applications"
                exportName="business-applications"
                summary={data ? `${apps.length} of ${data.total.toLocaleString("en-IN")}` : undefined}
                card={{ title: (a) => a.business_name, subtitle: (a) => `${a.contact_name} · ${a.email || a.phone}`, fields: ["status", "place", "plan", "applied"] }}
                footer={data && <Pagination page={page} totalPages={data.total_pages || 1} total={data.total} pageSize={PAGE_SIZE} onPageChange={(p) => set({ page: p })} />}
            />

            <Drawer
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.business_name ?? ""}
                subtitle={selected && <span className="font-mono">{selected.id}</span>}
                footer={
                    selected?.status === "pending" && (
                        <div className="flex gap-3">
                            <Button variant="danger" icon={XCircle} onClick={() => setRejecting(true)} disabled={busy} className="flex-1">
                                Reject
                            </Button>
                            <Button variant="primary" icon={CheckCircle} onClick={() => approve.mutate(selected.id)} disabled={busy} loading={approve.isPending} className="flex-1">
                                Approve
                            </Button>
                        </div>
                    )
                }
            >
                {selected && (
                    <>
                        {approvedBusiness && (
                            <Notice tone="good" icon={CheckCircle} title="Business profile created">
                                <p>
                                    {approvedBusiness.name} · plan {approvedBusiness.plan_code}
                                    {approvedBusiness.owner_user_id
                                        ? " · owner attached (they now set their redeem code in the app)"
                                        : " · no SeekKrr account matched the applicant yet — assign an owner from the business page"}
                                </p>
                                <ButtonLink to={`/collabs/businesses/${approvedBusiness.id}`} size="sm" variant="secondary" className="mt-2" icon={ArrowRight}>
                                    Open business
                                </ButtonLink>
                            </Notice>
                        )}

                        {selected.status === "rejected" && (
                            <Notice tone="bad" icon={XCircle} title={`Rejected${selected.actioned_at ? ` on ${formatDate(selected.actioned_at)}` : ""}`}>
                                {selected.rejection_reason && <>Reason: {selected.rejection_reason}</>}
                            </Notice>
                        )}

                        {selected.status === "approved" && !approvedBusiness && (
                            <Notice tone="good" icon={CheckCircle} title={`Approved${selected.actioned_at ? ` on ${formatDate(selected.actioned_at)}` : ""}`}>
                                {selected.business_id && <IdLink kind="business" id={selected.business_id} label="Open business →" />}
                            </Notice>
                        )}

                        <DrawerSection title="Business" icon={Store}>
                            <DetailList>
                                <DetailRow label="Status" value={<StatusPill status={selected.status} />} />
                                <DetailRow label="Categories" value={selected.categories.length ? selected.categories.join(", ") : "—"} />
                                <DetailRow label="Type" value={selected.sub_categories?.length ? selected.sub_categories.join(", ") : "—"} />
                                <DetailRow label="Region" value={selected.region_id ? <IdLink kind="region" id={selected.region_id} label={<RegionName id={selected.region_id} />} /> : "—"} />
                                <DetailRow label="Requested plan" value={selected.requested_plan ? humanize(selected.requested_plan) : "—"} />
                                <DetailRow label="GSTIN" value={selected.gstin ? <span className="font-mono">{selected.gstin}</span> : "—"} />
                                <DetailRow label="Source" value={humanize(selected.source)} />
                                <DetailRow label="Applied" value={formatDateTime(selected.applied_at)} />
                            </DetailList>
                        </DrawerSection>

                        <DrawerSection title="Contact" icon={Phone}>
                            <DetailList>
                                <DetailRow label="Name" value={selected.contact_name} />
                                <DetailRow
                                    label="Email"
                                    value={
                                        selected.email ? (
                                            <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1 text-accent-700 hover:underline">
                                                <Mail className="h-3.5 w-3.5" aria-hidden /> {selected.email}
                                            </a>
                                        ) : (
                                            "Not given (asked for a call back)"
                                        )
                                    }
                                />
                                <DetailRow
                                    label="Phone"
                                    value={
                                        <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1 text-accent-700 hover:underline">
                                            <Phone className="h-3.5 w-3.5" aria-hidden /> {selected.phone}
                                        </a>
                                    }
                                />
                            </DetailList>
                        </DrawerSection>

                        <DrawerSection title="Place" icon={MapPin}>
                            <DetailList>
                                <DetailRow label="Claimed place" value={selected.claimed_marker_id ? <MarkerLink id={selected.claimed_marker_id} /> : "Not an existing SeekKrr place"} />
                                <DetailRow
                                    label="Maps link"
                                    value={
                                        selected.maps_url ? (
                                            <a href={selected.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-accent-700 hover:underline">
                                                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden /> Open in Maps
                                            </a>
                                        ) : (
                                            "—"
                                        )
                                    }
                                />
                            </DetailList>
                            {!selected.claimed_marker_id && selected.status === "pending" && (
                                <Notice tone="warn">No existing place claimed — check the Maps link, and create or link a place on the business page after approval.</Notice>
                            )}
                        </DrawerSection>

                        {selected.social_links.length > 0 && (
                            <DrawerSection title={`Socials (${selected.social_links.length})`} icon={LinkIcon}>
                                <div className="space-y-2">
                                    {selected.social_links.map((link) => (
                                        <a
                                            key={link}
                                            href={socialHref(link)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 rounded-control border border-line bg-surface-muted p-2.5 text-sm text-ink transition-colors hover:border-accent-300"
                                        >
                                            <ExternalLink className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                                            <span className="truncate">{link.replace(/^https?:\/\/(www\.)?/, "")}</span>
                                        </a>
                                    ))}
                                </div>
                            </DrawerSection>
                        )}

                        {selected.message && (
                            <DrawerSection title="Message" icon={MessageSquare}>
                                <p className="whitespace-pre-wrap text-sm text-ink">{selected.message}</p>
                            </DrawerSection>
                        )}
                    </>
                )}
            </Drawer>

            <ConfirmDialog
                open={rejecting && !!selected}
                title="Reject application?"
                description={selected ? `Reject ${selected.business_name}? The applicant can apply again later.` : undefined}
                level="reason"
                reasonPlaceholder="e.g. Couldn't verify the business location"
                reasonMaxLength={1000}
                confirmLabel="Reject"
                tone="danger"
                isPending={reject.isPending}
                onCancel={() => setRejecting(false)}
                onConfirm={(reason) => selected && reject.mutate({ id: selected.id, reason: reason ?? "" })}
            />
        </div>
    );
}

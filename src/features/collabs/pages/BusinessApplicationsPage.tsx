import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Inbox, CheckCircle, XCircle, ExternalLink, Mail, Phone, MapPin, Store, Link as LinkIcon, MessageSquare, ArrowRight,
} from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Pagination } from "@/components/ui/Pagination";
import { businessesService } from "../services/businesses.service";
import { useCollabAccess } from "../roles";
import { useDebouncedValue } from "../hooks";
import {
    Chip, CountBadge, DetailRow, Drawer, LoadingButtonIcon, PageHeader, PanelState, ReasonModal, SearchBox,
    SegmentedTabs, StatusPill, Toolbar, btnDanger, btnPrimary, thClass,
} from "../components/CollabsUi";
import { MarkerLink, RegionName } from "../components/CollabPickers";
import { fmtDate, fmtDateTime, humanize } from "../utils";
import type { AdminBusiness, AdminBusinessApplication, BusinessApplicationStatus } from "../types";

const PAGE_SIZE = 20;
type TabValue = BusinessApplicationStatus | "all";

export function BusinessApplicationsPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<TabValue>("pending");
    const [searchInput, setSearchInput] = useState("");
    const search = useDebouncedValue(searchInput);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AdminBusinessApplication | null>(null);
    const [approvedBusiness, setApprovedBusiness] = useState<AdminBusiness | null>(null);
    const [rejecting, setRejecting] = useState(false);

    useEffect(() => setPage(1), [search, tab]);

    const params = { status: tab === "all" ? undefined : tab, search: search || undefined, page, page_size: PAGE_SIZE };
    const { data, isLoading, error, refetch } = useQuery({
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

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            <PageHeader
                icon={Inbox}
                title="Business Applications"
                gradient="from-indigo-500 to-indigo-600"
                badge={<CountBadge count={data?.pending_count ?? 0} label="Pending" />}
                subtitle={data ? `${data.total} applications` : "Loading..."}
            />

            <Toolbar>
                <SegmentedTabs<TabValue>
                    value={tab}
                    onChange={setTab}
                    tabs={[
                        { value: "pending", label: "Pending", count: data?.pending_count },
                        { value: "approved", label: "Approved" },
                        { value: "rejected", label: "Rejected" },
                        { value: "all", label: "All" },
                    ]}
                />
                <SearchBox value={searchInput} onChange={setSearchInput} placeholder="Search business, contact or email..." />
            </Toolbar>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState
                    isLoading={isLoading && !data}
                    error={error}
                    isEmpty={apps.length === 0}
                    emptyIcon={Inbox}
                    emptyText={tab === "pending" ? "No pending applications — queue is clear" : "No applications found"}
                    onRetry={() => refetch()}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Business</th>
                                    <th className={thClass}>Contact</th>
                                    <th className={thClass}>Place</th>
                                    <th className={thClass}>Plan</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Applied</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {apps.map((a) => (
                                    <tr key={a.id} onClick={() => openDrawer(a)} className="transition-colors hover:bg-neutral-50/80 cursor-pointer">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-neutral-900">{a.business_name}</div>
                                            <div className="text-[11px] text-neutral-400 mt-0.5">
                                                {a.categories.length ? [...a.categories, ...(a.sub_categories ?? [])].join(", ") : "No categories"} · via {a.source}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-neutral-700">{a.contact_name}</div>
                                            <div className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[220px]">{a.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {a.claimed_marker_id ? (
                                                <Chip tone="teal">
                                                    <MapPin className="w-3 h-3" /> Existing place
                                                </Chip>
                                            ) : a.maps_url ? (
                                                <Chip tone="amber">
                                                    <LinkIcon className="w-3 h-3" /> Maps link
                                                </Chip>
                                            ) : (
                                                <span className="text-neutral-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">{a.requested_plan ? humanize(a.requested_plan) : "—"}</td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={a.status} />
                                        </td>
                                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDate(a.applied_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
                {data && <Pagination page={page} totalPages={data.total_pages || 1} total={data.total} onPageChange={setPage} theme="indigo" />}
            </div>

            <Drawer
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.business_name ?? ""}
                subtitle={selected && <span className="font-mono">{selected.id}</span>}
                footer={
                    selected?.status === "pending" && (
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setRejecting(true)} disabled={busy} className={`${btnDanger} flex-1`}>
                                <XCircle className="w-4 h-4" /> Reject
                            </button>
                            <button type="button" onClick={() => approve.mutate(selected.id)} disabled={busy} className={`${btnPrimary} flex-1`}>
                                <LoadingButtonIcon loading={approve.isPending} icon={CheckCircle} /> Approve
                            </button>
                        </div>
                    )
                }
            >
                {selected && (
                    <>
                        {approvedBusiness && (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                                    <CheckCircle className="w-4 h-4" /> Business profile created
                                </p>
                                <p className="text-xs text-emerald-700">
                                    {approvedBusiness.name} · <StatusPill status={approvedBusiness.status} /> · plan {approvedBusiness.plan_code}
                                    {approvedBusiness.owner_user_id
                                        ? " · owner attached (they now set their redeem code in the app)"
                                        : " · no SeekKrr account matched the applicant yet — assign an owner from the business page"}
                                </p>
                                <Link
                                    to={`/collabs/businesses/${approvedBusiness.id}`}
                                    className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:underline"
                                >
                                    Open business <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}

                        {selected.status === "rejected" && (
                            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm">
                                <p className="font-medium flex items-center gap-2">
                                    <XCircle className="w-4 h-4" /> Rejected {selected.actioned_at ? `on ${fmtDate(selected.actioned_at)}` : ""}
                                </p>
                                {selected.rejection_reason && <p className="text-xs mt-1 pl-6">Reason: {selected.rejection_reason}</p>}
                            </div>
                        )}

                        {selected.status === "approved" && !approvedBusiness && (
                            <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm flex flex-wrap items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Approved {selected.actioned_at ? `on ${fmtDate(selected.actioned_at)}` : ""}
                                {selected.business_id && (
                                    <Link to={`/collabs/businesses/${selected.business_id}`} className="font-medium hover:underline ml-auto">
                                        Open business →
                                    </Link>
                                )}
                            </div>
                        )}

                        <section className="space-y-3">
                            <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                <Store className="w-4 h-4" /> Business
                            </h4>
                            <DetailRow label="Status" value={<StatusPill status={selected.status} />} />
                            <DetailRow label="Categories" value={selected.categories.length ? selected.categories.join(", ") : "—"} />
                            <DetailRow label="Type" value={selected.sub_categories?.length ? selected.sub_categories.join(", ") : "—"} />
                            <DetailRow label="Region" value={<RegionName id={selected.region_id} />} />
                            <DetailRow label="Requested plan" value={selected.requested_plan ? humanize(selected.requested_plan) : "—"} />
                            <DetailRow label="GSTIN" value={selected.gstin ? <span className="font-mono">{selected.gstin}</span> : "—"} />
                            <DetailRow label="Source" value={humanize(selected.source)} />
                            <DetailRow label="Applied" value={fmtDateTime(selected.applied_at)} />
                        </section>

                        <section className="space-y-3">
                            <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                <Phone className="w-4 h-4" /> Contact
                            </h4>
                            <DetailRow label="Name" value={selected.contact_name} />
                            <DetailRow
                                label="Email"
                                value={
                                    <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1 text-teal-700 hover:underline">
                                        <Mail className="w-3.5 h-3.5" /> {selected.email}
                                    </a>
                                }
                            />
                            <DetailRow
                                label="Phone"
                                value={
                                    <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1 text-teal-700 hover:underline">
                                        <Phone className="w-3.5 h-3.5" /> {selected.phone}
                                    </a>
                                }
                            />
                        </section>

                        <section className="space-y-3">
                            <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                <MapPin className="w-4 h-4" /> Place
                            </h4>
                            <DetailRow label="Claimed place" value={selected.claimed_marker_id ? <MarkerLink id={selected.claimed_marker_id} /> : "Not an existing SeekKrr place"} />
                            <DetailRow
                                label="Maps link"
                                value={
                                    selected.maps_url ? (
                                        <a href={selected.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline break-all">
                                            <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Open in Maps
                                        </a>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
                            {!selected.claimed_marker_id && selected.status === "pending" && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                    No existing marker claimed — check the Maps link, and create or link a marker on the business page after approval.
                                </p>
                            )}
                        </section>

                        {selected.social_links.length > 0 && (
                            <section className="space-y-2">
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                    <LinkIcon className="w-4 h-4" /> Socials ({selected.social_links.length})
                                </h4>
                                {selected.social_links.map((link) => (
                                    <a
                                        key={link}
                                        href={link.startsWith("http") ? link : `https://${link}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-colors text-sm text-neutral-700"
                                    >
                                        <ExternalLink className="w-4 h-4 text-neutral-400 shrink-0" />
                                        <span className="truncate">{link.replace(/^https?:\/\/(www\.)?/, "")}</span>
                                    </a>
                                ))}
                            </section>
                        )}

                        {selected.message && (
                            <section className="space-y-2">
                                <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                                    <MessageSquare className="w-4 h-4" /> Message
                                </h4>
                                <p className="text-sm text-neutral-700 whitespace-pre-wrap">{selected.message}</p>
                            </section>
                        )}
                    </>
                )}
            </Drawer>

            <ReasonModal
                open={rejecting && !!selected}
                title="Reject application"
                description={selected ? `Reject ${selected.business_name}? The applicant can apply again later.` : undefined}
                placeholder="e.g. Couldn't verify the business location"
                maxLength={1000}
                confirmLabel="Reject"
                isPending={reject.isPending}
                onCancel={() => setRejecting(false)}
                onConfirm={(reason) => selected && reject.mutate({ id: selected.id, reason })}
            />
        </div>
    );
}

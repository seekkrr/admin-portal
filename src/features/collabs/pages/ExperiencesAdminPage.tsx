import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Filter, ImageOff, Ticket } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { FilterDropdown, type DropdownOption } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { experiencesAdminService } from "../services/experiences-admin.service";
import { useCollabAccess } from "../roles";
import { useDebouncedValue } from "../hooks";
import {
    Chip, LoadingButtonIcon, Modal, PageHeader, PanelState, SearchBox, StatusPill, Toolbar, btnDanger, btnPrimary, btnSecondary,
    btnSmNeutral, btnSmReject, thClass,
} from "../components/CollabsUi";
import { fmtDate, totalPagesOf } from "../utils";
import type { AdminExperience, ExperienceStatus, ListExperiencesParams } from "../types";

const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All statuses" },
    { value: "published", label: "Published", dot: "bg-emerald-500" },
    { value: "draft", label: "Draft", dot: "bg-neutral-400" },
    { value: "paused", label: "Paused", dot: "bg-amber-500" },
    { value: "archived", label: "Archived", dot: "bg-neutral-300" },
];

const idInputClass =
    "w-56 px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

const coverOf = (e: AdminExperience) => e.cover_url || e.media?.[0] || null;
const businessNameOf = (e: AdminExperience) => e.business?.name || e.business_name || null;

export function ExperiencesAdminPage() {
    const { isStaff } = useCollabAccess();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState("");
    const [businessInput, setBusinessInput] = useState(searchParams.get("business_id") ?? "");
    const [searchInput, setSearchInput] = useState("");
    const businessId = useDebouncedValue(businessInput);
    const search = useDebouncedValue(searchInput);
    const [page, setPage] = useState(1);
    const [target, setTarget] = useState<AdminExperience | null>(null);

    useEffect(() => setPage(1), [status, businessId, search]);

    const params: ListExperiencesParams = {
        status: (status || undefined) as ExperienceStatus | undefined,
        business_id: businessId || undefined,
        q: search || undefined,
        page,
    };
    const { data, isLoading, error, refetch } = useQuery({
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
    const hasFilters = !!(status || businessInput || searchInput);
    const totalPages = data?.page_size ? totalPagesOf({ total: data.total, page_size: data.page_size }) : 1;
    const hiding = target ? !target.hidden_by_admin : false;

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            <PageHeader
                icon={Ticket}
                title="Experiences"
                gradient="from-violet-500 to-violet-600"
                subtitle={data ? `${data.total} experiences listed by businesses` : "Loading..."}
            />

            <Toolbar>
                <SearchBox value={searchInput} onChange={setSearchInput} placeholder="Search title..." />
                <FilterDropdown options={STATUS_OPTIONS} value={status} onChange={setStatus} icon={<Filter className="w-3.5 h-3.5" />} placeholder="Status" theme="teal" />
                <input
                    type="text"
                    value={businessInput}
                    onChange={(e) => setBusinessInput(e.target.value)}
                    placeholder="Business id"
                    className={idInputClass}
                    aria-label="Filter by business id"
                />
                {hasFilters && (
                    <button
                        type="button"
                        onClick={() => {
                            setStatus("");
                            setBusinessInput("");
                            setSearchInput("");
                        }}
                        className="px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </Toolbar>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState isLoading={isLoading && !data} error={error} isEmpty={experiences.length === 0} emptyIcon={Ticket} emptyText="No experiences found" onRetry={() => refetch()}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Experience</th>
                                    <th className={thClass}>Business</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Visibility</th>
                                    <th className={`${thClass} text-right`}>Bookings</th>
                                    <th className={thClass}>Updated</th>
                                    <th className={`${thClass} text-right`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {experiences.map((e) => {
                                    const cover = coverOf(e);
                                    const name = businessNameOf(e);
                                    return (
                                        <tr key={e.id} className="transition-colors hover:bg-neutral-50/80">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {cover ? (
                                                        <img src={cover} alt="" className="w-14 h-10 rounded-lg object-cover border border-neutral-200 shrink-0" />
                                                    ) : (
                                                        <span className="w-14 h-10 rounded-lg bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0">
                                                            <ImageOff className="w-4 h-4" />
                                                        </span>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-neutral-900 truncate max-w-[280px]">{e.title || "Untitled"}</div>
                                                        <div className="text-[11px] text-neutral-400 truncate max-w-[280px]">
                                                            {[e.region_name, e.tagline].filter(Boolean).join(" · ") || "—"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link to={`/collabs/businesses/${e.business_id}`} className="text-teal-700 font-medium hover:underline" title={e.business_id}>
                                                    {name ?? "Open business"}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusPill status={e.status} />
                                            </td>
                                            <td className="px-4 py-3">
                                                {e.hidden_by_admin ? (
                                                    <Chip tone="red">
                                                        <EyeOff className="w-3 h-3" /> Hidden
                                                    </Chip>
                                                ) : (
                                                    <Chip tone="teal">
                                                        <Eye className="w-3 h-3" /> Visible
                                                    </Chip>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right text-neutral-600">{e.stats?.bookings ?? 0}</td>
                                            <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDate(e.updated_at ?? e.created_at)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button type="button" onClick={() => setTarget(e)} className={e.hidden_by_admin ? btnSmNeutral : btnSmReject}>
                                                    {e.hidden_by_admin ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                    {e.hidden_by_admin ? "Unhide" : "Hide"}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
                {data && totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={data.total} onPageChange={setPage} theme="teal" />}
            </div>

            <Modal
                open={!!target}
                onClose={() => !toggleHidden.isPending && setTarget(null)}
                title={hiding ? "Hide this experience?" : "Unhide this experience?"}
                icon={hiding ? EyeOff : Eye}
                size="md"
                footer={
                    <>
                        <button type="button" onClick={() => setTarget(null)} disabled={toggleHidden.isPending} className={btnSecondary}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => target && toggleHidden.mutate(target)}
                            disabled={toggleHidden.isPending}
                            className={hiding ? btnDanger : btnPrimary}
                        >
                            <LoadingButtonIcon loading={toggleHidden.isPending} icon={hiding ? EyeOff : Eye} />
                            {hiding ? "Hide" : "Unhide"}
                        </button>
                    </>
                }
            >
                <p className="text-sm text-neutral-600 leading-relaxed">
                    {hiding ? (
                        <>
                            <strong>{target?.title || "This experience"}</strong> disappears from the app and can't be booked. The business still sees it in the
                            Partner Portal, marked as hidden by SeekKrr. Existing bookings are kept.
                        </>
                    ) : (
                        <>
                            <strong>{target?.title || "This experience"}</strong> shows in the app again if the business has it published.
                        </>
                    )}
                </p>
            </Modal>
        </div>
    );
}

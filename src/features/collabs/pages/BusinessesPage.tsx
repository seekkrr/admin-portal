import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Plus, Filter, BadgeCheck, Globe, Star } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { FilterDropdown, type DropdownOption } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { businessesService } from "../services/businesses.service";
import { useCollabAccess } from "../roles";
import { useDebouncedValue } from "../hooks";
import {
    Chip, LoadingButtonIcon, Modal, PageHeader, PanelState, SearchBox, StatusPill, Toolbar, btnPrimary, btnSecondary, thClass,
} from "../components/CollabsUi";
import { RegionName } from "../components/CollabPickers";
import { BusinessFormFields } from "../components/BusinessFormFields";
import { createPayloadFromDraft, emptyBusinessDraft, slugError, type BusinessDraft } from "../businessDraft";
import { fmtDate } from "../utils";
import type { BusinessStatus, ListBusinessesParams } from "../types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: DropdownOption[] = [
    { value: "", label: "All statuses" },
    { value: "pending_claim", label: "Pending claim", dot: "bg-amber-500" },
    { value: "active", label: "Active", dot: "bg-emerald-500" },
    { value: "suspended", label: "Suspended", dot: "bg-red-500" },
];

const VERIFIED_OPTIONS: DropdownOption[] = [
    { value: "", label: "Verified: any" },
    { value: "true", label: "Verified", dot: "bg-teal-500" },
    { value: "false", label: "Not verified", dot: "bg-neutral-400" },
];

export function BusinessesPage() {
    const { isStaff, isAdmin } = useCollabAccess();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const initialStatus = searchParams.get("status") ?? "";
    const [status, setStatus] = useState(STATUS_OPTIONS.some((o) => o.value === initialStatus) ? initialStatus : "");
    const [verified, setVerified] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const search = useDebouncedValue(searchInput);
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [draft, setDraft] = useState<BusinessDraft>(emptyBusinessDraft);

    useEffect(() => setPage(1), [search, status, verified]);

    const params: ListBusinessesParams = {
        status: (status || undefined) as BusinessStatus | undefined,
        verified: verified === "" ? undefined : verified === "true",
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-businesses", params],
        queryFn: () => businessesService.list(params),
        enabled: isStaff,
        placeholderData: (prev) => prev,
    });

    const create = useMutation({
        mutationFn: () => businessesService.create(createPayloadFromDraft(draft)),
        onSuccess: (business) => {
            toast.success(`${business.name} created — send the owner a claim link next`);
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

    return (
        <div className="p-6 max-w-[1400px] mx-auto space-y-5 animate-fade-in">
            <PageHeader
                icon={Store}
                title="Businesses"
                subtitle={data ? `${data.total} business profiles` : "Loading..."}
                actions={
                    isAdmin && (
                        <button type="button" onClick={() => setCreateOpen(true)} className={btnPrimary}>
                            <Plus className="w-4 h-4" /> Create on behalf
                        </button>
                    )
                }
            />

            <Toolbar>
                <SearchBox value={searchInput} onChange={setSearchInput} placeholder="Search name, contact email or phone..." />
                <FilterDropdown options={STATUS_OPTIONS} value={status} onChange={setStatus} icon={<Filter className="w-3.5 h-3.5" />} placeholder="Status" theme="teal" />
                <FilterDropdown options={VERIFIED_OPTIONS} value={verified} onChange={setVerified} icon={<BadgeCheck className="w-3.5 h-3.5" />} placeholder="Verified" theme="teal" />
                {(status || verified || searchInput) && (
                    <button
                        type="button"
                        onClick={() => {
                            setStatus("");
                            setVerified("");
                            setSearchInput("");
                        }}
                        className="px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </Toolbar>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <PanelState isLoading={isLoading && !data} error={error} isEmpty={businesses.length === 0} emptyIcon={Store} emptyText="No businesses found" onRetry={() => refetch()}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                    <th className={thClass}>Business</th>
                                    <th className={thClass}>Region</th>
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Plan</th>
                                    <th className={thClass}>Website</th>
                                    <th className={thClass}>Places</th>
                                    <th className={thClass}>Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {businesses.map((b) => (
                                    <tr key={b.id} onClick={() => navigate(`/collabs/businesses/${b.id}`)} className="transition-colors hover:bg-neutral-50/80 cursor-pointer">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-neutral-900 flex items-center gap-1.5">
                                                {b.name}
                                                {b.verified && <BadgeCheck className="w-4 h-4 text-teal-600" aria-label="Verified" />}
                                            </div>
                                            <div className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[280px]">
                                                {b.categories.length ? b.categories.join(", ") : b.tagline ?? b.slug}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">
                                            <RegionName id={b.region_id} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusPill status={b.status} />
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600 capitalize">{b.plan_code?.replace(/_/g, " ") ?? "free"}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {b.website_featured && (
                                                    <Chip tone="amber">
                                                        <Star className="w-3 h-3" /> Featured
                                                    </Chip>
                                                )}
                                                {b.show_on_website ? (
                                                    <Chip tone="teal">
                                                        <Globe className="w-3 h-3" /> Listed
                                                    </Chip>
                                                ) : (
                                                    <Chip>Hidden</Chip>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">{b.marker_ids.length}</td>
                                        <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{fmtDate(b.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </PanelState>
                {data && <Pagination page={page} totalPages={data.total_pages || 1} total={data.total} onPageChange={setPage} theme="teal" />}
            </div>

            <Modal
                open={createOpen}
                onClose={() => !create.isPending && setCreateOpen(false)}
                title="Create business on behalf"
                icon={Store}
                size="2xl"
                footer={
                    <>
                        <button type="button" onClick={() => setCreateOpen(false)} disabled={create.isPending} className={btnSecondary}>
                            Cancel
                        </button>
                        <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !canSubmitCreate} className={btnPrimary}>
                            <LoadingButtonIcon loading={create.isPending} icon={Plus} /> Create business
                        </button>
                    </>
                }
            >
                <p className="text-sm text-neutral-600 bg-teal-50/60 border border-teal-100 rounded-xl p-3">
                    Sales-assisted onboarding: the profile starts as <strong>pending claim</strong> and verified. After creating it, send the
                    owner a claim link — they verify by OTP to the listed phone and become the owner.
                </p>
                <BusinessFormFields draft={draft} onChange={setDraft} mode="create" idPrefix="biz-create" />
            </Modal>
        </div>
    );
}

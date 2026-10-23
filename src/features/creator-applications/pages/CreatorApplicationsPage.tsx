import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, UserPlus } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { creatorApplicationsService } from "../services/creator-applications.service";
import { ApplicationDetailModal } from "../components/ApplicationDetailModal";
import { IconButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { CountBadge, StatusPill } from "@/components/ui/StatusPill";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDate } from "@/utils/date";
import type { CreatorApplication } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin"];
const PER_PAGE = 20;

type StatusTab = "pending" | "verifying" | "approved" | "rejected" | "all";
const STATUS_TABS: { value: StatusTab; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "verifying", label: "Verifying" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all", label: "All" },
];

export function CreatorApplicationsPage() {
    const { user: currentUser } = useAuthStore();
    const hasAccess = !!currentUser && currentUser.role?.some((r) => ALLOWED_ROLES.includes(r));

    // Status tab, search and page live in the address. The queue opens on "Pending".
    const { state, set, reset } = useUrlState({ status: "pending", q: "", page: 1 });
    const [searchInput, setSearchInput] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));
    const status: StatusTab = STATUS_TABS.some((t) => t.value === state.status) ? (state.status as StatusTab) : "pending";
    const page = Math.max(1, state.page);

    const [viewingApp, setViewingApp] = useState<CreatorApplication | null>(null);

    const queryParams = {
        status: status === "all" ? undefined : status,
        search: state.q || undefined,
        page,
        page_size: PER_PAGE,
    };

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["admin-creator-applications", queryParams],
        queryFn: () => creatorApplicationsService.listApplications(queryParams),
        placeholderData: (prev) => prev,
        enabled: hasAccess,
    });

    const applications = data?.applications ?? [];
    const pagination = data?.pagination;
    const pendingCount = data?.pending_count ?? 0;

    if (!hasAccess) {
        return <AccessDenied message="Only admins can manage creator applications." />;
    }

    const columns: DataColumn<CreatorApplication>[] = [
        {
            id: "applicant",
            header: "Applicant",
            hideable: false,
            sortValue: (a) => a.name,
            cell: (a) => <span className="font-medium text-ink">{a.name}</span>,
        },
        {
            id: "email",
            header: "Email",
            sortValue: (a) => a.email,
            className: "max-w-[240px]",
            cell: (a) => <span className="block truncate text-ink-muted">{a.email}</span>,
        },
        { id: "phone", header: "Phone", csv: (a) => a.phone ?? "", cell: (a) => <span className="text-ink-muted">{a.phone || "—"}</span>, defaultHidden: true },
        {
            id: "links",
            header: "Social links",
            align: "right",
            sortValue: (a) => a.social_links?.length ?? 0,
            cell: (a) => <span className="tabular-nums text-ink-muted">{a.social_links?.length ?? 0}</span>,
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
                icon={UserPlus}
                title="Creator applications"
                badge={pendingCount > 0 ? <CountBadge count={pendingCount} /> : undefined}
                description={pagination ? `${pagination.total.toLocaleString("en-IN")} applications in this view` : "People asking to become creators"}
            />

            <Tabs
                label="Application status"
                variant="pill"
                tabs={STATUS_TABS.map((t) => ({ ...t, count: t.value === "pending" ? pendingCount : undefined }))}
                value={status}
                onChange={(v) => set({ status: v })}
            />

            <FilterBar
                search={{ value: searchInput, onChange: setSearchInput, placeholder: "Search by name or email…" }}
                onReset={() => {
                    setSearchInput("");
                    reset();
                }}
            />

            <DataTable
                label="Creator applications"
                rows={applications}
                columns={columns}
                rowKey={(a) => a.id}
                isLoading={isLoading && !data}
                isFetching={isFetching && !!data}
                error={error}
                onRetry={() => refetch()}
                empty={{
                    icon: UserPlus,
                    title: status === "pending" && !state.q ? "No applications waiting. You're up to date." : "No applications found",
                    description: state.q ? "Try a different search." : undefined,
                }}
                onRowClick={(a) => setViewingApp(a)}
                rowActions={(a) => <IconButton icon={Eye} size="sm" label={`Review ${a.name}`} onClick={() => setViewingApp(a)} />}
                storageKey="creator-applications"
                exportName="creator-applications"
                summary={pagination ? `${applications.length} of ${pagination.total.toLocaleString("en-IN")}` : undefined}
                card={{
                    title: (a) => a.name,
                    subtitle: (a) => a.email,
                    fields: ["status", "applied", "links"],
                }}
                footer={
                    pagination && (
                        <Pagination page={page} totalPages={pagination.total_pages} total={pagination.total} pageSize={PER_PAGE} onPageChange={(p) => set({ page: p })} />
                    )
                }
            />

            <ApplicationDetailModal open={!!viewingApp} application={viewingApp} onClose={() => setViewingApp(null)} />
        </div>
    );
}

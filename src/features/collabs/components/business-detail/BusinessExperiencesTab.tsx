import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarRange, EyeOff, Plus } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Notice } from "@/components/detail/DetailStates";
import { calendarDate, count } from "@/components/detail/detailFormat";
import { experiencesAdminService } from "../../services/experiences-admin.service";
import { featuresOf } from "../../utils";
import type { AdminBusiness, AdminExperience } from "../../types";

/** The business's experiences (any status); each opens the experience page. */
export function BusinessExperiencesTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const on = featuresOf(business).experiences;
    const [creating, setCreating] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const query = useQuery({
        queryKey: ["admin-experiences", { business_id: business.id }],
        queryFn: () => experiencesAdminService.list({ business_id: business.id }),
        staleTime: 30_000,
    });

    const create = useMutation({
        mutationFn: () => experiencesAdminService.create(business.id, { title, description }),
        onSuccess: (exp) => {
            toast.success("Draft experience created");
            queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
            setCreating(false);
            navigate(`/collabs/experiences/${exp.id}`);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const columns: DataColumn<AdminExperience>[] = [
        {
            id: "title",
            header: "Experience",
            hideable: false,
            sortValue: (e) => e.title,
            cell: (e) => (
                <div className="flex min-w-0 items-center gap-3">
                    {e.cover_url ? (
                        <img src={e.cover_url} alt="" className="h-10 w-12 shrink-0 rounded-md object-cover" />
                    ) : (
                        <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-500">
                            <CalendarRange className="h-4 w-4" aria-hidden />
                        </span>
                    )}
                    <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{e.title}</div>
                        {e.tagline && <div className="truncate text-xs text-ink-muted">{e.tagline}</div>}
                    </div>
                </div>
            ),
        },
        {
            id: "status",
            header: "Status",
            sortValue: (e) => e.status,
            cell: (e) => (
                <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill status={e.status} />
                    {e.hidden_by_admin && (
                        <Tag tone="bad">
                            <EyeOff className="h-3 w-3" aria-hidden /> Hidden
                        </Tag>
                    )}
                </span>
            ),
        },
        { id: "next", header: "Next date", sortValue: (e) => e.next_date ?? "", cell: (e) => <span className="text-ink-muted">{calendarDate(e.next_date)}</span> },
        { id: "bookings", header: "Bookings", align: "right", sortValue: (e) => e.stats?.bookings ?? 0, cell: (e) => <span className="tabular-nums">{count(e.stats?.bookings)}</span> },
    ];

    return (
        <div className="space-y-4">
            {!on && <Notice tone="warn" title="Experiences are off for this business">Turn them on in the Overview tab to edit experiences, slots and bookings.</Notice>}
            <Panel
                title={`Experiences${query.data ? ` (${query.data.total})` : ""}`}
                icon={CalendarRange}
                bodyClassName="p-0"
                actions={
                    canEdit && on ? (
                        <Button size="sm" variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                            New experience
                        </Button>
                    ) : undefined
                }
            >
                <DataTable
                    label="Experiences"
                    rows={query.data?.experiences ?? []}
                    columns={columns}
                    rowKey={(e) => e.id}
                    isLoading={query.isLoading}
                    error={query.error}
                    onRetry={() => query.refetch()}
                    toolbar={false}
                    frame="bare"
                    onRowClick={(e) => navigate(`/collabs/experiences/${e.id}`)}
                    empty={{ icon: CalendarRange, title: "No experiences yet" }}
                    card={{ title: (e) => e.title, subtitle: (e) => e.tagline ?? null, fields: ["status", "next", "bookings"] }}
                />
            </Panel>

            <Modal
                open={creating}
                onClose={() => setCreating(false)}
                dismissible={!create.isPending}
                title="New experience"
                description={`A draft for ${business.name}. Add photos and slots, then publish.`}
                icon={Plus}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreating(false)} disabled={create.isPending}>
                            Cancel
                        </Button>
                        <Button variant="primary" disabled={!title.trim()} loading={create.isPending} onClick={() => create.mutate()}>
                            Create draft
                        </Button>
                    </>
                }
            >
                <Field label="Title" required>
                    <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
                </Field>
                <Field label="Description">
                    <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} />
                </Field>
            </Modal>
        </div>
    );
}

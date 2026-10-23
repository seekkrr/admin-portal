import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, MessageSquare, Phone, Trash2 } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supportQueriesService } from "../services/support-queries.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/buttonStyles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { CopyText } from "@/components/ui/CopyText";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { formatDateTime, formatRelative } from "@/utils/date";

export function SupportQueryDetailPage() {
    const { queryId: queryIdParam } = useParams<{ queryId: string }>();
    const queryId = queryIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const CAN_DELETE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { data: query, isLoading, error, refetch } = useQuery({
        queryKey: ["support-query-detail", queryId],
        queryFn: () => supportQueriesService.getById(queryId),
        enabled: !!queryId,
        staleTime: 5 * 60 * 1000,
    });

    usePageTitle(query ? `Message from ${query.name || "Anonymous"}` : null);

    const deleteMutation = useMutation({
        mutationFn: () => supportQueriesService.deleteQuery(queryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-support-queries"] });
            toast.success("Query deleted");
            navigate("/support-queries", { replace: true });
        },
        onError: () => {
            toast.error("Failed to delete query");
            setConfirmDelete(false);
        },
    });

    if (isLoading) return <LoadingState label="Loading query details…" />;

    if (error || !query) {
        return (
            <div className="rounded-card border border-line bg-surface shadow-card">
                <ErrorState
                    error={error ?? new Error("This support query doesn't exist.")}
                    title="Couldn't load this support query"
                    onRetry={error ? () => refetch() : undefined}
                />
                <div className="flex justify-center pb-8">
                    <ButtonLink to="/support-queries" size="sm" variant="ghost">
                        Back to support queries
                    </ButtonLink>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <PageHeader
                icon={MessageSquare}
                title={query.name || "Anonymous"}
                description={query.created_at ? `Sent ${formatRelative(query.created_at)}` : undefined}
                actions={
                    <>
                        {query.email && (
                            <a href={`mailto:${query.email}`} className={buttonClass("secondary", "md")}>
                                <Mail className="h-4 w-4" aria-hidden />
                                Reply by email
                            </a>
                        )}
                        {CAN_DELETE && (
                            <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)} disabled={deleteMutation.isPending}>
                                Delete
                            </Button>
                        )}
                    </>
                }
            />

            <Panel title="Message">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{query.message || "No message provided."}</p>
            </Panel>

            <Panel title="Contact">
                <DetailList>
                    <DetailRow label="Name" value={query.name || "Anonymous"} />
                    <DetailRow
                        label="Email"
                        value={
                            query.email ? (
                                <a href={`mailto:${query.email}`} className="inline-flex items-center gap-1.5 text-accent-700 hover:underline">
                                    <Mail className="h-3.5 w-3.5" aria-hidden />
                                    {query.email}
                                </a>
                            ) : (
                                "—"
                            )
                        }
                    />
                    <DetailRow
                        label="Phone"
                        value={
                            query.phone ? (
                                <a href={`tel:${query.phone}`} className="inline-flex items-center gap-1.5 text-accent-700 hover:underline">
                                    <Phone className="h-3.5 w-3.5" aria-hidden />
                                    {query.phone}
                                </a>
                            ) : (
                                "—"
                            )
                        }
                    />
                    <DetailRow label="Received" value={formatDateTime(query.created_at)} />
                    <DetailRow label="Query ID" value={<CopyText value={query.id} mono truncate={false} />} />
                </DetailList>
            </Panel>

            <ConfirmDialog
                open={confirmDelete}
                title="Delete support query?"
                description={`The message from ${query.name || query.email || "Anonymous"} is removed for good.`}
                confirmLabel="Delete"
                tone="danger"
                level="type"
                typeToConfirm="DELETE"
                isPending={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => setConfirmDelete(false)}
            />
        </div>
    );
}

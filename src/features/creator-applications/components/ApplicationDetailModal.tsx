import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ExternalLink, Trash2, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill } from "@/components/ui/StatusPill";
import { SectionHeading } from "@/components/ui/PageHeader";
import { DetailList, DetailRow } from "@/components/ui/Panel";
import { CopyText } from "@/components/ui/CopyText";
import { IdLink } from "@/components/ui/IdLink";
import { formatDateTime } from "@/utils/date";
import { creatorApplicationsService } from "../services/creator-applications.service";
import type { CreatorApplication } from "@/types";

interface ApplicationDetailModalProps {
    open: boolean;
    application: CreatorApplication | null;
    onClose: () => void;
}

/** Review one creator application: approve, reject with a reason, or delete. */
export function ApplicationDetailModal({ open, application, onClose }: ApplicationDetailModalProps) {
    const queryClient = useQueryClient();
    const [confirm, setConfirm] = useState<"reject" | "delete" | null>(null);

    const done = (message: string) => {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ["admin-creator-applications"] });
        setConfirm(null);
        onClose();
    };

    const approveMutation = useMutation({
        mutationFn: (id: string) => creatorApplicationsService.approveApplication(id),
        onSuccess: () => done("Application approved"),
        onError: (err: Error) => toast.error(err.message || "Failed to approve application"),
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason?: string }) => creatorApplicationsService.rejectApplication(id, reason),
        onSuccess: () => done("Application rejected"),
        onError: (err: Error) => toast.error(err.message || "Failed to reject application"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => creatorApplicationsService.deleteApplication(id),
        onSuccess: () => done("Application deleted"),
        onError: (err: Error) => toast.error(err.message || "Failed to delete application"),
    });

    if (!application) return null;

    const canAction = application.status === "pending" || application.status === "verifying";
    const isBusy = approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending;

    return (
        <>
            <Modal
                open={open}
                onClose={onClose}
                dismissible={!isBusy}
                icon={UserPlus}
                title="Review application"
                description={
                    <span className="flex flex-wrap items-center gap-2">
                        {application.name}
                        <StatusPill status={application.status} />
                    </span>
                }
                size="lg"
                footer={
                    <>
                        <Button variant="ghost" icon={Trash2} onClick={() => setConfirm("delete")} disabled={isBusy} className="text-bad hover:bg-bad-soft hover:text-bad sm:mr-auto">
                            Delete
                        </Button>
                        {canAction ? (
                            <>
                                <Button variant="secondary" icon={XCircle} onClick={() => setConfirm("reject")} disabled={isBusy}>
                                    Reject
                                </Button>
                                <Button variant="primary" icon={CheckCircle} onClick={() => approveMutation.mutate(application.id)} loading={approveMutation.isPending} disabled={isBusy}>
                                    Approve
                                </Button>
                            </>
                        ) : (
                            <Button variant="secondary" onClick={onClose}>
                                Close
                            </Button>
                        )}
                    </>
                }
            >
                {application.status === "rejected" && application.rejection_reason && (
                    <div className="rounded-control border border-bad-line bg-bad-soft px-3 py-2.5 text-sm text-bad">
                        <span className="font-medium">Rejected:</span> {application.rejection_reason}
                    </div>
                )}

                <section className="space-y-3">
                    <SectionHeading>Applicant</SectionHeading>
                    <DetailList>
                        <DetailRow label="Name" value={application.name} />
                        <DetailRow
                            label="Email"
                            value={application.email ? <CopyText value={application.email} title="Copy email" /> : "Not shared"}
                        />
                        <DetailRow label="Source" value={application.source === "app" ? "SeekKrr app (Become a Creator)" : "Website"} />
                        {application.applicant_user_id && (
                            <DetailRow label="Applicant" value={<IdLink kind="user" id={application.applicant_user_id} />} />
                        )}
                        <DetailRow label="Phone" value={application.phone || "Not provided"} />
                        <DetailRow label="Applied" value={formatDateTime(application.applied_at)} />
                        {application.actioned_at && <DetailRow label="Decided" value={formatDateTime(application.actioned_at)} />}
                        {application.admin_id && <DetailRow label="Decided by" value={<IdLink kind="user" id={application.admin_id} />} />}
                        {application.used_by_user_id && <DetailRow label="Became creator" value={<IdLink kind="user" id={application.used_by_user_id} />} />}
                        <DetailRow label="Application ID" value={<CopyText value={application.id} mono truncate={false} />} />
                    </DetailList>
                </section>

                {application.social_links?.length > 0 && (
                    <section className="space-y-3">
                        <SectionHeading>Social links ({application.social_links.length})</SectionHeading>
                        <ul className="space-y-2">
                            {application.social_links.map((link, idx) => (
                                <li key={idx}>
                                    <a
                                        href={link.startsWith("http") ? link : "https://" + link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 rounded-control border border-line px-3 py-2.5 text-sm text-ink transition-colors hover:border-accent-300 hover:bg-accent-50/40"
                                    >
                                        <ExternalLink className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                                        <span className="min-w-0 flex-1 truncate font-medium">{link.replace(/^https?:\/\/(www\.)?/, "")}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </Modal>

            <ConfirmDialog
                open={open && confirm === "reject"}
                title="Reject application?"
                description={`${application.name} is told their application was not approved.`}
                level="reason"
                reasonLabel="Reason for rejection"
                reasonPlaceholder="e.g. Does not meet the minimum follower requirement…"
                confirmLabel="Reject"
                tone="danger"
                isPending={rejectMutation.isPending}
                onConfirm={(reason) => rejectMutation.mutate({ id: application.id, reason: reason || undefined })}
                onCancel={() => setConfirm(null)}
            />

            <ConfirmDialog
                open={open && confirm === "delete"}
                title="Delete application?"
                description={`The application from ${application.name} is removed from the list.`}
                confirmLabel="Delete"
                tone="danger"
                isPending={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate(application.id)}
                onCancel={() => setConfirm(null)}
            />
        </>
    );
}

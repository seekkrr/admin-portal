import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Banknote, CheckCircle2, ExternalLink, IndianRupee, Shield, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "@/components/ui/Modal";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { SectionHeading } from "@/components/ui/PageHeader";
import { DetailList, DetailRow } from "@/components/ui/Panel";
import { IdLink } from "@/components/ui/IdLink";
import { PanelState } from "@/components/ui/States";
import { formatCurrency } from "@/utils/format";
import { formatDate } from "@/utils/date";
import { humanizeStatus } from "@/components/ui/status";
import { creatorsService } from "../services/creators.service";

const CREATOR_STATUSES = ["active", "suspended", "rejected"] as const;
type CreatorStatus = (typeof CREATOR_STATUSES)[number];

interface CreatorDetailModalProps {
    open: boolean;
    creatorId: string | null;
    displayName: string;
    onClose: () => void;
}

/** Quick view of a creator (side panel): stats, tagline, status and verification. */
export function CreatorDetailModal({ open, creatorId, displayName, onClose }: CreatorDetailModalProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [confirmStatus, setConfirmStatus] = useState<CreatorStatus | null>(null);

    const { data: creator, isLoading, error, refetch } = useQuery({
        queryKey: ["creator-detail", creatorId],
        queryFn: () => creatorsService.getCreator(creatorId ?? ""),
        enabled: open && !!creatorId,
    });

    const updateMutation = useMutation({
        mutationFn: ({ status, is_verified }: { status?: string; is_verified?: boolean }) => creatorsService.updateCreator(creatorId ?? "", { status, is_verified }),
        onSuccess: () => {
            toast.success("Creator updated");
            queryClient.invalidateQueries({ queryKey: ["creator-detail", creatorId] });
            queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
            setConfirmStatus(null);
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setConfirmStatus(null);
        },
    });

    return (
        <>
            <Drawer
                open={open && !!creatorId}
                onClose={onClose}
                title={displayName || "Creator"}
                subtitle={
                    creator && (
                        <span className="flex flex-wrap items-center gap-2">
                            <StatusPill status={creator.status} />
                            {creator.is_verified && (
                                <Tag tone="good">
                                    <CheckCircle2 className="h-3 w-3" aria-hidden /> Verified
                                </Tag>
                            )}
                        </span>
                    )
                }
                footer={
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                        {creatorId && (
                            <ButtonLink to={`/creators/${creatorId}`} variant="primary" icon={ExternalLink} onClick={onClose}>
                                Open creator page
                            </ButtonLink>
                        )}
                    </div>
                }
            >
                <PanelState isLoading={isLoading} error={error} isEmpty={!creator} emptyText="Creator not found." onRetry={() => refetch()}>
                    {creator && (
                        <>
                            <section className="space-y-3">
                                <SectionHeading>Stats</SectionHeading>
                                <StatGrid cols={3}>
                                    <StatTile icon={Award} label="Quests" value={(creator.total_quests ?? 0).toLocaleString("en-IN")} />
                                    <StatTile icon={IndianRupee} label="Earnings" value={formatCurrency(creator.total_earnings ?? 0)} />
                                    <StatTile icon={Star} label="Rating" value={creator.rating ?? "—"} />
                                    <StatTile icon={Users} label="Travelers" value={(creator.travelers_served ?? 0).toLocaleString("en-IN")} />
                                    <StatTile icon={Banknote} label="Pending payout" value={formatCurrency(creator.pending_payouts ?? 0)} />
                                </StatGrid>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={Banknote}
                                    onClick={() => {
                                        onClose();
                                        // /payouts consumes these params to open the Initiate Payout modal prefilled.
                                        navigate(`/payouts?createForCreator=${creatorId}&amount=${creator.pending_payouts ?? 0}`);
                                    }}
                                >
                                    Create payout
                                </Button>
                            </section>

                            <section className="space-y-3">
                                <SectionHeading>Profile</SectionHeading>
                                <DetailList>
                                    <DetailRow label="User" value={<IdLink kind="user" id={creator.user_id} label={creator.name ?? undefined} />} />
                                    {creator.tagline && <DetailRow label="Tagline" value={<span className="italic">“{creator.tagline}”</span>} />}
                                    <DetailRow label="Joined" value={formatDate(creator.created_at)} />
                                </DetailList>
                            </section>

                            <section className="space-y-3">
                                <SectionHeading>
                                    <span className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-accent-600" aria-hidden /> Admin actions
                                    </span>
                                </SectionHeading>
                                <div className="flex flex-wrap gap-2">
                                    {CREATOR_STATUSES.map((s) => (
                                        <Button
                                            key={s}
                                            size="sm"
                                            variant={creator.status === s ? "primary" : "secondary"}
                                            disabled={creator.status === s || updateMutation.isPending}
                                            onClick={() => setConfirmStatus(s)}
                                        >
                                            {creator.status === s ? `${humanizeStatus(s)} now` : `Set ${humanizeStatus(s).toLowerCase()}`}
                                        </Button>
                                    ))}
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        icon={CheckCircle2}
                                        loading={updateMutation.isPending && !confirmStatus}
                                        disabled={updateMutation.isPending}
                                        onClick={() => updateMutation.mutate({ is_verified: !creator.is_verified })}
                                    >
                                        {creator.is_verified ? "Unverify" : "Verify"}
                                    </Button>
                                </div>
                            </section>
                        </>
                    )}
                </PanelState>
            </Drawer>

            <ConfirmDialog
                open={!!confirmStatus}
                title="Change creator status?"
                description={`${displayName || "This creator"} becomes "${confirmStatus ? humanizeStatus(confirmStatus) : ""}".`}
                confirmLabel="Change status"
                tone={confirmStatus === "active" ? "primary" : "warning"}
                onConfirm={() => confirmStatus && updateMutation.mutate({ status: confirmStatus })}
                onCancel={() => setConfirmStatus(null)}
                isPending={updateMutation.isPending}
            />
        </>
    );
}

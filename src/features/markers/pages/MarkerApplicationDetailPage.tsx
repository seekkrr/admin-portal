import { useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, ExternalLink, Globe, Image as ImageIcon, IndianRupee, Info, MapPin, MapPinPlus, Phone, X } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { markersService } from "../services/markers.service";
import { PlaceRequestStatus } from "../components/PlaceRequestStatus";
import { GeoMap } from "@/components/maps/GeoMap";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime, formatTime, toDate } from "@/utils/date";

const REVIEW_ROLES = ["admin", "super_admin", "moderator"];

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-accent-700 hover:underline">
            {children}
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
    );
}

function IconLabel({ icon: Icon, children }: { icon: typeof Globe; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />
            {children}
        </span>
    );
}

export function MarkerApplicationDetailPage() {
    const { appId: appIdParam } = useParams<{ appId: string }>();
    const appId = appIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canReview = !!user?.role?.some((r) => REVIEW_ROLES.includes(r));

    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);

    const { data: application, isLoading, error, refetch } = useQuery({
        queryKey: ["marker-application-detail", appId],
        queryFn: () => markersService.getApplication(appId),
        enabled: !!appId,
        staleTime: 5 * 60 * 1000,
    });

    usePageTitle(application?.proposed_title);

    const afterChange = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-marker-applications"] });
        queryClient.invalidateQueries({ queryKey: ["marker-application-detail", appId] });
        queryClient.invalidateQueries({ queryKey: ["today", "place-requests"] });
    };

    const approveMutation = useMutation({
        mutationFn: () => markersService.approveApplication(appId),
        onSuccess: () => {
            afterChange();
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success("Place request approved — the place is live");
            navigate("/markers/applications", { replace: true });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to approve place request");
            setShowApprove(false);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: (reason: string) => markersService.rejectApplication(appId, reason),
        onSuccess: () => {
            afterChange();
            toast.success("Place request rejected");
            navigate("/markers/applications", { replace: true });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to reject place request");
            setShowReject(false);
        },
    });

    if (isLoading) return <LoadingState label="Loading place request…" />;

    if (error || !application) {
        return (
            <Panel>
                <ErrorState
                    title="Couldn't load this place request"
                    error={error ?? new Error("It may have been removed.")}
                    onRetry={error ? () => refetch() : undefined}
                />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/markers/applications" variant="secondary">
                        Back to place requests
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const coords = application.proposed_location?.coordinates ?? null;

    // Photos can arrive under several field names depending on the app version.
    const appMedia = (application as { media?: unknown[] }).media;
    const info = application.additional_info || {};
    const rawPhotos: unknown[] =
        Array.isArray(application.photos) && application.photos.length > 0
            ? application.photos
            : Array.isArray(appMedia) && appMedia.length > 0
              ? appMedia
              : Array.isArray(info.media) && info.media.length > 0
                ? info.media
                : Array.isArray(info.photos) && info.photos.length > 0
                  ? info.photos
                  : [];
    const photos = rawPhotos.filter((p): p is string => typeof p === "string" && p.length > 0);
    const isOpen = application.status === "pending" || application.status === "under_review";

    const websiteUrl = typeof info.website_url === "string" ? info.website_url : null;
    const contact = typeof info.contact === "string" ? info.contact : null;
    const minExpense = info.min_expense as number | string | null | undefined;
    const maxExpense = info.max_expense as number | string | null | undefined;
    const opensAt = typeof info.opens_at === "string" ? info.opens_at : null;
    const closesAt = typeof info.closes_at === "string" ? info.closes_at : null;

    const hasExpense = (minExpense !== null && minExpense !== undefined) || (maxExpense !== null && maxExpense !== undefined);
    const expenseLabel = hasExpense ? `₹${minExpense ?? "?"} – ₹${maxExpense ?? "?"}` : null;

    // Opening hours may be a time ("09:00") or a full timestamp.
    const fmtHour = (v: string | null): string => (!v ? "?" : toDate(v) ? formatTime(v) : v);
    const hoursLabel = opensAt || closesAt ? `${fmtHour(opensAt)} – ${fmtHour(closesAt)}` : null;

    const lat = coords ? coords[1] : null;
    const lon = coords ? coords[0] : null;
    const googleMapsUrl = lat !== null && lon !== null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : null;

    const SHOWN = new Set(["website_url", "contact", "map_url", "min_expense", "max_expense", "opens_at", "closes_at", "tags", "media", "photos"]);
    const rest = Object.fromEntries(Object.entries(info).filter(([k]) => !SHOWN.has(k)));
    const tags = Array.isArray(info.tags) ? info.tags.filter((t): t is string => typeof t === "string") : [];
    const categories = application.proposed_categories ?? [];

    return (
        <div className="space-y-5">
            <PageHeader
                icon={MapPinPlus}
                title={application.proposed_title}
                badge={<PlaceRequestStatus status={application.status} />}
                description={categories.length ? <span className="capitalize">{categories.join(", ")}</span> : "No category"}
                actions={
                    canReview &&
                    isOpen && (
                        <Button variant="secondary" icon={X} onClick={() => setShowReject(true)}>
                            Reject
                        </Button>
                    )
                }
                primaryAction={
                    canReview &&
                    isOpen && (
                        <Button variant="primary" icon={Check} onClick={() => setShowApprove(true)}>
                            Approve
                        </Button>
                    )
                }
            />

            {application.status === "approved" && application.marker_id && (
                <Panel bodyClassName="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="text-sm text-ink-muted">Approved — this request became a live place.</p>
                    <ButtonLink to={`/markers/${application.marker_id}`} size="sm" variant="secondary" icon={MapPin}>
                        Open place
                    </ButtonLink>
                </Panel>
            )}

            {coords && (
                <Panel bodyClassName="p-0">
                    <GeoMap points={[{ coordinates: coords, label: application.proposed_title, color: "#00a49e" }]} center={coords} height="320px" zoom={14} />
                </Panel>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Proposed details" icon={Info}>
                    <DetailList>
                        <DetailRow label="Address" value={application.proposed_address || "—"} />
                        <DetailRow label="Description" value={<span className="whitespace-pre-wrap">{application.proposed_description || "—"}</span>} />
                        <DetailRow label="Coordinates" value={coords ? `${coords[1]}, ${coords[0]} (lat, lon)` : "—"} />
                        <DetailRow label="Submitted by" value={<IdLink kind="user" id={application.user_id} />} />
                        <DetailRow label="Submitted" value={formatDateTime(application.created_at)} />
                        <DetailRow
                            label="Tags"
                            value={
                                tags.length ? (
                                    <span className="flex flex-wrap gap-1.5">
                                        {tags.map((t) => (
                                            <Tag key={t}>{t}</Tag>
                                        ))}
                                    </span>
                                ) : (
                                    "—"
                                )
                            }
                        />
                        {application.status === "approved" && (
                            <DetailRow
                                label="Approved"
                                value={
                                    <span className="flex flex-wrap items-center gap-2">
                                        {formatDateTime(application.approved_at)}
                                        {application.approved_by && (
                                            <>
                                                <span className="text-ink-faint">by</span>
                                                <IdLink kind="user" id={application.approved_by} />
                                            </>
                                        )}
                                    </span>
                                }
                            />
                        )}
                        {application.status === "rejected" && (
                            <>
                                <DetailRow
                                    label="Rejected"
                                    value={
                                        <span className="flex flex-wrap items-center gap-2">
                                            {formatDateTime(application.rejected_at)}
                                            {application.rejected_by && (
                                                <>
                                                    <span className="text-ink-faint">by</span>
                                                    <IdLink kind="user" id={application.rejected_by} />
                                                </>
                                            )}
                                        </span>
                                    }
                                />
                                <DetailRow label="Reason" value={application.rejection_reason || "—"} />
                            </>
                        )}
                        {Object.keys(rest).length > 0 && (
                            <DetailRow
                                label="Other details"
                                value={
                                    <span className="flex flex-wrap gap-1.5">
                                        {Object.entries(rest).map(([k, v]) => (
                                            <Tag key={k} className="whitespace-normal">
                                                <span className="capitalize text-ink-muted">{k.replace(/_/g, " ")}:</span>
                                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                            </Tag>
                                        ))}
                                    </span>
                                }
                            />
                        )}
                    </DetailList>
                </Panel>

                <Panel title="Information and links" icon={Globe}>
                    <DetailList>
                        <DetailRow label={<IconLabel icon={IndianRupee}>Expense range</IconLabel>} value={expenseLabel || "—"} />
                        <DetailRow label={<IconLabel icon={Clock}>Opening hours</IconLabel>} value={hoursLabel || "—"} />
                        <DetailRow label={<IconLabel icon={Globe}>Website</IconLabel>} value={websiteUrl ? <ExternalAnchor href={websiteUrl}>{websiteUrl}</ExternalAnchor> : "—"} />
                        <DetailRow
                            label={<IconLabel icon={MapPin}>Maps</IconLabel>}
                            value={googleMapsUrl ? <ExternalAnchor href={googleMapsUrl}>Open in Google Maps</ExternalAnchor> : "—"}
                        />
                        <DetailRow
                            label={<IconLabel icon={Phone}>Contact</IconLabel>}
                            value={
                                contact ? (
                                    <a href={`tel:${contact}`} className="break-all text-accent-700 hover:underline">
                                        {contact}
                                    </a>
                                ) : (
                                    "—"
                                )
                            }
                        />
                    </DetailList>
                </Panel>
            </div>

            <Panel title="Photos" icon={ImageIcon}>
                {photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {photos.map((src, i) => (
                            <a
                                key={`${src}-${i}`}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="block aspect-square overflow-hidden rounded-control border border-line bg-surface-muted transition hover:ring-2 hover:ring-accent-500"
                            >
                                <img src={src} alt={`Proposed photo ${i + 1}`} className="h-full w-full object-cover" />
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-ink-muted">No photos were sent with this request.</p>
                )}
            </Panel>

            <ConfirmDialog
                open={showApprove}
                title="Approve place request?"
                description={`“${application.proposed_title}” becomes a live place in the app.`}
                confirmLabel="Approve"
                onConfirm={() => approveMutation.mutate()}
                onCancel={() => setShowApprove(false)}
                isPending={approveMutation.isPending}
            />

            <ConfirmDialog
                open={showReject}
                title="Reject place request?"
                description={`The person who asked for “${application.proposed_title}” sees this reason.`}
                level="reason"
                reasonPlaceholder="e.g. This place already exists, or the location is wrong."
                reasonMinLength={3}
                reasonMaxLength={1000}
                confirmLabel="Reject"
                tone="danger"
                onConfirm={(reason) => rejectMutation.mutate(reason ?? "")}
                onCancel={() => setShowReject(false)}
                isPending={rejectMutation.isPending}
            />
        </div>
    );
}

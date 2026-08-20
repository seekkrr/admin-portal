import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { markersService } from "../services/markers.service";
import { ArrowLeft, Inbox, Check, X, AlertCircle, Globe, ExternalLink, Phone, Clock, IndianRupee, Image as ImageIcon, MapPin } from "lucide-react";
import { useAuthStore } from "@store/auth.store";
import { GeoMap } from "@/components/maps/GeoMap";
import { toast } from "sonner";
import { LoadingFallback } from "@components/LoadingFallback";
import { Card } from "@/components/ui/Card";

export function MarkerApplicationDetailPage() {
    const { appId: appIdParam } = useParams<{ appId: string }>();
    const appId = appIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const CAN_APPROVE = user?.role?.some((r) =>
        ["admin", "super_admin", "moderator"].includes(r)
    );

    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    const { data: application, isLoading, error } = useQuery({
        queryKey: ["marker-application-detail", appId],
        queryFn: () => markersService.getApplication(appId),
        enabled: !!appId,
        staleTime: 5 * 60 * 1000,
    });

    const approveMutation = useMutation({
        mutationFn: () => markersService.approveApplication(appId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-marker-applications"] });
            queryClient.invalidateQueries({ queryKey: ["admin-markers"] });
            toast.success("Application approved and marker created");
            navigate("/markers/applications", { replace: true });
        },
        onError: () => {
            toast.error("Failed to approve application");
            setShowApprove(false);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: () => markersService.rejectApplication(appId, rejectReason.trim() || undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-marker-applications"] });
            toast.success("Application rejected");
            navigate("/markers/applications", { replace: true });
        },
        onError: () => {
            toast.error("Failed to reject application");
            setShowReject(false);
        },
    });

    if (isLoading) return <LoadingFallback message="Loading application..." />;

    if (error || !application) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load application or it does not exist.</p>
                <Link to="/markers/applications" className="text-orange-600 hover:underline">
                    Back to Applications
                </Link>
            </div>
        );
    }

    const coords = application.proposed_location?.coordinates ?? null;
    
    // Attempt to extract photos from various possible fields
    const appMedia = (application as { media?: unknown[] }).media;
    const rawPhotos =
        (Array.isArray(application.photos) && application.photos.length > 0) ? application.photos :
        (Array.isArray(appMedia) && appMedia.length > 0) ? appMedia :
        (Array.isArray(application.additional_info?.media) && application.additional_info.media.length > 0) ? application.additional_info.media :
        (Array.isArray(application.additional_info?.photos) && application.additional_info.photos.length > 0) ? application.additional_info.photos : [];
    
    const photos = rawPhotos.filter(Boolean);
    const isPending = application.status === "pending" || application.status === "under_review";

    const additionalInfo = application.additional_info || {};
    const websiteUrl = typeof additionalInfo.website_url === 'string' ? additionalInfo.website_url : null;
    const contact = typeof additionalInfo.contact === 'string' ? additionalInfo.contact : null;
    const minExpense = additionalInfo.min_expense;
    const maxExpense = additionalInfo.max_expense;
    const opensAt = typeof additionalInfo.opens_at === 'string' ? additionalInfo.opens_at : null;
    const closesAt = typeof additionalInfo.closes_at === 'string' ? additionalInfo.closes_at : null;

    const hasExpense = (minExpense !== null && minExpense !== undefined) || (maxExpense !== null && maxExpense !== undefined);
    const expenseLabel = hasExpense ? `₹${minExpense ?? "?"} – ₹${maxExpense ?? "?"}` : null;

    const fmtTime = (iso: string | null): string => {
        if (!iso) return "?";
        const d = new Date(iso);
        return Number.isNaN(d.getTime())
            ? iso
            : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    };
    const hasHours = !!opensAt || !!closesAt;
    const hoursLabel = hasHours ? `${fmtTime(opensAt)} – ${fmtTime(closesAt)}` : null;

    const lat = coords ? coords[1] : null;
    const lon = coords ? coords[0] : null;
    const googleMapsUrl =
        lat !== null && lon !== null
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
            : null;

    const remainingAdditionalInfo = { ...additionalInfo };
    delete remainingAdditionalInfo.website_url;
    delete remainingAdditionalInfo.contact;
    delete remainingAdditionalInfo.map_url;
    delete remainingAdditionalInfo.min_expense;
    delete remainingAdditionalInfo.max_expense;
    delete remainingAdditionalInfo.opens_at;
    delete remainingAdditionalInfo.closes_at;
    delete remainingAdditionalInfo.tags; // remove tags to render specifically if needed
    delete remainingAdditionalInfo.media;
    delete remainingAdditionalInfo.photos;

    const tagsArray = Array.isArray(additionalInfo.tags) ? additionalInfo.tags : [];

    const inputClass = "w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all";

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <Link
                    to="/markers/applications"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                {CAN_APPROVE && isPending && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowReject(true)}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-red-600 bg-red-50 hover:bg-red-100"
                        >
                            <X className="w-4 h-4" />
                            Reject
                        </button>
                        <button
                            onClick={() => setShowApprove(true)}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-emerald-600 hover:bg-emerald-700"
                        >
                            <Check className="w-4 h-4" />
                            Approve
                        </button>
                    </div>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start gap-4">
                    <div className="bg-orange-100 text-orange-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                        <Inbox className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">{application.proposed_title}</h1>
                        <p className="text-neutral-500 mt-1 capitalize">
                            {(application.proposed_categories ?? []).join(", ") || "Uncategorized"} · {application.status.replace("_", " ")}
                        </p>
                    </div>
                </div>
            </Card>

            {coords && (
                <Card padding="sm" className="overflow-hidden">
                    <GeoMap
                        points={[{ coordinates: coords, label: application.proposed_title, color: "#ea580c" }]}
                        center={coords}
                        height="320px"
                        zoom={14}
                    />
                </Card>
            )}

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-orange-600" />
                        Media
                    </h3>
                </div>
                <div className="p-6">
                    {photos.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {photos.map((src, i) => (
                                <a
                                    key={i}
                                    href={src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 hover:ring-2 hover:ring-orange-500 transition"
                                >
                                    <img src={src} alt={`Proposed photo ${i + 1}`} className="w-full h-full object-cover" />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <span className="text-neutral-500">—</span>
                    )}
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Information & Links</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <div className="flex items-center gap-3 text-neutral-700">
                        <IndianRupee className="w-4 h-4 text-orange-600 shrink-0" />
                        <span className="font-medium text-neutral-500 w-28 shrink-0">Expense range</span>
                        <span className="text-neutral-800">{expenseLabel || "—"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-700">
                        <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                        <span className="font-medium text-neutral-500 w-28 shrink-0">Opening hours</span>
                        <span className="text-neutral-800">{hoursLabel || "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-orange-600 shrink-0" />
                        <span className="font-medium text-neutral-500 w-28 shrink-0">Website</span>
                        {websiteUrl ? (
                            <a
                                href={websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-600 hover:underline break-all inline-flex items-center gap-1.5"
                            >
                                {websiteUrl}
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            </a>
                        ) : (
                            <span className="text-neutral-800">—</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                        <span className="font-medium text-neutral-500 w-28 shrink-0">Maps</span>
                        {googleMapsUrl ? (
                            <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-600 hover:underline inline-flex items-center gap-1.5"
                            >
                                View on Google Maps (Lat/Long)
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            </a>
                        ) : (
                            <span className="text-neutral-800">—</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-orange-600 shrink-0" />
                        <span className="font-medium text-neutral-500 w-28 shrink-0">Contact</span>
                        {contact ? (
                            <a
                                href={`tel:${contact}`}
                                className="text-orange-600 hover:underline break-all"
                            >
                                {contact}
                            </a>
                        ) : (
                            <span className="text-neutral-800">—</span>
                        )}
                    </div>
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Proposed Details</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Address" value={application.proposed_address} />
                    <DetailRow label="Description" value={application.proposed_description} />
                    <DetailRow
                        label="Coordinates"
                        value={coords ? `${coords[0]}, ${coords[1]} (lon, lat)` : null}
                    />
                    <DetailRow label="Submitted by" value={application.user_id} />
                    <DetailRow
                        label="Submitted"
                        value={application.created_at ? new Date(application.created_at).toLocaleString() : null}
                    />
                    <DetailRow label="Tags" value={tagsArray.join(", ") || null} />
                    {application.status === "rejected" && (
                        <DetailRow label="Rejection reason" value={application.rejection_reason} />
                    )}
                    {Object.keys(remainingAdditionalInfo).length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="w-32 shrink-0 font-medium text-neutral-500">Additional Info</span>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(remainingAdditionalInfo).map(([k, v]) => (
                                    <span
                                        key={k}
                                        className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
                                    >
                                        <span className="font-medium text-neutral-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>



            {/* Approve modal */}
            {showApprove && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 text-emerald-600 mb-4">
                                <div className="bg-emerald-100 text-emerald-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                                    <Check className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-bold text-neutral-900">Approve Application</h3>
                            </div>
                            <p className="text-neutral-600">
                                Approving "{application.proposed_title}" will create a live marker. Continue?
                            </p>
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowApprove(false)}
                                    disabled={approveMutation.isPending}
                                    className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => approveMutation.mutate()}
                                    disabled={approveMutation.isPending}
                                    className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {approveMutation.isPending && (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    Approve
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject modal */}
            {showReject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 text-red-600 mb-4">
                                <div className="bg-red-100 text-red-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-bold text-neutral-900">Reject Application</h3>
                            </div>
                            <p className="text-neutral-600 mb-3">
                                Provide an optional reason for rejecting "{application.proposed_title}".
                            </p>
                            <textarea
                                rows={3}
                                placeholder="Rejection reason (optional)"
                                className={`${inputClass} resize-none focus:ring-red-500/20 focus:border-red-500`}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowReject(false)}
                                    disabled={rejectMutation.isPending}
                                    className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => rejectMutation.mutate()}
                                    disabled={rejectMutation.isPending}
                                    className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                                >
                                    {rejectMutation.isPending && (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="w-32 shrink-0 font-medium text-neutral-500">{label}</span>
            <span className="text-neutral-800 whitespace-pre-wrap break-all">{value || "—"}</span>
        </div>
    );
}

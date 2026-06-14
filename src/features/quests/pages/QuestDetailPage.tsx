import React, { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, RefreshCw, AlertTriangle, Map, Settings,
    DollarSign, Lightbulb, Trophy,
    MapPin, Layers, Compass, Trash2, History, UserCircle,
    Image as ImageIcon, Plus, Upload, X, Check, Pencil,
    ChevronDown, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { questsService } from "../services/quests.service";
import { QuestActionModal, type QuestActionType } from "../components/QuestActionModal";
import { ReviewHistory } from "../components/ReviewHistory";
import { config } from "@/config/env";
import { formatDuration } from "../utils/formatters";
import { ExploreMap } from "../components/explore/ExploreMap";
import type { CloudinaryAsset, UpdateQuestPayload } from "@/types";

// ---- RBAC ----
const ALLOWED_ROLES = ["admin", "super_admin", "moderator"] as const;
const CAN_DELETE_ROLES = ["admin", "super_admin"] as const;
const CAN_EDIT_ROLES = ["admin", "super_admin", "moderator"] as const;

// ---- Status styles ----
const STATUS_CONFIG: Record<string, { dot: string; bg: string }> = {
    Draft:               { dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" },
    "Under Review":      { dot: "bg-blue-500",    bg: "bg-blue-50 text-blue-700 border-blue-200" },
    "Changes Requested": { dot: "bg-orange-500",  bg: "bg-orange-50 text-orange-700 border-orange-200" },
    Approved:            { dot: "bg-indigo-500",  bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    Published:           { dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    Paused:              { dot: "bg-amber-500",   bg: "bg-amber-50 text-amber-700 border-amber-200" },
    Rejected:            { dot: "bg-rose-500",    bg: "bg-rose-50 text-rose-700 border-rose-200" },
    Archived:            { dot: "bg-red-500",     bg: "bg-red-50 text-red-700 border-red-200" },
};

// ---- Section wrapper ----
function Section({ title, icon, children }: {
    title: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                {icon}<span>{title}</span>
            </h3>
            {children}
        </div>
    );
}

// ---- Static info row ----
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2 text-sm">
            <span className="text-neutral-400 font-medium w-32 flex-shrink-0">{label}</span>
            <span className="text-neutral-700">{value ?? <span className="text-neutral-400 italic">—</span>}</span>
        </div>
    );
}

// ---- Inline-editable row ----
function EditableRow({
    label, value, fieldKey, editingField, editValue, canEdit,
    onStart, onChange, onSave, onCancel, inputType = "text",
}: {
    label: string; value: React.ReactNode; fieldKey: string;
    editingField: string | null; editValue: string; canEdit: boolean;
    onStart: () => void; onChange: (v: string) => void;
    onSave: () => void; onCancel: () => void;
    inputType?: "text" | "number";
}) {
    if (editingField === fieldKey) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <span className="text-neutral-400 font-medium w-32 flex-shrink-0">{label}</span>
                <input
                    type={inputType}
                    value={editValue}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus
                    className="flex-1 bg-neutral-50 rounded-lg border border-neutral-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onSave();
                        if (e.key === "Escape") onCancel();
                    }}
                />
                <button onClick={onSave} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                    <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={onCancel} className="p-1 text-red-500 hover:bg-red-50 rounded">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }
    return (
        <div
            className={`flex items-start gap-2 text-sm group/row ${canEdit ? "cursor-pointer hover:bg-neutral-50 rounded-lg px-1 -mx-1 py-0.5 transition-colors" : ""}`}
            onClick={canEdit ? onStart : undefined}
        >
            <span className="text-neutral-400 font-medium w-32 flex-shrink-0">{label}</span>
            <span className="text-neutral-700 flex-1">{value ?? <span className="text-neutral-400 italic">—</span>}</span>
            {canEdit && <Pencil className="w-3 h-3 text-neutral-300 group-hover/row:text-violet-500 flex-shrink-0 mt-0.5 transition-colors" />}
        </div>
    );
}

// ---- Main Component ----
export function QuestDetailPage() {
    const { questId = "" } = useParams<{ questId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuthStore();

    const hasAccess = !!currentUser?.role?.some((r: string) => (ALLOWED_ROLES as readonly string[]).includes(r));
    const canDelete = !!currentUser?.role?.some((r: string) => (CAN_DELETE_ROLES as readonly string[]).includes(r));
    const canEdit = !!currentUser?.role?.some((r: string) => (CAN_EDIT_ROLES as readonly string[]).includes(r));
    const canApprove = canEdit;

    // ---- Local state ----
    const [activeTab, setActiveTab] = useState<"manage" | "explore">("manage");
    const [actionModal, setActionModal] = useState<{ action: QuestActionType } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [markersExpanded, setMarkersExpanded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (!deleteConfirm) setHardDelete(false); }, [deleteConfirm]);

    // ---- Queries ----
    const { data: quest, isLoading, error } = useQuery({
        queryKey: ["quest-detail", questId],
        queryFn: () => questsService.getQuestDetail(questId),
        enabled: !!questId,
    });

    const { data: reviewRecord } = useQuery({
        queryKey: ["quest-review-history", questId],
        queryFn: () => questsService.getReviewHistory(questId),
        enabled: !!questId && canApprove,
        retry: false,
    });

    // ---- Invalidation helper ----
    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
        queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
        queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
    }, [queryClient, questId]);

    // ---- Mutations ----
    const approveMutation = useMutation({
        mutationFn: () => questsService.approve(questId),
        onSuccess: () => { toast.success("Quest approved and published"); invalidate(); setActionModal(null); },
        onError: (e: Error) => { toast.error(e.message); setActionModal(null); },
    });

    const requestChangesMutation = useMutation({
        mutationFn: (comment: string) => questsService.requestChanges(questId, comment),
        onSuccess: () => {
            toast.success("Changes requested");
            invalidate();
            queryClient.invalidateQueries({ queryKey: ["quest-review-history", questId] });
            setActionModal(null);
        },
        onError: (e: Error) => { toast.error(e.message); setActionModal(null); },
    });

    const rejectMutation = useMutation({
        mutationFn: (reason: string) => questsService.reject(questId, reason),
        onSuccess: () => {
            toast.success("Quest rejected");
            invalidate();
            queryClient.invalidateQueries({ queryKey: ["quest-review-history", questId] });
            setActionModal(null);
        },
        onError: (e: Error) => { toast.error(e.message); setActionModal(null); },
    });

    const pauseMutation = useMutation({
        mutationFn: () => questsService.pause(questId),
        onSuccess: () => { toast.success("Quest paused"); invalidate(); setActionModal(null); },
        onError: (e: Error) => { toast.error(e.message); setActionModal(null); },
    });

    const unpauseMutation = useMutation({
        mutationFn: () => questsService.unpause(questId),
        onSuccess: () => { toast.success("Quest unpaused"); invalidate(); setActionModal(null); },
        onError: (e: Error) => { toast.error(e.message); setActionModal(null); },
    });

    const updateMutation = useMutation({
        mutationFn: (payload: UpdateQuestPayload) => questsService.updateQuest(questId, payload),
        onSuccess: () => {
            toast.success("Quest updated");
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
            setEditingField(null);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const deleteMutation = useMutation({
        mutationFn: () => questsService.deleteQuest(questId, hardDelete),
        onSuccess: () => {
            toast.success("Quest deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            navigate("/quests");
        },
        onError: (e: Error) => { toast.error(e.message); setDeleteConfirm(false); },
    });

    // ---- Action handler ----
    const handleActionConfirm = useCallback((text: string) => {
        if (!actionModal) return;
        switch (actionModal.action) {
            case "approve": approveMutation.mutate(); break;
            case "requestChanges": requestChangesMutation.mutate(text); break;
            case "reject": rejectMutation.mutate(text); break;
            case "pause": pauseMutation.mutate(); break;
            case "unpause": unpauseMutation.mutate(); break;
        }
    }, [actionModal, approveMutation, requestChangesMutation, rejectMutation, pauseMutation, unpauseMutation]);

    const isActionPending = approveMutation.isPending || requestChangesMutation.isPending ||
        rejectMutation.isPending || pauseMutation.isPending || unpauseMutation.isPending;

    // ---- Inline edit helpers ----
    const startEdit = (field: string, value: string | number) => {
        if (!canEdit) return;
        setEditingField(field);
        setEditValue(String(value ?? ""));
    };
    const cancelEdit = () => { setEditingField(null); setEditValue(""); };

    // ---- Media upload ----
    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !quest) return;
        setUploadingMedia(true);
        const current = [...(quest.cloudinary_assets ?? [])];
        try {
            const results = await Promise.all(Array.from(files).map(async (file) => {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("upload_preset", config.cloudinary.uploadPreset);
                const res = await fetch(config.cloudinary.uploadUrl, { method: "POST", body: fd });
                if (!res.ok) throw new Error(`Upload failed: ${file.name}`);
                return res.json() as Promise<{ public_id: string; secure_url: string; resource_type?: string; format?: string }>;
            }));
            const uploaded: CloudinaryAsset[] = results.map((r) => ({
                public_id: r.public_id, secure_url: r.secure_url,
                resource_type: r.resource_type ?? "image", format: r.format ?? "", alt_text: "",
            }));
            await questsService.updateQuest(questId, { cloudinary_assets: [...current, ...uploaded] });
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
            toast.success(`${files.length} file(s) uploaded`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingMedia(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleMediaRemove = async (publicId: string) => {
        if (!quest) return;
        const updated = quest.cloudinary_assets.filter((a: CloudinaryAsset) => a.public_id !== publicId);
        try {
            await questsService.updateQuest(questId, { cloudinary_assets: updated });
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
            toast.success("Media removed");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Remove failed");
        }
    };

    // ---- Guards ----
    if (!hasAccess) return <AccessDenied message="Only admins and moderators can manage quests." />;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-violet-600 animate-spin" />
            </div>
        );
    }

    if (error || !quest) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertTriangle className="w-10 h-10 text-red-400" />
                <p className="text-red-500 text-sm">Failed to load quest</p>
                <button onClick={() => navigate("/quests")} className="text-violet-600 text-sm hover:underline">
                    Back to Quests
                </button>
            </div>
        );
    }

    const sc = STATUS_CONFIG[quest.status] ?? { dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200" };

    // Available action buttons based on current status
    const showApprove = canApprove && quest.status === "Under Review";
    const showRequestChanges = canApprove && quest.status === "Under Review";
    const showReject = canApprove && (quest.status === "Under Review" || quest.status === "Changes Requested");
    const showPause = canApprove && quest.status === "Published";
    const showUnpause = canApprove && quest.status === "Paused";

    return (
        <div className="animate-fade-in mx-auto max-w-5xl space-y-4 pb-10">
            {/* Header */}
            <div className="flex items-center gap-4 flex-wrap">
                <button
                    onClick={() => navigate("/quests")}
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-neutral-900 truncate">
                        {quest.title || "Untitled Quest"}
                    </h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {quest.status}
                        </span>
                        <span className="text-sm text-neutral-400">ID: …{quest.id.slice(-8)}</span>
                        <span className="text-sm text-neutral-400">·</span>
                        <span className="text-sm text-neutral-400">{quest.total_markers} markers</span>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                    {showApprove && (
                        <button
                            onClick={() => setActionModal({ action: "approve" })}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                            Approve
                        </button>
                    )}
                    {showRequestChanges && (
                        <button
                            onClick={() => setActionModal({ action: "requestChanges" })}
                            className="px-4 py-2 rounded-xl bg-orange-100 text-orange-700 border border-orange-200 text-sm font-medium hover:bg-orange-200 transition-colors"
                        >
                            Request Changes
                        </button>
                    )}
                    {showReject && (
                        <button
                            onClick={() => setActionModal({ action: "reject" })}
                            className="px-4 py-2 rounded-xl bg-red-100 text-red-700 border border-red-200 text-sm font-medium hover:bg-red-200 transition-colors"
                        >
                            Reject
                        </button>
                    )}
                    {showPause && (
                        <button
                            onClick={() => setActionModal({ action: "pause" })}
                            className="px-4 py-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 text-sm font-medium hover:bg-amber-200 transition-colors"
                        >
                            Pause
                        </button>
                    )}
                    {showUnpause && (
                        <button
                            onClick={() => setActionModal({ action: "unpause" })}
                            className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-200 transition-colors"
                        >
                            Unpause
                        </button>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setActiveTab("manage")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "manage" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                >
                    <Settings className="w-4 h-4" /> Manage
                </button>
                <button
                    onClick={() => setActiveTab("explore")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "explore" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                >
                    <Map className="w-4 h-4" /> Explore Map
                </button>
            </div>

            {/* ── MANAGE TAB ── */}
            {activeTab === "manage" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Quest Info */}
                        <Section title="Quest Info" icon={<Compass className="w-4 h-4" />}>
                            <div className="space-y-3">
                                <EditableRow
                                    label="Title" value={quest.title} fieldKey="title"
                                    editingField={editingField} editValue={editValue} canEdit={canEdit}
                                    onStart={() => startEdit("title", quest.title ?? "")}
                                    onChange={setEditValue}
                                    onSave={() => updateMutation.mutate({ title: editValue })}
                                    onCancel={cancelEdit}
                                />
                                {/* Description (multi-line edit) */}
                                <div className="text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-neutral-400 font-medium text-sm">Description</span>
                                        {canEdit && editingField !== "description" && (
                                            <button
                                                onClick={() => startEdit("description", quest.description ?? "")}
                                                className="text-neutral-300 hover:text-violet-500 transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {editingField === "description" ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                rows={4}
                                                className="w-full text-sm bg-neutral-50 rounded-lg border border-neutral-200 p-3 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-y"
                                                autoFocus
                                            />
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => updateMutation.mutate({ description: editValue })}
                                                    className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 flex items-center gap-1"
                                                >
                                                    <Check className="w-3 h-3" /> Save
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 text-xs font-medium flex items-center gap-1"
                                                >
                                                    <X className="w-3 h-3" /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-neutral-700 text-sm leading-relaxed line-clamp-4">
                                            {quest.description || <span className="text-neutral-400 italic">No description</span>}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1 pt-1 border-t border-neutral-100">
                                    <EditableRow
                                        label="Price (₹)" value={quest.price > 0 ? `₹${quest.price.toLocaleString("en-IN")}` : "Free"}
                                        fieldKey="price" editingField={editingField} editValue={editValue} canEdit={canEdit}
                                        onStart={() => startEdit("price", quest.price)}
                                        onChange={setEditValue}
                                        onSave={() => updateMutation.mutate({ price: Number(editValue) })}
                                        onCancel={cancelEdit} inputType="number"
                                    />
                                    <EditableRow
                                        label="Points" value={quest.points}
                                        fieldKey="points" editingField={editingField} editValue={editValue} canEdit={canEdit}
                                        onStart={() => startEdit("points", quest.points ?? 0)}
                                        onChange={setEditValue}
                                        onSave={() => updateMutation.mutate({ points: Number(editValue) })}
                                        onCancel={cancelEdit} inputType="number"
                                    />
                                    <EditableRow
                                        label="Duration (min)" value={quest.duration_minutes ? `${quest.duration_minutes} min` : null}
                                        fieldKey="duration_minutes" editingField={editingField} editValue={editValue} canEdit={canEdit}
                                        onStart={() => startEdit("duration_minutes", quest.duration_minutes ?? 0)}
                                        onChange={setEditValue}
                                        onSave={() => updateMutation.mutate({ duration_minutes: Number(editValue) })}
                                        onCancel={cancelEdit} inputType="number"
                                    />
                                    <EditableRow
                                        label="Hints" value={quest.hints_allowed}
                                        fieldKey="hints_allowed" editingField={editingField} editValue={editValue} canEdit={canEdit}
                                        onStart={() => startEdit("hints_allowed", quest.hints_allowed ?? 0)}
                                        onChange={setEditValue}
                                        onSave={() => updateMutation.mutate({ hints_allowed: Number(editValue) })}
                                        onCancel={cancelEdit} inputType="number"
                                    />
                                    <InfoRow label="Difficulty" value={quest.difficulty ? quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1) : null} />
                                    <InfoRow label="Theme" value={(quest.theme ?? []).join(", ") || null} />
                                    <InfoRow label="Views" value={quest.view_count?.toLocaleString()} />
                                    <InfoRow label="Rating" value={quest.average_rating ? `${quest.average_rating.toFixed(1)} ⭐` : null} />
                                    <InfoRow label="Completions" value={quest.completion_count} />
                                    <InfoRow label="Duration" value={quest.duration_minutes ? formatDuration(quest.duration_minutes) : null} />
                                </div>
                            </div>
                        </Section>

                        {/* Right column */}
                        <div className="space-y-4">
                            {/* Region */}
                            <Section title="Region" icon={<MapPin className="w-4 h-4" />}>
                                <div className="space-y-2">
                                    <InfoRow label="Name" value={
                                        quest.region_summary?.id ? (
                                            <Link to={`/regions/${quest.region_summary.id}`} className="text-violet-600 hover:underline">
                                                {quest.region_summary.name}
                                            </Link>
                                        ) : quest.region_summary?.name
                                    } />
                                    <InfoRow label="Crowd meter" value={
                                        quest.region_summary?.crowd_meter
                                            ? Object.entries(quest.region_summary.crowd_meter)
                                                .sort((a, b) => b[0].localeCompare(a[0]))
                                                .slice(0, 3)
                                                .map(([m, v]) => `${m}: ${v}`)
                                                .join(" · ")
                                            : null
                                    } />
                                </div>
                            </Section>

                            {/* Creator */}
                            <Section title="Creator" icon={<UserCircle className="w-4 h-4" />}>
                                {quest.creator_summary?.id ? (
                                    <div className="flex items-center gap-3">
                                        {quest.creator_summary.avatar_url ? (
                                            <img
                                                src={quest.creator_summary.avatar_url}
                                                alt=""
                                                className="w-10 h-10 rounded-full object-cover border border-neutral-200"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                                                <UserCircle className="w-5 h-5 text-violet-500" />
                                            </div>
                                        )}
                                        <div>
                                            <Link
                                                to={`/creators/${quest.creator_summary.id}`}
                                                className="text-sm font-medium text-violet-600 hover:underline"
                                            >
                                                {quest.creator_summary.name || "Unknown"}
                                            </Link>
                                            {quest.creator_summary.tagline && (
                                                <p className="text-xs text-neutral-500 mt-0.5">{quest.creator_summary.tagline}</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-neutral-400 italic">Creator info unavailable</p>
                                )}
                            </Section>

                            {/* Linked Achievement */}
                            {quest.linked_achievement && (
                                <Section title="Linked Achievement" icon={<Trophy className="w-4 h-4" />}>
                                    <div className="flex items-center gap-3">
                                        {quest.linked_achievement.icon_url && (
                                            <img
                                                src={quest.linked_achievement.icon_url}
                                                alt=""
                                                className="w-8 h-8 rounded-lg object-cover"
                                            />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-neutral-800">{quest.linked_achievement.name}</p>
                                            {quest.linked_achievement.xp_reward && (
                                                <p className="text-xs text-amber-600 mt-0.5">+{quest.linked_achievement.xp_reward} XP</p>
                                            )}
                                        </div>
                                    </div>
                                </Section>
                            )}

                            {/* Pricing details */}
                            {(quest.min_expense !== null || quest.max_expense !== null) && (
                                <Section title="Estimated Expense" icon={<DollarSign className="w-4 h-4" />}>
                                    <div className="space-y-1">
                                        <InfoRow label="Min" value={quest.min_expense !== null ? `₹${quest.min_expense}` : null} />
                                        <InfoRow label="Max" value={quest.max_expense !== null ? `₹${quest.max_expense}` : null} />
                                    </div>
                                </Section>
                            )}

                            {/* Best months */}
                            {(quest.best_month_start || quest.best_month_end) && (
                                <Section title="Best Time to Visit" icon={<Clock className="w-4 h-4" />}>
                                    <InfoRow
                                        label="Season"
                                        value={[quest.best_month_start, quest.best_month_end].filter(Boolean).join(" → ")}
                                    />
                                </Section>
                            )}
                        </div>
                    </div>

                    {/* Markers playlist */}
                    <Section title={`Markers (${quest.total_markers})`} icon={<Layers className="w-4 h-4" />}>
                        {quest.marker_summaries.length === 0 ? (
                            <p className="text-sm text-neutral-400 italic">No markers in playlist</p>
                        ) : (
                            <div className="space-y-2">
                                {(markersExpanded ? quest.marker_summaries : quest.marker_summaries.slice(0, 5))
                                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                    .map((m, i) => (
                                        <div
                                            key={m.marker_id}
                                            className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100"
                                        >
                                            <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                                {m.order ?? i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <Link
                                                    to={`/markers/${m.marker_id}`}
                                                    className="text-sm font-medium text-neutral-800 hover:text-violet-600 transition-colors truncate block"
                                                >
                                                    {m.name || "Unnamed marker"}
                                                </Link>
                                                <p className="text-xs text-neutral-400 mt-0.5">
                                                    {m.category && <span>{m.category} · </span>}
                                                    {m.is_required ? "Required" : "Optional"}
                                                    {m.tags.length > 0 && ` · ${m.tags.slice(0, 3).join(", ")}`}
                                                </p>
                                            </div>
                                            {m.images[0]?.secure_url && (
                                                <img
                                                    src={m.images[0].secure_url}
                                                    alt=""
                                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-neutral-200"
                                                />
                                            )}
                                        </div>
                                    ))}
                                {quest.marker_summaries.length > 5 && (
                                    <button
                                        onClick={() => setMarkersExpanded(!markersExpanded)}
                                        className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 transition-colors mt-1"
                                    >
                                        <ChevronDown className={`w-4 h-4 transition-transform ${markersExpanded ? "rotate-180" : ""}`} />
                                        {markersExpanded ? "Show less" : `Show ${quest.marker_summaries.length - 5} more`}
                                    </button>
                                )}
                            </div>
                        )}
                    </Section>

                    {/* Keywords */}
                    {quest.keywords && quest.keywords.length > 0 && (
                        <Section title="Keywords" icon={<Lightbulb className="w-4 h-4" />}>
                            <div className="flex flex-wrap gap-1.5">
                                {quest.keywords.map((kw) => (
                                    <span key={kw} className="px-2.5 py-1 rounded-full text-xs bg-neutral-100 text-neutral-600 border border-neutral-200">
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Media Gallery */}
                    <Section title={`Media (${quest.cloudinary_assets.length})`} icon={<ImageIcon className="w-4 h-4" />}>
                        <div className="space-y-4">
                            {quest.cloudinary_assets.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                    {quest.cloudinary_assets.map((asset: CloudinaryAsset) => (
                                        <div key={asset.public_id} className="group relative rounded-xl overflow-hidden border border-neutral-200 aspect-square">
                                            <button onClick={() => setLightboxUrl(asset.secure_url)} className="w-full h-full">
                                                <img
                                                    src={asset.secure_url}
                                                    alt={asset.alt_text || ""}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            </button>
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleMediaRemove(asset.public_id)}
                                                    className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-neutral-400 italic">No media uploaded yet</p>
                            )}
                            {canEdit && (
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleMediaUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingMedia}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 text-neutral-600 text-sm font-medium hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 transition-all disabled:opacity-50"
                                    >
                                        {uploadingMedia ? (
                                            <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                                        ) : (
                                            <><Plus className="w-4 h-4" /><Upload className="w-4 h-4" /> Add Media</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* Review History */}
                    {canApprove && (
                        <Section title="Review History" icon={<History className="w-4 h-4" />}>
                            <ReviewHistory entries={reviewRecord?.review_history ?? []} />
                        </Section>
                    )}

                    {/* Danger Zone */}
                    {canDelete && (
                        <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                            <h3 className="text-base font-bold text-red-700 flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5" /> Danger Zone
                            </h3>
                            <p className="text-sm text-red-600 mb-4">
                                Deleting removes this quest. Hard delete is permanent and irreversible.
                            </p>
                            <button
                                onClick={() => setDeleteConfirm(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Delete Quest
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "explore" && (
                <ExploreMap questId={questId} detail={quest} />
            )}

            {/* ── Modals ── */}
            <QuestActionModal
                open={!!actionModal}
                action={actionModal?.action ?? null}
                questTitle={quest.title ?? "Quest"}
                isPending={isActionPending}
                onConfirm={handleActionConfirm}
                onCancel={() => setActionModal(null)}
            />

            <ConfirmModal
                open={deleteConfirm}
                title="Delete Quest"
                message={`This will ${hardDelete ? "PERMANENTLY" : "soft"}-delete "${quest.title ?? "this quest"}".`}
                confirmLabel={hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => setDeleteConfirm(false)}
                isPending={deleteMutation.isPending}
            >
                <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={hardDelete}
                        onChange={(e) => setHardDelete(e.target.checked)}
                        className="w-4 h-4 rounded border-red-300 accent-red-600"
                    />
                    <span className="text-xs text-red-600 font-medium">Hard delete (permanent, irreversible)</span>
                </label>
            </ConfirmModal>

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        onClick={() => setLightboxUrl(null)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt=""
                        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

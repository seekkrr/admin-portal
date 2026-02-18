import React, { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, RefreshCw, AlertTriangle,
    Clock, MapPin, Eye, Tag, Star, Layers,
    Compass, Hash, Lightbulb, Trophy,
    DollarSign, Trash2, Image as ImageIcon, UserCircle,
    Pencil, Check, X, Upload, Plus, Navigation,
} from "lucide-react";
import type { QuestDifficulty, QuestTheme } from "@/types";

const DIFFICULTY_OPTIONS: QuestDifficulty[] = ["Easy", "Medium", "Hard", "Expert"];
const THEME_OPTIONS: QuestTheme[] = ["Adventure", "Romance", "Culture", "Food", "History", "Nature", "Custom"];
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { questsService } from "../services/quests.service";
import { formatDuration, isValidObjectId } from "../utils/formatters";
import { ConfirmModal } from "@/features/users/components/ConfirmModal";

import { QuestRouteMap } from "../components/QuestRouteMap";
import { config } from "@/config/env";
import type { QuestStatus, CloudinaryAsset } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];
const CAN_EDIT_ROLES = ["admin", "super_admin", "moderator"];

// ---- Status Styles ----
const questStatusConfig: Record<string, { label: string; dot: string; bg: string; active: string }> = {
    Draft: { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200", active: "bg-neutral-600 text-white border-neutral-600" },
    Published: { label: "Published", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", active: "bg-emerald-600 text-white border-emerald-600" },
    Paused: { label: "Paused", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200", active: "bg-amber-500 text-white border-amber-500" },
    Archived: { label: "Archived", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200", active: "bg-red-600 text-white border-red-600" },
};

// ---- Confirm action type ----
type ConfirmAction =
    | { type: "delete" }
    | { type: "status-change"; payload: { status: QuestStatus } };

// ---- Component ----
export function QuestDetailPage() {
    const { questId } = useParams<{ questId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuthStore();

    const hasAccess = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);
    const canDelete = !!currentUser && CAN_DELETE_ROLES.includes(currentUser.role);
    const canEdit = !!currentUser && CAN_EDIT_ROLES.includes(currentUser.role);
    const validQuestId = isValidObjectId(questId);

    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [hardDelete, setHardDelete] = useState(false);
    const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

    // Inline editing state
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    // Reset hard delete on modal close
    useEffect(() => { if (!confirmAction) setHardDelete(false); }, [confirmAction]);

    // ---- Fetch ----
    const { data, isLoading, error } = useQuery({
        queryKey: ["quest-detail", questId],
        queryFn: () => questsService.getQuestDetail(questId!),
        enabled: !!questId && validQuestId,
    });

    // ---- Mutations ----
    const statusMutation = useMutation({
        mutationFn: (status: QuestStatus) => questsService.updateQuestStatus(questId!, status),
        onSuccess: () => {
            toast.success("Quest status updated");
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            setConfirmAction(null);
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    const deleteMutation = useMutation({
        mutationFn: (hard: boolean) => questsService.deleteQuest(questId!, hard),
        onSuccess: () => {
            toast.success("Quest deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            navigate("/quests");
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    const questUpdateMutation = useMutation({
        mutationFn: (payload: Record<string, unknown>) => questsService.updateQuest(questId!, payload),
        onSuccess: () => {
            toast.success("Quest updated");
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
            setEditingField(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    const stepUpdateMutation = useMutation({
        mutationFn: ({ stepId, data: payload }: { stepId: string; data: Record<string, unknown> }) =>
            questsService.updateStep(stepId, payload),
        onSuccess: () => {
            toast.success("Step updated");
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
            setEditingField(null);
        },
        onError: (err: Error) => toast.error(err.message),
    });

    // ---- Confirm handler ----
    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        switch (confirmAction.type) {
            case "delete":
                deleteMutation.mutate(hardDelete);
                break;
            case "status-change":
                statusMutation.mutate(confirmAction.payload.status);
                break;
        }
    }, [confirmAction, deleteMutation, statusMutation, hardDelete]);

    const toggleStep = (stepId: string) => {
        setExpandedSteps(prev => {
            const next = new Set(prev);
            if (next.has(stepId)) next.delete(stepId);
            else next.add(stepId);
            return next;
        });
    };

    // ---- Inline edit helpers ----
    const startEdit = (field: string, currentValue: string | number) => {
        if (!canEdit) return;
        setEditingField(field);
        setEditValue(String(currentValue));
    };

    const cancelEdit = () => {
        setEditingField(null);
        setEditValue("");
    };

    const saveQuestField = (field: string, value: string | number) => {
        questUpdateMutation.mutate({ [field]: value });
    };

    const saveMetadataField = (field: string, value: unknown) => {
        questUpdateMutation.mutate({ metadata: { [field]: value } });
    };

    const saveStepField = (stepId: string, field: string, value: string) => {
        stepUpdateMutation.mutate({ stepId, data: { [field]: value } });
    };

    // ---- Cloudinary upload ----
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleMediaUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !data) return;

        setUploadingMedia(true);
        const currentAssets = data.media?.cloudinary_assets ?? [];
        const newAssets: CloudinaryAsset[] = [...currentAssets];

        try {
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", config.cloudinary.uploadPreset);

                const res = await fetch(config.cloudinary.uploadUrl, {
                    method: "POST",
                    body: formData,
                });
                if (!res.ok) throw new Error("Upload failed");
                const result = await res.json();
                newAssets.push({
                    public_id: result.public_id,
                    secure_url: result.secure_url,
                    resource_type: result.resource_type ?? "image",
                    format: result.format ?? "",
                    alt_text: "",
                });
            }

            await questsService.updateQuest(questId!, {
                media: { cloudinary_assets: newAssets },
            });
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
        if (!data?.media) return;
        const updated = data.media.cloudinary_assets.filter(
            (a) => a.public_id !== publicId
        );
        try {
            await questsService.updateQuest(questId!, {
                media: { cloudinary_assets: updated },
            });
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

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertTriangle className="w-10 h-10 text-red-400" />
                <p className="text-red-500 text-sm">Failed to load quest</p>
                <button onClick={() => navigate("/quests")} className="text-violet-600 text-sm hover:underline">Back to Quests</button>
            </div>
        );
    }

    const { quest, metadata, location, media, steps, creator } = data;
    const currentStatus = quest.status;
    const defaultStatus = { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200", active: "bg-neutral-600 text-white border-neutral-600" };
    const sc = questStatusConfig[currentStatus] ?? defaultStatus;

    return (
        <div className="p-6 max-w-[1100px] mx-auto space-y-6 animate-fade-in">
            {/* Back Button + Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate("/quests")}
                    className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    {/* Editable Quest Name */}
                    {editingField === "metadata-title" ? (
                        <div className="flex items-center gap-2">
                            <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="text-2xl font-bold text-neutral-900 bg-neutral-50 rounded-lg border border-neutral-200 px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-violet-200"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") saveMetadataField("title", editValue);
                                    if (e.key === "Escape") cancelEdit();
                                }}
                            />
                            <button onClick={() => saveMetadataField("title", editValue)} className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600"><Check className="w-4 h-4" /></button>
                            <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-red-50 text-red-500"><X className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <h1
                            className={`text-2xl font-bold text-neutral-900 truncate flex items-center gap-2 group/name ${canEdit ? "cursor-pointer" : ""}`}
                            onClick={() => canEdit && startEdit("metadata-title", metadata?.title || quest.quest_title || "")}
                        >
                            {metadata?.title || quest.quest_title || "Untitled Quest"}
                            {canEdit && <Pencil className="w-4 h-4 text-neutral-300 group-hover/name:text-violet-500 transition-colors flex-shrink-0" />}
                        </h1>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                        </span>
                        <span className="text-sm text-neutral-400">ID: {quest._id.slice(-8)}</span>
                    </div>
                </div>
            </div>

            {/* Overview Grid (Stat Cards) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                {/* Editable Price */}
                {editingField === "price" ? (
                    <div className="bg-white rounded-2xl border border-violet-300 shadow-sm p-4 text-center ring-2 ring-violet-200">
                        <div className="flex items-center justify-center mb-2"><DollarSign className="w-4 h-4 text-emerald-500" /></div>
                        <input
                            type="number"
                            min={0}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full text-center text-lg font-bold text-neutral-900 bg-neutral-50 rounded-lg border border-neutral-200 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") saveQuestField("price", Number(editValue));
                                if (e.key === "Escape") cancelEdit();
                            }}
                        />
                        <div className="flex items-center justify-center gap-1 mt-2">
                            <button onClick={() => saveQuestField("price", Number(editValue))} className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-red-50 text-red-500"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => canEdit && startEdit("price", quest.price)}
                        className={`bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center group transition-all ${canEdit ? "hover:border-violet-300 hover:shadow-md cursor-pointer" : ""}`}
                    >
                        <div className="flex items-center justify-center mb-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            {canEdit && <Pencil className="w-3 h-3 text-neutral-300 group-hover:text-violet-500 ml-1 transition-colors" />}
                        </div>
                        <div className="text-xl font-bold text-neutral-900">{quest.price > 0 ? `₹${quest.price.toLocaleString("en-IN")}` : "Free"}</div>
                        <div className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1">Price</div>
                    </button>
                )}

                {/* Editable Duration */}
                {editingField === "metadata-duration" ? (
                    <div className="bg-white rounded-2xl border border-violet-300 shadow-sm p-4 text-center ring-2 ring-violet-200">
                        <div className="flex items-center justify-center mb-2"><Clock className="w-4 h-4 text-blue-500" /></div>
                        <input
                            type="number"
                            min={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full text-center text-lg font-bold text-neutral-900 bg-neutral-50 rounded-lg border border-neutral-200 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") saveMetadataField("duration_minutes", Number(editValue));
                                if (e.key === "Escape") cancelEdit();
                            }}
                        />
                        <div className="text-[10px] text-neutral-400 mt-1">minutes</div>
                        <div className="flex items-center justify-center gap-1 mt-1">
                            <button onClick={() => saveMetadataField("duration_minutes", Number(editValue))} className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-red-50 text-red-500"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => canEdit && startEdit("metadata-duration", metadata?.duration_minutes ?? 0)}
                        className={`bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center group transition-all ${canEdit ? "hover:border-violet-300 hover:shadow-md cursor-pointer" : ""}`}
                    >
                        <div className="flex items-center justify-center mb-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            {canEdit && <Pencil className="w-3 h-3 text-neutral-300 group-hover:text-violet-500 ml-1 transition-colors" />}
                        </div>
                        <div className="text-xl font-bold text-neutral-900">{formatDuration(metadata?.duration_minutes)}</div>
                        <div className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1">Duration</div>
                    </button>
                )}

                {/* Editable Difficulty */}
                {editingField === "metadata-difficulty" ? (
                    <div className="bg-white rounded-2xl border border-violet-300 shadow-sm p-4 text-center ring-2 ring-violet-200">
                        <div className="flex items-center justify-center mb-2"><Star className="w-4 h-4 text-amber-500" /></div>
                        <select
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); saveMetadataField("difficulty", e.target.value); }}
                            className="w-full text-center text-sm font-bold text-neutral-900 bg-neutral-50 rounded-lg border border-neutral-200 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-200 cursor-pointer"
                            autoFocus
                        >
                            {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-red-50 text-red-500 mt-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                ) : (
                    <button
                        onClick={() => canEdit && startEdit("metadata-difficulty", metadata?.difficulty ?? "Easy")}
                        className={`bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center group transition-all ${canEdit ? "hover:border-violet-300 hover:shadow-md cursor-pointer" : ""}`}
                    >
                        <div className="flex items-center justify-center mb-2">
                            <Star className="w-4 h-4 text-amber-500" />
                            {canEdit && <Pencil className="w-3 h-3 text-neutral-300 group-hover:text-violet-500 ml-1 transition-colors" />}
                        </div>
                        <div className="text-xl font-bold text-neutral-900">{metadata?.difficulty ?? "—"}</div>
                        <div className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1">Difficulty</div>
                    </button>
                )}

                {/* Editable Theme */}
                {editingField === "metadata-theme" ? (
                    <div className="bg-white rounded-2xl border border-violet-300 shadow-sm p-4 text-center ring-2 ring-violet-200">
                        <div className="flex items-center justify-center mb-2"><Tag className="w-4 h-4 text-violet-500" /></div>
                        <select
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); saveMetadataField("theme", e.target.value); }}
                            className="w-full text-center text-sm font-bold text-neutral-900 bg-neutral-50 rounded-lg border border-neutral-200 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-200 cursor-pointer"
                            autoFocus
                        >
                            {THEME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-red-50 text-red-500 mt-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                ) : (
                    <button
                        onClick={() => canEdit && startEdit("metadata-theme", metadata?.theme ?? "Adventure")}
                        className={`bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center group transition-all ${canEdit ? "hover:border-violet-300 hover:shadow-md cursor-pointer" : ""}`}
                    >
                        <div className="flex items-center justify-center mb-2">
                            <Tag className="w-4 h-4 text-violet-500" />
                            {canEdit && <Pencil className="w-3 h-3 text-neutral-300 group-hover:text-violet-500 ml-1 transition-colors" />}
                        </div>
                        <div className="text-xl font-bold text-neutral-900">{metadata?.theme ?? "—"}</div>
                        <div className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1">Theme</div>
                    </button>
                )}
            </div>

            {/* Status Management */}
            <Section title="Status Management" icon={<Compass className="w-4 h-4" />}>
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(questStatusConfig) as QuestStatus[]).map((status) => {
                        const sConf = questStatusConfig[status];
                        const isActive = currentStatus === status;
                        return (
                            <button
                                key={status}
                                disabled={isActive || statusMutation.isPending}
                                onClick={() => setConfirmAction({ type: "status-change", payload: { status } })}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${isActive ? (sConf?.active ?? "") + " shadow-sm cursor-default" : (sConf?.bg ?? "") + " hover:shadow-sm"} disabled:cursor-default`}
                            >
                                {isActive && <span className="mr-1.5">●</span>}
                                {status}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Metadata */}
                <Section title="Metadata" icon={<Hash className="w-4 h-4" />}>
                    <div className="space-y-4">
                        {/* Editable Description */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <Label>Description</Label>
                                {canEdit && editingField !== "metadata-description" && (
                                    <button
                                        onClick={() => startEdit("metadata-description", (metadata?.description ?? []).join("\n\n"))}
                                        className="text-neutral-400 hover:text-violet-600 transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            {editingField === "metadata-description" ? (
                                <div className="space-y-2">
                                    <textarea
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        rows={4}
                                        className="w-full text-sm text-neutral-700 bg-neutral-50 rounded-lg border border-neutral-200 p-3 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-y"
                                        autoFocus
                                        placeholder="Separate paragraphs with blank lines"
                                    />
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => saveMetadataField("description", editValue.split(/\n\s*\n/).filter(Boolean))}
                                            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors flex items-center gap-1"
                                        >
                                            <Check className="w-3 h-3" /> Save
                                        </button>
                                        <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 text-xs font-medium hover:bg-neutral-50 transition-colors flex items-center gap-1">
                                            <X className="w-3 h-3" /> Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-neutral-700 leading-relaxed space-y-2 mt-1">
                                    {metadata?.description && metadata.description.length > 0
                                        ? metadata.description.map((para, i) => <p key={i}>{para}</p>)
                                        : <p className="text-neutral-400 italic">No description</p>}
                                </div>
                            )}
                        </div>

                        {/* Keywords with delete */}
                        <div>
                            <Label>Keywords</Label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {(metadata?.keywords ?? []).map((kw, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">
                                        {kw}
                                        {canEdit && (
                                            <button
                                                onClick={() => {
                                                    const updated = (metadata?.keywords ?? []).filter((_, idx) => idx !== i);
                                                    saveMetadataField("keywords", updated);
                                                }}
                                                className="text-violet-400 hover:text-red-500 transition-colors ml-0.5"
                                                title="Remove keyword"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </span>
                                ))}
                                {canEdit && (
                                    editingField === "metadata-keyword-add" ? (
                                        <span className="inline-flex items-center gap-1">
                                            <input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="text-xs bg-neutral-50 rounded-full border border-neutral-200 px-2.5 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-violet-200"
                                                autoFocus
                                                placeholder="keyword"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && editValue.trim()) {
                                                        saveMetadataField("keywords", [...(metadata?.keywords ?? []), editValue.trim()]);
                                                    }
                                                    if (e.key === "Escape") cancelEdit();
                                                }}
                                            />
                                            <button onClick={cancelEdit} className="text-neutral-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => startEdit("metadata-keyword-add", "")}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-neutral-300 text-neutral-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" /> Add
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Editable Points & Hints */}
                        <div className="grid grid-cols-2 gap-3">
                            <EditableInfoRow
                                icon={<Trophy className="w-3.5 h-3.5 text-amber-500" />}
                                label="Max Points"
                                value={metadata?.max_points ?? "—"}
                                fieldKey="metadata-max_points"
                                editingField={editingField}
                                editValue={editValue}
                                canEdit={canEdit}
                                onStartEdit={() => startEdit("metadata-max_points", metadata?.max_points ?? 0)}
                                onChangeValue={setEditValue}
                                onSave={() => saveMetadataField("max_points", Number(editValue))}
                                onCancel={cancelEdit}
                                inputType="number"
                            />
                            <EditableInfoRow
                                icon={<Lightbulb className="w-3.5 h-3.5 text-yellow-500" />}
                                label="Max Hints"
                                value={metadata?.hints_allowed ?? "—"}
                                fieldKey="metadata-hints_allowed"
                                editingField={editingField}
                                editValue={editValue}
                                canEdit={canEdit}
                                onStartEdit={() => startEdit("metadata-hints_allowed", metadata?.hints_allowed ?? 0)}
                                onChangeValue={setEditValue}
                                onSave={() => saveMetadataField("hints_allowed", Number(editValue))}
                                onCancel={cancelEdit}
                                inputType="number"
                            />
                        </div>
                    </div>
                </Section>

                {/* Location + Map */}
                <Section title="Location" icon={<MapPin className="w-4 h-4" />}>
                    {location ? (
                        <div className="space-y-4">
                            <InfoRow label="Region" value={location.region} />
                            <QuestRouteMap location={location} steps={steps} height="340px" />
                        </div>
                    ) : (
                        <p className="text-sm text-neutral-400 italic">No location data</p>
                    )}
                </Section>
            </div>

            {/* Steps */}
            <Section title={`Steps (${steps.length})`} icon={<Layers className="w-4 h-4" />}>
                {steps.length === 0 ? (
                    <p className="text-sm text-neutral-400 italic">No steps defined</p>
                ) : (
                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
                        {steps.map((step) => (
                            <div key={step._id}>
                                <button
                                    onClick={() => toggleStep(step._id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                                >
                                    <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {step.order}
                                    </span>

                                    {/* Inline editable title */}
                                    {editingField === `step-title-${step._id}` ? (
                                        <span className="flex-1" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="w-full font-medium text-neutral-800 text-sm bg-neutral-50 rounded-lg border border-neutral-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") saveStepField(step._id, "title", editValue);
                                                    if (e.key === "Escape") cancelEdit();
                                                }}
                                            />
                                        </span>
                                    ) : (
                                        <span className="font-medium text-neutral-800 text-sm flex-1 group/title flex items-center gap-1.5">
                                            {step.title}
                                            {canEdit && (
                                                <Pencil
                                                    className="w-3 h-3 text-neutral-300 group-hover/title:text-violet-500 transition-colors cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); startEdit(`step-title-${step._id}`, step.title); }}
                                                />
                                            )}
                                        </span>
                                    )}

                                    {editingField === `step-title-${step._id}` ? (
                                        <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => saveStepField(step._id, "title", editValue)} className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                                            <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-red-50 text-red-500"><X className="w-3.5 h-3.5" /></button>
                                        </span>
                                    ) : (
                                        <span className={`text-neutral-400 transition-transform ${expandedSteps.has(step._id) ? "rotate-90" : ""}`}>
                                            ▸
                                        </span>
                                    )}
                                </button>

                                {expandedSteps.has(step._id) && (
                                    <div className="px-4 pb-4 pl-14 animate-fade-in space-y-3">
                                        {/* Editable description */}
                                        {editingField === `step-desc-${step._id}` ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    rows={3}
                                                    className="w-full text-sm text-neutral-700 bg-neutral-50 rounded-lg border border-neutral-200 p-3 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-y"
                                                    autoFocus
                                                />
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => saveStepField(step._id, "description", editValue)}
                                                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors flex items-center gap-1"
                                                    >
                                                        <Check className="w-3 h-3" /> Save
                                                    </button>
                                                    <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 text-xs font-medium hover:bg-neutral-50 transition-colors flex items-center gap-1">
                                                        <X className="w-3 h-3" /> Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="group/desc flex items-start gap-2">
                                                <p className="text-sm text-neutral-600 leading-relaxed flex-1">{step.description}</p>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => startEdit(`step-desc-${step._id}`, step.description)}
                                                        className="text-neutral-300 hover:text-violet-500 transition-colors flex-shrink-0"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Coordinates badge */}
                                        {(() => {
                                            const wp = (location?.route_waypoints ?? []).find(w => w.order === step.waypoint_order);
                                            const coords = wp?.location?.coordinates;
                                            if (!coords) return null;
                                            return (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[11px] font-mono border border-neutral-200">
                                                        <MapPin className="w-3 h-3 text-violet-500" />
                                                        {coords[1].toFixed(6)}, {coords[0].toFixed(6)}
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {/* How to reach */}
                                        {editingField === `step-reach-${step._id}` ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-1.5 text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                                                    <Navigation className="w-3 h-3" /> How to Reach
                                                </div>
                                                <textarea
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    rows={2}
                                                    className="w-full text-sm text-neutral-700 bg-neutral-50 rounded-lg border border-neutral-200 p-3 focus:outline-none focus:ring-2 focus:ring-violet-200 resize-y"
                                                    autoFocus
                                                    placeholder="Describe how to reach this step..."
                                                />
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => saveStepField(step._id, "how_to_reach", editValue)}
                                                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors flex items-center gap-1"
                                                    >
                                                        <Check className="w-3 h-3" /> Save
                                                    </button>
                                                    <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 text-xs font-medium hover:bg-neutral-50 transition-colors flex items-center gap-1">
                                                        <X className="w-3 h-3" /> Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="group/reach flex items-start gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-1.5 text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">
                                                        <Navigation className="w-3 h-3" /> How to Reach
                                                    </div>
                                                    <p className="text-sm text-neutral-600 leading-relaxed">
                                                        {step.how_to_reach || <span className="text-neutral-400 italic">Not specified</span>}
                                                    </p>
                                                </div>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => startEdit(`step-reach-${step._id}`, step.how_to_reach ?? "")}
                                                        className="text-neutral-300 hover:text-violet-500 transition-colors flex-shrink-0 mt-4"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Step images (clickable to enlarge) */}
                                        {step.cloudinary_assets && step.cloudinary_assets.length > 0 && (
                                            <div className="flex gap-2 flex-wrap">
                                                {step.cloudinary_assets.map((asset, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setLightboxUrl(asset.secure_url)}
                                                        className="relative group/img overflow-hidden rounded-lg border border-neutral-200 w-16 h-16 flex-shrink-0 hover:shadow-md transition-shadow"
                                                    >
                                                        <img src={asset.secure_url} alt="" className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-200" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                                            <Eye className="w-4 h-4 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Media Gallery with add/remove */}
            <Section title={`Media (${media?.cloudinary_assets.length ?? 0})`} icon={<ImageIcon className="w-4 h-4" />}>
                <div className="space-y-4">
                    {media && media.cloudinary_assets.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {media.cloudinary_assets.map((asset) => (
                                <div
                                    key={asset.public_id}
                                    className="group relative rounded-xl overflow-hidden border border-neutral-200 aspect-square"
                                >
                                    <button
                                        onClick={() => setLightboxUrl(asset.secure_url)}
                                        className="w-full h-full"
                                    >
                                        <img
                                            src={asset.secure_url}
                                            alt={asset.alt_text || ""}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </button>
                                    {/* Remove button */}
                                    {canEdit && (
                                        <button
                                            onClick={() => handleMediaRemove(asset.public_id)}
                                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-lg"
                                            title="Remove media"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-neutral-400 italic">No media uploaded</p>
                    )}

                    {/* Upload button */}
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
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 text-neutral-600 text-sm font-medium hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploadingMedia ? (
                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Uploading...</>
                                ) : (
                                    <><Plus className="w-4 h-4" /> <Upload className="w-4 h-4" /> Add Media</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </Section>

            {/* Creator Info */}
            <Section title="Creator" icon={<UserCircle className="w-4 h-4" />}>
                {creator ? (
                    <div className="grid grid-cols-2 gap-3">
                        <InfoRow label="Name" value={`${creator.first_name} ${creator.last_name}`} />
                        <InfoRow label="Role" value={creator.role} />
                        <InfoRow label="Status" value={creator.status} />
                        <InfoRow
                            label="Creator ID"
                            value={
                                <Link
                                    to={`/creators/${quest.created_by}`}
                                    className="text-violet-600 hover:text-violet-800 hover:underline transition-colors"
                                >
                                    {creator._id.slice(-12)}
                                </Link>
                            }
                        />
                    </div>
                ) : (
                    <p className="text-sm text-neutral-400 italic">Creator info unavailable</p>
                )}
            </Section>

            {/* Danger Zone (admin/super_admin only) */}
            {canDelete && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                    <h3 className="text-base font-bold text-red-700 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5" /> Danger Zone
                    </h3>
                    <p className="text-sm text-red-600 mb-4">Deleting a quest is irreversible if hard-deleted. Use with caution.</p>
                    <button
                        onClick={() => setConfirmAction({ type: "delete" })}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" /> Delete Quest
                    </button>
                </div>
            )}

            {/* Delete Confirm Modal */}
            <ConfirmModal
                open={confirmAction?.type === "delete"}
                title="Delete Quest"
                message={`This will ${hardDelete ? "PERMANENTLY" : "soft"}-delete "${metadata?.title || quest.quest_title || "this quest"}". ${hardDelete ? "All data will be permanently removed." : "The quest can be recovered later."}`}
                confirmLabel={hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={deleteMutation.isPending}
            >
                <label className="flex items-center gap-2 mt-3 mb-1 px-1 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={hardDelete}
                        onChange={(e) => setHardDelete(e.target.checked)}
                        className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 accent-red-600"
                    />
                    <span className="text-xs text-red-600 font-medium">Hard delete (permanent, irreversible)</span>
                </label>
            </ConfirmModal>

            {/* Status Change Confirm Modal */}
            <ConfirmModal
                open={confirmAction?.type === "status-change"}
                title="Change Quest Status"
                message={confirmAction?.type === "status-change"
                    ? `Change "${metadata?.title || quest.quest_title || "this quest"}" to "${confirmAction.payload.status}". This will take effect immediately.`
                    : ""}
                confirmLabel="Change Status"
                confirmStyle="bg-violet-600 hover:bg-violet-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={statusMutation.isPending}
                theme="warning"
            />

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        onClick={() => setLightboxUrl(null)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt=""
                        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

// ---- Shared sub-components ----

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                {icon} {title}
            </h3>
            {children}
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{children}</span>;
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="bg-neutral-50 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
                {icon}
                <span>{label}</span>
            </div>
            <span className="text-sm font-medium text-neutral-800">{value}</span>
        </div>
    );
}

function EditableInfoRow({
    icon,
    label,
    value,
    fieldKey,
    editingField,
    editValue,
    canEdit,
    onStartEdit,
    onChangeValue,
    onSave,
    onCancel,
    inputType = "text",
}: {
    icon?: React.ReactNode;
    label: string;
    value: React.ReactNode;
    fieldKey: string;
    editingField: string | null;
    editValue: string;
    canEdit: boolean;
    onStartEdit: () => void;
    onChangeValue: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
    inputType?: string;
}) {
    if (editingField === fieldKey) {
        return (
            <div className="bg-neutral-50 rounded-xl p-3 ring-2 ring-violet-200 space-y-2">
                <div className="flex items-center gap-2 text-neutral-500 text-sm">
                    {icon}
                    <span>{label}</span>
                </div>
                <input
                    type={inputType}
                    value={editValue}
                    onChange={(e) => onChangeValue(e.target.value)}
                    className="w-full text-sm font-medium text-neutral-800 bg-white rounded-lg border border-neutral-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onSave();
                        if (e.key === "Escape") onCancel();
                    }}
                />
                <div className="flex gap-1">
                    <button onClick={onSave} className="p-1 rounded-md hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={onCancel} className="p-1 rounded-md hover:bg-red-50 text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`bg-neutral-50 rounded-xl p-3 flex items-center justify-between gap-2 group ${canEdit ? "cursor-pointer hover:ring-2 hover:ring-violet-100 transition-all" : ""}`}
            onClick={canEdit ? onStartEdit : undefined}
        >
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
                {icon}
                <span>{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-neutral-800">{value}</span>
                {canEdit && <Pencil className="w-3 h-3 text-neutral-300 group-hover:text-violet-500 transition-colors" />}
            </div>
        </div>
    );
}

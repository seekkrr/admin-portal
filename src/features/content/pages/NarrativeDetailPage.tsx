import { useRef, useState, type ChangeEvent } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    XCircle,
    Archive,
    AudioLines,
    Trash2,
    ExternalLink,
    Eye,
    Clock,
    Loader2,
    Pencil,
    Save,
    Lock,
    LockOpen,
    Pin,
    ListOrdered,
    Image as ImageIcon,
    Upload,
    X,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { LoadingFallback } from "@components/LoadingFallback";
import { GeoMap } from "@/components/maps/GeoMap";
import { useAuthStore } from "@store/auth.store";
import { mediaService } from "@/services/media.service";
import { narrativesService } from "../services/narratives.service";
import { AudioPlayer } from "../components/AudioPlayer";
import { VoicePersonaSamples } from "../components/VoicePersonaSamples";
import type {
    AdminNarrative,
    NarrativeAttachType,
    UpdateNarrativePayload,
    VoicePersona,
} from "@/types";

const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];

const ATTACH_PATH: Record<NarrativeAttachType, string> = {
    marker: "/markers",
    quest: "/quests",
    region: "/regions",
};



type ModalAction = "approve" | "reject" | "archive";

interface EditForm {
    title: string;
    subtitle: string;
    content: string;
    voice_persona: VoicePersona | "";
    custom_voice_id: string;
    trigger_radius_m: string;
    is_mandatory: boolean;
    is_unlocked: boolean;
    sequence_order: string;
    media: string[];
}

export function NarrativeDetailPage() {
    const { narrativeId: narrativeIdParam } = useParams<{ narrativeId: string }>();
    const narrativeId = narrativeIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const canModerate = user?.role?.some((r) => CAN_MODERATE_ROLES.includes(r as string));
    const isSuper = !!user?.role?.includes("super_admin");

    const [modal, setModal] = useState<ModalAction | null>(null);
    const [note, setNote] = useState("");
    const [editForm, setEditForm] = useState<EditForm | null>(null);
    const [showDelete, setShowDelete] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const mediaFileInputRef = useRef<HTMLInputElement>(null);

    const {
        data: narrative,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["narrative-detail", narrativeId],
        queryFn: () => narrativesService.getById(narrativeId),
        enabled: !!narrativeId,
    });

    const { data: audioStatus } = useQuery({
        queryKey: ["narrative-audio-status", narrativeId],
        queryFn: () => narrativesService.audioStatus(narrativeId),
        enabled: !!narrativeId,
        refetchInterval: (query) =>
            query.state.data?.audio_status === "generating" ? 3000 : false,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["narrative-detail", narrativeId] });
        queryClient.invalidateQueries({ queryKey: ["narrative-audio-status", narrativeId] });
        queryClient.invalidateQueries({ queryKey: ["admin-narratives-queue"] });
        queryClient.invalidateQueries({ queryKey: ["admin-narratives"] });
    };

    const approveMut = useMutation({
        mutationFn: () => narrativesService.approve(narrativeId, note || undefined),
        onSuccess: () => {
            invalidate();
            toast.success("Narrative approved");
            closeModal();
        },
        onError: () => toast.error("Failed to approve narrative"),
    });

    const rejectMut = useMutation({
        mutationFn: () => narrativesService.reject(narrativeId, note),
        onSuccess: () => {
            invalidate();
            toast.success("Narrative rejected");
            closeModal();
        },
        onError: () => toast.error("Failed to reject narrative"),
    });

    const archiveMut = useMutation({
        mutationFn: () => narrativesService.archive(narrativeId),
        onSuccess: () => {
            invalidate();
            toast.success("Narrative archived");
            closeModal();
        },
        onError: () => toast.error("Failed to archive narrative"),
    });

    const generateMut = useMutation({
        mutationFn: () => narrativesService.generateAudio(narrativeId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["narrative-audio-status", narrativeId] });
            toast.success("Audio generation started");
        },
        onError: () => toast.error("Failed to start audio generation"),
    });

    const deleteAudioMut = useMutation({
        mutationFn: () => narrativesService.deleteAudio(narrativeId),
        onSuccess: () => {
            invalidate();
            toast.success("Audio cleared");
        },
        onError: () => toast.error("Failed to clear audio"),
    });

    const updateMut = useMutation({
        mutationFn: (payload: UpdateNarrativePayload) => narrativesService.update(narrativeId, payload),
        onSuccess: () => {
            invalidate();
            toast.success("Narrative updated");
            setEditForm(null);
        },
        onError: () => toast.error("Failed to update narrative"),
    });

    const deleteMut = useMutation({
        mutationFn: () => narrativesService.remove(narrativeId, hardDelete),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-narratives-queue"] });
            queryClient.invalidateQueries({ queryKey: ["admin-narratives"] });
            toast.success("Narrative deleted");
            navigate("/narratives", { replace: true });
        },
        onError: () => {
            toast.error("Failed to delete narrative");
            setShowDelete(false);
        },
    });

    const closeModal = () => {
        setModal(null);
        setNote("");
    };

    const startEdit = (n: AdminNarrative) => {
        setEditForm({
            title: n.title ?? "",
            subtitle: n.subtitle ?? "",
            content: n.content ?? "",
            voice_persona: n.voice_persona ?? "",
            custom_voice_id: n.custom_voice_id ?? "",
            trigger_radius_m: n.trigger_radius_m !== null ? String(n.trigger_radius_m) : "",
            is_mandatory: n.is_mandatory,
            is_unlocked: n.is_unlocked,
            sequence_order: n.sequence_order !== null ? String(n.sequence_order) : "",
            media: n.media ?? [],
        });
    };

    // ── Media upload (S3 presigned uploads) ──
    const handleMediaUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingMedia(true);
        try {
            const urls = await Promise.all(
                Array.from(files).map(async (file) => {
                    const result = await mediaService.uploadImage(file, {
                        category: "narrative",
                        entity_id: narrativeId,
                    });
                    return result.secure_url;
                }),
            );
            setEditForm((f) => (f ? { ...f, media: [...f.media, ...urls] } : f));
            toast.success(`${files.length} file(s) uploaded`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingMedia(false);
            if (mediaFileInputRef.current) mediaFileInputRef.current.value = "";
        }
    };

    const removeMedia = (url: string) =>
        setEditForm((f) => (f ? { ...f, media: f.media.filter((m) => m !== url) } : f));

    const saveEdit = (n: AdminNarrative) => {
        if (!editForm) return;
        if (!editForm.title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (editForm.voice_persona === "custom" && !/^[A-Za-z0-9]{20}$/.test(editForm.custom_voice_id.trim())) {
            toast.error("Enter a valid 20-character ElevenLabs voice ID");
            return;
        }
        const payload: UpdateNarrativePayload = {};
        if (editForm.title.trim() !== (n.title ?? "")) payload.title = editForm.title.trim();
        if (editForm.subtitle.trim() !== (n.subtitle ?? "")) payload.subtitle = editForm.subtitle.trim();
        if (editForm.content.trim() !== (n.content ?? "")) payload.content = editForm.content.trim();
        if (editForm.voice_persona && editForm.voice_persona !== n.voice_persona)
            payload.voice_persona = editForm.voice_persona;
        if (
            editForm.voice_persona === "custom" &&
            editForm.custom_voice_id.trim() !== (n.custom_voice_id ?? "")
        )
            payload.custom_voice_id = editForm.custom_voice_id.trim();
        const nextRadius = editForm.trigger_radius_m.trim() === "" ? null : Number(editForm.trigger_radius_m);
        if (nextRadius !== null && Number.isFinite(nextRadius) && nextRadius !== n.trigger_radius_m)
            payload.trigger_radius_m = nextRadius;
        if (editForm.is_mandatory !== n.is_mandatory) payload.is_mandatory = editForm.is_mandatory;
        if (editForm.is_unlocked !== n.is_unlocked) payload.is_unlocked = editForm.is_unlocked;
        const nextSeq = editForm.sequence_order.trim() === "" ? null : Number(editForm.sequence_order);
        if (nextSeq !== null && Number.isFinite(nextSeq) && nextSeq !== n.sequence_order)
            payload.sequence_order = nextSeq;
        const nextMedia = editForm.media.map((s) => s.trim()).filter(Boolean);
        if (nextMedia.join(",") !== (n.media ?? []).join(",")) payload.media = nextMedia;

        if (Object.keys(payload).length === 0) {
            toast.info("No changes to save");
            return;
        }
        updateMut.mutate(payload);
    };

    if (isLoading) return <LoadingFallback message="Loading narrative..." />;

    if (error || !narrative) {
        return (
            <div className="p-6 text-center">
                <p className="mb-4 text-red-500">Failed to load narrative or it does not exist.</p>
                <Link to="/narratives" className="text-orange-600 hover:underline">
                    Back to Narratives
                </Link>
            </div>
        );
    }

    const n: AdminNarrative = narrative;
    const liveAudioStatus = audioStatus?.audio_status ?? n.audio_status;
    const liveAudioUrl = audioStatus?.audio_url ?? n.audio_url;
    const liveAudioDuration = audioStatus?.audio_duration_s ?? n.audio_duration_s;
    const isGenerating = liveAudioStatus === "generating";

    const attachLabel =
        n.attach_type === "marker" ? "View marker" : n.attach_type === "quest" ? "View quest" : "View region";

    const pending = approveMut.isPending || rejectMut.isPending || archiveMut.isPending;

    return (
        <div className="animate-fade-in mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <Link
                    to="/narratives"
                    className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Link>
                {canModerate && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                            onClick={() => setModal("approve")}
                            disabled={n.status === "approved"}
                            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                        </button>
                        <button
                            onClick={() => setModal("reject")}
                            disabled={n.status === "rejected"}
                            className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <XCircle className="h-4 w-4" />
                            Reject
                        </button>
                        <button
                            onClick={() => setModal("archive")}
                            disabled={n.status === "archived"}
                            className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Archive className="h-4 w-4" />
                            Archive
                        </button>
                        <button
                            onClick={() => (editForm ? setEditForm(null) : startEdit(n))}
                            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition-colors ${
                                editForm
                                    ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                                    : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                            }`}
                        >
                            <Pencil className="h-4 w-4" />
                            {editForm ? "Close Editor" : "Edit"}
                        </button>
                        <button
                            onClick={() => {
                                setHardDelete(false);
                                setShowDelete(true);
                            }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 font-medium text-red-600 transition-colors hover:bg-red-100"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Header */}
            <Card padding="md">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                        <BookOpen className="h-5 w-5" />
                    </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-neutral-900">{n.title || "Untitled"}</h1>
                            {n.subtitle && <p className="mt-1 text-neutral-500">{n.subtitle}</p>}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge
                                    label={n.status.replace(/_/g, " ")}
                                    styles={
                                        n.status === "draft" ? "bg-neutral-50 text-neutral-700 border-neutral-200" :
                                        n.status === "under_review" ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        n.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                        n.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                        "bg-neutral-100 text-neutral-600 border-neutral-300"
                                    }
                                />
                                {n.voice_persona && (
                                    <Badge
                                        label={n.voice_persona.replace(/_/g, " ")}
                                        styles="bg-orange-50 text-orange-700 border-orange-200"
                                    />
                                )}
                                <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                                    <Eye className="h-3.5 w-3.5" /> {n.view_count} views
                                </span>
                                {n.is_mandatory && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                                        <Pin className="h-3.5 w-3.5" /> Mandatory
                                    </span>
                                )}
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        n.is_unlocked ? "bg-sky-50 text-sky-700" : "bg-neutral-100 text-neutral-600"
                                    }`}
                                >
                                    {n.is_unlocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                    {n.is_unlocked ? "Unlocked" : "Locked"}
                                </span>
                                {n.sequence_order !== null && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                                        <ListOrdered className="h-3.5 w-3.5" /> #{n.sequence_order}
                                    </span>
                                )}
                                {n.created_at && (
                                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                                        <Clock className="h-3.5 w-3.5" /> {new Date(n.created_at).toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Attached to */}
                        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">Attached to</p>
                                <span className="text-sm text-neutral-700 mt-1 block">
                                    <span className="capitalize">{n.attach_type}</span> ·{" "}
                                    <span className="font-mono text-xs">{n.attach_id}</span>
                                </span>
                            </div>
                            <Link
                                to={`${ATTACH_PATH[n.attach_type]}/${n.attach_id}`}
                                className="flex flex-shrink-0 items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline"
                            >
                                {attachLabel}
                                <ExternalLink className="h-4 w-4" />
                            </Link>
                        </div>
                </Card>
            {/* Edit panel */}
            {canModerate && editForm && (
                <Card padding="none" className="border-orange-200">
                    <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 mb-0 rounded-t-xl">
                        <CardTitle className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-orange-600" />
                            Edit Narrative
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-5 sm:p-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Subtitle</label>
                                <input
                                    type="text"
                                    value={editForm.subtitle}
                                    onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Content</label>
                                <textarea
                                    rows={6}
                                    value={editForm.content}
                                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-medium text-neutral-700">Voice persona</label>
                                <VoicePersonaSamples
                                    selected={editForm.voice_persona || undefined}
                                    onSelect={(persona) => setEditForm({ ...editForm, voice_persona: persona })}
                                    customVoiceId={editForm.custom_voice_id}
                                    onCustomVoiceIdChange={(value) => setEditForm({ ...editForm, custom_voice_id: value })}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Trigger radius (m)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={editForm.trigger_radius_m}
                                    onChange={(e) => setEditForm({ ...editForm, trigger_radius_m: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Sequence order</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={editForm.sequence_order}
                                    onChange={(e) => setEditForm({ ...editForm, sequence_order: e.target.value })}
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-neutral-700">Media</label>
                                <div className="flex flex-wrap gap-3">
                                    {editForm.media.map((url) => (
                                        <div
                                            key={url}
                                            className="group relative h-20 w-20 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
                                        >
                                            <img src={url} alt="Narrative media" className="h-full w-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeMedia(url)}
                                                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                                                title="Remove"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <label
                                        className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-600 ${
                                            uploadingMedia ? "pointer-events-none opacity-60" : ""
                                        }`}
                                    >
                                        {uploadingMedia ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Upload className="h-5 w-5" />
                                                <span className="text-[10px] font-medium">Upload</span>
                                            </>
                                        )}
                                        <input
                                            ref={mediaFileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={handleMediaUpload}
                                            disabled={uploadingMedia}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-6">
                            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                                <input
                                    type="checkbox"
                                    checked={editForm.is_mandatory}
                                    onChange={(e) => setEditForm({ ...editForm, is_mandatory: e.target.checked })}
                                    className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                                />
                                Mandatory
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                                <input
                                    type="checkbox"
                                    checked={editForm.is_unlocked}
                                    onChange={(e) => setEditForm({ ...editForm, is_unlocked: e.target.checked })}
                                    className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                                />
                                Unlocked by default
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
                            <button
                                onClick={() => setEditForm(null)}
                                disabled={updateMut.isPending}
                                className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => saveEdit(n)}
                                disabled={updateMut.isPending}
                                className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                            >
                                {updateMut.isPending ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Content & other sections only visible when not editing */}
            {!editForm && (
                <>
                    {/* Content */}
            <Card padding="none">
                <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 mb-0 rounded-t-xl">
                    <CardTitle>Narrative Content</CardTitle>
                </CardHeader>
                <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4">
                    <div className="prose prose-sm prose-neutral max-w-none whitespace-pre-wrap text-neutral-700">
                        {n.content || "No content provided."}
                    </div>
                    {n.review_note && (
                        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
                            <span className="font-semibold text-neutral-700">Review note: </span>
                            <span className="text-neutral-600">{n.review_note}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Media gallery */}
            {!editForm && n.media && n.media.length > 0 && (
                <Card padding="none">
                    <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 mb-0 rounded-t-xl">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-orange-600" />
                            Media
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                            {n.media.map((url, i) => (
                                <a
                                    key={`${url}-${i}`}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 transition hover:ring-2 hover:ring-orange-500"
                                >
                                    <img
                                        src={url}
                                        alt={`Narrative media ${i + 1}`}
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                    />
                                </a>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Trigger location map */}
            {n.trigger_location && (
                <Card padding="none">
                    <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 mb-0 rounded-t-xl">
                        <CardTitle>Trigger Location</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4">
                        <GeoMap
                            points={[{ coordinates: n.trigger_location.coordinates, label: n.title }]}
                            radiusMeters={n.trigger_radius_m}
                            height="320px"
                        />
                    </CardContent>
                </Card>
            )}

            {/* Audio */}
            <Card padding="none">
                <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 mb-0 rounded-t-xl">
                    <div className="flex flex-row items-center justify-between">
                        <CardTitle>Audio Narration</CardTitle>
                        <Badge
                            label={(liveAudioStatus || "none").replace(/_/g, " ")}
                            styles={
                                liveAudioStatus === "pending" ? "bg-neutral-50 text-neutral-600 border-neutral-200" :
                                liveAudioStatus === "generating" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                liveAudioStatus === "ready" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                liveAudioStatus === "failed" ? "bg-rose-50 text-rose-700 border-rose-200" :
                                "bg-amber-50 text-amber-700 border-amber-200"
                            }
                        />
                    </div>
                </CardHeader>
                <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 space-y-4">
                    <AudioPlayer src={liveAudioUrl} durationS={liveAudioDuration} />

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => generateMut.mutate()}
                            disabled={generateMut.isPending || isGenerating}
                            className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {generateMut.isPending || isGenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <AudioLines className="h-4 w-4" />
                            )}
                            {isGenerating ? "Generating…" : "Generate Audio"}
                        </button>
                        <button
                            onClick={() => deleteAudioMut.mutate()}
                            disabled={deleteAudioMut.isPending || (!liveAudioUrl && liveAudioStatus !== "generating")}
                            className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            {liveAudioStatus === "generating" ? "Cancel Audio" : "Clear Audio"}
                        </button>
                        {isGenerating && (
                            <span className="text-xs text-blue-600">Polling for completion…</span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Voice personas */}
            <Card padding="none">
                <CardHeader className="border-b border-neutral-100 bg-neutral-50/50 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 mb-0 rounded-t-xl">
                    <CardTitle>Voice Personas</CardTitle>
                </CardHeader>
                <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4">
                    <VoicePersonaSamples selected={n.voice_persona ?? undefined} />
                </CardContent>
                </Card>
                </>
            )}

            {/* Moderation modal */}
            <ConfirmModal
                open={!!modal}
                title={
                    modal === "approve"
                        ? "Approve Narrative"
                        : modal === "reject"
                        ? "Reject Narrative"
                        : "Archive Narrative"
                }
                message={
                    <>
                        <p className="mb-4">
                            {modal === "approve"
                                ? "This narrative will become publicly visible. You may add an optional review note."
                                : modal === "reject"
                                ? "Provide a reason for rejection. This note is required."
                                : "This narrative will be archived and hidden from users."}
                        </p>
                        {(modal === "approve" || modal === "reject") && (
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={4}
                                placeholder={
                                    modal === "reject" ? "Reason for rejection (required)" : "Review note (optional)"
                                }
                                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            />
                        )}
                    </>
                }
                confirmLabel={modal === "approve" ? "Approve" : modal === "reject" ? "Reject" : "Archive"}
                confirmStyle={
                    modal === "approve"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : modal === "reject"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-neutral-700 hover:bg-neutral-800"
                }
                isPending={pending}
                onConfirm={() => {
                    if (modal === "approve") approveMut.mutate();
                    else if (modal === "reject") rejectMut.mutate();
                    else archiveMut.mutate();
                }}
                onCancel={closeModal}
                disabledConfirm={modal === "reject" && note.trim().length === 0}
            />

            {/* Delete modal */}
            <ConfirmModal
                open={showDelete}
                title="Delete Narrative"
                message={
                    <>
                        <p className="mb-4 text-neutral-600">
                            Are you sure you want to delete <strong>{n.title || "this narrative"}</strong>?
                            {hardDelete
                                ? " This will permanently remove the record."
                                : " It will be soft-deleted and hidden from users."}
                        </p>
                        {isSuper && (
                            <label className="flex items-center gap-2 text-sm font-medium text-red-700 mt-2">
                                <input
                                    type="checkbox"
                                    checked={hardDelete}
                                    onChange={(e) => setHardDelete(e.target.checked)}
                                    className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
                                />
                                Permanently delete (super-admin, irreversible)
                            </label>
                        )}
                    </>
                }
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                isPending={deleteMut.isPending}
                onConfirm={() => deleteMut.mutate()}
                onCancel={() => setShowDelete(false)}
            />
        </div>
    );
}

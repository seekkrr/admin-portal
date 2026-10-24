import { useRef, useState, type ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Archive,
    AudioLines,
    BookOpen,
    CheckCircle2,
    Eye,
    Image as ImageIcon,
    ListOrdered,
    Loader2,
    Lock,
    LockOpen,
    Pencil,
    Pin,
    Save,
    Trash2,
    Upload,
    X,
    XCircle,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailList, DetailRow, Panel } from "@/components/ui/Panel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { Checkbox, Field, TextArea, TextInput } from "@/components/ui/Field";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/utils/date";
import type { EntityKind } from "@/utils/entity";
import { GeoMap } from "@/components/maps/GeoMap";
import { useAuthStore } from "@store/auth.store";
import { mediaService } from "@/services/media.service";
import { narrativesService } from "../services/narratives.service";
import { AudioPlayer } from "../components/AudioPlayer";
import { VoicePersonaSamples } from "../components/VoicePersonaSamples";
import { AudioStatusPill, NarrativeStatusPill } from "../components/NarrativePills";
import { PERSONAS } from "../components/voicePersonas";
import type {
    AdminNarrative,
    NarrativeAttachType,
    UpdateNarrativePayload,
    VoicePersona,
} from "@/types";

const CAN_MODERATE_ROLES = ["admin", "super_admin", "moderator"];

const ATTACH_KIND: Record<NarrativeAttachType, EntityKind> = { marker: "place", quest: "quest", region: "region" };
const ATTACH_LABEL: Record<NarrativeAttachType, string> = { marker: "Place", quest: "Quest", region: "Region" };

function personaName(p: VoicePersona): string {
    return PERSONAS.find((x) => x.id === p)?.label ?? (p === "custom" ? "Custom voice" : p.replace(/_/g, " "));
}

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
    const [editForm, setEditForm] = useState<EditForm | null>(null);
    const [showDelete, setShowDelete] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const mediaFileInputRef = useRef<HTMLInputElement>(null);

    const {
        data: narrative,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["narrative-detail", narrativeId],
        queryFn: () => narrativesService.getById(narrativeId),
        enabled: !!narrativeId,
    });
    usePageTitle(narrative?.title);

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
        mutationFn: (note?: string) => narrativesService.approve(narrativeId, note || undefined),
        onSuccess: () => {
            invalidate();
            toast.success("Narrative approved");
            closeModal();
        },
        onError: () => toast.error("Failed to approve narrative"),
    });

    const rejectMut = useMutation({
        mutationFn: (note: string) => narrativesService.reject(narrativeId, note),
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

    const closeModal = () => setModal(null);

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

    if (isLoading) return <LoadingState label="Loading narrative…" />;

    if (error || !narrative) {
        return (
            <Panel>
                <ErrorState
                    error={error ?? new Error("This narrative doesn't exist or was deleted.")}
                    title="Couldn't load the narrative"
                    onRetry={error ? () => void refetch() : undefined}
                />
                <div className="flex justify-center pb-6">
                    <ButtonLink to="/narratives" variant="secondary" size="sm">
                        Back to narratives
                    </ButtonLink>
                </div>
            </Panel>
        );
    }

    const n: AdminNarrative = narrative;
    const liveAudioStatus = audioStatus?.audio_status ?? n.audio_status;
    const liveAudioUrl = audioStatus?.audio_url ?? n.audio_url;
    const liveAudioDuration = audioStatus?.audio_duration_s ?? n.audio_duration_s;
    const isGenerating = liveAudioStatus === "generating";
    const pending = approveMut.isPending || rejectMut.isPending || archiveMut.isPending;
    const editing = !!editForm;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={BookOpen}
                title={n.title || "Untitled"}
                description={n.subtitle ?? undefined}
                badge={<NarrativeStatusPill status={n.status} />}
                actions={
                    canModerate && (
                        <>
                            <Button icon={CheckCircle2} onClick={() => setModal("approve")} disabled={n.status === "approved"}>
                                Approve
                            </Button>
                            <Button icon={XCircle} onClick={() => setModal("reject")} disabled={n.status === "rejected"}>
                                Reject
                            </Button>
                        </>
                    )
                }
                primaryAction={
                    canModerate && (
                        <Button variant={editing ? "secondary" : "primary"} icon={editing ? X : Pencil} onClick={() => (editing ? setEditForm(null) : startEdit(n))}>
                            {editing ? "Close editor" : "Edit"}
                        </Button>
                    )
                }
                menu={
                    canModerate
                        ? [
                              { label: "Archive", icon: Archive, onSelect: () => setModal("archive"), disabled: n.status === "archived" },
                              {
                                  label: "Delete narrative",
                                  icon: Trash2,
                                  danger: true,
                                  onSelect: () => {
                                      setHardDelete(false);
                                      setShowDelete(true);
                                  },
                              },
                          ]
                        : undefined
                }
            />

            {/* Overview */}
            <Panel>
                <div className="flex flex-wrap items-center gap-2">
                    {n.voice_persona && <Tag tone="brand">{personaName(n.voice_persona)}</Tag>}
                    {n.is_mandatory && (
                        <Tag tone="info">
                            <Pin className="h-3 w-3" aria-hidden /> Mandatory
                        </Tag>
                    )}
                    <Tag>
                        {n.is_unlocked ? <LockOpen className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
                        {n.is_unlocked ? "Unlocked" : "Locked"}
                    </Tag>
                    {n.sequence_order !== null && (
                        <Tag>
                            <ListOrdered className="h-3 w-3" aria-hidden /> #{n.sequence_order}
                        </Tag>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                        <Eye className="h-3.5 w-3.5" aria-hidden /> {n.view_count.toLocaleString("en-IN")} views
                    </span>
                </div>
                <DetailList className="mt-4">
                    <DetailRow
                        label="Attached to"
                        value={
                            <span className="inline-flex flex-wrap items-center gap-2">
                                <Tag>{ATTACH_LABEL[n.attach_type] ?? n.attach_type}</Tag>
                                <IdLink kind={ATTACH_KIND[n.attach_type] ?? "place"} id={n.attach_id} short={false} />
                            </span>
                        }
                    />
                    {n.chain_id && <DetailRow label="Chain" value={<span className="font-mono text-xs text-ink-muted">{n.chain_id}</span>} />}
                    <DetailRow label="Created" value={formatDateTime(n.created_at)} />
                    {n.updated_at && <DetailRow label="Updated" value={formatDateTime(n.updated_at)} />}
                    {n.created_by && <DetailRow label="Created by" value={<IdLink kind="user" id={n.created_by} />} />}
                    {n.reviewed_at && (
                        <DetailRow
                            label="Reviewed"
                            value={
                                <span className="inline-flex flex-wrap items-center gap-1.5">
                                    {formatDateTime(n.reviewed_at)}
                                    {n.reviewed_by && (
                                        <>
                                            <span className="text-ink-faint">by</span>
                                            <IdLink kind="user" id={n.reviewed_by} />
                                        </>
                                    )}
                                </span>
                            }
                        />
                    )}
                </DetailList>
            </Panel>

            {/* Edit panel */}
            {canModerate && editForm && (
                <Panel
                    title="Edit narrative"
                    icon={Pencil}
                    actions={
                        <>
                            <Button variant="secondary" size="sm" onClick={() => setEditForm(null)} disabled={updateMut.isPending}>
                                Cancel
                            </Button>
                            <Button variant="primary" size="sm" icon={Save} onClick={() => saveEdit(n)} loading={updateMut.isPending} disabled={uploadingMedia}>
                                Save changes
                            </Button>
                        </>
                    }
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Title" required>
                            <TextInput type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                        </Field>
                        <Field label="Subtitle">
                            <TextInput type="text" value={editForm.subtitle} onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })} />
                        </Field>
                        <Field label="Content" className="md:col-span-2">
                            <TextArea rows={6} value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} />
                        </Field>
                        <div className="md:col-span-2">
                            <span className="mb-2 block text-sm font-medium text-ink">Voice persona</span>
                            <VoicePersonaSamples
                                selected={editForm.voice_persona || undefined}
                                onSelect={(persona) => setEditForm({ ...editForm, voice_persona: persona })}
                                customVoiceId={editForm.custom_voice_id}
                                onCustomVoiceIdChange={(value) => setEditForm({ ...editForm, custom_voice_id: value })}
                            />
                        </div>
                        <Field label="Trigger radius (m)">
                            <TextInput type="number" min={1} inputMode="numeric" value={editForm.trigger_radius_m} onChange={(e) => setEditForm({ ...editForm, trigger_radius_m: e.target.value })} />
                        </Field>
                        <Field label="Sequence order">
                            <TextInput type="number" min={0} inputMode="numeric" value={editForm.sequence_order} onChange={(e) => setEditForm({ ...editForm, sequence_order: e.target.value })} />
                        </Field>
                        <div className="md:col-span-2">
                            <span className="mb-1.5 block text-sm font-medium text-ink">Media</span>
                            <div className="flex flex-wrap gap-3">
                                {editForm.media.map((url) => (
                                    <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-control border border-line bg-surface-muted">
                                        <img src={url} alt="Narrative media" className="h-full w-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeMedia(url)}
                                            className="absolute right-1 top-1 rounded-full bg-brand-950/70 p-1 text-white transition-opacity hover:bg-brand-950 sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
                                            aria-label="Remove image"
                                        >
                                            <X className="h-3.5 w-3.5" aria-hidden />
                                        </button>
                                    </div>
                                ))}
                                <label
                                    className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-dashed border-line-strong text-ink-faint transition-colors focus-within:ring-2 focus-within:ring-accent-500 hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700 ${
                                        uploadingMedia ? "pointer-events-none opacity-60" : ""
                                    }`}
                                >
                                    {uploadingMedia ? (
                                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                                    ) : (
                                        <>
                                            <Upload className="h-5 w-5" aria-hidden />
                                            <span className="text-[11px] font-medium">Upload</span>
                                        </>
                                    )}
                                    <input
                                        ref={mediaFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="sr-only"
                                        onChange={handleMediaUpload}
                                        disabled={uploadingMedia}
                                        aria-label="Upload images"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-6">
                        <Checkbox checked={editForm.is_mandatory} onChange={(v) => setEditForm({ ...editForm, is_mandatory: v })} label="Mandatory" />
                        <Checkbox checked={editForm.is_unlocked} onChange={(v) => setEditForm({ ...editForm, is_unlocked: v })} label="Unlocked by default" />
                    </div>
                </Panel>
            )}

            {/* Content & other sections only visible when not editing */}
            {!editing && (
                <>
                    <Panel title="Narrative content">
                        <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed text-ink">{n.content || <span className="text-ink-muted">No content provided.</span>}</div>
                        {n.review_note && (
                            <div className="mt-4 rounded-control border border-line bg-surface-muted p-3 text-sm">
                                <span className="font-semibold text-ink">Review note: </span>
                                <span className="text-ink-muted">{n.review_note}</span>
                            </div>
                        )}
                    </Panel>

                    {n.media && n.media.length > 0 && (
                        <Panel title="Media" icon={ImageIcon}>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                {n.media.map((url, i) => (
                                    <a
                                        key={`${url}-${i}`}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block aspect-square overflow-hidden rounded-control border border-line bg-surface-muted transition hover:ring-2 hover:ring-accent-500"
                                    >
                                        <img src={url} alt={`Narrative media ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                                    </a>
                                ))}
                            </div>
                        </Panel>
                    )}

                    {n.trigger_location && (
                        <Panel title="Trigger location" description={n.trigger_radius_m ? `Plays within ${n.trigger_radius_m} m` : undefined}>
                            <GeoMap points={[{ coordinates: n.trigger_location.coordinates, label: n.title }]} radiusMeters={n.trigger_radius_m} height="320px" />
                        </Panel>
                    )}

                    <Panel title="Audio narration" actions={<AudioStatusPill status={liveAudioStatus} />}>
                        <div className="space-y-4">
                            <AudioPlayer src={liveAudioUrl} durationS={liveAudioDuration} />
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="primary" icon={AudioLines} onClick={() => generateMut.mutate()} loading={generateMut.isPending || isGenerating}>
                                    {isGenerating ? "Generating…" : "Generate audio"}
                                </Button>
                                <Button
                                    icon={Trash2}
                                    onClick={() => deleteAudioMut.mutate()}
                                    loading={deleteAudioMut.isPending}
                                    disabled={!liveAudioUrl && liveAudioStatus !== "generating"}
                                >
                                    {liveAudioStatus === "generating" ? "Cancel audio" : "Clear audio"}
                                </Button>
                                {isGenerating && (
                                    <span className="text-xs text-info" role="status">
                                        Checking for completion…
                                    </span>
                                )}
                            </div>
                        </div>
                    </Panel>

                    <Panel title="Voice personas">
                        <VoicePersonaSamples selected={n.voice_persona ?? undefined} />
                    </Panel>
                </>
            )}

            {/* Moderation: approve takes an optional note, reject a required reason (sent to the author) */}
            <ConfirmDialog
                open={modal === "approve" || modal === "reject"}
                title={modal === "approve" ? "Approve narrative?" : "Reject narrative"}
                description={modal === "approve" ? "This narrative becomes publicly visible." : "The author sees your reason."}
                confirmLabel={modal === "approve" ? "Approve" : "Reject"}
                tone={modal === "approve" ? "primary" : "danger"}
                level="reason"
                reasonLabel={modal === "approve" ? "Review note" : "Reason"}
                reasonPlaceholder={modal === "approve" ? "Optional note for the author" : "Why is this narrative rejected?"}
                reasonMinLength={modal === "reject" ? 1 : 0}
                reasonMaxLength={2000}
                isPending={pending}
                onConfirm={(reason) => {
                    if (modal === "approve") approveMut.mutate(reason);
                    else rejectMut.mutate(reason ?? "");
                }}
                onCancel={closeModal}
            />

            <ConfirmDialog
                open={modal === "archive"}
                title="Archive narrative?"
                description="It is hidden from users. You can find it under Archived."
                confirmLabel="Archive"
                tone="warning"
                isPending={pending}
                onConfirm={() => archiveMut.mutate()}
                onCancel={closeModal}
            />

            {/* Delete — soft by default; super admins can delete permanently (type the title) */}
            <ConfirmDialog
                open={showDelete}
                title={hardDelete ? "Permanently delete narrative?" : "Delete narrative?"}
                description={
                    hardDelete ? (
                        <>
                            <strong className="text-ink">{n.title || "This narrative"}</strong> is removed for good.
                        </>
                    ) : (
                        <>
                            <strong className="text-ink">{n.title || "This narrative"}</strong> is hidden from users and the admin lists.
                        </>
                    )
                }
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hardDelete ? "type" : "simple"}
                typeToConfirm={hardDelete ? n.title?.trim() || "DELETE" : undefined}
                isPending={deleteMut.isPending}
                onConfirm={() => deleteMut.mutate()}
                onCancel={() => setShowDelete(false)}
            >
                {isSuper && <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Super admins only. This can't be undone." />}
            </ConfirmDialog>
        </div>
    );
}

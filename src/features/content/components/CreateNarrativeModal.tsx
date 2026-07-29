import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    BookPlus,
    X,
    AlertTriangle,
    Loader2,
    Link2,
    Pencil,
    Upload,
    Image as ImageIcon,
    Radius,
} from "lucide-react";
import { narrativesService } from "../services/narratives.service";
import { PERSONAS } from "./voicePersonas";
import { AttachTargetPicker, type AttachTarget } from "./AttachTargetPicker";
import { NarrativeConflictDialog } from "./NarrativeConflictDialog";
import { mediaService } from "@/services/media.service";
import type {
    CreateNarrativePayload,
    NarrativeAttachType,
    NarrativeAttachSummary,
    VoicePersona,
} from "@/types";

interface CreateNarrativeModalProps {
    open: boolean;
    onClose: () => void;
}

const ATTACH_TYPES: { value: NarrativeAttachType; label: string }[] = [
    { value: "marker", label: "Marker" },
    { value: "quest", label: "Quest" },
    { value: "region", label: "Region" },
];

interface FormState {
    title: string;
    subtitle: string;
    content: string;
    voicePersona: VoicePersona | "";
    customVoiceId: string;
    triggerRadius: string;
    isMandatory: boolean;
    isUnlocked: boolean;
    media: string[];
}

const EMPTY_FORM: FormState = {
    title: "",
    subtitle: "",
    content: "",
    voicePersona: "",
    customVoiceId: "",
    triggerRadius: "",
    isMandatory: false,
    isUnlocked: true,
    media: [],
};

type SubmitStatus = "draft" | "approved";

// Derive the chain-related payload fields from a conflict summary.
//   - chain conflict  → append onto the first chain (chain_id + sequence_order)
//   - standalone-only → chain onto the first standalone narrative (chain_with)
//   - no conflict     → {} (plain standalone create)
function chainFieldsFromSummary(
    s: NarrativeAttachSummary | null | undefined,
): Pick<CreateNarrativePayload, "chain_id" | "sequence_order" | "chain_with"> {
    if (!s || !s.has_conflict) return {};
    const firstChain = s.chains[0];
    if (firstChain) {
        return {
            chain_id: firstChain.chain_id,
            sequence_order: firstChain.next_sequence_order,
        };
    }
    const firstStandalone = s.standalone[0];
    if (firstStandalone) {
        return { chain_with: firstStandalone._id };
    }
    return {};
}

// The existing narrative id to navigate to for "edit existing instead".
function editTargetId(s: NarrativeAttachSummary | null | undefined): string | null {
    if (!s) return null;
    return s.chains[0]?.first_narrative_id ?? s.standalone[0]?._id ?? null;
}

export function CreateNarrativeModal({ open, onClose }: CreateNarrativeModalProps) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [attachType, setAttachType] = useState<NarrativeAttachType>("marker");
    const [target, setTarget] = useState<AttachTarget | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    // Conflict dialog state (defensive / race path).
    const [conflict, setConflict] = useState<NarrativeAttachSummary | null>(null);

    const reset = () => {
        setAttachType("marker");
        setTarget(null);
        setForm(EMPTY_FORM);
        setUploadingMedia(false);
        setConflict(null);
    };

    const close = () => {
        reset();
        onClose();
    };

    // ── Proactive pre-check: summarize existing narratives on the target ──────
    const { data: summary, isFetching: summaryLoading } = useQuery({
        queryKey: ["narrative-attach-summary", attachType, target?.id],
        enabled: open && !!target,
        staleTime: 15 * 1000,
        queryFn: () => narrativesService.attachSummary(attachType, target?.id ?? ""),
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-narratives"] });
        queryClient.invalidateQueries({ queryKey: ["admin-narratives-queue"] });
    };

    // Build the create payload. `chainFields` come from the (proactive or
    // defensive) summary; for a clean target they are empty (plain standalone).
    const buildPayload = (
        attachId: string,
        status: SubmitStatus,
        chainFields: Pick<
            CreateNarrativePayload,
            "chain_id" | "sequence_order" | "chain_with"
        >,
    ): CreateNarrativePayload => {
        const radius = form.triggerRadius.trim();
        const radiusNum = radius === "" ? undefined : Number(radius);
        return {
            title: form.title.trim(),
            attach_type: attachType,
            attach_id: attachId,
            content: form.content.trim() || undefined,
            subtitle: form.subtitle.trim() || undefined,
            voice_persona: form.voicePersona || undefined,
            custom_voice_id:
                form.voicePersona === "custom" ? form.customVoiceId.trim() : undefined,
            trigger_radius_m:
                radiusNum !== undefined && Number.isFinite(radiusNum) ? radiusNum : undefined,
            media: form.media.length > 0 ? form.media : undefined,
            is_mandatory: form.isMandatory,
            is_unlocked: form.isUnlocked,
            status,
            ...chainFields,
        };
    };

    const createMutation = useMutation({
        mutationFn: (payload: CreateNarrativePayload) => narrativesService.create(payload),
        onSuccess: () => {
            invalidate();
            toast.success("Narrative created");
            close();
        },
        onError: async (err: Error, payload) => {
            // Defensive race path: someone may have attached a narrative between
            // our pre-check and submit (backend answers 409). The interceptor
            // collapses the error to `err.message`, so we never read the
            // response — instead we re-fetch the summary and, if it now reports a
            // conflict, open the conflict dialog populated from the fresh data.
            if (!target) {
                toast.error(err.message);
                return;
            }
            try {
                const fresh = await narrativesService.attachSummary(attachType, target.id);
                if (fresh.has_conflict) {
                    setConflict(fresh);
                    return;
                }
            } catch {
                // Fall through to the generic toast on a failed re-check.
            }
            void payload;
            toast.error(err.message);
        },
    });

    // "Chain it" from the defensive conflict dialog: resolve chain fields from
    // the fresh summary and retry with the same form values (kept as draft —
    // the dialog is a recovery path, not the primary submit).
    const chainItMutation = useMutation({
        mutationFn: () => {
            const fresh = conflict;
            const attachId = fresh?.attach_id ?? target?.id ?? "";
            return narrativesService.create(
                buildPayload(attachId, "draft", chainFieldsFromSummary(fresh)),
            );
        },
        onSuccess: () => {
            invalidate();
            toast.success("Narrative chained to existing content");
            close();
        },
        onError: (err: Error) => {
            setConflict(null);
            toast.error(err.message);
        },
    });

    const submitting =
        createMutation.isPending || chainItMutation.isPending || uploadingMedia;

    const canSubmit = useMemo(
        () => !!target && form.title.trim().length > 0 && !summaryLoading && !submitting,
        [target, form.title, summaryLoading, submitting],
    );

    const handleSubmit = (status: SubmitStatus) => {
        if (!target) {
            toast.error("Pick an attach target first");
            return;
        }
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (form.voicePersona === "custom" && !/^[A-Za-z0-9]{20}$/.test(form.customVoiceId.trim())) {
            toast.error("Enter a valid 20-character ElevenLabs voice ID");
            return;
        }
        createMutation.mutate(
            buildPayload(target.id, status, chainFieldsFromSummary(summary)),
        );
    };

    // ── Media upload (unsigned Cloudinary, mirrors QuestDetailPage) ───────────
    const handleMediaUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingMedia(true);
        try {
            const urls = await Promise.all(
                Array.from(files).map(async (file) => {
                    const result = await mediaService.uploadImage(file, { category: "narrative" });
                    return result.secure_url;
                }),
            );
            setForm((f) => ({ ...f, media: [...f.media, ...urls] }));
            toast.success(`${files.length} file(s) uploaded`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploadingMedia(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const removeMedia = (url: string) =>
        setForm((f) => ({ ...f, media: f.media.filter((m) => m !== url) }));

    // Clear uploaded media whenever the editor is closed.
    useEffect(() => {
        if (!open) setForm((f) => (f.media.length ? { ...f, media: [] } : f));
    }, [open]);

    if (!open) return null;

    const showConflict = !!summary?.has_conflict && !summaryLoading;
    const editId = editTargetId(summary);
    const firstChain = summary?.chains[0];
    const firstStandalone = summary?.standalone[0];

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
                <div className="mx-4 max-h-[90vh] w-full max-w-2xl animate-slide-up overflow-y-auto rounded-2xl bg-white shadow-2xl">
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white p-6">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
                            <BookPlus className="h-5 w-5 text-orange-600" />
                            New Narrative
                        </h3>
                        <button
                            onClick={close}
                            className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="space-y-5 p-6">
                        {/* Attach type */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                                Attach to
                            </label>
                            <div className="flex gap-2">
                                {ATTACH_TYPES.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => {
                                            setAttachType(t.value);
                                            setTarget(null);
                                        }}
                                        className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                                            attachType === t.value
                                                ? "border-orange-400 bg-orange-50 text-orange-700 shadow-sm"
                                                : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50"
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Target picker */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                                Target {attachType}
                            </label>
                            <AttachTargetPicker
                                attachType={attachType}
                                value={target}
                                onChange={setTarget}
                            />
                        </div>

                        {/* Conflict pre-check notice */}
                        {target && (
                            <>
                                {summaryLoading && (
                                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Checking existing narratives…
                                    </div>
                                )}

                                {showConflict && (
                                    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                                        <div className="flex items-start gap-2.5">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                                            <div className="text-xs leading-relaxed text-amber-800">
                                                This {attachType} already has{" "}
                                                <strong>{summary?.active_count}</strong>{" "}
                                                {summary?.active_count === 1
                                                    ? "narrative"
                                                    : "narratives"}
                                                . Don't worry — we'll automatically{" "}
                                                <strong>chain</strong> your new one onto it, or you
                                                can edit the existing narrative instead.
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-amber-900">
                                            <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                                            {firstChain ? (
                                                <span>
                                                    Will be added as{" "}
                                                    <strong>
                                                        part #{firstChain.next_sequence_order}
                                                    </strong>{" "}
                                                    of “{firstChain.label}”.
                                                </span>
                                            ) : firstStandalone ? (
                                                <span>
                                                    Will be chained after “
                                                    <strong>
                                                        {firstStandalone.title || "Untitled"}
                                                    </strong>
                                                    ”.
                                                </span>
                                            ) : (
                                                <span>Will be chained onto the existing narrative.</span>
                                            )}
                                        </div>

                                        {editId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    close();
                                                    navigate(`/narratives/${editId}`);
                                                }}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit existing instead
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Title */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                                Title *
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                        </div>

                        {/* Subtitle */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                                Subtitle
                            </label>
                            <input
                                type="text"
                                value={form.subtitle}
                                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                                className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                        </div>

                        {/* Content */}
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                                Content
                            </label>
                            <textarea
                                rows={5}
                                value={form.content}
                                onChange={(e) => setForm({ ...form, content: e.target.value })}
                                className="w-full min-h-[120px] resize-none rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                        </div>

                        {/* Voice persona + trigger radius */}
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                                    Voice persona
                                </label>
                                <select
                                    value={form.voicePersona}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            voicePersona: e.target.value as VoicePersona | "",
                                        })
                                    }
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="">None</option>
                                    {PERSONAS.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.label}
                                        </option>
                                    ))}
                                    <option value="custom">Custom (ElevenLabs voice ID)</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
                                    <Radius className="h-3.5 w-3.5 text-orange-500" />
                                    Trigger radius (m)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    placeholder="e.g. 50"
                                    value={form.triggerRadius}
                                    onChange={(e) =>
                                        setForm({ ...form, triggerRadius: e.target.value })
                                    }
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                            </div>
                        </div>

                        {/* Custom ElevenLabs voice ID input */}
                        {form.voicePersona === "custom" && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                                    ElevenLabs voice ID
                                </label>
                                <input
                                    type="text"
                                    value={form.customVoiceId}
                                    onChange={(e) => setForm({ ...form, customVoiceId: e.target.value })}
                                    placeholder="e.g. pNInz6obpgDQGcFmaJgB"
                                    className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                                <p className="mt-1 text-xs text-neutral-500">20-character voice ID from your ElevenLabs voice library.</p>
                            </div>
                        )}

                        {/* Media upload */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
                                <ImageIcon className="h-3.5 w-3.5 text-orange-500" />
                                Media
                            </label>
                            <div className="flex flex-wrap gap-3">
                                {form.media.map((url) => (
                                    <div
                                        key={url}
                                        className="group relative h-20 w-20 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50"
                                    >
                                        <img
                                            src={url}
                                            alt="Narrative media"
                                            className="h-full w-full object-cover"
                                        />
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
                                        ref={fileInputRef}
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

                        {/* Flags */}
                        <div className="flex flex-wrap gap-5">
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input
                                    type="checkbox"
                                    className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                                    checked={form.isMandatory}
                                    onChange={(e) =>
                                        setForm({ ...form, isMandatory: e.target.checked })
                                    }
                                />
                                Mandatory
                            </label>
                            <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input
                                    type="checkbox"
                                    className="rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
                                    checked={form.isUnlocked}
                                    onChange={(e) =>
                                        setForm({ ...form, isUnlocked: e.target.checked })
                                    }
                                />
                                Unlocked by default
                            </label>
                        </div>
                    </div>

                    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-neutral-200 bg-white px-6 py-4">
                        <button
                            onClick={close}
                            disabled={submitting}
                            className="rounded-xl bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleSubmit("draft")}
                            disabled={!canSubmit}
                            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                        >
                            Save as Draft
                        </button>
                        <button
                            onClick={() => handleSubmit("approved")}
                            disabled={!canSubmit}
                            className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                        >
                            {(createMutation.isPending || chainItMutation.isPending) && (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            )}
                            Submit
                        </button>
                    </div>
                </div>
            </div>

            <NarrativeConflictDialog
                open={!!conflict}
                summary={conflict}
                isPending={chainItMutation.isPending}
                onChainIt={() => chainItMutation.mutate()}
                onCancel={() => setConflict(null)}
            />
        </>
    );
}

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, BookPlus, Image as ImageIcon, Link2, Loader2, Pencil, Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Checkbox, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { narrativesService } from "../services/narratives.service";
import { PERSONAS } from "./voicePersonas";
import { AttachTargetPicker, type AttachTarget } from "./AttachTargetPicker";
import { NarrativeConflictDialog } from "./NarrativeConflictDialog";
import { mediaService } from "@/services/media.service";
import type { CreateNarrativePayload, NarrativeAttachType, NarrativeAttachSummary, VoicePersona } from "@/types";

interface CreateNarrativeModalProps {
    open: boolean;
    onClose: () => void;
}

const ATTACH_TYPES: { value: NarrativeAttachType; label: string }[] = [
    { value: "marker", label: "Place" },
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
function chainFieldsFromSummary(s: NarrativeAttachSummary | null | undefined): Pick<CreateNarrativePayload, "chain_id" | "sequence_order" | "chain_with"> {
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
        chainFields: Pick<CreateNarrativePayload, "chain_id" | "sequence_order" | "chain_with">
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
            custom_voice_id: form.voicePersona === "custom" ? form.customVoiceId.trim() : undefined,
            trigger_radius_m: radiusNum !== undefined && Number.isFinite(radiusNum) ? radiusNum : undefined,
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
        onError: async (err: Error) => {
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
            return narrativesService.create(buildPayload(attachId, "draft", chainFieldsFromSummary(fresh)));
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

    const submitting = createMutation.isPending || chainItMutation.isPending || uploadingMedia;

    const canSubmit = useMemo(() => !!target && form.title.trim().length > 0 && !summaryLoading && !submitting, [target, form.title, summaryLoading, submitting]);

    const handleSubmit = (status: SubmitStatus) => {
        if (!target) {
            toast.error("Pick what this narrative is attached to first");
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
        createMutation.mutate(buildPayload(target.id, status, chainFieldsFromSummary(summary)));
    };

    // ── Media upload (S3 presigned uploads) ───────────
    const handleMediaUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingMedia(true);
        try {
            const urls = await Promise.all(
                Array.from(files).map(async (file) => {
                    const result = await mediaService.uploadImage(file, { category: "narrative" });
                    return result.secure_url;
                })
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

    const removeMedia = (url: string) => setForm((f) => ({ ...f, media: f.media.filter((m) => m !== url) }));

    // Clear uploaded media whenever the editor is closed.
    useEffect(() => {
        if (!open) setForm((f) => (f.media.length ? { ...f, media: [] } : f));
    }, [open]);

    const showConflict = !!summary?.has_conflict && !summaryLoading;
    const editId = editTargetId(summary);
    const firstChain = summary?.chains[0];
    const firstStandalone = summary?.standalone[0];
    const targetLabel = ATTACH_TYPES.find((t) => t.value === attachType)?.label.toLowerCase() ?? attachType;

    return (
        <>
            <Modal
                open={open}
                onClose={close}
                dismissible={!submitting}
                icon={BookPlus}
                title="New narrative"
                description="A story attached to a place, quest or region."
                size="2xl"
                footer={
                    <>
                        <Button variant="secondary" onClick={close} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button variant="secondary" onClick={() => handleSubmit("draft")} disabled={!canSubmit}>
                            Save as draft
                        </Button>
                        <Button variant="primary" onClick={() => handleSubmit("approved")} disabled={!canSubmit} loading={createMutation.isPending || chainItMutation.isPending}>
                            Submit
                        </Button>
                    </>
                }
            >
                {/* Attach type */}
                <div>
                    <span className="mb-1.5 block text-sm font-medium text-ink">Attach to</span>
                    <Tabs<NarrativeAttachType>
                        label="Attach to"
                        variant="pill"
                        tabs={ATTACH_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                        value={attachType}
                        onChange={(v) => {
                            setAttachType(v);
                            setTarget(null);
                        }}
                    />
                </div>

                {/* Target picker */}
                <div>
                    <span className="mb-1.5 block text-sm font-medium text-ink">
                        Which {targetLabel}
                        <span className="ml-0.5 text-bad" aria-hidden>
                            *
                        </span>
                    </span>
                    <AttachTargetPicker attachType={attachType} value={target} onChange={setTarget} />
                </div>

                {/* Conflict pre-check notice */}
                {target && summaryLoading && (
                    <div className="flex items-center gap-2 text-xs text-ink-muted" role="status">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Checking existing narratives…
                    </div>
                )}

                {target && showConflict && (
                    <div className="space-y-3 rounded-control border border-warn-line bg-warn-soft px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
                            <p className="text-xs leading-relaxed text-ink">
                                This {targetLabel} already has <strong>{summary?.active_count}</strong> {summary?.active_count === 1 ? "narrative" : "narratives"}. Your
                                new one is <strong>chained</strong> onto it automatically, or you can edit the existing narrative instead.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-lg bg-surface/70 px-3 py-2 text-xs text-ink">
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
                            {firstChain ? (
                                <span>
                                    Will be added as <strong>part #{firstChain.next_sequence_order}</strong> of “{firstChain.label}”.
                                </span>
                            ) : firstStandalone ? (
                                <span>
                                    Will be chained after “<strong>{firstStandalone.title || "Untitled"}</strong>”.
                                </span>
                            ) : (
                                <span>Will be chained onto the existing narrative.</span>
                            )}
                        </div>

                        {editId && (
                            <Button
                                size="sm"
                                variant="secondary"
                                icon={Pencil}
                                onClick={() => {
                                    close();
                                    navigate(`/narratives/${editId}`);
                                }}
                            >
                                Edit existing instead
                            </Button>
                        )}
                    </div>
                )}

                <Field label="Title" required>
                    <TextInput type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Field>

                <Field label="Subtitle">
                    <TextInput type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
                </Field>

                <Field label="Content">
                    <TextArea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[120px]" />
                </Field>

                {/* Voice persona + trigger radius */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Voice persona">
                        <SelectInput value={form.voicePersona} onChange={(e) => setForm({ ...form, voicePersona: e.target.value as VoicePersona | "" })}>
                            <option value="">None</option>
                            {PERSONAS.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                            <option value="custom">Custom (ElevenLabs voice ID)</option>
                        </SelectInput>
                    </Field>

                    <Field label="Trigger radius (m)">
                        <TextInput
                            type="number"
                            min={1}
                            inputMode="numeric"
                            placeholder="e.g. 50"
                            value={form.triggerRadius}
                            onChange={(e) => setForm({ ...form, triggerRadius: e.target.value })}
                        />
                    </Field>
                </div>

                {/* Custom ElevenLabs voice ID input */}
                {form.voicePersona === "custom" && (
                    <Field label="ElevenLabs voice ID" hint="20-character voice ID from your ElevenLabs voice library.">
                        <TextInput type="text" value={form.customVoiceId} onChange={(e) => setForm({ ...form, customVoiceId: e.target.value })} placeholder="e.g. pNInz6obpgDQGcFmaJgB" />
                    </Field>
                )}

                {/* Media upload */}
                <div>
                    <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">
                        <ImageIcon className="h-3.5 w-3.5 text-accent-600" aria-hidden />
                        Media
                    </span>
                    <div className="flex flex-wrap gap-3">
                        {form.media.map((url) => (
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
                                ref={fileInputRef}
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

                {/* Flags */}
                <div className="flex flex-wrap gap-5">
                    <Checkbox checked={form.isMandatory} onChange={(v) => setForm({ ...form, isMandatory: v })} label="Mandatory" />
                    <Checkbox checked={form.isUnlocked} onChange={(v) => setForm({ ...form, isUnlocked: v })} label="Unlocked by default" />
                </div>
            </Modal>

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

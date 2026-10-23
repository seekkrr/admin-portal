import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft, Mail, Save, RotateCcw, History, Send, Monitor, Smartphone, AlertTriangle, Info, Loader2, Braces, Truck, Clock,
} from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useCollabAccess } from "@/features/collabs/roles";
import {
    Chip, CopyButton, Drawer, Field, LoadingButtonIcon, Modal, SectionCard, SegmentedTabs, btnPrimary, btnSecondary, btnSmNeutral, inputClass,
} from "@/features/collabs/components/CollabsUi";
import { fmtDateTime } from "@/features/collabs/utils";
import { emailTemplatesService } from "../services/email-templates.service";
import { CodeTextarea, DeliveryBanner } from "../components/EmailUi";
import type { EmailProvider, EmailTemplateDetail, EmailTemplateDraft, EmailTemplateParts } from "../types";

type FieldName = keyof EmailTemplateParts;

function useDebounced<T>(value: T, ms: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), ms);
        return () => window.clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

/** Fields that differ from what's live (layouts only carry HTML). */
function changedFields(draft: EmailTemplateParts, current: EmailTemplateParts, isLayout: boolean): EmailTemplateDraft {
    const out: EmailTemplateDraft = {};
    if (draft.html !== current.html) out.html = draft.html;
    if (!isLayout) {
        if (draft.subject !== current.subject) out.subject = draft.subject;
        if (draft.text !== current.text) out.text = draft.text;
    }
    return out;
}

function draftPayload(draft: EmailTemplateParts, isLayout: boolean): EmailTemplateDraft {
    return isLayout ? { html: draft.html } : { subject: draft.subject, html: draft.html, text: draft.text };
}

// ── Preview ────────────────────────────────────────────────

function PreviewPanel({ templateKey, draft, isLayout }: { templateKey: string; draft: EmailTemplateParts; isLayout: boolean }) {
    const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
    const [tab, setTab] = useState<"html" | "text">("html");
    const payload = useMemo(() => draftPayload(draft, isLayout), [draft, isLayout]);
    const debounced = useDebounced(payload, 600);

    const { data, isFetching, error } = useQuery({
        queryKey: ["email-template-preview", templateKey, debounced],
        queryFn: () => emailTemplatesService.preview(templateKey, debounced),
        placeholderData: (prev) => prev,
        staleTime: 30 * 1000,
        retry: false,
    });

    return (
        <SectionCard
            title={
                <span className="flex items-center gap-2">
                    Live preview {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />}
                </span>
            }
            icon={Monitor}
            bodyClassName="p-4 space-y-3"
            actions={
                <div className="flex gap-1 bg-neutral-100 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => setDevice("desktop")}
                        className={`p-1.5 rounded-md ${device === "desktop" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"}`}
                        aria-label="Desktop width"
                        aria-pressed={device === "desktop"}
                    >
                        <Monitor className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setDevice("mobile")}
                        className={`p-1.5 rounded-md ${device === "mobile" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"}`}
                        aria-label="Mobile width"
                        aria-pressed={device === "mobile"}
                    >
                        <Smartphone className="w-4 h-4" />
                    </button>
                </div>
            }
        >
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{(error as Error).message}</p>}
            {data && (
                <>
                    {!isLayout && (
                        <div className="text-sm">
                            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Subject</span>
                            <p className="font-medium text-neutral-900 break-words">{data.subject || <span className="text-neutral-400">(empty)</span>}</p>
                        </div>
                    )}
                    {data.unknown_placeholders.length > 0 && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                                Unknown placeholders (sent literally): {data.unknown_placeholders.map((p) => `$${p}`).join(", ")}
                            </span>
                        </div>
                    )}
                    {!isLayout && (
                        <SegmentedTabs
                            value={tab}
                            onChange={setTab}
                            tabs={[
                                { value: "html", label: "HTML" },
                                { value: "text", label: "Plain text" },
                            ]}
                        />
                    )}
                    {tab === "html" || isLayout ? (
                        <div className="bg-neutral-100 rounded-xl p-3 flex justify-center overflow-x-auto">
                            <iframe
                                title="Email preview"
                                sandbox=""
                                srcDoc={data.html}
                                className="bg-white rounded-lg border border-neutral-200 h-[640px] transition-all"
                                style={{ width: device === "mobile" ? 375 : "100%", maxWidth: device === "mobile" ? 375 : 760 }}
                            />
                        </div>
                    ) : (
                        <pre className="text-xs font-mono whitespace-pre-wrap bg-neutral-50 border border-neutral-200 rounded-xl p-4 max-h-[640px] overflow-auto text-neutral-800">
                            {data.text || "(no plain-text part)"}
                        </pre>
                    )}
                    {isLayout && <p className="text-[11px] text-neutral-400">Layouts are previewed around the “Creator welcome” email.</p>}
                </>
            )}
            {!data && !error && <LoadingFallback message="Rendering preview..." />}
        </SectionCard>
    );
}

// ── Delivery (ZeptoMail) ───────────────────────────────────

function DeliveryPanel({ template, draft }: { template: EmailTemplateDetail; draft: EmailTemplateParts }) {
    const queryClient = useQueryClient();
    const [provider, setProvider] = useState<EmailProvider>(template.delivery.provider);
    const [zeptoKey, setZeptoKey] = useState(template.delivery.zepto_template_key ?? "");
    const zeptoAvailable = template.transport.zeptomail_configured;

    const save = useMutation({
        mutationFn: () => emailTemplatesService.setDelivery(template.key, provider, zeptoKey),
        onSuccess: (t) => {
            toast.success(t.delivery.provider === "zeptomail" ? "Now sending with the ZeptoMail template" : "Now sending the SeekKrr design");
            queryClient.setQueryData(["email-template", template.key], t);
            queryClient.invalidateQueries({ queryKey: ["email-templates"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save delivery"),
    });

    const testZepto = useMutation({
        mutationFn: () =>
            emailTemplatesService.sendTest(template.key, { ...draftPayload(draft, false), use_zeptomail: true, zepto_template_key: zeptoKey.trim() || undefined }),
        onSuccess: (r) => toast.success(`ZeptoMail test queued to ${r.to}`),
        onError: (e: Error) => toast.error(e.message || "Failed to send ZeptoMail test"),
    });

    const dirty = provider !== template.delivery.provider || (provider === "zeptomail" && zeptoKey.trim() !== (template.delivery.zepto_template_key ?? ""));
    const keyMissing = provider === "zeptomail" && !zeptoKey.trim();

    return (
        <SectionCard title="Delivery" icon={Truck}>
            <div className="space-y-4">
                <div className="space-y-2">
                    {(
                        [
                            { value: "seekkrr", label: "SeekKrr design (edited here)", help: "The subject/HTML/text on this page, wrapped in the shared header and footer." },
                            {
                                value: "zeptomail",
                                label: "ZeptoMail template (designed in Zoho)",
                                help: zeptoAvailable ? "Zoho renders the email from a template you design in ZeptoMail." : "ZeptoMail isn't configured on this server (ZEPTOMAIL_TOKEN).",
                            },
                        ] as { value: EmailProvider; label: string; help: string }[]
                    ).map((opt) => {
                        const disabled = opt.value === "zeptomail" && !zeptoAvailable;
                        return (
                            <label
                                key={opt.value}
                                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                                    provider === opt.value ? "border-teal-300 bg-teal-50/50" : "border-neutral-200"
                                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-neutral-50"}`}
                            >
                                <input
                                    type="radio"
                                    name={`provider-${template.key}`}
                                    checked={provider === opt.value}
                                    disabled={disabled}
                                    onChange={() => setProvider(opt.value)}
                                    className="mt-0.5 accent-teal-600"
                                />
                                <span>
                                    <span className="block text-sm font-medium text-neutral-800">{opt.label}</span>
                                    <span className="block text-xs text-neutral-500">{opt.help}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>

                {provider === "zeptomail" && (
                    <>
                        <Field label="ZeptoMail template key" htmlFor="zepto-key" required>
                            <input
                                id="zepto-key"
                                type="text"
                                maxLength={200}
                                value={zeptoKey}
                                onChange={(e) => setZeptoKey(e.target.value)}
                                className={`${inputClass} font-mono`}
                                placeholder="2d6f.…"
                            />
                        </Field>
                        <div>
                            <p className="text-sm font-medium text-neutral-700 mb-1">Merge fields for the ZeptoMail editor</p>
                            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                                {template.zeptomail_merge_fields.map((f) => (
                                    <CopyButton key={f} value={`{{${f}}}`} label={`{{${f}}}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700" />
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg p-2 flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 text-teal-600" />
                            If the ZeptoMail template fails, we send the SeekKrr design so nothing is lost.
                        </p>
                    </>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                    {provider === "zeptomail" && (
                        <button type="button" onClick={() => testZepto.mutate()} disabled={keyMissing || !zeptoAvailable || testZepto.isPending} className={btnSecondary}>
                            <LoadingButtonIcon loading={testZepto.isPending} icon={Send} /> Send test via ZeptoMail
                        </button>
                    )}
                    <button type="button" onClick={() => save.mutate()} disabled={!dirty || keyMissing || save.isPending} className={btnPrimary}>
                        <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save delivery
                    </button>
                </div>
            </div>
        </SectionCard>
    );
}

// ── Editor ─────────────────────────────────────────────────

function TemplateEditor({ template }: { template: EmailTemplateDetail }) {
    const queryClient = useQueryClient();
    const isLayout = template.is_layout;
    const [draft, setDraft] = useState<EmailTemplateParts>(template.current);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [confirmReset, setConfirmReset] = useState(false);
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [restoreVersion, setRestoreVersion] = useState<number | null>(null);

    const subjectRef = useRef<HTMLInputElement>(null);
    const htmlRef = useRef<HTMLTextAreaElement>(null);
    const textRef = useRef<HTMLTextAreaElement>(null);
    const lastFocused = useRef<FieldName>("html");

    const changes = changedFields(draft, template.current, isLayout);
    const dirty = Object.keys(changes).length > 0;

    // Unsaved-changes guard: reload/close + in-app link clicks (BrowserRouter has no useBlocker).
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
            if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
            if (anchor.pathname === window.location.pathname) return;
            if (!window.confirm("You have unsaved changes to this template. Leave without saving?")) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        document.addEventListener("click", onClick, true);
        return () => {
            window.removeEventListener("beforeunload", onBeforeUnload);
            document.removeEventListener("click", onClick, true);
        };
    }, [dirty]);

    const applyTemplate = (t: EmailTemplateDetail) => {
        queryClient.setQueryData(["email-template", t.key], t);
        queryClient.invalidateQueries({ queryKey: ["email-templates"] });
        setDraft(t.current);
    };

    const save = useMutation({
        mutationFn: () => emailTemplatesService.save(template.key, changes),
        onSuccess: (t) => {
            applyTemplate(t);
            const unknown = t.warnings?.unknown_placeholders ?? [];
            setWarnings(unknown);
            if (unknown.length) toast.warning(`Saved, but these placeholders aren't supplied by this email: ${unknown.map((p) => `$${p}`).join(", ")}`);
            else toast.success("Template saved — live within about a minute");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save template"),
    });

    const reset = useMutation({
        mutationFn: () => emailTemplatesService.reset(template.key),
        onSuccess: (t) => {
            applyTemplate(t);
            setWarnings([]);
            setConfirmReset(false);
            toast.success("Back to the built-in design");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to reset template"),
    });

    const restore = useMutation({
        mutationFn: (version: number) => emailTemplatesService.restore(template.key, version),
        onSuccess: (t, version) => {
            applyTemplate(t);
            setRestoreVersion(null);
            setVersionsOpen(false);
            toast.success(`Version ${version} restored (saved as a new version)`);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to restore version"),
    });

    const test = useMutation({
        mutationFn: () => emailTemplatesService.sendTest(template.key, draftPayload(draft, isLayout)),
        onSuccess: (r) => toast.success(`Test email queued to ${r.to} (via ${r.via})`),
        onError: (e: Error) => toast.error(e.message || "Failed to send test"),
    });

    const insertVariable = (name: string) => {
        const field: FieldName = isLayout ? "html" : lastFocused.current;
        const el = field === "subject" ? subjectRef.current : field === "html" ? htmlRef.current : textRef.current;
        const token = `$${name}`;
        const value = draft[field];
        const start = el?.selectionStart ?? value.length;
        const end = el?.selectionEnd ?? value.length;
        setDraft({ ...draft, [field]: `${value.slice(0, start)}${token}${value.slice(end)}` });
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.selectionStart = el.selectionEnd = start + token.length;
        });
    };

    const variables = [
        ...template.variables.map((v) => ({ name: v.name, title: `${v.description ? `${v.description} — ` : ""}e.g. ${v.sample || "(empty)"}`, brand: false })),
        ...template.brand_variables.map((b) => ({ name: b, title: "Brand variable (same in every email)", brand: true })),
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Link
                    to="/email-templates"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" /> All templates
                </Link>
                <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => setVersionsOpen(true)} className={btnSecondary}>
                        <History className="w-4 h-4" /> Versions ({template.versions.length})
                    </button>
                    <button type="button" onClick={() => test.mutate()} disabled={test.isPending} className={btnSecondary}>
                        <LoadingButtonIcon loading={test.isPending} icon={Send} /> Send test to me
                    </button>
                    <button type="button" onClick={() => setConfirmReset(true)} disabled={!template.has_override || reset.isPending} className={btnSecondary}>
                        <RotateCcw className="w-4 h-4" /> Reset to default
                    </button>
                    <button type="button" onClick={() => save.mutate()} disabled={!dirty || save.isPending} className={btnPrimary}>
                        <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save
                    </button>
                </div>
            </div>

            <div>
                <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                    {template.name}
                    {template.has_override && <Chip tone="teal">Customized</Chip>}
                    {template.delivery.provider === "zeptomail" && <Chip tone="violet">ZeptoMail template</Chip>}
                    {dirty && <Chip tone="amber">Unsaved changes</Chip>}
                </h1>
                <p className="text-sm text-neutral-500">
                    {template.description} · <span className="font-mono text-xs">{template.key}</span>
                    {template.updated_at ? ` · updated ${fmtDateTime(template.updated_at)}` : ""}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <p className="text-xs text-neutral-600 bg-teal-50/60 border border-teal-100 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-600 shrink-0" /> Changes reach sending within about a minute.
                </p>
                {template.source === "v1" && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> Sent by the legacy V1 service — design overrides apply; ZeptoMail templates aren't available.
                    </p>
                )}
                {template.delivery.provider === "zeptomail" && (
                    <p className="text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <Info className="w-4 h-4 shrink-0" /> This email currently sends the ZeptoMail template. The design below is the fallback.
                    </p>
                )}
                {warnings.length > 0 && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> Last save: unknown placeholders {warnings.map((p) => `$${p}`).join(", ")} — they'll be sent literally.
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
                <div className="space-y-4">
                    <SectionCard title="Content" icon={Mail} bodyClassName="p-5 space-y-4">
                        {variables.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-neutral-700 mb-1.5 flex items-center gap-1.5">
                                    <Braces className="w-4 h-4 text-teal-600" /> Variables
                                    <span className="text-xs font-normal text-neutral-500">— click to insert at the cursor{isLayout ? "" : " of the focused field"}</span>
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {variables.map((v) => (
                                        <button
                                            key={`${v.brand ? "b" : "v"}-${v.name}`}
                                            type="button"
                                            title={v.title}
                                            aria-label={`Insert $${v.name}`}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => insertVariable(v.name)}
                                            className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                                                v.brand ? "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100" : "bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100"
                                            }`}
                                        >
                                            ${v.name}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-1.5 text-[11px] text-neutral-500">
                                    Values are inserted as text (HTML-escaped). <span className="font-mono">$cta_button</span> and <span className="font-mono">$reason_html</span> are
                                    pre-built HTML snippets — place them where a block element can go.
                                </p>
                            </div>
                        )}

                        {!isLayout && (
                            <Field label="Subject" htmlFor="tpl-subject">
                                <input
                                    id="tpl-subject"
                                    ref={subjectRef}
                                    type="text"
                                    maxLength={300}
                                    value={draft.subject}
                                    onFocus={() => (lastFocused.current = "subject")}
                                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                                    className={inputClass}
                                />
                            </Field>
                        )}

                        <Field label={isLayout ? "Layout HTML" : "HTML body"} htmlFor="tpl-html" hint="No scripts, iframes, forms, inline event handlers or javascript: links. Max 200 KB. Tab indents; Esc then Tab leaves the editor.">
                            <CodeTextarea
                                id="tpl-html"
                                ref={htmlRef}
                                value={draft.html}
                                onValueChange={(html) => setDraft((d) => ({ ...d, html }))}
                                onFocus={() => (lastFocused.current = "html")}
                                rows={22}
                            />
                        </Field>

                        {!isLayout && (
                            <Field label="Plain text" htmlFor="tpl-text" hint="Shown by email clients that don't render HTML.">
                                <textarea
                                    id="tpl-text"
                                    ref={textRef}
                                    value={draft.text}
                                    onFocus={() => (lastFocused.current = "text")}
                                    onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                                    className={`${inputClass} font-mono text-xs min-h-[160px] resize-y`}
                                />
                            </Field>
                        )}
                    </SectionCard>

                    {template.supports_zeptomail && <DeliveryPanel key={`${template.delivery.provider}-${template.delivery.zepto_template_key ?? ""}`} template={template} draft={draft} />}

                    <DeliveryBanner delivery={template.transport} compact />
                </div>

                <div className="2xl:sticky 2xl:top-0">
                    <PreviewPanel templateKey={template.key} draft={draft} isLayout={isLayout} />
                </div>
            </div>

            {/* Versions */}
            <Drawer open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Saved versions" subtitle={`${template.name} · last 20 kept`}>
                {template.versions.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-10">No saved versions — this email uses the built-in design.</p>
                ) : (
                    <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                        {template.versions.map((v, i) => (
                            <li key={v.version} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-neutral-900">
                                        Version {v.version} {i === 0 && template.has_override && <Chip tone="teal">Latest</Chip>}
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        {fmtDateTime(v.saved_at)}
                                        {v.saved_by ? <> · by <span className="font-mono">{v.saved_by.slice(-6)}</span></> : null}
                                    </p>
                                </div>
                                <button type="button" onClick={() => setRestoreVersion(v.version)} className={btnSmNeutral}>
                                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Drawer>

            <Modal
                open={restoreVersion !== null}
                onClose={() => !restore.isPending && setRestoreVersion(null)}
                title={`Restore version ${restoreVersion ?? ""}`}
                icon={History}
                size="md"
                footer={
                    <>
                        <button type="button" onClick={() => setRestoreVersion(null)} disabled={restore.isPending} className={btnSecondary}>
                            Cancel
                        </button>
                        <button type="button" onClick={() => restoreVersion !== null && restore.mutate(restoreVersion)} disabled={restore.isPending} className={btnPrimary}>
                            <LoadingButtonIcon loading={restore.isPending} icon={RotateCcw} /> Restore
                        </button>
                    </>
                }
            >
                <p className="text-sm text-neutral-600">
                    The version's subject, HTML and text become live again (saved as a new version).
                    {dirty && <strong className="block mt-2 text-amber-700">Your unsaved edits on this page will be replaced.</strong>}
                </p>
            </Modal>

            <ConfirmModal
                open={confirmReset}
                theme="warning"
                title="Reset to default"
                message="Removes your customized subject, HTML and text so this email uses the built-in SeekKrr design again. The delivery choice is kept, and saved versions stay available to restore."
                confirmLabel="Reset"
                confirmStyle="bg-amber-600 hover:bg-amber-700"
                onConfirm={() => reset.mutate()}
                onCancel={() => setConfirmReset(false)}
                isPending={reset.isPending}
            />
        </div>
    );
}

export function EmailTemplateEditorPage() {
    const { key: rawKey } = useParams<{ key: string }>();
    const templateKey = useMemo(() => {
        try {
            return decodeURIComponent(rawKey ?? "");
        } catch {
            return rawKey ?? "";
        }
    }, [rawKey]);
    const { isAdmin } = useCollabAccess();

    const { data: template, isLoading, error } = useQuery({
        queryKey: ["email-template", templateKey],
        queryFn: () => emailTemplatesService.get(templateKey),
        enabled: isAdmin && !!templateKey,
        staleTime: Infinity,
    });

    if (!isAdmin) return <AccessDenied message="Only admins can edit email templates." />;
    if (isLoading) return <LoadingFallback message="Loading template..." />;
    if (error || !template) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">{error instanceof Error ? error.message : "Template not found."}</p>
                <Link to="/email-templates" className="text-teal-600 hover:underline">
                    Back to Email Templates
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <TemplateEditor key={template.key} template={template} />
        </div>
    );
}

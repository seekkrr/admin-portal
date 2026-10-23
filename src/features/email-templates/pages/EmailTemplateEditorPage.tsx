import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Save, RotateCcw, History, Send, Monitor, Smartphone, AlertTriangle, Info, Loader2, Braces, Truck, Clock, Copy, CheckCircle2, XCircle } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { Drawer } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/utils/date";
import { cx } from "@/utils/cx";
import { useCollabAccess } from "@/features/collabs/roles";
import { Notice } from "@/features/collabs/components/AdminBits";
import { emailTemplatesService } from "../services/email-templates.service";
import type { EmailDeliveryStatus, EmailProvider, EmailTemplateDetail, EmailTemplateDraft, EmailTemplateParts } from "../types";

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

/**
 * Tab in the HTML box inserts two spaces (no heavy editor dependency). Press
 * Esc first to let Tab move focus out of the field.
 */
function indentOnTab(e: KeyboardEvent<HTMLTextAreaElement>, escaped: MutableRefObject<boolean>, value: string, onValue: (v: string) => void) {
    if (e.key === "Escape") {
        escaped.current = true;
        return;
    }
    if (e.key === "Tab" && !escaped.current && !e.shiftKey) {
        e.preventDefault();
        const el = e.currentTarget;
        const { selectionStart: s, selectionEnd: end } = el;
        onValue(`${value.slice(0, s)}  ${value.slice(end)}`);
        requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = s + 2;
        });
        return;
    }
    escaped.current = false;
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`Copied ${text}`, { duration: 1200 });
    } catch {
        toast.error("Couldn't copy to clipboard");
    }
}

// ── Sending status (transport) ─────────────────────────────

function TransportPanel({ delivery }: { delivery: EmailDeliveryStatus }) {
    const nothing = !delivery.smtp_configured && !delivery.zeptomail_configured;
    const flag = (ok: boolean, label: string, detail?: string | null) => (
        <span className={cx("inline-flex items-center gap-1.5", ok ? "text-good" : "text-ink-muted")}>
            {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4 text-ink-faint" aria-hidden />}
            {label}
            {detail && <span className="font-mono text-xs text-ink-faint">{detail}</span>}
        </span>
    );
    return (
        <Panel title="Sending" icon={Send}>
            <DetailList>
                <DetailRow label="Sending via" value={delivery.transport === "zeptomail" ? "ZeptoMail API" : "SMTP (Zoho)"} />
                <DetailRow
                    label="From"
                    value={
                        <>
                            {delivery.from?.name ? `${delivery.from.name} ` : ""}
                            <span className="font-mono text-ink-muted">&lt;{delivery.from?.address ?? "—"}&gt;</span>
                        </>
                    }
                />
                <DetailRow
                    label="Configured"
                    value={
                        <span className="flex flex-wrap gap-x-5 gap-y-1">
                            {flag(delivery.smtp_configured, "Zoho SMTP", delivery.smtp_configured ? delivery.smtp_host : null)}
                            {flag(delivery.zeptomail_configured, "ZeptoMail")}
                        </span>
                    }
                />
            </DetailList>
            {nothing && (
                <Notice tone="bad" icon={AlertTriangle} title="Emails won't send" className="mt-4">
                    Neither Zoho SMTP nor ZeptoMail is configured on the server.
                </Notice>
            )}
        </Panel>
    );
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
        <Panel
            title={
                <span className="flex items-center gap-2">
                    Live preview {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-600" aria-label="Updating" />}
                </span>
            }
            icon={Monitor}
            bodyClassName="space-y-3 p-4"
            actions={
                <Tabs<"desktop" | "mobile">
                    label="Preview width"
                    variant="pill"
                    value={device}
                    onChange={setDevice}
                    tabs={[
                        { value: "desktop", label: <Monitor className="h-4 w-4" aria-label="Desktop width" /> },
                        { value: "mobile", label: <Smartphone className="h-4 w-4" aria-label="Phone width" /> },
                    ]}
                />
            }
        >
            {error && <Notice tone="bad">{(error as Error).message}</Notice>}
            {data && (
                <>
                    {!isLayout && (
                        <div className="text-sm">
                            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Subject</span>
                            <p className="break-words font-medium text-ink">{data.subject || <span className="text-ink-faint">(empty)</span>}</p>
                        </div>
                    )}
                    {data.unknown_placeholders.length > 0 && (
                        <Notice tone="warn" icon={AlertTriangle} title="Unknown placeholders (sent literally)">
                            {data.unknown_placeholders.map((p) => `$${p}`).join(", ")}
                        </Notice>
                    )}
                    {!isLayout && (
                        <Tabs<"html" | "text">
                            label="Preview part"
                            variant="pill"
                            value={tab}
                            onChange={setTab}
                            tabs={[
                                { value: "html", label: "HTML" },
                                { value: "text", label: "Plain text" },
                            ]}
                        />
                    )}
                    {tab === "html" || isLayout ? (
                        <div className="flex justify-center overflow-x-auto rounded-control bg-brand-50 p-3">
                            <iframe
                                title="Email preview"
                                sandbox=""
                                srcDoc={data.html}
                                className="h-[640px] rounded-lg border border-line bg-surface transition-all"
                                style={{ width: device === "mobile" ? 375 : "100%", maxWidth: device === "mobile" ? 375 : 760 }}
                            />
                        </div>
                    ) : (
                        <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-control border border-line bg-surface-muted p-4 font-mono text-xs text-ink">
                            {data.text || "(no plain-text part)"}
                        </pre>
                    )}
                    {isLayout && <p className="text-xs text-ink-faint">Layouts are previewed around the “Creator welcome” email.</p>}
                </>
            )}
            {!data && !error && <LoadingState label="Rendering preview…" />}
        </Panel>
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

    const options: { value: EmailProvider; label: string; help: string }[] = [
        { value: "seekkrr", label: "SeekKrr design (edited here)", help: "The subject/HTML/text on this page, wrapped in the shared header and footer." },
        {
            value: "zeptomail",
            label: "ZeptoMail template (designed in Zoho)",
            help: zeptoAvailable ? "Zoho renders the email from a template you design in ZeptoMail." : "ZeptoMail isn't configured on this server (ZEPTOMAIL_TOKEN).",
        },
    ];

    return (
        <Panel title="Delivery" icon={Truck}>
            <div className="space-y-4">
                <fieldset className="space-y-2">
                    <legend className="sr-only">How this email is sent</legend>
                    {options.map((opt) => {
                        const disabled = opt.value === "zeptomail" && !zeptoAvailable;
                        return (
                            <label
                                key={opt.value}
                                className={cx(
                                    "flex items-start gap-3 rounded-control border p-3 transition-colors",
                                    provider === opt.value ? "border-accent-300 bg-accent-50" : "border-line",
                                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-muted"
                                )}
                            >
                                <input
                                    type="radio"
                                    name={`provider-${template.key}`}
                                    checked={provider === opt.value}
                                    disabled={disabled}
                                    onChange={() => setProvider(opt.value)}
                                    className="mt-0.5 accent-accent-600"
                                />
                                <span>
                                    <span className="block text-sm font-medium text-ink">{opt.label}</span>
                                    <span className="block text-xs text-ink-muted">{opt.help}</span>
                                </span>
                            </label>
                        );
                    })}
                </fieldset>

                {provider === "zeptomail" && (
                    <>
                        <Field label="ZeptoMail template key" required>
                            <TextInput type="text" maxLength={200} value={zeptoKey} onChange={(e) => setZeptoKey(e.target.value)} className="font-mono" placeholder="2d6f.…" />
                        </Field>
                        <div>
                            <p className="mb-1 text-sm font-medium text-ink">Merge fields for the ZeptoMail editor</p>
                            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                                {template.zeptomail_merge_fields.map((f) => (
                                    <Button key={f} size="sm" variant="secondary" icon={Copy} className="font-mono text-[11px]" onClick={() => copyText(`{{${f}}}`)}>
                                        {`{{${f}}}`}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Notice tone="neutral" icon={Info}>
                            If the ZeptoMail template fails, we send the SeekKrr design so nothing is lost.
                        </Notice>
                    </>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                    {provider === "zeptomail" && (
                        <Button variant="secondary" icon={Send} onClick={() => testZepto.mutate()} disabled={keyMissing || !zeptoAvailable} loading={testZepto.isPending}>
                            Send test via ZeptoMail
                        </Button>
                    )}
                    <Button variant="primary" icon={Save} onClick={() => save.mutate()} disabled={!dirty || keyMissing} loading={save.isPending}>
                        Save delivery
                    </Button>
                </div>
            </div>
        </Panel>
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
    const htmlEscaped = useRef(false);

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
        <div className="space-y-5">
            <PageHeader
                icon={Mail}
                title={template.name}
                badge={
                    <span className="flex flex-wrap items-center gap-1.5">
                        {template.has_override && <Tag tone="brand">Customized</Tag>}
                        {template.delivery.provider === "zeptomail" && <Tag tone="info">ZeptoMail template</Tag>}
                        {dirty && <Tag tone="warn">Unsaved changes</Tag>}
                    </span>
                }
                description={
                    <>
                        {template.description} · <span className="font-mono text-xs">{template.key}</span>
                        {template.updated_at ? ` · updated ${formatDateTime(template.updated_at)}` : ""}
                    </>
                }
                actions={
                    <>
                        <Button variant="secondary" icon={History} onClick={() => setVersionsOpen(true)}>
                            Versions ({template.versions.length})
                        </Button>
                        <Button variant="secondary" icon={Send} onClick={() => test.mutate()} loading={test.isPending}>
                            Send test to me
                        </Button>
                        <Button variant="secondary" icon={RotateCcw} onClick={() => setConfirmReset(true)} disabled={!template.has_override || reset.isPending}>
                            Reset to default
                        </Button>
                    </>
                }
                primaryAction={
                    <Button variant="primary" icon={Save} onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
                        Save
                    </Button>
                }
            />

            <div className="flex flex-col gap-2">
                <Notice tone="brand" icon={Clock} title="Changes reach sending within about a minute." />
                {template.source === "v1" && (
                    <Notice tone="warn" icon={AlertTriangle} title="Sent by the legacy V1 service">
                        Design overrides apply; ZeptoMail templates aren&apos;t available.
                    </Notice>
                )}
                {template.delivery.provider === "zeptomail" && (
                    <Notice tone="info" icon={Info} title="This email currently sends the ZeptoMail template.">
                        The design below is the fallback.
                    </Notice>
                )}
                {warnings.length > 0 && (
                    <Notice tone="warn" icon={AlertTriangle} title="Last save: unknown placeholders">
                        {warnings.map((p) => `$${p}`).join(", ")} — they&apos;ll be sent literally.
                    </Notice>
                )}
            </div>

            <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-2">
                <div className="space-y-4">
                    <Panel title="Content" icon={Mail} bodyClassName="space-y-4 p-4 sm:p-5">
                        {variables.length > 0 && (
                            <div>
                                <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
                                    <Braces className="h-4 w-4 text-accent-600" aria-hidden /> Variables
                                    <span className="text-xs font-normal text-ink-muted">— click to insert at the cursor{isLayout ? "" : " of the focused field"}</span>
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
                                            className={cx(
                                                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                                                v.brand ? "border-line bg-surface-muted text-ink-muted hover:bg-brand-50" : "border-accent-200 bg-accent-50 text-accent-700 hover:bg-accent-100"
                                            )}
                                        >
                                            ${v.name}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-1.5 text-xs text-ink-muted">
                                    Values are inserted as text (HTML-escaped). <span className="font-mono">$cta_button</span> and <span className="font-mono">$reason_html</span>{" "}
                                    are pre-built HTML snippets — place them where a block element can go.
                                </p>
                            </div>
                        )}

                        {!isLayout && (
                            <Field label="Subject">
                                <TextInput
                                    ref={subjectRef}
                                    type="text"
                                    maxLength={300}
                                    value={draft.subject}
                                    onFocus={() => (lastFocused.current = "subject")}
                                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                                />
                            </Field>
                        )}

                        <Field
                            label={isLayout ? "Layout HTML" : "HTML body"}
                            hint="No scripts, iframes, forms, inline event handlers or javascript: links. Max 200 KB. Tab indents; Esc then Tab leaves the editor."
                        >
                            <TextArea
                                ref={htmlRef}
                                value={draft.html}
                                spellCheck={false}
                                rows={22}
                                onChange={(e) => setDraft((d) => ({ ...d, html: e.target.value }))}
                                onKeyDown={(e) => indentOnTab(e, htmlEscaped, draft.html, (html) => setDraft((d) => ({ ...d, html })))}
                                onFocus={() => (lastFocused.current = "html")}
                                className="resize-y font-mono text-[12.5px]"
                            />
                        </Field>

                        {!isLayout && (
                            <Field label="Plain text" hint="Shown by email clients that don't render HTML.">
                                <TextArea
                                    ref={textRef}
                                    value={draft.text}
                                    onFocus={() => (lastFocused.current = "text")}
                                    onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                                    className="min-h-[160px] resize-y font-mono text-xs"
                                />
                            </Field>
                        )}
                    </Panel>

                    {template.supports_zeptomail && <DeliveryPanel key={`${template.delivery.provider}-${template.delivery.zepto_template_key ?? ""}`} template={template} draft={draft} />}

                    <TransportPanel delivery={template.transport} />
                </div>

                <div className="2xl:sticky 2xl:top-[calc(var(--app-header-h)+1rem)]">
                    <PreviewPanel templateKey={template.key} draft={draft} isLayout={isLayout} />
                </div>
            </div>

            {/* Versions */}
            <Drawer open={versionsOpen} onClose={() => setVersionsOpen(false)} title="Saved versions" subtitle={`${template.name} · last 20 kept`}>
                {template.versions.length === 0 ? (
                    <EmptyState icon={History} title="No saved versions" description="This email uses the built-in design." />
                ) : (
                    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
                        {template.versions.map((v, i) => (
                            <li key={v.version} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div>
                                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                                        Version {v.version} {i === 0 && template.has_override && <Tag tone="brand">Latest</Tag>}
                                    </p>
                                    <p className="text-xs text-ink-muted">
                                        {formatDateTime(v.saved_at)}
                                        {v.saved_by ? (
                                            <>
                                                {" "}
                                                · by <IdLink kind="user" id={v.saved_by} />
                                            </>
                                        ) : null}
                                    </p>
                                </div>
                                <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setRestoreVersion(v.version)}>
                                    Restore
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </Drawer>

            <ConfirmDialog
                open={restoreVersion !== null}
                title={`Restore version ${restoreVersion ?? ""}?`}
                description={
                    <>
                        The version&apos;s subject, HTML and text become live again (saved as a new version).
                        {dirty && <strong className="mt-2 block text-warn">Your unsaved edits on this page will be replaced.</strong>}
                    </>
                }
                confirmLabel="Restore"
                isPending={restore.isPending}
                onConfirm={() => restoreVersion !== null && restore.mutate(restoreVersion)}
                onCancel={() => setRestoreVersion(null)}
            />

            <ConfirmDialog
                open={confirmReset}
                tone="warning"
                title="Reset to default?"
                description="Removes your customized subject, HTML and text so this email uses the built-in SeekKrr design again. The delivery choice is kept, and saved versions stay available to restore."
                confirmLabel="Reset"
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

    const { data: template, isLoading, error, refetch } = useQuery({
        queryKey: ["email-template", templateKey],
        queryFn: () => emailTemplatesService.get(templateKey),
        enabled: isAdmin && !!templateKey,
        staleTime: Infinity,
    });

    usePageTitle(template?.name ?? templateKey);

    if (!isAdmin) return <AccessDenied message="Only admins can edit email templates." />;
    if (isLoading) return <LoadingState label="Loading template…" />;
    if (error || !template) {
        return (
            <div className="rounded-card border border-line bg-surface shadow-card">
                <ErrorState
                    title="Couldn't open this template"
                    error={error ?? new Error("Template not found.")}
                    onRetry={error ? () => refetch() : undefined}
                />
                <div className="flex justify-center pb-8">
                    <ButtonLink to="/email-templates" size="sm" variant="secondary">
                        Back to email templates
                    </ButtonLink>
                </div>
            </div>
        );
    }

    return <TemplateEditor key={template.key} template={template} />;
}

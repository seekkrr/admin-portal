import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Rocket, Power, Globe, Save, FileText, ExternalLink, Upload, LayoutPanelLeft } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, SelectInput, Switch, TextInput } from "@/components/ui/Field";
import { PanelState } from "@/components/ui/States";
import { formatDateTime } from "@/utils/date";
import { cx } from "@/utils/cx";
import { platformConfigService } from "../services/platform-config.service";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { RegionMultiSelect } from "../components/CollabPickers";
import type {
    FeatureFlag,
    PartnerPortalSection,
    PartnerPortalSections,
    PartnerPortalSettings,
    TermsDoc,
    TermsVersion,
    UpdatePartnerPortalPayload,
} from "../types";

const FLAG_KEY = "collabs";

const TERMS_DOCS: { doc: TermsDoc; label: string; who: string }[] = [
    { doc: "creator_collab_terms", label: "Creator collab terms", who: "creators" },
    { doc: "business_terms", label: "Business terms", who: "business owners" },
];

const PARTNER_PORTAL_KEY = ["platform-partner-portal"] as const;

const PARTNER_PORTAL_SECTIONS: { key: PartnerPortalSection; label: string; hint: string }[] = [
    { key: "plans", label: "Plans & billing", hint: "Plan & billing page, plan names, usage limits and upgrade prompts." },
    { key: "matchmaking", label: "Matchmaking", hint: "Discover creators, match scores, profile reveals and invites." },
    { key: "attribution", label: "Attribution", hint: "Visits and clicks traced back to each creator and UGC brief." },
    { key: "content_library", label: "Redemptions & content", hint: "Redemption history and the library of creator content." },
    { key: "offers", label: "Check-in offers", hint: "Offers shown to explorers who check in at the place." },
    { key: "team", label: "Team", hint: "Invite managers and staff to help run the business." },
    { key: "messages", label: "Messages", hint: "Chat threads with creators about each collab." },
    { key: "blocked_creators", label: "Blocked creators", hint: "Creators the business has blocked, and unblocking them." },
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function FlagEditor({ flag }: { flag: FeatureFlag }) {
    const queryClient = useQueryClient();
    const [regions, setRegions] = useState<string[]>(flag.regions_enabled ?? []);
    const [minVersion, setMinVersion] = useState(flag.min_app_version ?? "");
    const [confirmToggle, setConfirmToggle] = useState(false);

    const update = useMutation({
        mutationFn: (payload: Parameters<typeof platformConfigService.updateFlag>[1]) => platformConfigService.updateFlag(FLAG_KEY, payload),
        onSuccess: (updated, payload) => {
            queryClient.setQueryData<FeatureFlag[]>(["platform-feature-flags"], (prev) =>
                (prev ?? []).some((f) => f.key === updated.key) ? (prev ?? []).map((f) => (f.key === updated.key ? updated : f)) : [...(prev ?? []), updated]
            );
            if (payload.enabled !== undefined) {
                toast.success(updated.enabled ? "Collabs turned ON globally" : "Collabs turned OFF everywhere — hidden in all apps");
                setConfirmToggle(false);
            } else {
                toast.success("Rollout settings saved");
            }
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update the feature flag"),
    });

    const settingsDirty = !sameSet(regions, flag.regions_enabled ?? []) || minVersion.trim() !== (flag.min_app_version ?? "");
    const versionInvalid = minVersion.trim() !== "" && !/^\d+(\.\d+){0,3}([+-][\w.]+)?$/.test(minVersion.trim());

    return (
        <>
            <section className={cx("overflow-hidden rounded-card border-2 bg-surface shadow-card", flag.enabled ? "border-good-line" : "border-bad-line")}>
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
                    <div className="flex items-center gap-4">
                        <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-card sm:h-14 sm:w-14", flag.enabled ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
                            <Power className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Global kill switch</p>
                            <h2 className="text-xl font-semibold text-ink sm:text-2xl">Collabs are {flag.enabled ? "ON" : "OFF"}</h2>
                            <p className="text-sm text-ink-muted">
                                {flag.enabled
                                    ? `Visible in ${flag.regions_enabled.length} enabled region${flag.regions_enabled.length === 1 ? "" : "s"}.`
                                    : "Hidden in every app and region — no release needed to turn back on."}
                                {flag.updated_at ? ` Last changed ${formatDateTime(flag.updated_at)}.` : ""}
                            </p>
                        </div>
                    </div>
                    <Button variant={flag.enabled ? "danger" : "primary"} icon={Power} onClick={() => setConfirmToggle(true)}>
                        {flag.enabled ? "Turn off everywhere" : "Turn on"}
                    </Button>
                </div>
            </section>

            <Panel
                title="Regions and minimum app version"
                icon={Globe}
                actions={
                    <Button
                        variant="primary"
                        icon={Save}
                        onClick={() => update.mutate({ regions_enabled: regions, min_app_version: minVersion.trim() })}
                        disabled={!settingsDirty || versionInvalid || update.isPending}
                        loading={update.isPending && update.variables?.enabled === undefined}
                    >
                        Save rollout
                    </Button>
                }
            >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <p className="mb-1.5 text-sm font-medium text-ink">Enabled regions</p>
                        <RegionMultiSelect value={regions} onChange={setRegions} />
                        <p className="mt-1 text-xs text-ink-faint">Collabs show only for places whose region is listed here (exact region match — city or hotspot).</p>
                    </div>
                    <Field
                        label="Minimum app version"
                        error={versionInvalid ? "Use a version like 3.2.0." : undefined}
                        hint="Older app builds hide collab UI. Leave empty for no minimum."
                    >
                        <TextInput type="text" maxLength={20} value={minVersion} onChange={(e) => setMinVersion(e.target.value)} className="font-mono" placeholder="e.g. 3.2.0" />
                    </Field>
                </div>
            </Panel>

            <ConfirmDialog
                open={confirmToggle}
                tone={flag.enabled ? "danger" : "warning"}
                title={flag.enabled ? "Turn collabs off everywhere?" : "Turn collabs on?"}
                description={
                    flag.enabled
                        ? "This immediately hides all collab UI for every creator and business in every region. Pending requests stay in place."
                        : `Collabs become visible in the ${regions.length} enabled region${regions.length === 1 ? "" : "s"}.`
                }
                confirmLabel={flag.enabled ? "Turn off" : "Turn on"}
                onConfirm={() => update.mutate({ enabled: !flag.enabled })}
                onCancel={() => setConfirmToggle(false)}
                isPending={update.isPending}
            />
        </>
    );
}

function PartnerPortalEditor({ settings }: { settings: PartnerPortalSettings }) {
    const queryClient = useQueryClient();
    const [sections, setSections] = useState<PartnerPortalSections>(settings.sections);
    const [plan, setPlan] = useState(settings.default_plan);
    const [reason, setReason] = useState("");

    const plansQuery = useQuery({ queryKey: ["collabs-plans"], queryFn: collabsAdminService.listPlans, staleTime: 5 * 60 * 1000 });
    const planOptions = useMemo(() => {
        const options = (plansQuery.data ?? [])
            .filter((p) => p.active || p.code === settings.default_plan)
            .map((p) => ({ code: p.code, name: p.name ?? p.code }));
        if (!options.some((o) => o.code === settings.default_plan)) options.unshift({ code: settings.default_plan, name: settings.default_plan });
        return options;
    }, [plansQuery.data, settings.default_plan]);

    const changedSections = PARTNER_PORTAL_SECTIONS.filter((s) => sections[s.key] !== settings.sections[s.key]).map((s) => s.key);
    const planChanged = plan !== settings.default_plan;
    const dirty = changedSections.length > 0 || planChanged;

    const save = useMutation({
        mutationFn: () => {
            const payload: UpdatePartnerPortalPayload = {};
            if (changedSections.length) payload.sections = Object.fromEntries(changedSections.map((k) => [k, sections[k]]));
            if (planChanged) payload.default_plan = plan;
            if (reason.trim()) payload.reason = reason.trim();
            return platformConfigService.updatePartnerPortal(payload);
        },
        onSuccess: (updated) => {
            queryClient.setQueryData(PARTNER_PORTAL_KEY, updated);
            toast.success("Partner Portal settings saved");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save the Partner Portal settings"),
    });

    return (
        <Panel
            title="Partner Portal sections"
            icon={LayoutPanelLeft}
            actions={
                <Button variant="primary" icon={Save} onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
                    Save
                </Button>
            }
        >
            <p className="mb-4 text-sm text-ink-muted">
                Choose what businesses see in the Partner Portal and the app.
                {settings.updated_at ? ` Last changed ${formatDateTime(settings.updated_at)}.` : ""}
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {PARTNER_PORTAL_SECTIONS.map((s) => {
                    const on = sections[s.key];
                    return (
                        <li key={s.key} className="flex items-start justify-between gap-4 rounded-control border border-line bg-surface-muted p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-ink">
                                    {s.label}
                                    <span className={cx("ml-2 text-xs font-semibold", on ? "text-accent-700" : "text-ink-faint")}>{on ? "Shown" : "Hidden"}</span>
                                </p>
                                <p className="mt-0.5 text-xs text-ink-muted">{s.hint}</p>
                            </div>
                            <Switch
                                checked={on}
                                label={s.label}
                                hideLabel
                                disabled={save.isPending}
                                onChange={() => setSections((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                            />
                        </li>
                    );
                })}
            </ul>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Plan for every business" hint="Used for every business without an override. Growth for now.">
                    <SelectInput value={plan} onChange={(e) => setPlan(e.target.value)} disabled={plansQuery.isLoading || save.isPending}>
                        {planOptions.map((p) => (
                            <option key={p.code} value={p.code}>
                                {p.name}
                            </option>
                        ))}
                    </SelectInput>
                </Field>
                <Field label="Reason" hint="Optional. Saved to the change history.">
                    <TextInput type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Hiding plans until billing launches" />
                </Field>
            </div>
        </Panel>
    );
}

function TermsCard({ doc, label, who, current }: { doc: TermsDoc; label: string; who: string; current: TermsVersion | undefined }) {
    const queryClient = useQueryClient();
    const [version, setVersion] = useState("");
    const [url, setUrl] = useState(current?.url ?? "");
    const [confirm, setConfirm] = useState(false);

    const publish = useMutation({
        mutationFn: () => platformConfigService.publishTerms(doc, version.trim(), url.trim() || undefined),
        onSuccess: (t) => {
            toast.success(`${label} v${t.version} published — ${who} will re-accept on their next collab action`);
            setConfirm(false);
            setVersion("");
            queryClient.invalidateQueries({ queryKey: ["platform-terms"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to publish terms"),
    });

    const urlInvalid = url.trim() !== "" && !url.trim().startsWith("https://");
    const sameVersion = version.trim() !== "" && version.trim() === current?.version;

    return (
        <Panel title={label} icon={FileText}>
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface-muted p-3">
                    <div>
                        <p className="text-xs text-ink-muted">Current version</p>
                        <p className="font-mono text-lg font-semibold text-ink">{current?.version ?? "—"}</p>
                    </div>
                    {current?.url && (
                        <a href={current.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent-700 hover:underline">
                            <ExternalLink className="h-4 w-4" aria-hidden /> View
                        </a>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="New version" required error={sameVersion ? "Already the current version." : undefined}>
                        <TextInput type="text" maxLength={40} value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono" placeholder="2026-11" />
                    </Field>
                    <Field label="Document URL" className="sm:col-span-2" error={urlInvalid ? "Must start with https://" : undefined}>
                        <TextInput type="url" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seekkrr.com/…" />
                    </Field>
                </div>
                <Button variant="primary" icon={Upload} onClick={() => setConfirm(true)} disabled={!version.trim() || sameVersion || urlInvalid || publish.isPending}>
                    Publish version
                </Button>
            </div>
            <ConfirmDialog
                open={confirm}
                tone="warning"
                title={`Publish ${label} v${version.trim()}?`}
                description={`All ${who} must accept the new version before their next collab action.`}
                confirmLabel="Publish"
                onConfirm={() => publish.mutate()}
                onCancel={() => setConfirm(false)}
                isPending={publish.isPending}
            />
        </Panel>
    );
}

export function RolloutPage() {
    const { isAdmin } = useCollabAccess();
    const flagsQuery = useQuery({ queryKey: ["platform-feature-flags"], queryFn: platformConfigService.listFlags, enabled: isAdmin });
    const termsQuery = useQuery({ queryKey: ["platform-terms"], queryFn: platformConfigService.getTerms, enabled: isAdmin });
    const portalQuery = useQuery({ queryKey: PARTNER_PORTAL_KEY, queryFn: platformConfigService.getPartnerPortal, enabled: isAdmin });

    if (!isAdmin) return <AccessDenied message="Only admins can change the collabs rollout." />;

    const flag: FeatureFlag | undefined =
        flagsQuery.data?.find((f) => f.key === FLAG_KEY) ??
        (flagsQuery.data ? { key: FLAG_KEY, enabled: false, regions_enabled: [], min_app_version: null, updated_at: null } : undefined);

    return (
        <div className="max-w-[1200px] space-y-5">
            <PageHeader icon={Rocket} title="Rollout" description="Feature flag, region rollout, Partner Portal sections and collab terms versions" />

            <PanelState isLoading={flagsQuery.isLoading} error={flagsQuery.error} isEmpty={!flag} emptyIcon={Rocket} emptyText="Feature flag unavailable" onRetry={() => flagsQuery.refetch()}>
                {flag && <FlagEditor key={`${flag.key}-${flag.updated_at ?? ""}`} flag={flag} />}
            </PanelState>

            <PanelState
                isLoading={portalQuery.isLoading}
                error={portalQuery.error}
                isEmpty={!portalQuery.data}
                emptyIcon={LayoutPanelLeft}
                emptyText="Partner Portal settings unavailable"
                onRetry={() => portalQuery.refetch()}
            >
                {portalQuery.data && (
                    <PartnerPortalEditor
                        key={`${portalQuery.data.updated_at ?? ""}-${portalQuery.data.default_plan}-${JSON.stringify(portalQuery.data.sections)}`}
                        settings={portalQuery.data}
                    />
                )}
            </PanelState>

            <div className="space-y-3">
                <div>
                    <SectionHeading>Terms versions</SectionHeading>
                    <p className="mt-0.5 text-sm text-ink-muted">Publishing a new version forces re-acceptance (recorded per user with version, time and platform).</p>
                </div>
                <PanelState isLoading={termsQuery.isLoading} error={termsQuery.error} isEmpty={false} emptyIcon={FileText} emptyText="" onRetry={() => termsQuery.refetch()}>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {TERMS_DOCS.map((t) => (
                            <TermsCard key={`${t.doc}-${termsQuery.data?.[t.doc]?.version ?? ""}`} doc={t.doc} label={t.label} who={t.who} current={termsQuery.data?.[t.doc]} />
                        ))}
                    </div>
                </PanelState>
            </div>
        </div>
    );
}

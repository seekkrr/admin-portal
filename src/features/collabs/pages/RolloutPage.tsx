import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Rocket, Power, Globe, Save, FileText, ExternalLink, Upload, LayoutPanelLeft } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Card } from "@/components/ui/Card";
import { platformConfigService } from "../services/platform-config.service";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { Field, LoadingButtonIcon, PageHeader, PanelState, SectionCard, Switch, btnPrimary, inputClass } from "../components/CollabsUi";
import { RegionMultiSelect } from "../components/CollabPickers";
import { fmtDateTime } from "../utils";
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
            <Card padding="none" className={`overflow-hidden border-2 ${flag.enabled ? "border-emerald-200" : "border-red-200"}`}>
                <div className="p-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${flag.enabled ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                            <Power className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Global kill switch</p>
                            <h2 className="text-2xl font-bold text-neutral-900">Collabs are {flag.enabled ? "ON" : "OFF"}</h2>
                            <p className="text-sm text-neutral-500">
                                {flag.enabled
                                    ? `Visible in ${flag.regions_enabled.length} enabled region${flag.regions_enabled.length === 1 ? "" : "s"}.`
                                    : "Hidden in every app and region — no release needed to turn back on."}
                                {flag.updated_at ? ` Last changed ${fmtDateTime(flag.updated_at)}.` : ""}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setConfirmToggle(true)}
                        className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors ${
                            flag.enabled ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                    >
                        <Power className="w-4 h-4" /> {flag.enabled ? "Turn off everywhere" : "Turn on"}
                    </button>
                </div>
            </Card>

            <SectionCard
                title="Regions & minimum app version"
                icon={Globe}
                actions={
                    <button
                        type="button"
                        onClick={() => update.mutate({ regions_enabled: regions, min_app_version: minVersion.trim() })}
                        disabled={!settingsDirty || versionInvalid || update.isPending}
                        className={btnPrimary}
                    >
                        <LoadingButtonIcon loading={update.isPending && update.variables?.enabled === undefined} icon={Save} /> Save rollout
                    </button>
                }
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Field label="Enabled regions" hint="Collabs show only for markers whose region is listed here (exact region match — city or hotspot).">
                            <RegionMultiSelect value={regions} onChange={setRegions} />
                        </Field>
                    </div>
                    <Field
                        label="Minimum app version"
                        htmlFor="flag-min-version"
                        hint={versionInvalid ? "Use a version like 3.2.0." : "Older app builds hide collab UI. Leave empty for no minimum."}
                    >
                        <input
                            id="flag-min-version"
                            type="text"
                            maxLength={20}
                            value={minVersion}
                            onChange={(e) => setMinVersion(e.target.value)}
                            className={`${inputClass} font-mono`}
                            placeholder="e.g. 3.2.0"
                        />
                    </Field>
                </div>
            </SectionCard>

            <ConfirmModal
                open={confirmToggle}
                theme={flag.enabled ? "danger" : "warning"}
                title={flag.enabled ? "Turn collabs off everywhere?" : "Turn collabs on?"}
                message={
                    flag.enabled
                        ? "This immediately hides all collab UI for every creator and business in every region. Pending requests stay in place."
                        : `Collabs become visible in the ${regions.length} enabled region${regions.length === 1 ? "" : "s"}.`
                }
                confirmLabel={flag.enabled ? "Turn off" : "Turn on"}
                confirmStyle={flag.enabled ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}
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
        <SectionCard
            title="Partner Portal sections"
            icon={LayoutPanelLeft}
            actions={
                <button type="button" onClick={() => save.mutate()} disabled={!dirty || save.isPending} className={btnPrimary}>
                    <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save
                </button>
            }
        >
            <p className="text-sm text-neutral-500 mb-4">
                Choose what businesses see in the Partner Portal and the app.
                {settings.updated_at ? ` Last changed ${fmtDateTime(settings.updated_at)}.` : ""}
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PARTNER_PORTAL_SECTIONS.map((s) => {
                    const on = sections[s.key];
                    return (
                        <li key={s.key} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-neutral-100 bg-neutral-50/60">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-neutral-900">
                                    {s.label}
                                    <span className={`ml-2 text-xs font-semibold ${on ? "text-teal-700" : "text-neutral-400"}`}>{on ? "Shown" : "Hidden"}</span>
                                </p>
                                <p className="text-xs text-neutral-500 mt-0.5">{s.hint}</p>
                            </div>
                            <Switch
                                on={on}
                                label={s.label}
                                disabled={save.isPending}
                                onToggle={() => setSections((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                            />
                        </li>
                    );
                })}
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <Field label="Plan for every business" htmlFor="pp-default-plan" hint="Used for every business without an override. Growth for now.">
                    <select
                        id="pp-default-plan"
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        className={inputClass}
                        disabled={plansQuery.isLoading || save.isPending}
                    >
                        {planOptions.map((p) => (
                            <option key={p.code} value={p.code}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Reason" htmlFor="pp-reason" hint="Optional. Saved to the admin audit log.">
                    <input
                        id="pp-reason"
                        type="text"
                        maxLength={300}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Hiding plans until billing launches"
                    />
                </Field>
            </div>
        </SectionCard>
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
        <SectionCard title={label} icon={FileText}>
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div>
                        <p className="text-xs text-neutral-500">Current version</p>
                        <p className="text-lg font-bold font-mono text-neutral-900">{current?.version ?? "—"}</p>
                    </div>
                    {current?.url && (
                        <a href={current.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
                            <ExternalLink className="w-4 h-4" /> View
                        </a>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="New version" htmlFor={`terms-v-${doc}`} required hint={sameVersion ? "Already the current version." : undefined}>
                        <input id={`terms-v-${doc}`} type="text" maxLength={40} value={version} onChange={(e) => setVersion(e.target.value)} className={`${inputClass} font-mono`} placeholder="2026-11" />
                    </Field>
                    <div className="sm:col-span-2">
                        <Field label="Document URL" htmlFor={`terms-u-${doc}`} hint={urlInvalid ? "Must start with https://" : undefined}>
                            <input id={`terms-u-${doc}`} type="url" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} placeholder="https://seekkrr.com/…" />
                        </Field>
                    </div>
                </div>
                <button type="button" onClick={() => setConfirm(true)} disabled={!version.trim() || sameVersion || urlInvalid || publish.isPending} className={btnPrimary}>
                    <Upload className="w-4 h-4" /> Publish version
                </button>
            </div>
            <ConfirmModal
                open={confirm}
                theme="warning"
                title={`Publish ${label} v${version.trim()}`}
                message={`All ${who} must accept the new version before their next collab action.`}
                confirmLabel="Publish"
                confirmStyle="bg-teal-600 hover:bg-teal-700"
                onConfirm={() => publish.mutate()}
                onCancel={() => setConfirm(false)}
                isPending={publish.isPending}
            />
        </SectionCard>
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
        <div className="max-w-[1200px] space-y-5 animate-fade-in">
            <PageHeader icon={Rocket} title="Rollout" gradient="from-amber-500 to-amber-600" subtitle="Feature flag, region rollout, Partner Portal sections and collab terms versions" />

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

            <div>
                <h2 className="text-lg font-bold text-neutral-900 mb-1">Terms versions</h2>
                <p className="text-sm text-neutral-500 mb-3">Publishing a new version forces re-acceptance (recorded per user with version, time and platform).</p>
                <PanelState isLoading={termsQuery.isLoading} error={termsQuery.error} isEmpty={false} emptyIcon={FileText} emptyText="" onRetry={() => termsQuery.refetch()}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {TERMS_DOCS.map((t) => (
                            <TermsCard key={`${t.doc}-${termsQuery.data?.[t.doc]?.version ?? ""}`} doc={t.doc} label={t.label} who={t.who} current={termsQuery.data?.[t.doc]} />
                        ))}
                    </div>
                </PanelState>
            </div>
        </div>
    );
}

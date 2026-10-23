import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SlidersHorizontal, Play, Save, RotateCcw, FlaskConical, BarChart3, Scale, Sparkles } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import {
    Checkbox, Chip, Field, LoadingButtonIcon, PageHeader, PanelState, SectionCard, btnPrimary, btnSecondary, inputClass, thClass,
} from "../components/CollabsUi";
import { formatPercent } from "../utils";
import {
    MATCH_WEIGHT_KEYS, type MatchConfig, type MatchRerank, type MatchVariantPayload, type MatchWeightKey, type MatchWeights,
} from "../types";

const WEIGHT_META: Record<MatchWeightKey, { label: string; help: string }> = {
    theme: { label: "Theme affinity", help: "Travel styles, niches & quest themes vs business categories" },
    local: { label: "Local presence", help: "Region check-ins/quests; “in town now” boost" },
    quality: { label: "Quality", help: "Ratings, verified badge & followers, travelers served" },
    reliability: { label: "Reliability", help: "Completed ÷ redeemed, no-shows (Wilson bound)" },
    content: { label: "Content fit", help: "Brief deliverables vs ownership-verified platforms" },
    peer: { label: "Peer signal", help: "Similar businesses rated these creators highly" },
    activity: { label: "Activity", help: "Last active & recent check-ins" },
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const sumWeights = (w: MatchWeights) => MATCH_WEIGHT_KEYS.reduce((s, k) => s + (w[k] ?? 0), 0);

function normalize(w: MatchWeights): MatchWeights {
    const total = sumWeights(w);
    if (total <= 0) return w;
    return Object.fromEntries(MATCH_WEIGHT_KEYS.map((k) => [k, round((w[k] ?? 0) / total, 3)])) as MatchWeights;
}

function Slider({
    label,
    help,
    value,
    onChange,
    max = 1,
    changed,
}: {
    label: string;
    help?: string;
    value: number;
    onChange: (v: number) => void;
    max?: number;
    changed?: boolean;
}) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <label className="text-sm font-medium text-neutral-800">
                    {label}
                    {changed && <span className="ml-1.5 text-[10px] font-semibold text-amber-600">changed</span>}
                </label>
                <input
                    type="number"
                    min={0}
                    max={max}
                    step={0.01}
                    value={value}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(0, n)));
                    }}
                    className="w-20 px-2 py-1 rounded-lg border border-neutral-200 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                    aria-label={`${label} value`}
                />
            </div>
            <input
                type="range"
                min={0}
                max={max}
                step={0.01}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-teal-600 mt-1"
                aria-label={label}
            />
            {help && <p className="text-[11px] text-neutral-400">{help}</p>}
        </div>
    );
}

function WeightsEditor({ value, onChange, baseline }: { value: MatchWeights; onChange: (w: MatchWeights) => void; baseline?: MatchWeights }) {
    const total = sumWeights(value);
    return (
        <div className="space-y-4">
            {MATCH_WEIGHT_KEYS.map((k) => (
                <Slider
                    key={k}
                    label={WEIGHT_META[k].label}
                    help={WEIGHT_META[k].help}
                    value={value[k] ?? 0}
                    changed={!!baseline && round(baseline[k] ?? 0, 3) !== round(value[k] ?? 0, 3)}
                    onChange={(v) => onChange({ ...value, [k]: round(v, 3) })}
                />
            ))}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-100">
                <span className={`text-xs ${Math.abs(total - 1) > 0.01 ? "text-amber-700" : "text-neutral-500"}`}>
                    Sum: <span className="font-mono font-semibold">{round(total, 3)}</span>
                    {Math.abs(total - 1) > 0.01 && " — scores are a weighted blend; normalizing keeps them comparable."}
                </span>
                <button type="button" onClick={() => onChange(normalize(value))} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
                    <Scale className="w-3.5 h-3.5" /> Normalize to 1
                </button>
            </div>
        </div>
    );
}

function MatchTuningEditor({
    config,
    savedVariant,
    onSaved,
}: {
    config: MatchConfig;
    /** Variant saved earlier in this session (the API never returns it). */
    savedVariant: MatchVariantPayload | null;
    onSaved: (variant: MatchVariantPayload | null) => void;
}) {
    const queryClient = useQueryClient();
    const [weights, setWeights] = useState<MatchWeights>(config.weights);
    const [rerank, setRerank] = useState<MatchRerank>(config.rerank);
    const [variantOn, setVariantOn] = useState(!!savedVariant);
    const [variantVersion, setVariantVersion] = useState(savedVariant?.version ?? "exp-1");
    const [variantTraffic, setVariantTraffic] = useState(savedVariant?.traffic_percent ?? 10);
    const [variantWeights, setVariantWeights] = useState<MatchWeights>(savedVariant?.weights ?? config.weights);
    const [confirmSave, setConfirmSave] = useState(false);

    // Preview
    const [collabId, setCollabId] = useState("");
    const [limit, setLimit] = useState(10);
    const [previewWith, setPreviewWith] = useState<"main" | "variant" | "saved">("main");

    const collabsQuery = useQuery({
        queryKey: ["collabs-admin-collabs", { status: "active" }],
        queryFn: () => collabsAdminService.listCollabs({ status: "active", page: 1 }),
        staleTime: 60 * 1000,
    });

    const preview = useMutation({
        mutationFn: () =>
            collabsAdminService.previewMatch({
                collab_id: collabId.trim(),
                limit,
                ...(previewWith === "saved"
                    ? {}
                    : { weights: previewWith === "variant" ? variantWeights : weights, rerank }),
            }),
        onError: (e: Error) => toast.error(e.message || "Preview failed"),
    });

    const variantPayload: MatchVariantPayload | null = variantOn
        ? { version: variantVersion.trim(), traffic_percent: variantTraffic, weights: variantWeights, rerank }
        : null;

    const save = useMutation({
        mutationFn: () => collabsAdminService.saveMatchConfig({ weights, rerank, variant: variantPayload }),
        onSuccess: (cfg) => {
            toast.success(`Match config saved as ${cfg.version}. Cached matches were cleared.`);
            setConfirmSave(false);
            onSaved(variantPayload);
            queryClient.setQueryData(["collabs-match-config"], cfg);
            queryClient.invalidateQueries({ queryKey: ["collabs-match-evaluation"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save match config"),
    });

    const dirty =
        MATCH_WEIGHT_KEYS.some((k) => round(weights[k] ?? 0, 3) !== round(config.weights[k] ?? 0, 3)) ||
        round(rerank.lambda, 3) !== round(config.rerank.lambda, 3) ||
        round(rerank.explore_ratio, 3) !== round(config.rerank.explore_ratio, 3) ||
        JSON.stringify(variantPayload) !== JSON.stringify(savedVariant);

    const variantInvalid = variantOn && (!variantVersion.trim() || variantTraffic < 1 || variantTraffic > 100);
    const collabs = collabsQuery.data?.collabs ?? [];
    const results = preview.data ?? [];

    return (
        <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <SectionCard
                    title="Scoring weights"
                    icon={SlidersHorizontal}
                    actions={
                        <div className="flex items-center gap-2">
                            <Chip tone="teal">Live: {config.version}</Chip>
                            <button
                                type="button"
                                onClick={() => {
                                    setWeights(config.weights);
                                    setRerank(config.rerank);
                                    setVariantOn(!!savedVariant);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Reset
                            </button>
                        </div>
                    }
                >
                    <WeightsEditor value={weights} onChange={setWeights} baseline={config.weights} />
                    <div className="mt-6 pt-4 border-t border-neutral-100 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Re-rank (MMR diversity)</p>
                        <Slider
                            label="Lambda (relevance vs diversity)"
                            help="1 = pure relevance; lower = more diverse result list."
                            value={rerank.lambda}
                            changed={round(rerank.lambda, 3) !== round(config.rerank.lambda, 3)}
                            onChange={(v) => setRerank({ ...rerank, lambda: round(v, 3) })}
                        />
                        <Slider
                            label="Explore ratio (new creators)"
                            help="Share of slots reserved for new creators (0–0.5)."
                            max={0.5}
                            value={rerank.explore_ratio}
                            changed={round(rerank.explore_ratio, 3) !== round(config.rerank.explore_ratio, 3)}
                            onChange={(v) => setRerank({ ...rerank, explore_ratio: round(v, 3) })}
                        />
                    </div>
                </SectionCard>

                <div className="space-y-4">
                    <SectionCard title="A/B variant" icon={FlaskConical}>
                        <div className="space-y-4">
                            <Checkbox
                                checked={variantOn}
                                onChange={setVariantOn}
                                label="Run a variant on a share of businesses"
                                hint="Businesses are bucketed by hash(business_id) % 100."
                            />
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                {savedVariant
                                    ? `Variant “${savedVariant.version}” (${savedVariant.traffic_percent}%) was saved in this session. `
                                    : "The API doesn't report the currently running variant. "}
                                Saving with this unchecked removes any existing variant.
                            </p>
                            {variantOn && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Variant version label" htmlFor="variant-version" required>
                                            <input
                                                id="variant-version"
                                                type="text"
                                                value={variantVersion}
                                                onChange={(e) => setVariantVersion(e.target.value)}
                                                className={`${inputClass} font-mono`}
                                            />
                                        </Field>
                                        <Field label="Traffic %" htmlFor="variant-traffic" required hint="1–100">
                                            <input
                                                id="variant-traffic"
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={variantTraffic}
                                                onChange={(e) => setVariantTraffic(Number(e.target.value))}
                                                className={inputClass}
                                            />
                                        </Field>
                                    </div>
                                    <WeightsEditor value={variantWeights} onChange={setVariantWeights} baseline={weights} />
                                    <p className="text-[11px] text-neutral-400">The variant uses the same re-rank settings as the main config.</p>
                                </>
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title="Preview against a collab" icon={Play}>
                        <div className="space-y-4">
                            <Field label="Collab" htmlFor="preview-collab" hint="Pick an active collab or paste any collab id.">
                                <select
                                    id="preview-collab"
                                    value={collabs.some((c) => c.id === collabId) ? collabId : ""}
                                    onChange={(e) => setCollabId(e.target.value)}
                                    className={inputClass}
                                    disabled={collabsQuery.isLoading}
                                >
                                    <option value="">{collabsQuery.isLoading ? "Loading active collabs…" : "— Select an active collab —"}</option>
                                    {collabs.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.offer} — wants {c.want || "…"} ({c.id.slice(-6)})
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={collabId}
                                    onChange={(e) => setCollabId(e.target.value)}
                                    placeholder="Collab id"
                                    className={`${inputClass} font-mono mt-2`}
                                    aria-label="Collab id"
                                />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Results" htmlFor="preview-limit">
                                    <input
                                        id="preview-limit"
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={limit}
                                        onChange={(e) => setLimit(Math.min(50, Math.max(1, Number(e.target.value) || 10)))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="Score with" htmlFor="preview-with">
                                    <select id="preview-with" value={previewWith} onChange={(e) => setPreviewWith(e.target.value as typeof previewWith)} className={inputClass}>
                                        <option value="main">Edited main weights</option>
                                        {variantOn && <option value="variant">Variant weights</option>}
                                        <option value="saved">Saved live config</option>
                                    </select>
                                </Field>
                            </div>
                            <button type="button" onClick={() => preview.mutate()} disabled={!collabId.trim() || preview.isPending} className={`${btnSecondary} w-full`}>
                                <LoadingButtonIcon loading={preview.isPending} icon={Play} /> Run preview
                            </button>
                        </div>
                    </SectionCard>
                </div>
            </div>

            {(preview.data || preview.isPending) && (
                <SectionCard title="Preview ranking" icon={Sparkles} bodyClassName="p-0">
                    {preview.isPending ? (
                        <LoadingFallback message="Scoring creators..." />
                    ) : results.length === 0 ? (
                        <p className="p-8 text-center text-sm text-neutral-400">No eligible creators for this collab (hard filters remove opted-out, blocked or under-tier creators).</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                        <th className={thClass}>#</th>
                                        <th className={thClass}>Creator</th>
                                        <th className={`${thClass} text-right`}>Score</th>
                                        <th className={thClass}>Reasons</th>
                                        <th className={thClass}>Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                    {results.map((r, i) => (
                                        <tr key={r.creator_user_id} className="align-top">
                                            <td className="px-4 py-3 text-neutral-400 font-mono">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-neutral-900 flex items-center gap-2">
                                                    {r.display_name}
                                                    {r.is_new && <Chip tone="violet">New</Chip>}
                                                </div>
                                                <div className="font-mono text-[11px] text-neutral-400">{r.creator_user_id}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-lg font-bold text-neutral-900">{r.score}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {r.reasons.map((reason) => (
                                                        <Chip key={reason} tone="teal">
                                                            {reason}
                                                        </Chip>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 min-w-[240px]">
                                                <div className="grid grid-cols-[80px_1fr_36px] gap-x-2 gap-y-1 items-center">
                                                    {MATCH_WEIGHT_KEYS.map((k) => {
                                                        const v = r.breakdown?.[k] ?? 0;
                                                        return (
                                                            <div key={k} className="contents">
                                                                <span className="text-[11px] text-neutral-500">{WEIGHT_META[k].label.split(" ")[0]}</span>
                                                                <span className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                                                                    <span className="block h-full bg-teal-500" style={{ width: `${Math.round(v * 100)}%` }} />
                                                                </span>
                                                                <span className="text-[11px] font-mono text-neutral-500 text-right">{v.toFixed(2)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-0 z-10 bg-white/90 backdrop-blur border border-neutral-200 rounded-2xl shadow-lg p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-neutral-600">
                    {dirty ? "Unsaved changes — preview them first, then save to go live." : "Showing the live configuration."}
                </p>
                <button type="button" onClick={() => setConfirmSave(true)} disabled={!dirty || variantInvalid || save.isPending} className={btnPrimary}>
                    <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save config
                </button>
            </div>

            <ConfirmModal
                open={confirmSave}
                theme="warning"
                title="Save match config"
                message="New weights apply to every business's SeekKrr Match ranking and clear the match cache. The previous config is kept in history."
                confirmLabel="Save"
                confirmStyle="bg-teal-600 hover:bg-teal-700"
                onConfirm={() => save.mutate()}
                onCancel={() => setConfirmSave(false)}
                isPending={save.isPending}
            />
        </>
    );
}

function EvaluationTable() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-match-evaluation"],
        queryFn: collabsAdminService.matchEvaluation,
        staleTime: 60 * 1000,
    });
    const rows = data ?? [];
    return (
        <SectionCard title="Evaluation by config version" icon={BarChart3} bodyClassName="p-0">
            <PanelState isLoading={isLoading} error={error} isEmpty={rows.length === 0} emptyIcon={BarChart3} emptyText="No match events recorded yet" onRetry={() => refetch()}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                <th className={thClass}>Version</th>
                                <th className={`${thClass} text-right`}>Impressions</th>
                                <th className={`${thClass} text-right`}>Reveals</th>
                                <th className={`${thClass} text-right`}>Invites</th>
                                <th className={`${thClass} text-right`}>Accepted</th>
                                <th className={`${thClass} text-right`}>Completed</th>
                                <th className={`${thClass} text-right`}>Invite acceptance</th>
                                <th className={`${thClass} text-right`}>Completion after accept</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {rows.map((r) => (
                                <tr key={r.config_version}>
                                    <td className="px-4 py-2.5 font-mono font-medium">{r.config_version}</td>
                                    <td className="px-4 py-2.5 text-right">{r.impression}</td>
                                    <td className="px-4 py-2.5 text-right">{r.reveal}</td>
                                    <td className="px-4 py-2.5 text-right">{r.invite}</td>
                                    <td className="px-4 py-2.5 text-right">{r.accept}</td>
                                    <td className="px-4 py-2.5 text-right">{r.complete}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold">{formatPercent(r.invite_acceptance, 1)}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold">{formatPercent(r.completion_after_accept, 1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </PanelState>
        </SectionCard>
    );
}

export function MatchTuningPage() {
    const { isAdmin } = useCollabAccess();
    const [savedVariant, setSavedVariant] = useState<MatchVariantPayload | null>(null);
    const { data: config, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-match-config"],
        queryFn: collabsAdminService.getMatchConfig,
        enabled: isAdmin,
    });

    if (!isAdmin) return <AccessDenied message="Only admins can tune SeekKrr Match." />;

    return (
        <div className="space-y-5 animate-fade-in">
            <PageHeader
                icon={SlidersHorizontal}
                title="Match Tuning"
                gradient="from-indigo-500 to-indigo-600"
                subtitle="SeekKrr Match: explainable weighted scorers + MMR re-rank. Preview changes before they go live."
            />
            <PanelState isLoading={isLoading} error={error} isEmpty={!config} emptyIcon={SlidersHorizontal} emptyText="No match config" onRetry={() => refetch()}>
                {config && <MatchTuningEditor key={config.version} config={config} savedVariant={savedVariant} onSaved={setSavedVariant} />}
            </PanelState>
            <EvaluationTable />
        </div>
    );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SlidersHorizontal, Play, Save, RotateCcw, FlaskConical, BarChart3, Scale, Sparkles } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, SelectInput, TextInput } from "@/components/ui/Field";
import { LoadingState, PanelState } from "@/components/ui/States";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { cx } from "@/utils/cx";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import { Notice } from "../components/AdminBits";
import { formatPercent } from "../utils";
import {
    MATCH_WEIGHT_KEYS, type MatchConfig, type MatchEvaluationRow, type MatchPreviewResult, type MatchRerank, type MatchVariantPayload,
    type MatchWeightKey, type MatchWeights,
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
                <span className="text-sm font-medium text-ink">
                    {label}
                    {changed && <span className="ml-1.5 text-[11px] font-semibold text-warn">changed</span>}
                </span>
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
                    className="h-8 w-20 rounded-control border border-line-strong bg-surface px-2 text-right font-mono text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
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
                className="mt-1 w-full accent-accent-600"
                aria-label={label}
            />
            {help && <p className="text-xs text-ink-faint">{help}</p>}
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-2">
                <span className={cx("text-xs", Math.abs(total - 1) > 0.01 ? "text-warn" : "text-ink-muted")}>
                    Sum: <span className="font-mono font-semibold">{round(total, 3)}</span>
                    {Math.abs(total - 1) > 0.01 && " — scores are a weighted blend; normalizing keeps them comparable."}
                </span>
                <Button size="sm" variant="ghost" icon={Scale} onClick={() => onChange(normalize(value))}>
                    Normalize to 1
                </Button>
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

    const previewColumns: DataColumn<MatchPreviewResult & { rank: number }>[] = [
        { id: "rank", header: "#", sortValue: (r) => r.rank, cell: (r) => <span className="font-mono text-ink-faint">{r.rank}</span> },
        {
            id: "creator",
            header: "Creator",
            hideable: false,
            sortValue: (r) => r.display_name,
            csv: (r) => `${r.display_name} ${r.creator_user_id}`,
            cell: (r) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-ink">
                        {r.display_name}
                        {r.is_new && <Tag tone="info">New</Tag>}
                    </div>
                    <IdLink kind="user" id={r.creator_user_id} />
                </div>
            ),
        },
        { id: "score", header: "Score", align: "right", sortValue: (r) => r.score, cell: (r) => <span className="text-lg font-semibold tabular-nums text-ink">{r.score}</span> },
        {
            id: "reasons",
            header: "Reasons",
            csv: (r) => r.reasons.join("; "),
            cell: (r) => (
                <div className="flex flex-wrap gap-1">
                    {r.reasons.map((reason) => (
                        <Tag key={reason} tone="brand">
                            {reason}
                        </Tag>
                    ))}
                </div>
            ),
        },
        {
            id: "breakdown",
            header: "Breakdown",
            className: "min-w-[240px]",
            csv: (r) => MATCH_WEIGHT_KEYS.map((k) => `${k}=${(r.breakdown?.[k] ?? 0).toFixed(2)}`).join(" "),
            cell: (r) => (
                <div className="grid grid-cols-[80px_1fr_36px] items-center gap-x-2 gap-y-1">
                    {MATCH_WEIGHT_KEYS.map((k) => {
                        const v = r.breakdown?.[k] ?? 0;
                        return (
                            <div key={k} className="contents">
                                <span className="text-xs text-ink-muted">{WEIGHT_META[k].label.split(" ")[0]}</span>
                                <span className="h-1.5 overflow-hidden rounded-full bg-brand-50">
                                    <span className="block h-full bg-accent-500" style={{ width: `${Math.round(v * 100)}%` }} />
                                </span>
                                <span className="text-right font-mono text-xs text-ink-muted">{v.toFixed(2)}</span>
                            </div>
                        );
                    })}
                </div>
            ),
        },
    ];

    return (
        <>
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <Panel
                    title="Scoring weights"
                    icon={SlidersHorizontal}
                    actions={
                        <>
                            <Tag tone="brand">Live: {config.version}</Tag>
                            <Button
                                size="sm"
                                variant="ghost"
                                icon={RotateCcw}
                                onClick={() => {
                                    setWeights(config.weights);
                                    setRerank(config.rerank);
                                    setVariantOn(!!savedVariant);
                                }}
                            >
                                Reset
                            </Button>
                        </>
                    }
                >
                    <WeightsEditor value={weights} onChange={setWeights} baseline={config.weights} />
                    <div className="mt-6 space-y-4 border-t border-line pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Re-rank (MMR diversity)</p>
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
                </Panel>

                <div className="space-y-4">
                    <Panel title="A/B variant" icon={FlaskConical}>
                        <div className="space-y-4">
                            <Checkbox
                                checked={variantOn}
                                onChange={setVariantOn}
                                label="Run a variant on a share of businesses"
                                hint="Businesses are bucketed by hash(business_id) % 100."
                            />
                            <Notice tone="warn">
                                {savedVariant
                                    ? `Variant “${savedVariant.version}” (${savedVariant.traffic_percent}%) was saved in this session. `
                                    : "The API doesn't report the currently running variant. "}
                                Saving with this unchecked removes any existing variant.
                            </Notice>
                            {variantOn && (
                                <>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Field label="Variant version label" required>
                                            <TextInput type="text" value={variantVersion} onChange={(e) => setVariantVersion(e.target.value)} className="font-mono" />
                                        </Field>
                                        <Field label="Traffic %" required hint="1–100">
                                            <TextInput type="number" min={1} max={100} value={variantTraffic} onChange={(e) => setVariantTraffic(Number(e.target.value))} />
                                        </Field>
                                    </div>
                                    <WeightsEditor value={variantWeights} onChange={setVariantWeights} baseline={weights} />
                                    <p className="text-xs text-ink-faint">The variant uses the same re-rank settings as the main config.</p>
                                </>
                            )}
                        </div>
                    </Panel>

                    <Panel title="Preview against a collab" icon={Play}>
                        <div className="space-y-4">
                            <Field label="Collab" hint="Pick an active collab or paste any collab id below.">
                                <SelectInput
                                    value={collabs.some((c) => c.id === collabId) ? collabId : ""}
                                    onChange={(e) => setCollabId(e.target.value)}
                                    disabled={collabsQuery.isLoading}
                                >
                                    <option value="">{collabsQuery.isLoading ? "Loading active collabs…" : "— Select an active collab —"}</option>
                                    {collabs.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.offer} — wants {c.want || "…"} ({c.id.slice(-6)})
                                        </option>
                                    ))}
                                </SelectInput>
                            </Field>
                            <Field label="Collab id" hideLabel>
                                <TextInput type="text" value={collabId} onChange={(e) => setCollabId(e.target.value)} placeholder="Collab id" className="font-mono" />
                            </Field>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label="Results">
                                    <TextInput
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={limit}
                                        onChange={(e) => setLimit(Math.min(50, Math.max(1, Number(e.target.value) || 10)))}
                                    />
                                </Field>
                                <Field label="Score with">
                                    <SelectInput value={previewWith} onChange={(e) => setPreviewWith(e.target.value as typeof previewWith)}>
                                        <option value="main">Edited main weights</option>
                                        {variantOn && <option value="variant">Variant weights</option>}
                                        <option value="saved">Saved live config</option>
                                    </SelectInput>
                                </Field>
                            </div>
                            <Button variant="secondary" icon={Play} block onClick={() => preview.mutate()} disabled={!collabId.trim()} loading={preview.isPending}>
                                Run preview
                            </Button>
                        </div>
                    </Panel>
                </div>
            </div>

            {(preview.data || preview.isPending) && (
                <Panel title="Preview ranking" icon={Sparkles} bodyClassName="p-0">
                    {preview.isPending ? (
                        <LoadingState label="Scoring creators…" />
                    ) : (
                        <DataTable
                            label="Preview ranking"
                            rows={results.map((r, i) => ({ ...r, rank: i + 1 }))}
                            columns={previewColumns}
                            rowKey={(r) => r.creator_user_id}
                            empty={{
                                icon: Sparkles,
                                title: "No eligible creators for this collab",
                                description: "Hard filters remove opted-out, blocked or under-tier creators.",
                            }}
                            exportName="match-preview"
                            frame="bare"
                            card={{ title: (r) => `${r.rank}. ${r.display_name}`, subtitle: (r) => `Score ${r.score}`, fields: ["reasons", "breakdown"] }}
                        />
                    )}
                </Panel>
            )}

            <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/95 p-4 shadow-pop backdrop-blur md:bottom-4">
                <p className="text-sm text-ink-muted">{dirty ? "Unsaved changes — preview them first, then save to go live." : "Showing the live configuration."}</p>
                <Button variant="primary" icon={Save} onClick={() => setConfirmSave(true)} disabled={!dirty || variantInvalid} loading={save.isPending}>
                    Save config
                </Button>
            </div>

            <ConfirmDialog
                open={confirmSave}
                tone="warning"
                title="Save match config?"
                description="New weights apply to every business's SeekKrr Match ranking and clear the match cache. The previous config is kept in history."
                confirmLabel="Save"
                onConfirm={() => save.mutate()}
                onCancel={() => setConfirmSave(false)}
                isPending={save.isPending}
            />
        </>
    );
}

const pct = (v: number | null) => formatPercent(v, 1);

const EVAL_COLUMNS: DataColumn<MatchEvaluationRow>[] = [
    { id: "version", header: "Version", hideable: false, sortValue: (r) => r.config_version, cell: (r) => <span className="font-mono font-medium">{r.config_version}</span> },
    { id: "impression", header: "Impressions", align: "right", sortValue: (r) => r.impression, cell: (r) => <span className="tabular-nums">{r.impression}</span> },
    { id: "reveal", header: "Reveals", align: "right", sortValue: (r) => r.reveal, cell: (r) => <span className="tabular-nums">{r.reveal}</span> },
    { id: "invite", header: "Invites", align: "right", sortValue: (r) => r.invite, cell: (r) => <span className="tabular-nums">{r.invite}</span> },
    { id: "accept", header: "Accepted", align: "right", sortValue: (r) => r.accept, cell: (r) => <span className="tabular-nums">{r.accept}</span> },
    { id: "complete", header: "Completed", align: "right", sortValue: (r) => r.complete, cell: (r) => <span className="tabular-nums">{r.complete}</span> },
    {
        id: "invite_acceptance",
        header: "Invite acceptance",
        align: "right",
        sortValue: (r) => r.invite_acceptance,
        csv: (r) => pct(r.invite_acceptance),
        cell: (r) => <span className="font-semibold">{pct(r.invite_acceptance)}</span>,
    },
    {
        id: "completion_after_accept",
        header: "Completion after accept",
        align: "right",
        sortValue: (r) => r.completion_after_accept,
        csv: (r) => pct(r.completion_after_accept),
        cell: (r) => <span className="font-semibold">{pct(r.completion_after_accept)}</span>,
    },
];

function EvaluationTable() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["collabs-match-evaluation"],
        queryFn: collabsAdminService.matchEvaluation,
        staleTime: 60 * 1000,
    });
    return (
        <Panel title="Evaluation by config version" icon={BarChart3} bodyClassName="p-0">
            <DataTable
                label="Evaluation by config version"
                rows={data ?? []}
                columns={EVAL_COLUMNS}
                rowKey={(r) => r.config_version}
                isLoading={isLoading}
                error={error}
                onRetry={() => refetch()}
                empty={{ icon: BarChart3, title: "No match events recorded yet" }}
                storageKey="match-evaluation"
                exportName="match-evaluation"
                frame="bare"
                card={{ title: (r) => r.config_version, fields: ["invite_acceptance", "completion_after_accept", "impression", "invite"] }}
            />
        </Panel>
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
        <div className="space-y-5">
            <PageHeader
                icon={SlidersHorizontal}
                title="Match tuning"
                description="SeekKrr Match: explainable weighted scorers + MMR re-rank. Preview changes before they go live."
            />
            <PanelState isLoading={isLoading} error={error} isEmpty={!config} emptyIcon={SlidersHorizontal} emptyText="No match config" onRetry={() => refetch()}>
                {config && <MatchTuningEditor key={config.version} config={config} savedVariant={savedVariant} onSaved={setSavedVariant} />}
            </PanelState>
            <EvaluationTable />
        </div>
    );
}

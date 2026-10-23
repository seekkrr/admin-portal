import { useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Power, Trash2, KeyRound, Calculator, Gift, Layers } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Field, TextArea } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { IdLink } from "@/components/ui/IdLink";
import { CopyText } from "@/components/ui/CopyText";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { humanizeStatus } from "@/components/ui/status";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDateTime } from "@/utils/date";
import { taskConfigsService } from "../services/task-configs.service";
import { stepRewardsService } from "../services/step-rewards.service";
import { RewardResult } from "../components/EvaluateModal";
import type { RewardEvaluation, StepReward, TaskConfig } from "@/types";

export function TaskConfigDetailPage() {
    const { taskId: taskIdParam } = useParams<{ taskId: string }>();
    const taskId = taskIdParam ?? "";
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const IS_SUPER = !!user?.role?.includes("super_admin");

    const [revealAnswers, setRevealAnswers] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);

    const { data: task, isLoading, error, refetch } = useQuery({
        queryKey: ["task-config-detail", taskId],
        queryFn: () => taskConfigsService.getById(taskId),
        enabled: !!taskId,
        staleTime: 60 * 1000,
    });
    usePageTitle(task?.title);

    const fullQuery = useQuery({
        queryKey: ["task-config-full", taskId],
        queryFn: () => taskConfigsService.getFull(taskId),
        enabled: !!taskId && revealAnswers && CAN_MANAGE,
        staleTime: 60 * 1000,
    });

    const linkedRewardQuery = useQuery({
        queryKey: ["step-reward-for-task", taskId],
        queryFn: () => stepRewardsService.forContext("task_completion", taskId),
        enabled: !!taskId,
        staleTime: 60 * 1000,
    });

    // Sibling task configs at the same place / quest (spot duplicate or conflicting tasks).
    const byMarkerQuery = useQuery({
        queryKey: ["task-configs-by-marker", task?.marker_id],
        queryFn: () => taskConfigsService.byMarker(task?.marker_id ?? ""),
        enabled: !!task?.marker_id,
        staleTime: 60 * 1000,
    });

    const byQuestQuery = useQuery({
        queryKey: ["task-configs-by-quest", task?.quest_id],
        queryFn: () => taskConfigsService.byQuest(task?.quest_id ?? ""),
        enabled: !!task?.quest_id,
        staleTime: 60 * 1000,
    });

    const toggleMutation = useMutation({
        mutationFn: () => taskConfigsService.toggleActive(taskId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["task-config-detail", taskId] });
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Active state toggled");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to toggle"),
    });

    const deleteMutation = useMutation({
        mutationFn: () => taskConfigsService.remove(taskId, IS_SUPER ? hardDelete : false),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Task config deleted");
            navigate("/task-configs", { replace: true });
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete");
            setShowDelete(false);
        },
    });

    if (isLoading) return <LoadingState label="Loading task config…" />;

    if (error || !task) {
        return (
            <Panel>
                {error ? (
                    <ErrorState error={error} title="Couldn't load this task config" onRetry={() => refetch()} />
                ) : (
                    <EmptyState icon={Settings2} title="This task config doesn't exist." action={<Link to="/task-configs" className="text-sm font-medium text-accent-700 hover:underline">Back to task configs</Link>} />
                )}
            </Panel>
        );
    }

    const full = fullQuery.data;
    const correctAnswer = full?.quiz_data?.correct_answer;
    const expectedValue = full?.qr_data && typeof full.qr_data === "object" ? (full.qr_data as Record<string, unknown>).expected_value : undefined;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Settings2}
                title={task.title}
                badge={
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-normal">
                        <Tag>{humanizeStatus(task.task_type)}</Tag>
                        <Tag tone={task.is_active ? "good" : "neutral"}>{task.is_active ? "Active" : "Inactive"}</Tag>
                    </span>
                }
                description={`${task.base_points.toLocaleString("en-IN")} points`}
                actions={
                    CAN_MANAGE && (
                        <>
                            <Button variant="secondary" icon={Power} onClick={() => toggleMutation.mutate()} loading={toggleMutation.isPending}>
                                {task.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="danger" icon={Trash2} onClick={() => setShowDelete(true)} disabled={deleteMutation.isPending}>
                                Delete
                            </Button>
                        </>
                    )
                }
            />

            <Panel title="Details">
                <DetailList>
                    <DetailRow label="Description" value={task.description ? <span className="whitespace-pre-wrap">{task.description}</span> : "—"} />
                    <DetailRow label="Place" value={<IdLink kind="place" id={task.marker_id} short={false} />} />
                    <DetailRow label="Quest" value={<IdLink kind="quest" id={task.quest_id} short={false} />} />
                    <DetailRow label="Base points" value={task.base_points.toLocaleString("en-IN")} />
                    <DetailRow label="Created by" value={<IdLink kind="user" id={task.created_by} />} />
                    <DetailRow label="Created" value={formatDateTime(task.created_at)} />
                    <DetailRow label="Updated" value={formatDateTime(task.updated_at)} />
                    <DetailRow label="ID" value={<CopyText value={task._id} mono truncate={false} />} />
                </DetailList>
            </Panel>

            {/* Type-specific config objects */}
            <PhotoRequirementsSection value={task.photo_requirements} />
            <QrDataSection value={task.qr_data} />
            <QuizDataSection value={task.quiz_data} />
            <GameConfigSection value={task.game_config} />
            <CollectionItemsSection value={task.collection_items} />
            <SocialTaskSection value={task.social_task} />
            <HintsSection value={task.hints} />

            {CAN_MANAGE && (
                <Panel
                    title="Answer keys"
                    icon={KeyRound}
                    actions={
                        <Button size="sm" variant="ghost" onClick={() => setRevealAnswers((v) => !v)} aria-expanded={revealAnswers}>
                            {revealAnswers ? "Hide" : "Reveal answer keys"}
                        </Button>
                    }
                    bodyClassName={revealAnswers ? "p-4 sm:p-5" : "hidden"}
                >
                    {revealAnswers &&
                        (fullQuery.isLoading ? (
                            <p className="text-sm text-ink-muted">Loading answer keys…</p>
                        ) : fullQuery.error ? (
                            <ErrorState error={fullQuery.error} title="Couldn't load the answer keys" compact onRetry={() => fullQuery.refetch()} />
                        ) : correctAnswer === undefined && expectedValue === undefined ? (
                            <p className="text-sm text-ink-muted">No answer keys for this task type.</p>
                        ) : (
                            <div className="space-y-3">
                                {correctAnswer !== undefined && <AnswerKey label="Quiz correct answer" value={String(correctAnswer)} />}
                                {expectedValue !== undefined && <AnswerKey label="QR expected value" value={String(expectedValue)} />}
                            </div>
                        ))}
                </Panel>
            )}

            <Panel title="Linked step reward" icon={Gift}>
                {linkedRewardQuery.isLoading ? (
                    <p className="text-sm text-ink-muted">Loading linked step reward…</p>
                ) : linkedRewardQuery.data ? (
                    <LinkedReward reward={linkedRewardQuery.data} />
                ) : (
                    <p className="text-sm text-ink-muted">No step reward configured for this task.</p>
                )}
            </Panel>

            <Panel title="Related task configs" icon={Layers}>
                <div className="space-y-5">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">At the same place</p>
                        <RelatedList
                            isLoading={byMarkerQuery.isLoading}
                            items={(byMarkerQuery.data ?? []).filter((t) => t._id !== taskId)}
                            emptyLabel="No other task configs at this place."
                        />
                    </div>
                    {task.quest_id && (
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">In the same quest</p>
                            <RelatedList
                                isLoading={byQuestQuery.isLoading}
                                items={(byQuestQuery.data ?? []).filter((t) => t._id !== taskId)}
                                emptyLabel="No other task configs in this quest."
                            />
                        </div>
                    )}
                </div>
            </Panel>

            <ConfirmDialog
                open={showDelete}
                title={IS_SUPER && hardDelete ? "Permanently delete task config?" : "Delete task config?"}
                description={IS_SUPER && hardDelete ? "It is removed for good and can't be recovered." : `Delete "${task.title}"? It stops showing at its place.`}
                confirmLabel={IS_SUPER && hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={IS_SUPER && hardDelete ? "type" : "simple"}
                typeToConfirm={task.title.trim() || "DELETE"}
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => {
                    setShowDelete(false);
                    setHardDelete(false);
                }}
                isPending={deleteMutation.isPending}
            >
                {IS_SUPER && <Checkbox checked={hardDelete} onChange={setHardDelete} label="Delete permanently" hint="Can't be recovered." />}
            </ConfirmDialog>
        </div>
    );
}

function AnswerKey({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-control border border-warn-line bg-warn-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-warn">{label}</p>
            <p className="mt-1 break-all font-mono text-sm text-ink">{value}</p>
        </div>
    );
}

function RelatedList({ isLoading, items, emptyLabel }: { isLoading: boolean; items: TaskConfig[]; emptyLabel: string }) {
    if (isLoading) return <p className="text-sm text-ink-muted">Loading…</p>;
    if (items.length === 0) return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
    return (
        <ul className="divide-y divide-line rounded-control border border-line">
            {items.map((t) => (
                <li key={t._id}>
                    <Link to={`/task-configs/${t._id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-muted">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-ink">{t.title}</span>
                            <Tag>{humanizeStatus(t.task_type)}</Tag>
                            {!t.is_active && <Tag>Inactive</Tag>}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-muted">{t.base_points} pts</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function plainValue(val: unknown): ReactNode {
    if (val === null || val === undefined) return "—";
    if (typeof val === "object") return <pre className="overflow-x-auto rounded-control bg-surface-muted px-2 py-1 font-mono text-xs">{JSON.stringify(val, null, 2)}</pre>;
    return String(val);
}

function KVSection({ title, entries }: { title: string; entries: [string, unknown][] }) {
    return (
        <Panel title={title}>
            <DetailList>
                {entries.map(([key, val]) => (
                    <DetailRow key={key} label={<span className="capitalize">{key.replace(/_/g, " ")}</span>} value={plainValue(val)} />
                ))}
            </DetailList>
        </Panel>
    );
}

function isFilledObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function PhotoRequirementsSection({ value }: { value: unknown }) {
    if (!isFilledObject(value)) return null;
    const entries: [string, unknown][] = [];
    if (value.min_photos !== undefined) entries.push(["Min photos", value.min_photos]);
    if (value.max_photos !== undefined) entries.push(["Max photos", value.max_photos]);
    if (value.description !== undefined) entries.push(["Description", value.description]);
    Object.entries(value)
        .filter(([k]) => !["min_photos", "max_photos", "description"].includes(k))
        .forEach((e) => entries.push(e));
    return <KVSection title="Photo requirements" entries={entries} />;
}

function QrDataSection({ value }: { value: unknown }) {
    if (!isFilledObject(value)) return null;
    const entries: [string, unknown][] = [];
    if (value.code !== undefined) entries.push(["Code", value.code]);
    if (value.expected_value !== undefined) entries.push(["Expected value", value.expected_value]);
    Object.entries(value)
        .filter(([k]) => !["code", "expected_value"].includes(k))
        .forEach((e) => entries.push(e));
    return <KVSection title="QR data" entries={entries} />;
}

function QuizDataSection({ value }: { value: unknown }) {
    if (!isFilledObject(value)) return null;
    const question = value.question as string | undefined;
    const options = Array.isArray(value.options) ? (value.options as string[]) : [];
    if (!question && options.length === 0) return null;
    return (
        <Panel title="Quiz">
            <DetailList>
                {question && <DetailRow label="Question" value={question} />}
                {options.length > 0 && (
                    <DetailRow
                        label="Options"
                        value={
                            <ol className="list-inside list-decimal space-y-1">
                                {options.map((opt, i) => (
                                    <li key={i}>{opt}</li>
                                ))}
                            </ol>
                        }
                    />
                )}
            </DetailList>
        </Panel>
    );
}

function GameConfigSection({ value }: { value: unknown }) {
    if (!isFilledObject(value)) return null;
    return <KVSection title="Game config" entries={Object.entries(value)} />;
}

function SocialTaskSection({ value }: { value: unknown }) {
    if (!isFilledObject(value)) return null;
    return <KVSection title="Social task" entries={Object.entries(value)} />;
}

function CollectionItemsSection({ value }: { value: unknown }) {
    if (!value || !Array.isArray(value) || value.length === 0) return null;
    return (
        <Panel title={`Collection items (${value.length})`}>
            <ol className="space-y-2 text-sm">
                {value.map((item, i) => (
                    <li key={i} className="rounded-control border border-line bg-surface-muted px-4 py-2.5">
                        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">#{i + 1}</span>
                        {typeof item === "object" && item !== null ? (
                            Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                                <span key={k} className="mr-3 text-ink">
                                    <span className="capitalize text-ink-muted">{k.replace(/_/g, " ")}: </span>
                                    {String(v)}
                                </span>
                            ))
                        ) : (
                            <span className="text-ink">{String(item)}</span>
                        )}
                    </li>
                ))}
            </ol>
        </Panel>
    );
}

function HintsSection({ value }: { value: unknown }) {
    if (!value || !Array.isArray(value) || value.length === 0) return null;
    return (
        <Panel title={`Hints (${value.length})`}>
            <ol className="space-y-3 text-sm">
                {value.map((hint, idx) => {
                    if (!hint || typeof hint !== "object") {
                        return (
                            <li key={idx} className="rounded-control border border-line bg-surface-muted px-4 py-3">
                                <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Hint {idx + 1}</span>
                                <p className="mt-1 text-ink">{String(hint)}</p>
                            </li>
                        );
                    }
                    const h = hint as Record<string, unknown>;
                    const text = (h.text ?? h.hint ?? h.content ?? h.description) as string | undefined;
                    const cost = h.cost ?? h.point_cost ?? h.points;
                    const otherEntries = Object.entries(h).filter(([k]) => !["text", "hint", "content", "description", "cost", "point_cost", "points"].includes(k));
                    return (
                        <li key={idx} className="rounded-control border border-line bg-surface-muted px-4 py-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Hint {idx + 1}</span>
                            {text !== undefined && <p className="mt-1 text-ink">{text}</p>}
                            {cost !== undefined && (
                                <p className="mt-1 text-xs text-ink-muted">
                                    Cost: <span className="font-semibold text-ink">{String(cost)}</span> pts
                                </p>
                            )}
                            {otherEntries.map(([k, v]) => (
                                <p key={k} className="mt-0.5 text-xs text-ink-muted">
                                    <span className="capitalize">{k.replace(/_/g, " ")}</span>: <span className="text-ink">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                                </p>
                            ))}
                        </li>
                    );
                })}
            </ol>
        </Panel>
    );
}

function LinkedReward({ reward }: { reward: StepReward }) {
    const [contextJson, setContextJson] = useState("{}");
    const [result, setResult] = useState<RewardEvaluation | null>(null);

    const evaluateMutation = useMutation({
        mutationFn: (context: Record<string, unknown>) => stepRewardsService.evaluate(reward._id, context),
        onSuccess: (res) => setResult(res),
        onError: (e: Error) => toast.error(e.message || "Failed to evaluate reward"),
    });

    const handleEvaluate = () => {
        let parsed: Record<string, unknown>;
        try {
            const obj = JSON.parse(contextJson || "{}");
            if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
                toast.error("Context must be a JSON object");
                return;
            }
            parsed = obj as Record<string, unknown>;
        } catch {
            toast.error("Invalid JSON context");
            return;
        }
        evaluateMutation.mutate(parsed);
    };

    return (
        <div className="space-y-4">
            <DetailList>
                <DetailRow label="Base points" value={reward.base_points.toLocaleString("en-IN")} />
                <DetailRow label="Bonus conditions" value={reward.bonus_conditions?.length ?? 0} />
            </DetailList>

            {reward.bonus_conditions && reward.bonus_conditions.length > 0 && (
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-4 font-mono text-xs text-ink">
                    {JSON.stringify(reward.bonus_conditions, null, 2)}
                </pre>
            )}

            <div className="space-y-3 rounded-card border border-line bg-surface-muted p-4">
                <Field label="Try it — context (JSON)" hint='For example {"time_taken": 30}.'>
                    <TextArea rows={4} className="font-mono text-xs" value={contextJson} onChange={(e) => setContextJson(e.target.value)} />
                </Field>
                <div className="flex justify-end">
                    <Button variant="primary" icon={Calculator} onClick={handleEvaluate} loading={evaluateMutation.isPending}>
                        Evaluate
                    </Button>
                </div>
                {result && <RewardResult result={result} />}
            </div>
        </div>
    );
}

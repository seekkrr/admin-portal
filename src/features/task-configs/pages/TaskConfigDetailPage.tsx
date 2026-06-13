import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    Settings2,
    Power,
    Trash2,
    KeyRound,
    Calculator,
    Gift,
    Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@store/auth.store";
import { taskConfigsService } from "../services/task-configs.service";
import { stepRewardsService } from "../services/step-rewards.service";
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

    const { data: task, isLoading, error } = useQuery({
        queryKey: ["task-config-detail", taskId],
        queryFn: () => taskConfigsService.getById(taskId),
        enabled: !!taskId,
        staleTime: 60 * 1000,
    });

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

    // Sibling task configs at the same marker / quest (oversight: spot duplicate
    // or conflicting tasks). Uses the dedicated by-marker / by-quest endpoints.
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

    if (isLoading) return <LoadingFallback message="Loading task config..." />;

    if (error || !task) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load task config or it does not exist.</p>
                <Link to="/task-configs" className="text-slate-600 hover:underline">
                    Back to Task Configs
                </Link>
            </div>
        );
    }

    const full = fullQuery.data;
    const correctAnswer = full?.quiz_data?.correct_answer;
    const expectedValue =
        full?.qr_data && typeof full.qr_data === "object"
            ? (full.qr_data as Record<string, unknown>).expected_value
            : undefined;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <Link
                    to="/task-configs"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                {CAN_MANAGE && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => toggleMutation.mutate()}
                            disabled={toggleMutation.isPending}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50"
                        >
                            <Power className="w-4 h-4" />
                            {task.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                            onClick={() => setShowDelete(true)}
                            disabled={deleteMutation.isPending}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start gap-4">
                    <div className="bg-slate-100 text-slate-600 rounded-xl w-10 h-10 flex items-center justify-center shrink-0">
                        <Settings2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">{task.title}</h1>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {task.task_type}
                            </span>
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                    task.is_active
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-neutral-50 text-neutral-600 border-neutral-200"
                                }`}
                            >
                                {task.is_active ? "Active" : "Inactive"}
                            </span>
                            <span className="text-xs">{task.base_points} pts</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Details */}
            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold">Details</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Description" value={task.description ?? null} />
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                        <span className="w-36 shrink-0 font-medium text-neutral-500">Marker</span>
                        <Link
                            to={`/markers/${task.marker_id}`}
                            className="text-slate-600 hover:underline font-mono break-all"
                        >
                            {task.marker_id}
                        </Link>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                        <span className="w-36 shrink-0 font-medium text-neutral-500">Quest</span>
                        {task.quest_id ? (
                            <Link
                                to={`/quests/${task.quest_id}`}
                                className="text-slate-600 hover:underline font-mono break-all"
                            >
                                {task.quest_id}
                            </Link>
                        ) : (
                            <span className="text-neutral-800">—</span>
                        )}
                    </div>
                    <DetailRow label="Base points" value={String(task.base_points)} />
                    <DetailRow label="Created by" value={task.created_by ?? null} />
                    <DetailRow
                        label="Created"
                        value={task.created_at ? new Date(task.created_at).toLocaleString() : null}
                    />
                    <DetailRow
                        label="Updated"
                        value={task.updated_at ? new Date(task.updated_at).toLocaleString() : null}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                        <span className="w-36 shrink-0 font-medium text-neutral-500">ID</span>
                        <span className="text-neutral-800 font-mono break-all">{task._id}</span>
                    </div>
                </div>
            </Card>

            {/* Type-specific config objects */}
            <JsonSection title="Photo requirements" value={task.photo_requirements} />
            <JsonSection title="QR data" value={task.qr_data} />
            <JsonSection title="Quiz data" value={task.quiz_data} />
            <JsonSection title="Game config" value={task.game_config} />
            <JsonSection title="Collection items" value={task.collection_items} />
            <JsonSection title="Social task" value={task.social_task} />
            <JsonSection title="Hints" value={task.hints} />

            {/* Reveal answer keys */}
            {CAN_MANAGE && (
                <Card padding="none" className="overflow-hidden">
                    <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6 flex items-center justify-between">
                        <h3 className="text-base font-semibold flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-amber-600" />
                            Answer Keys
                        </h3>
                        <button
                            onClick={() => setRevealAnswers((v) => !v)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                            {revealAnswers ? "Hide" : "Reveal answer keys"}
                        </button>
                    </div>
                    {revealAnswers && (
                        <div className="p-6 text-sm">
                            {fullQuery.isLoading ? (
                                <p className="text-neutral-500">Loading answer keys...</p>
                            ) : fullQuery.error ? (
                                <p className="text-red-500">Failed to load answer keys.</p>
                            ) : correctAnswer === undefined && expectedValue === undefined ? (
                                <p className="text-neutral-500">No answer keys for this task type.</p>
                            ) : (
                                <div className="space-y-3">
                                    {correctAnswer !== undefined && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                                                Quiz correct answer
                                            </p>
                                            <p className="mt-1 font-mono text-amber-900 break-all">
                                                {String(correctAnswer)}
                                            </p>
                                        </div>
                                    )}
                                    {expectedValue !== undefined && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                                                QR expected value
                                            </p>
                                            <p className="mt-1 font-mono text-amber-900 break-all">
                                                {String(expectedValue)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            )}

            {/* Linked step reward */}
            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                        <Gift className="w-4 h-4 text-slate-600" />
                        Linked Step Reward
                    </h3>
                </div>
                <div className="p-6 text-sm">
                    {linkedRewardQuery.isLoading ? (
                        <p className="text-neutral-500">Loading linked step reward...</p>
                    ) : linkedRewardQuery.data ? (
                        <LinkedReward reward={linkedRewardQuery.data} />
                    ) : (
                        <p className="text-neutral-500">No step reward configured for this task.</p>
                    )}
                </div>
            </Card>

            {/* Related task configs (by marker / by quest) */}
            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-600" />
                        Related Task Configs
                    </h3>
                </div>
                <div className="p-6 space-y-6 text-sm">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                            At the same marker
                        </p>
                        <RelatedList
                            isLoading={byMarkerQuery.isLoading}
                            items={(byMarkerQuery.data ?? []).filter((t) => t._id !== taskId)}
                            emptyLabel="No other task configs at this marker."
                        />
                    </div>
                    {task.quest_id && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                                In the same quest
                            </p>
                            <RelatedList
                                isLoading={byQuestQuery.isLoading}
                                items={(byQuestQuery.data ?? []).filter((t) => t._id !== taskId)}
                                emptyLabel="No other task configs in this quest."
                            />
                        </div>
                    )}
                </div>
            </Card>

            <ConfirmModal
                open={showDelete}
                title="Delete Task Config"
                message={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
                confirmLabel={IS_SUPER && hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => deleteMutation.mutate()}
                onCancel={() => {
                    setShowDelete(false);
                    setHardDelete(false);
                }}
                isPending={deleteMutation.isPending}
            >
                {IS_SUPER && (
                    <label className="flex items-center gap-2 mt-3 mb-1 px-1 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={hardDelete}
                            onChange={(e) => setHardDelete(e.target.checked)}
                            className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 accent-red-600"
                        />
                        <span className="text-xs text-red-600 font-medium">
                            Permanently delete (cannot be recovered)
                        </span>
                    </label>
                )}
            </ConfirmModal>
        </div>
    );
}

function RelatedList({
    isLoading,
    items,
    emptyLabel,
}: {
    isLoading: boolean;
    items: TaskConfig[];
    emptyLabel: string;
}) {
    if (isLoading) return <p className="text-neutral-500">Loading...</p>;
    if (items.length === 0) return <p className="text-neutral-500">{emptyLabel}</p>;
    return (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
            {items.map((t) => (
                <li key={t._id}>
                    <Link
                        to={`/task-configs/${t._id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors"
                    >
                        <span className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-neutral-800 truncate">{t.title}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                {t.task_type}
                            </span>
                            {!t.is_active && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-50 text-neutral-500 border border-neutral-200 shrink-0">
                                    Inactive
                                </span>
                            )}
                        </span>
                        <span className="text-xs text-neutral-500 shrink-0">{t.base_points} pts</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="w-36 shrink-0 font-medium text-neutral-500">{label}</span>
            <span className="text-neutral-800 whitespace-pre-wrap break-words">{value || "—"}</span>
        </div>
    );
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
    const isEmpty =
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
    if (isEmpty) return null;
    return (
        <Card padding="none" className="overflow-hidden">
            <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                <h3 className="text-base font-semibold">{title}</h3>
            </div>
            <div className="p-6">
                <pre className="text-xs font-mono text-neutral-700 bg-neutral-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(value, null, 2)}
                </pre>
            </div>
        </Card>
    );
}

function LinkedReward({ reward }: { reward: StepReward }) {
    const [contextJson, setContextJson] = useState("{}");
    const [result, setResult] = useState<RewardEvaluation | null>(null);

    const evaluateMutation = useMutation({
        mutationFn: (context: Record<string, unknown>) =>
            stepRewardsService.evaluate(reward._id, context),
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

    const inputClass =
        "w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all";

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <DetailRow label="Base points" value={String(reward.base_points)} />
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                    <span className="w-36 shrink-0 font-medium text-neutral-500">Bonus conditions</span>
                    <span className="text-neutral-800">{reward.bonus_conditions?.length ?? 0}</span>
                </div>
            </div>

            {reward.bonus_conditions && reward.bonus_conditions.length > 0 && (
                <pre className="text-xs font-mono text-neutral-700 bg-neutral-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(reward.bonus_conditions, null, 2)}
                </pre>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Evaluate tester
                </p>
                <textarea
                    rows={4}
                    className={`${inputClass} resize-none font-mono text-xs`}
                    value={contextJson}
                    onChange={(e) => setContextJson(e.target.value)}
                />
                <div className="flex justify-end">
                    <button
                        onClick={handleEvaluate}
                        disabled={evaluateMutation.isPending}
                        className="px-4 py-2.5 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {evaluateMutation.isPending ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Calculator className="w-4 h-4" />
                        )}
                        Evaluate
                    </button>
                </div>
                {result && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
                            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                Base
                            </p>
                            <p className="mt-1 text-xl font-bold text-neutral-800">{result.base_points}</p>
                        </div>
                        <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
                            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                Bonus
                            </p>
                            <p className="mt-1 text-xl font-bold text-neutral-800">{result.bonus_points}</p>
                        </div>
                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-center">
                            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                                Total
                            </p>
                            <p className="mt-1 text-xl font-bold text-slate-700">{result.total_points}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

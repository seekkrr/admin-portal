import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
    Settings2,
    Plus,
    Trash2,
    Power,
    Calculator,
    Pencil,
    X,
    Search,
    Filter,
} from "lucide-react";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAuthStore } from "@store/auth.store";
import { LoadingFallback } from "@components/LoadingFallback";
import { taskConfigsService } from "../services/task-configs.service";
import { stepRewardsService } from "../services/step-rewards.service";
import type {
    TaskConfig,
    TaskConfigType,
    CreateTaskConfigPayload,
    UpdateTaskConfigPayload,
    StepReward,
    StepRewardContextType,
    BonusCondition,
    BonusOperator,
    CreateStepRewardPayload,
    UpdateStepRewardPayload,
    RewardEvaluation,
} from "@/types";

const TASK_TYPES: TaskConfigType[] = [
    "photo_challenge",
    "qr_scan",
    "quiz",
    "collection",
    "social",
    "checkin",
];

const CONTEXT_TYPES: StepRewardContextType[] = [
    "quest_completion",
    "marker_visit",
    "task_completion",
    "streak_bonus",
];

const OPERATORS: BonusOperator[] = ["gte", "lte", "eq", "in"];

const inputClass =
    "w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20 transition-all";

type Tab = "task-configs" | "step-rewards";

export function TaskConfigsPage() {
    const { user } = useAuthStore();
    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));

    const [tab, setTab] = useState<Tab>("task-configs");

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                    <Settings2 className="w-6 h-6 text-slate-600" />
                    Task Configs &amp; Step Rewards
                </h1>
                <p className="text-neutral-500 mt-1">
                    Configure marker/quest tasks and the points awarded for completing them
                </p>
            </div>

            <div className="bg-neutral-100/70 p-1.5 rounded-xl inline-flex overflow-x-auto w-full sm:w-auto">
                <button
                    onClick={() => setTab("task-configs")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        tab === "task-configs"
                            ? "bg-white text-slate-700 shadow-sm ring-1 ring-neutral-200/50"
                            : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50"
                    }`}
                >
                    Task Configs
                </button>
                <button
                    onClick={() => setTab("step-rewards")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        tab === "step-rewards"
                            ? "bg-white text-slate-700 shadow-sm ring-1 ring-neutral-200/50"
                            : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50"
                    }`}
                >
                    Step Rewards
                </button>
            </div>

            {tab === "task-configs" ? (
                <TaskConfigsTab canManage={CAN_MANAGE} />
            ) : (
                <StepRewardsTab canManage={CAN_MANAGE} />
            )}
        </div>
    );
}


function TypeBadge({ value }: { value: string }) {
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {value}
        </span>
    );
}

// ============================================================
// TAB 1 — Task Configs
// ============================================================

interface TaskConfigForm {
    task_type: TaskConfigType;
    title: string;
    description: string;
    marker_id: string;
    quest_id: string;
    base_points: string;
    is_active: boolean;
    quiz_question: string;
    quiz_options: string;
    quiz_correct_answer: string;
    qr_expected_value: string;
    photo_requirements: string;
}

const EMPTY_TASK_FORM: TaskConfigForm = {
    task_type: "photo_challenge",
    title: "",
    description: "",
    marker_id: "",
    quest_id: "",
    base_points: "0",
    is_active: true,
    quiz_question: "",
    quiz_options: "",
    quiz_correct_answer: "",
    qr_expected_value: "",
    photo_requirements: "",
};

function taskConfigToForm(t: TaskConfig): TaskConfigForm {
    const quiz = (t.quiz_data ?? {}) as Record<string, unknown>;
    const qr = (t.qr_data ?? {}) as Record<string, unknown>;
    const options = Array.isArray(quiz.options) ? (quiz.options as string[]).join("\n") : "";
    return {
        task_type: t.task_type,
        title: t.title ?? "",
        description: t.description ?? "",
        marker_id: t.marker_id ?? "",
        quest_id: t.quest_id ?? "",
        base_points: String(t.base_points ?? 0),
        is_active: t.is_active,
        quiz_question: typeof quiz.question === "string" ? quiz.question : "",
        quiz_options: options,
        quiz_correct_answer: typeof quiz.correct_answer === "string" ? quiz.correct_answer : "",
        qr_expected_value: typeof qr.expected_value === "string" ? qr.expected_value : "",
        photo_requirements: t.photo_requirements
            ? JSON.stringify(t.photo_requirements, null, 2)
            : "",
    };
}

function TaskConfigsTab({ canManage }: { canManage: boolean }) {
    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [questId, setQuestId] = useState("");
    const [markerId, setMarkerId] = useState("");
    const [taskType, setTaskType] = useState<TaskConfigType | "">("");

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<TaskConfigForm>(EMPTY_TASK_FORM);
    const [confirmDelete, setConfirmDelete] = useState<TaskConfig | null>(null);

    const closeModal = () => {
        setShowModal(false);
        setEditId(null);
        setForm(EMPTY_TASK_FORM);
    };

    const openCreate = () => {
        setEditId(null);
        setForm(EMPTY_TASK_FORM);
        setShowModal(true);
    };

    const openEdit = async (t: TaskConfig) => {
        // Seed from the (answer-stripped) list row immediately for responsiveness,
        // then pull the /full record so quiz_data.correct_answer / qr_data.expected_value
        // prefill correctly — otherwise saving would clobber the stored answer keys.
        setEditId(t._id);
        setForm(taskConfigToForm(t));
        setShowModal(true);
        try {
            const full = await taskConfigsService.getFull(t._id);
            setForm(taskConfigToForm(full));
        } catch {
            // Fall back to the public-dict form; answer fields may be blank.
        }
    };

    const { data, isLoading, error } = useQuery({
        queryKey: [
            "admin-task-configs",
            { quest_id: questId, marker_id: markerId, task_type: taskType, page },
        ],
        queryFn: () =>
            taskConfigsService.list({
                quest_id: questId || undefined,
                marker_id: markerId || undefined,
                task_type: taskType || undefined,
                page,
                page_size: 20,
            }),
        staleTime: 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: (payload: CreateTaskConfigPayload) => taskConfigsService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Task config created");
            closeModal();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create task config"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateTaskConfigPayload }) =>
            taskConfigsService.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            queryClient.invalidateQueries({ queryKey: ["task-config-detail"] });
            toast.success("Task config updated");
            closeModal();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update task config"),
    });

    const toggleMutation = useMutation({
        mutationFn: (id: string) => taskConfigsService.toggleActive(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Active state toggled");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to toggle"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => taskConfigsService.remove(id, false),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Task config deleted");
            setConfirmDelete(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete");
            setConfirmDelete(null);
        },
    });

    const handleSubmit = () => {
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (!form.marker_id.trim()) {
            toast.error("Marker ID is required");
            return;
        }
        // Type-specific fields, shared by create and edit. task_type cannot change
        // on edit, so the active sub-form always matches the existing type.
        const typeFields: Partial<CreateTaskConfigPayload> = {};
        if (form.task_type === "quiz") {
            const options = form.quiz_options
                .split("\n")
                .map((o) => o.trim())
                .filter(Boolean);
            const quiz: Record<string, unknown> = {};
            if (form.quiz_question.trim()) quiz.question = form.quiz_question.trim();
            if (options.length > 0) quiz.options = options;
            if (form.quiz_correct_answer.trim()) quiz.correct_answer = form.quiz_correct_answer.trim();
            typeFields.quiz_data = quiz;
        } else if (form.task_type === "qr_scan") {
            if (form.qr_expected_value.trim()) {
                typeFields.qr_data = { expected_value: form.qr_expected_value.trim() };
            }
        } else if (form.task_type === "photo_challenge") {
            const raw = form.photo_requirements.trim();
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        typeFields.photo_requirements = parsed as Record<string, unknown>;
                    } else {
                        typeFields.photo_requirements = { description: raw };
                    }
                } catch {
                    typeFields.photo_requirements = { description: raw };
                }
            }
        }

        if (editId) {
            // PUT cannot change task_type / marker_id / quest_id.
            const payload: UpdateTaskConfigPayload = {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                base_points: Number(form.base_points) || 0,
                is_active: form.is_active,
                ...typeFields,
            };
            updateMutation.mutate({ id: editId, payload });
            return;
        }

        const payload: CreateTaskConfigPayload = {
            task_type: form.task_type,
            title: form.title.trim(),
            marker_id: form.marker_id.trim(),
            base_points: Number(form.base_points) || 0,
            is_active: form.is_active,
            ...typeFields,
        };
        if (form.description.trim()) payload.description = form.description.trim();
        if (form.quest_id.trim()) payload.quest_id = form.quest_id.trim();

        createMutation.mutate(payload);
    };

    if (isLoading) return <LoadingFallback message="Loading task configs..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load task configs.</div>;

    const configs = data?.task_configs ?? [];

    return (
        <>
            {/* Filters Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                    <div className="flex flex-1 flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Filter by quest ID"
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                value={questId}
                                onChange={(e) => {
                                    setQuestId(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Filter by marker ID"
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                value={markerId}
                                onChange={(e) => {
                                    setMarkerId(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                        <FilterDropdown
                            options={TASK_TYPES.map(t => ({ label: t, value: t }))}
                            value={taskType}
                            onChange={(v: string) => {
                                setTaskType(v as TaskConfigType | "");
                                setPage(1);
                            }}
                            icon={<Filter className="w-3.5 h-3.5" />}
                            placeholder="All types"
                        />
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            Create Task Config
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="bg-neutral-50/60 border-b border-neutral-100">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Title
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Type
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Marker
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Points
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Active
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {configs.map((t) => (
                                    <tr key={t._id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <Link
                                                to={`/task-configs/${t._id}`}
                                                className="font-medium text-slate-700 hover:text-slate-900"
                                            >
                                                {t.title}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4">
                                            <TypeBadge value={t.task_type} />
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs text-neutral-500 max-w-[140px] truncate">
                                            {t.marker_id}
                                        </td>
                                        <td className="px-4 py-4 text-neutral-800">{t.base_points}</td>
                                        <td className="px-4 py-4">
                                            {canManage ? (
                                                <button
                                                    onClick={() => toggleMutation.mutate(t._id)}
                                                    disabled={toggleMutation.isPending}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                                                        t.is_active
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                            : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                                                    }`}
                                                >
                                                    <Power className="w-3 h-3" />
                                                    {t.is_active ? "Active" : "Inactive"}
                                                </button>
                                            ) : (
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                        t.is_active
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            : "bg-neutral-50 text-neutral-600 border-neutral-200"
                                                    }`}
                                                >
                                                    {t.is_active ? "Active" : "Inactive"}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <Link
                                                    to={`/task-configs/${t._id}`}
                                                    className="text-slate-600 hover:text-slate-900 font-medium"
                                                >
                                                    View
                                                </Link>
                                                {canManage && (
                                                    <button
                                                        onClick={() => void openEdit(t)}
                                                        className="text-neutral-400 hover:text-slate-700 p-1 rounded-md transition-colors"
                                                        title="Edit task config"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canManage && (
                                                    <button
                                                        onClick={() => setConfirmDelete(t)}
                                                        className="text-neutral-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                                                        title="Delete task config"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {configs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <Settings2 className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>No task configs found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && data.total_pages > 1 && (
                        <Pagination
                            page={data.page}
                            totalPages={data.total_pages}
                            total={data.total}
                            onPageChange={setPage}
                        />
                    )}
                </div>

            {showModal && (
                <ModalShell
                    title={editId ? "Edit Task Config" : "Create Task Config"}
                    onClose={closeModal}
                >
                    <div className="space-y-4">
                        {editId && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                Task type, marker, and quest cannot be changed after creation.
                            </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Task type *">
                                <select
                                    className={`${inputClass} bg-white disabled:bg-neutral-100 disabled:text-neutral-500`}
                                    value={form.task_type}
                                    disabled={!!editId}
                                    onChange={(e) =>
                                        setForm({ ...form, task_type: e.target.value as TaskConfigType })
                                    }
                                >
                                    {TASK_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Base points">
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={form.base_points}
                                    onChange={(e) => setForm({ ...form, base_points: e.target.value })}
                                />
                            </Field>
                        </div>
                        <Field label="Title *">
                            <input
                                type="text"
                                className={inputClass}
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                            />
                        </Field>
                        <Field label="Description">
                            <textarea
                                rows={2}
                                className={`${inputClass} resize-none`}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                            />
                        </Field>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Marker ID *">
                                <input
                                    type="text"
                                    className={`${inputClass} font-mono disabled:bg-neutral-100 disabled:text-neutral-500`}
                                    value={form.marker_id}
                                    disabled={!!editId}
                                    onChange={(e) => setForm({ ...form, marker_id: e.target.value })}
                                />
                            </Field>
                            <Field label="Quest ID (optional)">
                                <input
                                    type="text"
                                    className={`${inputClass} font-mono disabled:bg-neutral-100 disabled:text-neutral-500`}
                                    value={form.quest_id}
                                    disabled={!!editId}
                                    onChange={(e) => setForm({ ...form, quest_id: e.target.value })}
                                />
                            </Field>
                        </div>

                        {form.task_type === "quiz" && (
                            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Quiz data
                                </p>
                                <Field label="Question">
                                    <input
                                        type="text"
                                        className={inputClass}
                                        value={form.quiz_question}
                                        onChange={(e) => setForm({ ...form, quiz_question: e.target.value })}
                                    />
                                </Field>
                                <Field label="Options (one per line)">
                                    <textarea
                                        rows={3}
                                        className={`${inputClass} resize-none`}
                                        value={form.quiz_options}
                                        onChange={(e) => setForm({ ...form, quiz_options: e.target.value })}
                                    />
                                </Field>
                                <Field label="Correct answer">
                                    <input
                                        type="text"
                                        className={inputClass}
                                        value={form.quiz_correct_answer}
                                        onChange={(e) =>
                                            setForm({ ...form, quiz_correct_answer: e.target.value })
                                        }
                                    />
                                </Field>
                            </div>
                        )}

                        {form.task_type === "qr_scan" && (
                            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    QR data
                                </p>
                                <Field label="Expected value">
                                    <input
                                        type="text"
                                        className={inputClass}
                                        value={form.qr_expected_value}
                                        onChange={(e) =>
                                            setForm({ ...form, qr_expected_value: e.target.value })
                                        }
                                    />
                                </Field>
                            </div>
                        )}

                        {form.task_type === "photo_challenge" && (
                            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Photo requirements
                                </p>
                                <Field label="JSON object, or plain text used as description">
                                    <textarea
                                        rows={3}
                                        className={`${inputClass} resize-none font-mono text-xs`}
                                        placeholder='{ "description": "Photo with the landmark" }'
                                        value={form.photo_requirements}
                                        onChange={(e) =>
                                            setForm({ ...form, photo_requirements: e.target.value })
                                        }
                                    />
                                </Field>
                            </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                className="w-4 h-4 rounded border-neutral-300 text-slate-600 focus:ring-slate-500 accent-slate-600"
                            />
                            <span className="text-sm text-neutral-700 font-medium">Active</span>
                        </label>

                        <ModalActions
                            onCancel={closeModal}
                            onConfirm={handleSubmit}
                            isPending={createMutation.isPending || updateMutation.isPending}
                            confirmLabel={editId ? "Save Changes" : "Create"}
                        />
                    </div>
                </ModalShell>
            )}

            <ConfirmModal
                open={!!confirmDelete}
                title="Confirm Deletion"
                message={`Delete task config "${confirmDelete?.title}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                theme="danger"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />
        </>
    );
}

// ============================================================
// TAB 2 — Step Rewards
// ============================================================

interface BonusRow {
    field: string;
    operator: BonusOperator;
    value: string;
    bonus_points: string;
}

interface StepRewardForm {
    context_type: StepRewardContextType;
    context_id: string;
    base_points: string;
    bonus_conditions: BonusRow[];
    unlocked_badges: string;
    unlocked_content: string;
}

const EMPTY_REWARD_FORM: StepRewardForm = {
    context_type: "quest_completion",
    context_id: "",
    base_points: "0",
    bonus_conditions: [],
    unlocked_badges: "",
    unlocked_content: "",
};

function rewardToForm(r: StepReward): StepRewardForm {
    return {
        context_type: r.context_type,
        context_id: r.context_id,
        base_points: String(r.base_points),
        bonus_conditions: (r.bonus_conditions ?? []).map((c) => ({
            field: c.field,
            operator: c.operator,
            value: typeof c.value === "object" ? JSON.stringify(c.value) : String(c.value ?? ""),
            bonus_points: String(c.bonus_points),
        })),
        unlocked_badges: (r.unlocked_badges ?? []).join(", "),
        unlocked_content: (r.unlocked_content ?? []).join(", "),
    };
}

function buildBonusConditions(rows: BonusRow[]): BonusCondition[] {
    return rows
        .filter((r) => r.field.trim())
        .map((r) => {
            let value: unknown = r.value;
            if (r.operator === "in") {
                value = r.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
            } else {
                const num = Number(r.value);
                if (r.value.trim() !== "" && !Number.isNaN(num)) value = num;
            }
            return {
                field: r.field.trim(),
                operator: r.operator,
                value,
                bonus_points: Number(r.bonus_points) || 0,
            };
        });
}

function StepRewardsTab({ canManage }: { canManage: boolean }) {
    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [contextType, setContextType] = useState<StepRewardContextType | "">("");
    const [contextId, setContextId] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<StepRewardForm>(EMPTY_REWARD_FORM);
    const [confirmDelete, setConfirmDelete] = useState<StepReward | null>(null);
    const [evaluateTarget, setEvaluateTarget] = useState<StepReward | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-step-rewards", { context_type: contextType, context_id: contextId, page }],
        queryFn: () =>
            stepRewardsService.list({
                context_type: contextType || undefined,
                context_id: contextId || undefined,
                page,
                page_size: 20,
            }),
        staleTime: 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: (payload: CreateStepRewardPayload) => stepRewardsService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-step-rewards"] });
            toast.success("Step reward created");
            setShowForm(false);
            setForm(EMPTY_REWARD_FORM);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create step reward"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateStepRewardPayload }) =>
            stepRewardsService.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-step-rewards"] });
            toast.success("Step reward updated");
            setShowForm(false);
            setEditId(null);
            setForm(EMPTY_REWARD_FORM);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update step reward"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => stepRewardsService.remove(id, false),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-step-rewards"] });
            toast.success("Step reward deleted");
            setConfirmDelete(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete step reward");
            setConfirmDelete(null);
        },
    });

    const openCreate = () => {
        setEditId(null);
        setForm(EMPTY_REWARD_FORM);
        setShowForm(true);
    };

    const openEdit = async (r: StepReward) => {
        // Seed from the row, then refetch the single reward so the form reflects
        // the latest server state before editing.
        setEditId(r._id);
        setForm(rewardToForm(r));
        setShowForm(true);
        try {
            const fresh = await stepRewardsService.getById(r._id);
            setForm(rewardToForm(fresh));
        } catch {
            // Keep the row-seeded form if the refetch fails.
        }
    };

    const handleSubmit = () => {
        if (!form.context_id.trim()) {
            toast.error("Context ID is required");
            return;
        }
        const conditions = buildBonusConditions(form.bonus_conditions);
        const badges = form.unlocked_badges
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        const content = form.unlocked_content
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);

        if (editId) {
            const payload: UpdateStepRewardPayload = {
                base_points: Number(form.base_points) || 0,
                bonus_conditions: conditions,
                unlocked_badges: badges,
                unlocked_content: content,
            };
            updateMutation.mutate({ id: editId, payload });
        } else {
            const payload: CreateStepRewardPayload = {
                context_type: form.context_type,
                context_id: form.context_id.trim(),
                base_points: Number(form.base_points) || 0,
                bonus_conditions: conditions,
                unlocked_badges: badges,
                unlocked_content: content,
            };
            createMutation.mutate(payload);
        }
    };

    const setRow = (idx: number, patch: Partial<BonusRow>) => {
        setForm((f) => ({
            ...f,
            bonus_conditions: f.bonus_conditions.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
        }));
    };
    const addRow = () =>
        setForm((f) => ({
            ...f,
            bonus_conditions: [
                ...f.bonus_conditions,
                { field: "", operator: "gte", value: "", bonus_points: "0" },
            ],
        }));
    const removeRow = (idx: number) =>
        setForm((f) => ({
            ...f,
            bonus_conditions: f.bonus_conditions.filter((_, i) => i !== idx),
        }));

    if (isLoading) return <LoadingFallback message="Loading step rewards..." />;
    if (error) return <div className="p-6 text-center text-red-500">Failed to load step rewards.</div>;

    const rewards = data?.rewards ?? [];

    return (
        <>
            {/* Filters Toolbar */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                    <div className="flex flex-1 flex-col sm:flex-row gap-3">
                        <FilterDropdown
                            options={CONTEXT_TYPES.map(c => ({ label: c, value: c }))}
                            value={contextType}
                            onChange={(v: string) => {
                                setContextType(v as StepRewardContextType | "");
                                setPage(1);
                            }}
                            icon={<Filter className="w-3.5 h-3.5" />}
                            placeholder="All contexts"
                        />
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Filter by context ID"
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                value={contextId}
                                onChange={(e) => {
                                    setContextId(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    </div>
                    {canManage && (
                        <button
                            onClick={openCreate}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            Create Step Reward
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead className="bg-neutral-50/60 border-b border-neutral-100">
                            <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Context
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Context ID
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Base
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Bonuses
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {rewards.map((r) => (
                                    <tr key={r._id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <TypeBadge value={r.context_type} />
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs text-neutral-500 max-w-[160px] truncate">
                                            {r.context_id}
                                        </td>
                                        <td className="px-4 py-4 text-neutral-800">{r.base_points}</td>
                                        <td className="px-4 py-4 text-neutral-600">
                                            {r.bonus_conditions?.length ?? 0}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => setEvaluateTarget(r)}
                                                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                                                >
                                                    <Calculator className="w-4 h-4" />
                                                    Evaluate
                                                </button>
                                                {canManage && (
                                                    <button
                                                        onClick={() => void openEdit(r)}
                                                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                        Edit
                                                    </button>
                                                )}
                                                {canManage && (
                                                    <button
                                                        onClick={() => setConfirmDelete(r)}
                                                        className="text-neutral-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {rewards.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <Settings2 className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>No step rewards found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && data.total_pages > 1 && (
                        <Pagination
                            page={data.page}
                            totalPages={data.total_pages}
                            total={data.total}
                            onPageChange={setPage}
                        />
                    )}
                </div>

            {showForm && (
                <ModalShell
                    title={editId ? "Edit Step Reward" : "Create Step Reward"}
                    onClose={() => {
                        setShowForm(false);
                        setEditId(null);
                    }}
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Context type *">
                                <select
                                    className={`${inputClass} bg-white disabled:opacity-60`}
                                    value={form.context_type}
                                    disabled={!!editId}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            context_type: e.target.value as StepRewardContextType,
                                        })
                                    }
                                >
                                    {CONTEXT_TYPES.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Base points *">
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={form.base_points}
                                    onChange={(e) => setForm({ ...form, base_points: e.target.value })}
                                />
                            </Field>
                        </div>
                        <Field label="Context ID *">
                            <input
                                type="text"
                                className={`${inputClass} font-mono disabled:opacity-60`}
                                value={form.context_id}
                                disabled={!!editId}
                                onChange={(e) => setForm({ ...form, context_id: e.target.value })}
                            />
                        </Field>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Bonus conditions
                                </p>
                                <button
                                    onClick={addRow}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add row
                                </button>
                            </div>
                            {form.bonus_conditions.length === 0 && (
                                <p className="text-xs text-neutral-400">No bonus conditions.</p>
                            )}
                            {form.bonus_conditions.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="field"
                                        className={`${inputClass} col-span-4 py-2 px-3`}
                                        value={row.field}
                                        onChange={(e) => setRow(idx, { field: e.target.value })}
                                    />
                                    <select
                                        className={`${inputClass} col-span-2 py-2 px-2 bg-white`}
                                        value={row.operator}
                                        onChange={(e) =>
                                            setRow(idx, { operator: e.target.value as BonusOperator })
                                        }
                                    >
                                        {OPERATORS.map((op) => (
                                            <option key={op} value={op}>
                                                {op}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder={row.operator === "in" ? "a, b, c" : "value"}
                                        className={`${inputClass} col-span-3 py-2 px-3`}
                                        value={row.value}
                                        onChange={(e) => setRow(idx, { value: e.target.value })}
                                    />
                                    <input
                                        type="number"
                                        placeholder="pts"
                                        className={`${inputClass} col-span-2 py-2 px-2`}
                                        value={row.bonus_points}
                                        onChange={(e) => setRow(idx, { bonus_points: e.target.value })}
                                    />
                                    <button
                                        onClick={() => removeRow(idx)}
                                        className="col-span-1 flex items-center justify-center text-neutral-400 hover:text-rose-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <Field label="Unlocked badges (comma-separated)">
                            <input
                                type="text"
                                className={inputClass}
                                value={form.unlocked_badges}
                                onChange={(e) => setForm({ ...form, unlocked_badges: e.target.value })}
                            />
                        </Field>
                        <Field label="Unlocked content (comma-separated)">
                            <input
                                type="text"
                                className={inputClass}
                                value={form.unlocked_content}
                                onChange={(e) => setForm({ ...form, unlocked_content: e.target.value })}
                            />
                        </Field>

                        <ModalActions
                            onCancel={() => {
                                setShowForm(false);
                                setEditId(null);
                            }}
                            onConfirm={handleSubmit}
                            isPending={createMutation.isPending || updateMutation.isPending}
                            confirmLabel={editId ? "Save" : "Create"}
                        />
                    </div>
                </ModalShell>
            )}

            {evaluateTarget && (
                <EvaluateModal reward={evaluateTarget} onClose={() => setEvaluateTarget(null)} />
            )}

            <ConfirmModal
                open={!!confirmDelete}
                title="Confirm Deletion"
                message={`Delete step reward for "${confirmDelete?.context_id}"? This action cannot be undone.`}
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                theme="danger"
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
                onCancel={() => setConfirmDelete(null)}
                isPending={deleteMutation.isPending}
            />
        </>
    );
}

// ============================================================
// Shared sub-components
// ============================================================

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">{label}</label>
            {children}
        </div>
    );
}


function ModalShell({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-neutral-200 sticky top-0 bg-white rounded-t-2xl">
                    <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

function ModalActions({
    onCancel,
    onConfirm,
    isPending,
    confirmLabel,
}: {
    onCancel: () => void;
    onConfirm: () => void;
    isPending: boolean;
    confirmLabel: string;
}) {
    return (
        <div className="flex justify-end gap-3 pt-2">
            <button
                onClick={onCancel}
                disabled={isPending}
                className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
            >
                Cancel
            </button>
            <button
                onClick={onConfirm}
                disabled={isPending}
                className="px-4 py-2.5 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
            >
                {isPending && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {confirmLabel}
            </button>
        </div>
    );
}


export function EvaluateModal({
    reward,
    onClose,
}: {
    reward: StepReward;
    onClose: () => void;
}) {
    const [contextJson, setContextJson] = useState("{}");
    const [result, setResult] = useState<RewardEvaluation | null>(null);

    const evaluateMutation = useMutation({
        mutationFn: (context: Record<string, unknown>) =>
            stepRewardsService.evaluate(reward._id, context),
        onSuccess: (res) => {
            setResult(res);
        },
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
        <ModalShell title="Evaluate Reward" onClose={onClose}>
            <div className="space-y-4">
                <p className="text-sm text-neutral-500">
                    Context: <span className="font-mono text-neutral-700">{reward.context_type}</span> ·{" "}
                    <span className="font-mono text-neutral-700">{reward.context_id}</span>
                </p>
                <Field label="Context (JSON object)">
                    <textarea
                        rows={6}
                        className={`${inputClass} resize-none font-mono text-xs`}
                        value={contextJson}
                        onChange={(e) => setContextJson(e.target.value)}
                    />
                </Field>
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
                        <ResultStat label="Base" value={result.base_points} />
                        <ResultStat label="Bonus" value={result.bonus_points} />
                        <ResultStat label="Total" value={result.total_points} highlight />
                    </div>
                )}
            </div>
        </ModalShell>
    );
}

function ResultStat({
    label,
    value,
    highlight,
}: {
    label: string;
    value: number;
    highlight?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border p-4 text-center ${
                highlight ? "border-slate-300 bg-slate-50" : "border-neutral-200 bg-white"
            }`}
        >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${highlight ? "text-slate-700" : "text-neutral-800"}`}>
                {value}
            </p>
        </div>
    );
}

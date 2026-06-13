import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
    Trophy,
    Search,
    Plus,
    Pencil,
    Trash2,
    Eye,
    Award,
    X,
} from "lucide-react";
import { achievementsService } from "../services/achievements.service";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingFallback } from "@components/LoadingFallback";
import { FilterDropdown } from "@/components/FilterDropdown";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { useAuthStore } from "@store/auth.store";
import type {
    Achievement,
    AchievementTriggerType,
    AchievementRarity,
    CreateAchievementPayload,
    UpdateAchievementPayload,
} from "@/types";

const TRIGGER_TYPES: AchievementTriggerType[] = [
    "xp_threshold",
    "quests_completed",
    "markers_visited",
    "streak_days",
    "tasks_completed",
    "manual",
];

const RARITIES: AchievementRarity[] = ["common", "rare", "epic", "legendary"];

const RARITY_BADGE: Record<AchievementRarity, string> = {
    common: "bg-neutral-100 text-neutral-700 border-neutral-200",
    rare: "bg-blue-50 text-blue-700 border-blue-200",
    epic: "bg-purple-50 text-purple-700 border-purple-200",
    legendary: "bg-amber-50 text-amber-700 border-amber-200",
};

interface FormState {
    title: string;
    description: string;
    trigger_type: AchievementTriggerType;
    trigger_threshold: string;
    rewards_points: string;
    rarity: AchievementRarity;
    icon_url: string;
    perks: string;
    is_active: boolean;
}

const EMPTY_FORM: FormState = {
    title: "",
    description: "",
    trigger_type: "quests_completed",
    trigger_threshold: "1",
    rewards_points: "0",
    rarity: "common",
    icon_url: "",
    perks: "",
    is_active: true,
};

function toFormState(a: Achievement): FormState {
    return {
        title: a.title,
        description: a.description ?? "",
        trigger_type: a.trigger_type,
        trigger_threshold: String(a.trigger_threshold),
        rewards_points: String(a.rewards_points),
        rarity: a.rarity,
        icon_url: a.icon_url ?? "",
        perks: a.perks.join(", "),
        is_active: a.is_active,
    };
}

function parsePerks(raw: string): string[] {
    return raw
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}

export function AchievementsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const IS_SUPER = !!user?.role?.includes("super_admin");

    const [page, setPage] = useState(1);
    const [perPage] = useState(20);
    const [triggerType, setTriggerType] = useState<"" | AchievementTriggerType>("");
    const [rarity, setRarity] = useState<"" | AchievementRarity>("");
    const [isActive, setIsActive] = useState<"" | "true" | "false">("");

    const [modalMode, setModalMode] = useState<null | "create" | { type: "edit"; id: string }>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [confirmDelete, setConfirmDelete] = useState<null | { id: string; title: string }>(null);
    const [hardDelete, setHardDelete] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ["admin-achievements", { page, trigger_type: triggerType, rarity, is_active: isActive }],
        queryFn: () =>
            achievementsService.list({
                page,
                page_size: perPage,
                trigger_type: triggerType || undefined,
                rarity: rarity || undefined,
                is_active: isActive === "" ? undefined : isActive === "true",
            }),
        staleTime: 5 * 60 * 1000,
    });

    const levelsQuery = useQuery({
        queryKey: ["explorer-levels"],
        queryFn: () => achievementsService.explorerLevels(),
        staleTime: 30 * 60 * 1000,
    });

    const [earnedUserInput, setEarnedUserInput] = useState("");
    const [earnedUserId, setEarnedUserId] = useState("");
    const earnedQuery = useQuery({
        queryKey: ["user-earned-achievements", earnedUserId],
        queryFn: () => achievementsService.userEarned(earnedUserId),
        enabled: !!earnedUserId,
        staleTime: 60 * 1000,
    });

    const createMutation = useMutation({
        mutationFn: (payload: CreateAchievementPayload) => achievementsService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement created");
            setModalMode(null);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create achievement"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateAchievementPayload }) =>
            achievementsService.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement updated");
            setModalMode(null);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update achievement"),
    });

    const deleteMutation = useMutation({
        mutationFn: ({ id, hard }: { id: string; hard: boolean }) => achievementsService.remove(id, hard),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement deleted");
            setConfirmDelete(null);
            setHardDelete(false);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete achievement");
            setConfirmDelete(null);
            setHardDelete(false);
        },
    });

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setModalMode("create");
    };

    const openEdit = (a: Achievement) => {
        setForm(toFormState(a));
        setModalMode({ type: "edit", id: a._id });
    };

    const handleSubmit = () => {
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        const threshold = Number(form.trigger_threshold);
        if (!Number.isFinite(threshold)) {
            toast.error("Trigger threshold must be a number");
            return;
        }
        const points = form.rewards_points === "" ? 0 : Number(form.rewards_points);
        if (!Number.isFinite(points)) {
            toast.error("Rewards points must be a number");
            return;
        }

        if (modalMode === "create") {
            const payload: CreateAchievementPayload = {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                trigger_type: form.trigger_type,
                trigger_threshold: threshold,
                rewards_points: points,
                rarity: form.rarity,
                icon_url: form.icon_url.trim() || undefined,
                perks: parsePerks(form.perks),
                is_active: form.is_active,
            };
            createMutation.mutate(payload);
        } else if (modalMode && modalMode.type === "edit") {
            const payload: UpdateAchievementPayload = {
                title: form.title.trim(),
                description: form.description.trim() || undefined,
                trigger_threshold: threshold,
                rewards_points: points,
                rarity: form.rarity,
                icon_url: form.icon_url.trim() || undefined,
                perks: parsePerks(form.perks),
                is_active: form.is_active,
            };
            updateMutation.mutate({ id: modalMode.id, payload });
        }
    };

    if (isLoading) return <LoadingFallback message="Loading achievements..." />;

    if (error) {
        return <div className="p-6 text-center text-red-500">Failed to load achievements.</div>;
    }

    const achievements = data?.achievements ?? [];
    const isEditing = !!modalMode && modalMode !== "create";
    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-600" />
                        Achievements
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Define unlockable achievements and reward criteria
                    </p>
                </div>
                {CAN_MANAGE && (
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600 text-white rounded-xl text-sm font-medium hover:bg-yellow-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Achievement
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <FilterDropdown
                        value={triggerType}
                        onChange={(val) => {
                            setTriggerType(val as "" | AchievementTriggerType);
                            setPage(1);
                        }}
                        options={[
                            { value: "", label: "All Trigger Types" },
                            ...TRIGGER_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))
                        ]}
                        placeholder="All Trigger Types"
                        theme="amber"
                    />
                    <FilterDropdown
                        value={rarity}
                        onChange={(val) => {
                            setRarity(val as "" | AchievementRarity);
                            setPage(1);
                        }}
                        options={[
                            { value: "", label: "All Rarities" },
                            ...RARITIES.map((r) => ({ value: r, label: r }))
                        ]}
                        placeholder="All Rarities"
                        theme="amber"
                    />
                    <FilterDropdown
                        value={isActive}
                        onChange={(val) => {
                            setIsActive(val as "" | "true" | "false");
                            setPage(1);
                        }}
                        options={[
                            { value: "", label: "All Statuses" },
                            { value: "true", label: "Active" },
                            { value: "false", label: "Inactive" }
                        ]}
                        placeholder="All Statuses"
                        theme="amber"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                        <thead>
                            <tr className="bg-neutral-50/60 border-b border-neutral-100">
                                <th className="px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-left">Title</th>
                                <th className="px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-left">Trigger Type</th>
                                <th className="px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-right">Threshold</th>
                                <th className="px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-right">Points</th>
                                <th className="px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-left">Rarity</th>
                                <th className="px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-left">Status</th>
                                <th className="px-4 py-3.5 font-semibold text-neutral-500 text-xs uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-50">
                                {achievements.map((a) => (
                                <tr key={a._id} className="divide-y divide-neutral-50 hover:bg-neutral-50/80 transition-colors group">
                                    <td className="px-4 py-3 align-middle">
                                        <Link
                                            to={`/achievements/${a._id}`}
                                            className="font-medium text-neutral-900 hover:text-yellow-600"
                                        >
                                            {a.title}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-neutral-600 capitalize">
                                        {a.trigger_type.replace(/_/g, " ")}
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right text-neutral-600">
                                        {a.trigger_threshold}
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right text-neutral-600">
                                        {a.rewards_points}
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        <Badge label={a.rarity} styles={RARITY_BADGE[a.rarity]} />
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                a.is_active
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-neutral-100 text-neutral-600"
                                            }`}
                                        >
                                            {a.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    to={`/achievements/${a._id}`}
                                                    title="View details"
                                                    className="p-1.5 rounded-lg text-neutral-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                                {CAN_MANAGE && (
                                                    <button
                                                        onClick={() => openEdit(a)}
                                                        title="Edit achievement"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {CAN_MANAGE && (
                                                    <button
                                                        onClick={() => {
                                                            setHardDelete(false);
                                                            setConfirmDelete({ id: a._id, title: a.title });
                                                        }}
                                                        title="Delete achievement"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {achievements.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <Trophy className="w-12 h-12 text-neutral-300 mb-4" />
                                                <p>No achievements found matching your criteria.</p>
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

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold text-neutral-900">Explorer Levels</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Reference: XP thresholds and perks per explorer level
                    </p>
                </div>
                <div className="overflow-x-auto">
                    {levelsQuery.isLoading ? (
                        <p className="p-6 text-sm text-neutral-500">Loading explorer levels...</p>
                    ) : levelsQuery.error ? (
                        <p className="p-6 text-sm text-red-500">Failed to load explorer levels.</p>
                    ) : (
                        <table className="min-w-full divide-y divide-neutral-200 text-sm">
                            <thead className="bg-neutral-50">
                                <tr className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    <th className="px-4 py-3">Level</th>
                                    <th className="px-4 py-3">Title</th>
                                    <th className="px-4 py-3 text-right">Min XP</th>
                                    <th className="px-4 py-3 text-right">Max XP</th>
                                    <th className="px-4 py-3">Perks</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-200">
                                {(levelsQuery.data ?? []).map((lvl) => (
                                    <tr key={lvl.level} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-neutral-900">{lvl.level}</td>
                                        <td className="px-4 py-3 text-neutral-700">{lvl.title}</td>
                                        <td className="px-4 py-3 text-right text-neutral-600">{lvl.min_xp}</td>
                                        <td className="px-4 py-3 text-right text-neutral-600">
                                            {lvl.max_xp === null ? "∞" : lvl.max_xp}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-600">
                                            {lvl.perks.length > 0 ? lvl.perks.join(", ") : "—"}
                                        </td>
                                    </tr>
                                ))}
                                {(levelsQuery.data ?? []).length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                                            No explorer levels configured.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                        <Award className="w-4 h-4 text-yellow-600" />
                        User Achievements Lookup
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Inspect achievements earned (and in-progress) for any user by ID
                    </p>
                </div>
                <div className="p-4 sm:px-6">
                    <form
                        className="flex flex-col sm:flex-row gap-3 max-w-2xl"
                        onSubmit={(e) => {
                            e.preventDefault();
                            setEarnedUserId(earnedUserInput.trim());
                        }}
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Enter user ID..."
                                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                value={earnedUserInput}
                                onChange={(e) => setEarnedUserInput(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!earnedUserInput.trim()}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Search className="w-4 h-4" />
                            Look up
                        </button>
                    </form>

                    {earnedUserId && (
                        <div className="mt-4">
                            {earnedQuery.isLoading ? (
                                <p className="text-sm text-neutral-500">Loading user achievements...</p>
                            ) : earnedQuery.error ? (
                                <p className="text-sm text-red-500">
                                    Failed to load achievements for this user.
                                </p>
                            ) : (earnedQuery.data ?? []).length === 0 ? (
                                <p className="text-sm text-neutral-500">
                                    No achievement records for user{" "}
                                    <span className="font-mono">{earnedUserId}</span>.
                                </p>
                            ) : (
                                <div className="overflow-x-auto border border-neutral-100 rounded-lg">
                                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                                        <thead className="bg-neutral-50">
                                            <tr className="text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                                <th className="px-4 py-3">Achievement ID</th>
                                                <th className="px-4 py-3">Progress</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Earned at</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-neutral-200">
                                            {(earnedQuery.data ?? []).map((ua) => (
                                                <tr key={ua._id} className="hover:bg-neutral-50">
                                                    <td className="px-4 py-3">
                                                        <Link
                                                            to={`/achievements/${ua.achievement_id}`}
                                                            className="font-mono text-xs text-yellow-700 hover:underline"
                                                        >
                                                            {ua.achievement_id}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 text-neutral-600">
                                                        {ua.progress_current} / {ua.progress_required}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                ua.is_completed
                                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                    : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                                                            }`}
                                                        >
                                                            {ua.is_completed ? "Earned" : "In progress"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-neutral-600">
                                                        {ua.earned_at
                                                            ? new Date(ua.earned_at).toLocaleString()
                                                            : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            {modalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
                        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
                            <h3 className="text-lg font-bold text-neutral-900">
                                {isEditing ? "Edit Achievement" : "Create Achievement"}
                            </h3>
                            <button
                                onClick={() => setModalMode(null)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Trigger Type <span className="text-red-500">*</span>
                                    </label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={form.trigger_type.replace(/_/g, " ")}
                                            readOnly
                                            className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm bg-neutral-50 text-neutral-500 capitalize cursor-not-allowed"
                                        />
                                    ) : (
                                        <select
                                            value={form.trigger_type}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    trigger_type: e.target.value as AchievementTriggerType,
                                                })
                                            }
                                            className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        >
                                            {TRIGGER_TYPES.map((t) => (
                                                <option key={t} value={t}>
                                                    {t.replace(/_/g, " ")}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {isEditing && (
                                        <p className="text-xs text-neutral-400 mt-1">
                                            Trigger type is immutable after creation.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Trigger Threshold <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={form.trigger_threshold}
                                        onChange={(e) =>
                                            setForm({ ...form, trigger_threshold: e.target.value })
                                        }
                                        className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Rewards Points
                                    </label>
                                    <input
                                        type="number"
                                        value={form.rewards_points}
                                        onChange={(e) =>
                                            setForm({ ...form, rewards_points: e.target.value })
                                        }
                                        className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Rarity
                                    </label>
                                    <select
                                        value={form.rarity}
                                        onChange={(e) =>
                                            setForm({ ...form, rarity: e.target.value as AchievementRarity })
                                        }
                                        className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    >
                                        {RARITIES.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Icon URL
                                </label>
                                <input
                                    type="text"
                                    value={form.icon_url}
                                    onChange={(e) => setForm({ ...form, icon_url: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Perks (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={form.perks}
                                    onChange={(e) => setForm({ ...form, perks: e.target.value })}
                                    placeholder="e.g. Early access, Bonus XP"
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    className="rounded border-neutral-300 text-yellow-600 focus:ring-yellow-500"
                                />
                                <span className="text-sm font-medium text-neutral-700">Active</span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-neutral-200">
                            <button
                                onClick={() => setModalMode(null)}
                                disabled={isSubmitting}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                {isEditing ? "Save Changes" : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm modal */}
            <ConfirmModal
                open={!!confirmDelete}
                title="Delete Achievement"
                message={
                    <>
                        Are you sure you want to delete <strong>{confirmDelete?.title}</strong>?{" "}
                        {hardDelete
                            ? "This will permanently remove it."
                            : "It will be soft-deleted."}
                    </>
                }
                confirmLabel="Delete"
                confirmStyle="bg-red-600 hover:bg-red-700"
                disabledConfirm={false}
                isPending={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate({ id: confirmDelete!.id, hard: hardDelete })}
                onCancel={() => {
                    setConfirmDelete(null);
                    setHardDelete(false);
                }}
                theme="danger"
            >
                {IS_SUPER && (
                    <label className="mt-4 flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={hardDelete}
                            onChange={(e) => setHardDelete(e.target.checked)}
                            className="rounded border-neutral-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-neutral-700">Hard delete (permanent)</span>
                    </label>
                )}
            </ConfirmModal>
        </div>
    );
}

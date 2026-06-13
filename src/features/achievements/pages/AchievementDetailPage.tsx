import { useState, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Pencil, Trash2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { achievementsService } from "../services/achievements.service";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingFallback } from "@components/LoadingFallback";
import { useAuthStore } from "@store/auth.store";
import type {
    Achievement,
    AchievementRarity,
    UpdateAchievementPayload,
} from "@/types";

const RARITY_BADGE: Record<AchievementRarity, string> = {
    common: "bg-neutral-100 text-neutral-700 border-neutral-200",
    rare: "bg-blue-50 text-blue-700 border-blue-200",
    epic: "bg-purple-50 text-purple-700 border-purple-200",
    legendary: "bg-amber-50 text-amber-700 border-amber-200",
};

const RARITIES: AchievementRarity[] = ["common", "rare", "epic", "legendary"];

function fmtDate(value?: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

interface EditState {
    title: string;
    description: string;
    trigger_threshold: string;
    rewards_points: string;
    rarity: AchievementRarity;
    icon_url: string;
    perks: string;
    is_active: boolean;
}

function toEditState(a: Achievement): EditState {
    return {
        title: a.title,
        description: a.description ?? "",
        trigger_threshold: String(a.trigger_threshold),
        rewards_points: String(a.rewards_points),
        rarity: a.rarity,
        icon_url: a.icon_url ?? "",
        perks: a.perks.join(", "),
        is_active: a.is_active,
    };
}

export function AchievementDetailPage() {
    const { achievementId: achievementIdParam } = useParams<{ achievementId: string }>();
    const achievementId = achievementIdParam ?? "";
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const CAN_MANAGE = !!user?.role?.some((r) => ["admin", "super_admin"].includes(r));
    const IS_SUPER = !!user?.role?.includes("super_admin");

    const [edit, setEdit] = useState<EditState | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);

    const { data: achievement, isLoading, error } = useQuery<Achievement>({
        queryKey: ["achievement-detail", achievementId],
        queryFn: () => achievementsService.getById(achievementId),
        enabled: !!achievementId,
        staleTime: 60 * 1000,
    });

    const updateMutation = useMutation({
        mutationFn: (payload: UpdateAchievementPayload) =>
            achievementsService.update(achievementId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["achievement-detail", achievementId] });
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement updated");
            setEdit(null);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update achievement"),
    });

    const deleteMutation = useMutation({
        mutationFn: (hard: boolean) => achievementsService.remove(achievementId, hard),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement deleted");
            navigate("/achievements");
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete achievement");
            setConfirmDelete(false);
        },
    });

    if (isLoading) return <LoadingFallback message="Loading achievement..." />;

    if (error || !achievement) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">Failed to load achievement or it does not exist.</p>
                <Link to="/achievements" className="text-yellow-600 hover:underline">
                    Back to Achievements
                </Link>
            </div>
        );
    }

    const handleSave = () => {
        if (!edit) return;
        if (!edit.title.trim()) {
            toast.error("Title is required");
            return;
        }
        const threshold = Number(edit.trigger_threshold);
        const points = edit.rewards_points === "" ? 0 : Number(edit.rewards_points);
        if (!Number.isFinite(threshold) || !Number.isFinite(points)) {
            toast.error("Threshold and points must be numbers");
            return;
        }
        const payload: UpdateAchievementPayload = {
            title: edit.title.trim(),
            description: edit.description.trim() || undefined,
            trigger_threshold: threshold,
            rewards_points: points,
            rarity: edit.rarity,
            icon_url: edit.icon_url.trim() || undefined,
            perks: edit.perks
                .split(",")
                .map((p) => p.trim())
                .filter((p) => p.length > 0),
            is_active: edit.is_active,
        };
        updateMutation.mutate(payload);
    };

    return (
        <div className="animate-fade-in max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <Link
                    to="/achievements"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                {CAN_MANAGE && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setEdit(toEditState(achievement))}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center gap-2 transition-colors text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                        >
                            <Pencil className="w-4 h-4" />
                            Edit
                        </button>
                        <button
                            onClick={() => {
                                setHardDelete(false);
                                setConfirmDelete(true);
                            }}
                            className="py-2.5 px-4 rounded-xl font-medium flex items-center gap-2 transition-colors text-red-600 bg-red-50 hover:bg-red-100"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start gap-4">
                    {achievement.icon_url ? (
                        <img
                            src={achievement.icon_url}
                            alt={achievement.title}
                            className="w-14 h-14 rounded-xl object-cover bg-neutral-100 flex-shrink-0"
                        />
                    ) : (
                        <div className="bg-yellow-100 text-yellow-600 rounded-xl w-14 h-14 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-6 h-6" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-neutral-900">{achievement.title}</h1>
                        <div className="mt-2 flex items-center gap-2">
                            <Badge label={achievement.rarity} styles={RARITY_BADGE[achievement.rarity]} />
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    achievement.is_active
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-neutral-100 text-neutral-600"
                                }`}
                            >
                                {achievement.is_active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
                <div className="bg-neutral-50/50 border-b border-neutral-100 p-4 sm:px-6">
                    <h3 className="text-base font-semibold text-neutral-900">Details</h3>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <DetailRow label="Description">
                        <span className="text-neutral-800 whitespace-pre-wrap">
                            {achievement.description || "—"}
                        </span>
                    </DetailRow>
                    <DetailRow label="Trigger Type">
                        <span className="text-neutral-800 capitalize">
                            {achievement.trigger_type.replace(/_/g, " ")}
                        </span>
                    </DetailRow>
                    <DetailRow label="Trigger Threshold">
                        <span className="text-neutral-800">{achievement.trigger_threshold}</span>
                    </DetailRow>
                    <DetailRow label="Rewards Points">
                        <span className="text-neutral-800">{achievement.rewards_points}</span>
                    </DetailRow>
                    <DetailRow label="Rarity">
                        <Badge label={achievement.rarity} styles={RARITY_BADGE[achievement.rarity]} />
                    </DetailRow>
                    <DetailRow label="Perks">
                        {achievement.perks.length > 0 ? (
                            <ul className="list-disc list-inside text-neutral-800 space-y-0.5">
                                {achievement.perks.map((p, i) => (
                                    <li key={`${p}-${i}`}>{p}</li>
                                ))}
                            </ul>
                        ) : (
                            <span className="text-neutral-800">—</span>
                        )}
                    </DetailRow>
                    <DetailRow label="Active">
                        <span className="text-neutral-800">{achievement.is_active ? "Yes" : "No"}</span>
                    </DetailRow>
                    <DetailRow label="Icon URL">
                        <span className="text-neutral-800 font-mono break-all">
                            {achievement.icon_url || "—"}
                        </span>
                    </DetailRow>
                    <DetailRow label="Created">
                        <span className="text-neutral-800">{fmtDate(achievement.created_at)}</span>
                    </DetailRow>
                    <DetailRow label="Updated">
                        <span className="text-neutral-800">{fmtDate(achievement.updated_at)}</span>
                    </DetailRow>
                    <DetailRow label="ID">
                        <span className="text-neutral-500 font-mono text-xs break-all">
                            {achievement._id}
                        </span>
                    </DetailRow>
                </div>
            </Card>

            {/* Edit Modal */}
            {edit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
                            <h3 className="text-lg font-bold text-neutral-900">Edit Achievement</h3>
                            <button
                                onClick={() => setEdit(null)}
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
                                    value={edit.title}
                                    onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    rows={2}
                                    value={edit.description}
                                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Trigger Type
                                </label>
                                <input
                                    type="text"
                                    value={achievement.trigger_type.replace(/_/g, " ")}
                                    readOnly
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm bg-neutral-50 text-neutral-500 capitalize cursor-not-allowed"
                                />
                                <p className="text-xs text-neutral-400 mt-1">
                                    Trigger type is immutable after creation.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                                        Trigger Threshold <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={edit.trigger_threshold}
                                        onChange={(e) =>
                                            setEdit({ ...edit, trigger_threshold: e.target.value })
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
                                        value={edit.rewards_points}
                                        onChange={(e) =>
                                            setEdit({ ...edit, rewards_points: e.target.value })
                                        }
                                        className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Rarity</label>
                                <select
                                    value={edit.rarity}
                                    onChange={(e) =>
                                        setEdit({ ...edit, rarity: e.target.value as AchievementRarity })
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
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Icon URL
                                </label>
                                <input
                                    type="text"
                                    value={edit.icon_url}
                                    onChange={(e) => setEdit({ ...edit, icon_url: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Perks (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={edit.perks}
                                    onChange={(e) => setEdit({ ...edit, perks: e.target.value })}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={edit.is_active}
                                    onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
                                    className="rounded border-neutral-300 text-yellow-600 focus:ring-yellow-500"
                                />
                                <span className="text-sm font-medium text-neutral-700">Active</span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-neutral-200">
                            <button
                                onClick={() => setEdit(null)}
                                disabled={updateMutation.isPending}
                                className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                                className="px-4 py-2.5 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {updateMutation.isPending && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 text-red-600 mb-4">
                                <AlertCircle className="w-6 h-6" />
                                <h3 className="text-lg font-bold text-neutral-900">Delete Achievement</h3>
                            </div>
                            <p className="text-neutral-600">
                                Are you sure you want to delete <strong>{achievement.title}</strong>?{" "}
                                {hardDelete
                                    ? "This will permanently remove it."
                                    : "It will be soft-deleted."}
                            </p>
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
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setConfirmDelete(false);
                                        setHardDelete(false);
                                    }}
                                    disabled={deleteMutation.isPending}
                                    className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(hardDelete)}
                                    disabled={deleteMutation.isPending}
                                    className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {deleteMutation.isPending && (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="w-40 shrink-0 font-medium text-neutral-500">{label}</span>
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

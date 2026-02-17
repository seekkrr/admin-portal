import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft, RefreshCw, AlertTriangle,
    Clock, MapPin, Eye, Tag, Star, Layers,
    Compass, Hash, Lightbulb, Trophy,
    DollarSign, Trash2, Image as ImageIcon, UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@store/auth.store";
import { AccessDenied } from "@components/AccessDenied";
import { questsService } from "../services/quests.service";
import { formatDuration, isValidObjectId } from "../utils/formatters";
import { ConfirmModal } from "@/features/users/components/ConfirmModal";
import { Badge } from "@/features/users/components/Badge";
import type { QuestStatus } from "@/types";

// ---- Constants ----
const ALLOWED_ROLES = ["admin", "super_admin", "moderator"];
const CAN_DELETE_ROLES = ["admin", "super_admin"];

// ---- Status Styles ----
const questStatusConfig: Record<string, { label: string; dot: string; bg: string; active: string }> = {
    Draft: { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200", active: "bg-neutral-600 text-white border-neutral-600" },
    Published: { label: "Published", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", active: "bg-emerald-600 text-white border-emerald-600" },
    Paused: { label: "Paused", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200", active: "bg-amber-500 text-white border-amber-500" },
    Archived: { label: "Archived", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200", active: "bg-red-600 text-white border-red-600" },
};

// formatDuration and isValidObjectId imported from ../utils/formatters

// ---- Confirm action type ----
type ConfirmAction =
    | { type: "delete" }
    | { type: "status-change"; payload: { status: QuestStatus } };

// ---- Component ----
export function QuestDetailPage() {
    const { questId } = useParams<{ questId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuthStore();

    const hasAccess = !!currentUser && ALLOWED_ROLES.includes(currentUser.role);
    const canDelete = !!currentUser && CAN_DELETE_ROLES.includes(currentUser.role);
    const validQuestId = isValidObjectId(questId);

    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [hardDelete, setHardDelete] = useState(false);
    const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

    // Reset hard delete on modal close
    useEffect(() => { if (!confirmAction) setHardDelete(false); }, [confirmAction]);

    // ---- Fetch ----
    const { data, isLoading, error } = useQuery({
        queryKey: ["quest-detail", questId],
        queryFn: () => questsService.getQuestDetail(questId!),
        enabled: !!questId && validQuestId,
    });

    // ---- Mutations ----
    const statusMutation = useMutation({
        mutationFn: (status: QuestStatus) => questsService.updateQuestStatus(questId!, status),
        onSuccess: () => {
            toast.success("Quest status updated");
            queryClient.invalidateQueries({ queryKey: ["quest-detail", questId] });
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            setConfirmAction(null);
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    const deleteMutation = useMutation({
        mutationFn: (hard: boolean) => questsService.deleteQuest(questId!, hard),
        onSuccess: () => {
            toast.success("Quest deleted");
            queryClient.invalidateQueries({ queryKey: ["admin-quests"] });
            navigate("/quests");
        },
        onError: (err: Error) => { toast.error(err.message); setConfirmAction(null); },
    });

    // ---- Confirm handler ----
    const executeConfirmedAction = useCallback(() => {
        if (!confirmAction) return;
        switch (confirmAction.type) {
            case "delete":
                deleteMutation.mutate(hardDelete);
                break;
            case "status-change":
                statusMutation.mutate(confirmAction.payload.status);
                break;
        }
    }, [confirmAction, deleteMutation, statusMutation, hardDelete]);

    const toggleStep = (stepId: string) => {
        setExpandedSteps(prev => {
            const next = new Set(prev);
            if (next.has(stepId)) next.delete(stepId);
            else next.add(stepId);
            return next;
        });
    };

    // ---- Guards ----
    if (!hasAccess) return <AccessDenied message="Only admins and moderators can manage quests." />;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-violet-600 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertTriangle className="w-10 h-10 text-red-400" />
                <p className="text-red-500 text-sm">Failed to load quest</p>
                <button onClick={() => navigate("/quests")} className="text-violet-600 text-sm hover:underline">Back to Quests</button>
            </div>
        );
    }

    const { quest, metadata, location, media, steps, creator } = data;
    const currentStatus = quest.status;
    const defaultStatus = { label: "Draft", dot: "bg-neutral-400", bg: "bg-neutral-50 text-neutral-600 border-neutral-200", active: "bg-neutral-600 text-white border-neutral-600" };
    const sc = questStatusConfig[currentStatus] ?? defaultStatus;

    return (
        <div className="p-6 max-w-[1100px] mx-auto space-y-6 animate-fade-in">
            {/* Back Button + Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate("/quests")}
                    className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-neutral-900 truncate">
                        {metadata?.title || quest.quest_title || "Untitled Quest"}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                        </span>
                        <span className="text-sm text-neutral-400">ID: {quest._id.slice(-8)}</span>
                    </div>
                </div>
            </div>

            {/* Overview Grid (Stat Cards) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={<Eye className="w-4 h-4 text-indigo-500" />} label="Views" value={(quest.view_count ?? 0).toLocaleString()} />
                <StatCard icon={<DollarSign className="w-4 h-4 text-emerald-500" />} label="Price" value={quest.price > 0 ? `₹${quest.price.toLocaleString("en-IN")}` : "Free"} />
                <StatCard icon={<Clock className="w-4 h-4 text-blue-500" />} label="Duration" value={formatDuration(metadata?.duration_minutes)} />
                <StatCard icon={<Layers className="w-4 h-4 text-teal-500" />} label="Steps" value={steps.length} />
                <StatCard icon={<Star className="w-4 h-4 text-amber-500" />} label="Difficulty" value={metadata?.difficulty ?? "—"} />
                <StatCard icon={<Tag className="w-4 h-4 text-violet-500" />} label="Theme" value={metadata?.theme ?? "—"} />
            </div>

            {/* Status Management */}
            <Section title="Status Management" icon={<Compass className="w-4 h-4" />}>
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(questStatusConfig) as QuestStatus[]).map((status) => {
                        const sConf = questStatusConfig[status];
                        const isActive = currentStatus === status;
                        return (
                            <button
                                key={status}
                                disabled={isActive || statusMutation.isPending}
                                onClick={() => setConfirmAction({ type: "status-change", payload: { status } })}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${isActive ? (sConf?.active ?? "") + " shadow-sm cursor-default" : (sConf?.bg ?? "") + " hover:shadow-sm"} disabled:cursor-default`}
                            >
                                {isActive && <span className="mr-1.5">●</span>}
                                {status}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Metadata */}
                <Section title="Metadata" icon={<Hash className="w-4 h-4" />}>
                    <div className="space-y-4">
                        {/* Description */}
                        {metadata?.description && metadata.description.length > 0 && (
                            <div>
                                <Label>Description</Label>
                                <div className="text-sm text-neutral-700 leading-relaxed space-y-2 mt-1">
                                    {metadata.description.map((para, i) => <p key={i}>{para}</p>)}
                                </div>
                            </div>
                        )}

                        {/* Keywords */}
                        {metadata?.keywords && metadata.keywords.length > 0 && (
                            <div>
                                <Label>Keywords</Label>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {metadata.keywords.map((kw, i) => (
                                        <Badge key={i} label={kw} styles="bg-violet-50 text-violet-700 border-violet-200" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Points & Hints */}
                        <div className="grid grid-cols-2 gap-3">
                            <InfoRow icon={<Trophy className="w-3.5 h-3.5 text-amber-500" />} label="Max Points" value={metadata?.max_points ?? "—"} />
                            <InfoRow icon={<Lightbulb className="w-3.5 h-3.5 text-yellow-500" />} label="Hints Allowed" value={metadata?.hints_allowed ?? "—"} />
                        </div>
                    </div>
                </Section>

                {/* Location */}
                <Section title="Location" icon={<MapPin className="w-4 h-4" />}>
                    {location ? (
                        <div className="space-y-3">
                            <InfoRow label="Region" value={location.region} />
                            <InfoRow
                                label="Start"
                                value={`${location.start_location.coordinates[1].toFixed(4)}, ${location.start_location.coordinates[0].toFixed(4)}`}
                            />
                            <InfoRow
                                label="End"
                                value={`${location.end_location.coordinates[1].toFixed(4)}, ${location.end_location.coordinates[0].toFixed(4)}`}
                            />
                            <InfoRow label="Waypoints" value={location.route_waypoints?.length ?? 0} />
                            <InfoRow label="Map Style" value={location.map_data?.map_style ?? "—"} />
                            <InfoRow label="Zoom Level" value={location.map_data?.zoom_level ?? "—"} />
                        </div>
                    ) : (
                        <p className="text-sm text-neutral-400 italic">No location data</p>
                    )}
                </Section>
            </div>

            {/* Steps */}
            <Section title={`Steps (${steps.length})`} icon={<Layers className="w-4 h-4" />}>
                {steps.length === 0 ? (
                    <p className="text-sm text-neutral-400 italic">No steps defined</p>
                ) : (
                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 overflow-hidden">
                        {steps.map((step) => (
                            <div key={step._id}>
                                <button
                                    onClick={() => toggleStep(step._id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                                >
                                    <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {step.order}
                                    </span>
                                    <span className="font-medium text-neutral-800 text-sm flex-1">{step.title}</span>
                                    <span className={`text-neutral-400 transition-transform ${expandedSteps.has(step._id) ? "rotate-90" : ""}`}>
                                        ▸
                                    </span>
                                </button>
                                {expandedSteps.has(step._id) && (
                                    <div className="px-4 pb-3 pl-14 text-sm text-neutral-600 leading-relaxed animate-fade-in">
                                        {step.description}
                                        {step.cloudinary_assets && step.cloudinary_assets.length > 0 && (
                                            <div className="flex gap-2 mt-2">
                                                {step.cloudinary_assets.map((asset, i) => (
                                                    <img key={i} src={asset.secure_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-neutral-200" />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Media Gallery */}
            <Section title={`Media (${media?.cloudinary_assets.length ?? 0})`} icon={<ImageIcon className="w-4 h-4" />}>
                {media && media.cloudinary_assets.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {media.cloudinary_assets.map((asset) => (
                            <a
                                key={asset.public_id}
                                href={asset.secure_url}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative rounded-xl overflow-hidden border border-neutral-200 aspect-square"
                            >
                                <img
                                    src={asset.secure_url}
                                    alt={asset.alt_text || ""}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-2">
                                    <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                                        {asset.public_id}
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-neutral-400 italic">No media uploaded</p>
                )}
            </Section>

            {/* Creator Info */}
            <Section title="Creator" icon={<UserCircle className="w-4 h-4" />}>
                {creator ? (
                    <div className="grid grid-cols-2 gap-3">
                        <InfoRow label="Name" value={`${creator.first_name} ${creator.last_name}`} />
                        <InfoRow label="Role" value={creator.role} />
                        <InfoRow label="Status" value={creator.status} />
                        <InfoRow label="Creator ID" value={creator._id.slice(-12)} />
                    </div>
                ) : (
                    <p className="text-sm text-neutral-400 italic">Creator info unavailable</p>
                )}
            </Section>

            {/* Quest Settings */}
            <Section title="Quest Settings" icon={<Compass className="w-4 h-4" />}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoRow label="Booking Enabled" value={quest.booking_enabled ? "Yes" : "No"} />
                    <InfoRow label="Price" value={quest.price > 0 ? `₹${quest.price.toLocaleString("en-IN")}` : "Free"} />
                    <InfoRow label="Currency" value={quest.currency ?? "INR"} />
                    <InfoRow label="Schema Version" value={quest.schema_version} />
                    <InfoRow label="Quest Version" value={quest.version} />
                    <InfoRow label="Created" value={new Date(quest.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
                </div>
            </Section>

            {/* Danger Zone (admin/super_admin only) */}
            {canDelete && (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                    <h3 className="text-base font-bold text-red-700 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5" /> Danger Zone
                    </h3>
                    <p className="text-sm text-red-600 mb-4">Deleting a quest is irreversible if hard-deleted. Use with caution.</p>
                    <button
                        onClick={() => setConfirmAction({ type: "delete" })}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" /> Delete Quest
                    </button>
                </div>
            )}

            {/* Delete Confirm Modal */}
            <ConfirmModal
                open={confirmAction?.type === "delete"}
                title="Delete Quest"
                message={`This will ${hardDelete ? "PERMANENTLY" : "soft"}-delete "${metadata?.title || quest.quest_title || "this quest"}". ${hardDelete ? "All data will be permanently removed." : "The quest can be recovered later."}`}
                confirmLabel={hardDelete ? "Hard Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={deleteMutation.isPending}
            >
                <label className="flex items-center gap-2 mt-3 mb-1 px-1 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={hardDelete}
                        onChange={(e) => setHardDelete(e.target.checked)}
                        className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 accent-red-600"
                    />
                    <span className="text-xs text-red-600 font-medium">Hard delete (permanent, irreversible)</span>
                </label>
            </ConfirmModal>

            {/* Status Change Confirm Modal */}
            <ConfirmModal
                open={confirmAction?.type === "status-change"}
                title="Change Quest Status"
                message={confirmAction?.type === "status-change"
                    ? `Change "${metadata?.title || quest.quest_title || "this quest"}" to "${confirmAction.payload.status}". This will take effect immediately.`
                    : ""}
                confirmLabel="Change Status"
                confirmStyle="bg-violet-600 hover:bg-violet-700"
                onConfirm={executeConfirmedAction}
                onCancel={() => setConfirmAction(null)}
                isPending={statusMutation.isPending}
                theme="warning"
            />
        </div>
    );
}

// ---- Shared sub-components ----

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                {icon} {title}
            </h3>
            {children}
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{children}</span>;
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="bg-neutral-50 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-neutral-500 text-sm">
                {icon}
                <span>{label}</span>
            </div>
            <span className="text-sm font-medium text-neutral-800">{value}</span>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center">
            <div className="flex items-center justify-center mb-2">{icon}</div>
            <div className="text-xl font-bold text-neutral-900">{value}</div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider mt-1">{label}</div>
        </div>
    );
}

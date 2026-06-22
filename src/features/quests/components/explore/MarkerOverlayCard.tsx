import { X, CheckSquare, MapPin, Clock, Wallet, Globe, Phone } from "lucide-react";
import type { ExperienceMarker, ExperienceTask } from "@/types";

function TaskRow({ task }: { task: ExperienceTask }) {
    return (
        <div className="bg-white/5 rounded-lg p-2 text-xs space-y-1 border border-white/10">
            <div className="flex items-center justify-between">
                <p className="font-semibold text-violet-100">{task.title}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-200">
                    {task.task_type}
                </span>
            </div>
            {task.quiz_data && (() => {
                const qd = task.quiz_data;
                return (
                    <div className="text-neutral-300">
                        <p>{qd.question}</p>
                        <ul className="mt-1 space-y-0.5">
                            {qd.options.map((opt, i) => (
                                <li key={i} className={i === qd.correct_answer
                                    ? "text-emerald-400 font-medium" : "text-neutral-400"}>
                                    {i === qd.correct_answer ? "✓ " : "• "}{opt}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })()}
            {task.collection_items && task.collection_items.length > 0 && (
                <p className="text-neutral-300">Collect: {task.collection_items.join(", ")}</p>
            )}
            {task.qr_data && <p className="text-neutral-400">QR scan task</p>}
            {task.photo_requirements && <p className="text-neutral-400">Photo challenge</p>}
            {task.social_task && <p className="text-neutral-400">Social task</p>}
            {task.hints.length > 0 && (() => {
                const hint = task.hints[0];
                return hint ? (
                    <p className="text-amber-300/80">Hint ({hint.cost} pts): {hint.text}</p>
                ) : null;
            })()}
            <p className="text-violet-300/70">+{task.base_points} pts</p>
        </div>
    );
}

interface MarkerOverlayCardProps {
    marker: ExperienceMarker;
    onClose: () => void;
}

export function MarkerOverlayCard({ marker, onClose }: MarkerOverlayCardProps) {
    const expense = marker.min_expense !== null || marker.max_expense !== null
        ? `₹${marker.min_expense ?? 0}–₹${marker.max_expense ?? "?"}` : null;
    return (
        <div className="relative w-[320px] max-h-[340px] flex flex-col
                        bg-[rgba(17,17,21,0.96)] backdrop-blur-md rounded-2xl border border-violet-700/40
                        shadow-2xl overflow-hidden">
            {marker.images?.[0] && (
                <div className="relative h-32 flex-shrink-0 overflow-hidden">
                    <img src={marker.images?.[0]} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-8">
                        <p className="text-white font-bold text-sm truncate">{marker.name}</p>
                        {marker.category && <p className="text-violet-200/80 text-xs">{marker.category}</p>}
                    </div>
                </div>
            )}
            <div className="p-3 space-y-2 overflow-y-auto">
                {!marker.images?.[0] && (
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-violet-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-white">{marker.name}</p>
                            {marker.category && <p className="text-xs text-violet-300/70">{marker.category}</p>}
                        </div>
                    </div>
                )}
                {marker.description && (
                    <p className="text-xs text-neutral-300 leading-relaxed line-clamp-3">{marker.description}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-400">
                    {marker.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{marker.address}</span>}
                    {(marker.opens_at || marker.closes_at) && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{marker.opens_at ?? "?"}–{marker.closes_at ?? "?"}</span>
                    )}
                    {expense && <span className="flex items-center gap-1"><Wallet className="w-3 h-3" />{expense}</span>}
                    {marker.website_url && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Website</span>}
                    {marker.contact && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{marker.contact}</span>}
                </div>
                {marker.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {marker.tags.slice(0, 6).map((t) => (
                            <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/5 text-neutral-300">{t}</span>
                        ))}
                    </div>
                )}
                {marker.things_to_do_text && (
                    <p className="text-xs text-violet-200/90 leading-relaxed">{marker.things_to_do_text}</p>
                )}
                {marker.tasks.length > 0 && (
                    <div>
                        <p className="text-[10px] font-semibold text-violet-300 flex items-center gap-1 mb-1.5 uppercase tracking-wider">
                            <CheckSquare className="w-3 h-3" /> Tasks ({marker.tasks.length})
                        </p>
                        <div className="space-y-1.5">
                            {marker.tasks.map((task) => <TaskRow key={task._id} task={task} />)}
                        </div>
                    </div>
                )}
            </div>
            <button onClick={onClose}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

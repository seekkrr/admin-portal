import { X, CheckSquare, MapPin } from "lucide-react";
import type { MarkerWithCoords } from "../../hooks/useQuestExperience";
import type { TaskConfig } from "@/types";

interface MarkerOverlayCardProps {
    marker: MarkerWithCoords;
    onClose: () => void;
}

export function MarkerOverlayCard({ marker, onClose }: MarkerOverlayCardProps) {
    return (
        <div className="absolute bottom-4 left-4 right-16 md:left-auto md:right-72 md:w-72 z-20 bg-white rounded-2xl border border-neutral-200 shadow-xl overflow-hidden">
            {marker.images[0]?.secure_url && (
                <div className="relative h-32 overflow-hidden">
                    <img src={marker.images[0].secure_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-8">
                        <p className="text-white font-semibold text-sm truncate">{marker.name}</p>
                        {marker.category && <p className="text-white/70 text-xs">{marker.category}</p>}
                    </div>
                </div>
            )}
            <div className="p-3 space-y-2">
                {!marker.images[0]?.secure_url && (
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-neutral-800">{marker.name}</p>
                            {marker.category && <p className="text-xs text-neutral-400">{marker.category}</p>}
                        </div>
                    </div>
                )}
                {marker.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {marker.tags.slice(0, 5).map((t) => (
                            <span key={t} className="px-1.5 py-0.5 text-[10px] rounded-full bg-neutral-100 text-neutral-500">{t}</span>
                        ))}
                    </div>
                )}
                {marker.things_to_do_text && (
                    <p className="text-xs text-neutral-600 leading-relaxed line-clamp-3">{marker.things_to_do_text}</p>
                )}
                {marker.tasks.length > 0 && (
                    <div>
                        <p className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1 mb-1">
                            <CheckSquare className="w-3 h-3" /> Tasks ({marker.tasks.length})
                        </p>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {marker.tasks.map((task: TaskConfig) => (
                                <div key={task._id} className="bg-neutral-50 rounded-lg p-2 text-xs space-y-0.5">
                                    <p className="font-medium text-neutral-800">{task.title}</p>
                                    <p className="text-neutral-400">Type: {task.task_type}</p>
                                    {task.quiz_data?.correct_answer && (
                                        <p className="text-emerald-600 font-medium">
                                            Answer: {task.quiz_data.correct_answer}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/20 text-white hover:bg-black/30 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

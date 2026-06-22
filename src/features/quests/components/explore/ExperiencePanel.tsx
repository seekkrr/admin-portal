import { X, Volume2, Sparkles, CheckSquare, MapPin } from "lucide-react";
import { TaskPlayer } from "./TaskPlayer";
import type { ExperienceMarker, ExperienceNarrative } from "@/types";

interface ExperiencePanelProps {
    marker: ExperienceMarker;
    narrative: ExperienceNarrative | null;
    onClose: () => void;
    onTaskComplete?: (taskId: string, points: number) => void;
    onHintUsed?: (taskId: string, cost: number) => void;
    onAudioEnded?: () => void;
}

export function ExperiencePanel({ marker, narrative, onClose, onTaskComplete, onHintUsed, onAudioEnded }: ExperiencePanelProps) {
    const heroImg = narrative?.media?.[0] ?? marker.images?.[0] ?? null;
    return (
        <div className="absolute top-3 bottom-[84px] left-3 z-30 w-[372px] max-w-[88%] flex flex-col
                        bg-[rgba(13,13,18,0.96)] backdrop-blur-md border border-violet-800/40 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-white/10 flex-shrink-0">
                <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {marker.order ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{marker.name}</p>
                    {marker.category && <p className="text-[11px] text-violet-300/70">{marker.category}</p>}
                </div>
                <button onClick={onClose} className="p-1 rounded-full bg-white/10 text-white hover:bg-white/20 flex-shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {heroImg && (
                    <div className="relative h-40 flex-shrink-0">
                        <img src={heroImg} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(13,13,18,0.95)] to-transparent" />
                    </div>
                )}

                <div className="p-4 space-y-4">
                    {marker.address && (
                        <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 flex-shrink-0" /> {marker.address}
                        </p>
                    )}

                    {narrative ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Narrative
                                </span>
                                {narrative.voice_persona && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-300">
                                        {narrative.voice_persona.replace(/_/g, " ")}
                                    </span>
                                )}
                                {narrative.is_mandatory && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-900/30 text-rose-300">mandatory</span>
                                )}
                            </div>
                            {narrative.title && <p className="text-sm font-semibold text-amber-100">{narrative.title}</p>}
                            {narrative.content && <p className="text-sm text-neutral-200 leading-relaxed">{narrative.content}</p>}
                            {narrative.audio_url && (
                                <div className="flex items-center gap-2 pt-1">
                                    <Volume2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <audio key={narrative.id} src={narrative.audio_url} autoPlay controls
                                        onEnded={onAudioEnded} className="h-8 w-full rounded-full" style={{ colorScheme: "dark" }} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-neutral-400 italic">No narrative recorded for this stop.</p>
                    )}

                    {marker.things_to_do_text && (
                        <p className="text-xs text-violet-200/90 leading-relaxed border-l-2 border-violet-500/40 pl-2">
                            {marker.things_to_do_text}
                        </p>
                    )}

                    <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-violet-300 flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" /> Tasks ({marker.tasks.length})
                        </p>
                        {marker.tasks.length > 0
                            ? marker.tasks.map((t) => <TaskPlayer key={t._id} task={t}
                                onComplete={onTaskComplete ? () => onTaskComplete(t._id, t.base_points) : undefined}
                                onHint={onHintUsed ? (cost) => onHintUsed(t._id, cost) : undefined} />)
                            : <p className="text-xs text-neutral-500 italic">No tasks at this stop.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

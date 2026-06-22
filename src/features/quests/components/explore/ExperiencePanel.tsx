import { useState, useEffect, useCallback, useRef } from "react";
import { X, Volume2, Sparkles, CheckSquare, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { TaskPlayer } from "./TaskPlayer";
import type { ExperienceMarker, ExperienceNarrative } from "@/types";

interface ExperiencePanelProps {
    marker: ExperienceMarker;
    narratives: ExperienceNarrative[];
    onClose: () => void;
    onTaskComplete?: (taskId: string, points: number) => void;
    onHintUsed?: (taskId: string, cost: number) => void;
    /** Fires when the entire chain has finished (last narrative audio ends). */
    onChainComplete?: () => void;
}

export function ExperiencePanel({ marker, narratives, onClose, onTaskComplete, onHintUsed, onChainComplete }: ExperiencePanelProps) {
    const [chainIndex, setChainIndex] = useState(0);
    const audioTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset chain position when the marker (stop) changes.
    useEffect(() => { setChainIndex(0); }, [marker.marker_id]);

    const current = narratives[chainIndex] ?? null;

    useEffect(() => {
        return () => {
            if (audioTimeoutRef.current) {
                clearTimeout(audioTimeoutRef.current);
                audioTimeoutRef.current = null;
            }
        };
    }, [current]);
    const isChain = narratives.length > 1;
    const isLast = chainIndex >= narratives.length - 1;

    const goNext = useCallback(() => {
        if (!isLast) setChainIndex((i) => i + 1);
    }, [isLast]);
    const goPrev = useCallback(() => {
        setChainIndex((i) => Math.max(0, i - 1));
    }, []);

    // When the current narrative's audio ends, either advance the chain or
    // signal the parent that the whole chain is done.
    const handleAudioEnded = useCallback(() => {
        if (!isLast) {
            // Auto-advance to next narrative in the chain after a brief pause.
            audioTimeoutRef.current = setTimeout(() => goNext(), 600);
        } else {
            onChainComplete?.();
        }
    }, [isLast, goNext, onChainComplete]);

    // If the current narrative has no audio and it's part of a chain, auto-advance
    // after a readable dwell so the text can be read.
    useEffect(() => {
        if (!current || !isChain) return;
        if (current.audio_url) return;  // audio-driven advance
        const dwell = current.content ? Math.max(3000, (current.content.length / 20) * 1000) : 2000;
        const t = setTimeout(() => {
            if (!isLast) goNext();
            else onChainComplete?.();
        }, dwell);
        return () => clearTimeout(t);
    }, [current, isChain, isLast, goNext, onChainComplete]);

    const heroImg = current?.media?.[0] ?? marker.images?.[0] ?? null;

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

                    {current ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Narrative
                                </span>
                                {isChain && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-200 font-medium">
                                        {chainIndex + 1} / {narratives.length}
                                    </span>
                                )}
                                {current.voice_persona && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-300">
                                        {current.voice_persona.replace(/_/g, " ")}
                                    </span>
                                )}
                                {current.is_mandatory && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-900/30 text-rose-300">mandatory</span>
                                )}
                            </div>
                            {current.title && <p className="text-sm font-semibold text-amber-100">{current.title}</p>}
                            {current.content && <p className="text-sm text-neutral-200 leading-relaxed">{current.content}</p>}
                            {current.audio_url && (
                                <div className="flex items-center gap-2 pt-1">
                                    <Volume2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                    <audio key={current.id} src={current.audio_url} autoPlay controls
                                        onEnded={handleAudioEnded} className="h-8 w-full rounded-full" style={{ colorScheme: "dark" }} />
                                </div>
                            )}

                            {/* Chain navigation (manual prev/next) */}
                            {isChain && (
                                <div className="flex items-center justify-between pt-1">
                                    <button onClick={goPrev} disabled={chainIndex === 0}
                                        className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                                    </button>
                                    {/* Dot indicators */}
                                    <div className="flex items-center gap-1">
                                        {narratives.map((_, i) => (
                                            <button key={i} onClick={() => setChainIndex(i)}
                                                className={`w-1.5 h-1.5 rounded-full transition-all ${
                                                    i === chainIndex ? "bg-amber-400 scale-125" : "bg-white/25 hover:bg-white/40"
                                                }`} />
                                        ))}
                                    </div>
                                    <button onClick={goNext} disabled={isLast}
                                        className="flex items-center gap-1 text-[11px] text-violet-300 hover:text-violet-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
                                        Next <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
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

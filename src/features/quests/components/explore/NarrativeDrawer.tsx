import { useState } from "react";
import { BookOpen, X, Volume2, MapPin } from "lucide-react";
import type { ExperienceNarrative } from "@/types";

interface NarrativeDrawerProps {
    narratives: ExperienceNarrative[];
}

export function NarrativeDrawer({ narratives }: NarrativeDrawerProps) {
    const [open, setOpen] = useState(false);
    if (narratives.length === 0) return null;
    const ordered = [...narratives].sort((a, b) => (a.sequence_order ?? 99) - (b.sequence_order ?? 99));

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-sm
                           rounded-xl px-3 py-2 text-xs text-amber-200 border border-amber-700/40 hover:bg-black/80"
            >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Story ({narratives.length})
            </button>

            {open && (
                <div className="absolute inset-y-0 left-0 z-30 w-80 max-w-[85%] bg-neutral-900/95 backdrop-blur-md
                                border-r border-amber-800/30 shadow-2xl flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                            <BookOpen className="w-4 h-4" /> Quest Narrative
                        </h3>
                        <button onClick={() => setOpen(false)} className="p-1 rounded-full bg-white/10 text-white hover:bg-white/20">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {ordered.map((n) => (
                            <div key={n.id} className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-amber-100">{n.title || "Untitled"}</p>
                                    {n.trigger_location
                                        ? <MapPin className="w-3.5 h-3.5 text-amber-400" />
                                        : <span className="text-[9px] text-neutral-500 uppercase">intro</span>}
                                </div>
                                {n.subtitle && <p className="text-xs text-neutral-400 italic">{n.subtitle}</p>}
                                {n.content && <p className="text-xs text-neutral-300 leading-relaxed">{n.content}</p>}
                                <div className="flex items-center gap-2 flex-wrap text-[10px] text-neutral-500 pt-1">
                                    {n.voice_persona && <span className="px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-300">{n.voice_persona}</span>}
                                    {n.is_mandatory && <span className="px-1.5 py-0.5 rounded-full bg-rose-900/30 text-rose-300">mandatory</span>}
                                    <span>audio: {n.audio_status ?? "none"}</span>
                                </div>
                                {n.audio_url && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                                        <audio controls src={n.audio_url} className="h-7 w-full" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

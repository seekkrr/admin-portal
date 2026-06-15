import { useEffect, useRef } from "react";
import { MapPin, Flag } from "lucide-react";
import type { ExperienceMarker } from "@/types";

interface ExploreLegendProps {
    markers: ExperienceMarker[];
    activeMarkerId: string | null;
    startMarkerId: string | null;
    onSelect: (marker: ExperienceMarker, index: number) => void;
}

export function ExploreLegend({ markers, activeMarkerId, startMarkerId, onSelect }: ExploreLegendProps) {
    const sorted = [...markers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const activeRef = useRef<HTMLButtonElement>(null);

    // Keep the active stop visible as the tour advances.
    useEffect(() => {
        activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [activeMarkerId]);

    return (
        <div className="absolute top-4 right-4 z-10 w-56 max-h-[60vh] overflow-y-auto
                        bg-black/75 backdrop-blur-md rounded-2xl border border-violet-900/40 shadow-2xl p-3 space-y-1">
            <h4 className="text-[10px] font-bold text-violet-400 uppercase tracking-widest px-1 mb-2">Quest Route</h4>
            {sorted.map((m, i) => (
                <button
                    key={m.marker_id}
                    ref={activeMarkerId === m.marker_id ? activeRef : undefined}
                    onClick={() => onSelect(m, i)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-colors ${
                        activeMarkerId === m.marker_id
                            ? "bg-violet-600/30 text-violet-100 border border-violet-500/40"
                            : "hover:bg-white/5 text-neutral-300 border border-transparent"
                    } ${!m.coordinates ? "opacity-40" : ""}`}
                >
                    <span className="w-5 h-5 rounded-full bg-violet-700 text-white text-[10px] font-bold
                                     flex items-center justify-center flex-shrink-0 border border-violet-400/30">
                        {m.order ?? i + 1}
                    </span>
                    <span className="truncate flex-1 text-xs">{m.name || "Marker"}</span>
                    {m.marker_id === startMarkerId && <Flag className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                    {m.is_required && <MapPin className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                </button>
            ))}
        </div>
    );
}

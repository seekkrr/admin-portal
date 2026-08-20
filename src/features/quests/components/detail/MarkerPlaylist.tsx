import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Map as MapIcon, Flag } from "lucide-react";
import type { MarkerSummary } from "@/types";

interface MarkerPlaylistProps {
    markers: MarkerSummary[];
    startMarkerId: string | null;
    onShowOnMap: (markerId: string) => void;
}

export function MarkerPlaylist({ markers, startMarkerId, onShowOnMap }: MarkerPlaylistProps) {
    const [expanded, setExpanded] = useState(false);
    if (markers.length === 0) {
        return <p className="text-sm text-neutral-400 italic">No markers in playlist</p>;
    }
    const sorted = [...markers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const shown = expanded ? sorted : sorted.slice(0, 6);

    return (
        <div className="space-y-2">
            {shown.map((m, i) => (
                <div key={m.marker_id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {m.order ?? i + 1}
                    </span>
                    {m.images?.[0]?.secure_url && (
                        <img src={m.images?.[0]?.secure_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-neutral-200" />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <Link to={`/markers/${m.marker_id}`} className="text-sm font-medium text-neutral-800 hover:text-violet-600 truncate">
                                {m.name ?? "Unnamed marker"}
                            </Link>
                            {m.marker_id === startMarkerId && <Flag className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            {(m.categories && m.categories.length > 0) && <span>{m.categories.join(", ")} · </span>}
                            {m.is_required ? "Required" : "Optional"}
                            {m.tags.length > 0 && ` · ${m.tags.slice(0, 3).join(", ")}`}
                        </p>
                    </div>
                    <button
                        onClick={() => onShowOnMap(m.marker_id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-violet-600 hover:bg-violet-50 transition-colors flex-shrink-0"
                        title="Show on Explore Map">
                        <MapIcon className="w-3.5 h-3.5" /> Map
                    </button>
                </div>
            ))}
            {sorted.length > 6 && (
                <button onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 transition-colors mt-1">
                    <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    {expanded ? "Show less" : `Show ${sorted.length - 6} more`}
                </button>
            )}
        </div>
    );
}

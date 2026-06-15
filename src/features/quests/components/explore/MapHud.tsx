import type { ReactNode } from "react";
import { Sunrise, Sun, Sunset, Moon, Play, Pause, SkipForward, SkipBack, MapPin, Route } from "lucide-react";
import type { TimeOfDay } from "./theme";

const TOD_ICON: Record<TimeOfDay, ReactNode> = {
    dawn: <Sunrise className="w-4 h-4" />,
    day: <Sun className="w-4 h-4" />,
    dusk: <Sunset className="w-4 h-4" />,
    night: <Moon className="w-4 h-4" />,
};

interface MapHudProps {
    title: string;
    markerCount: number;
    distanceKm: number | null;
    timeOfDay: TimeOfDay;
    onCycleTime: () => void;
    isPlaying: boolean;
    canTour: boolean;
    onPlay: () => void;
    onStop: () => void;
    onNext: () => void;
    onPrev: () => void;
}

export function MapHud({
    title, markerCount, distanceKm, timeOfDay, onCycleTime,
    isPlaying, canTour, onPlay, onStop, onNext, onPrev,
}: MapHudProps) {
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2
                        bg-black/75 backdrop-blur-md rounded-2xl border border-violet-900/40 shadow-2xl px-3 py-2">
            <div className="hidden sm:flex flex-col pr-3 border-r border-white/10">
                <span className="text-xs font-semibold text-violet-100 truncate max-w-[180px]">{title}</span>
                <span className="text-[10px] text-neutral-400 flex items-center gap-2">
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{markerCount}</span>
                    {distanceKm !== null && <span className="flex items-center gap-0.5"><Route className="w-3 h-3" />{distanceKm.toFixed(1)} km</span>}
                </span>
            </div>

            <button onClick={onCycleTime}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 text-violet-200 hover:bg-white/10 text-xs capitalize"
                title="Cycle time of day">
                {TOD_ICON[timeOfDay]} {timeOfDay}
            </button>

            <div className="flex items-center gap-1 pl-1">
                <button onClick={onPrev} disabled={!canTour}
                    className="p-1.5 rounded-lg bg-white/5 text-violet-200 hover:bg-white/10 disabled:opacity-30">
                    <SkipBack className="w-4 h-4" />
                </button>
                <button onClick={isPlaying ? onStop : onPlay} disabled={!canTour}
                    className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-30"
                    title={isPlaying ? "Pause tour" : "Play Quest"}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={onNext} disabled={!canTour}
                    className="p-1.5 rounded-lg bg-white/5 text-violet-200 hover:bg-white/10 disabled:opacity-30">
                    <SkipForward className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

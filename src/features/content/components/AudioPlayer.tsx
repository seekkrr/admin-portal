import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { Play, Pause, VolumeX, AlertTriangle } from "lucide-react";

interface AudioPlayerProps {
    src: string | null;
    durationS?: number | null;
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, durationS }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(durationS ?? 0);
    const [errored, setErrored] = useState(false);

    useEffect(() => {
        // Reset state whenever the source changes.
        setIsPlaying(false);
        setCurrent(0);
        setDuration(durationS ?? 0);
        setErrored(false);
    }, [src, durationS]);

    if (!src) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                <VolumeX className="h-5 w-5 text-neutral-400" />
                No audio generated
            </div>
        );
    }

    if (errored) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Audio unavailable
            </div>
        );
    }

    const togglePlay = () => {
        const el = audioRef.current;
        if (!el) return;
        if (isPlaying) {
            el.pause();
        } else {
            void el.play().catch(() => setErrored(true));
        }
    };

    const onSeek = (e: ChangeEvent<HTMLInputElement>) => {
        const el = audioRef.current;
        if (!el) return;
        const next = Number(e.target.value);
        el.currentTime = next;
        setCurrent(next);
    };

    const progressMax = duration > 0 ? duration : 0;

    return (
        <div className="flex items-center gap-4 rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3">
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDuration(d);
                }}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrent(0);
                }}
                onError={() => setErrored(true)}
            />
            <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-600 text-white transition-colors hover:bg-orange-700"
            >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <div className="flex flex-1 items-center gap-3">
                <input
                    type="range"
                    min={0}
                    max={progressMax || 1}
                    step={0.1}
                    value={current}
                    onChange={onSeek}
                    aria-label="Seek"
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-orange-200 accent-orange-600"
                />
                <span className="w-24 flex-shrink-0 text-right font-mono text-xs text-neutral-500">
                    {formatTime(current)} / {formatTime(duration)}
                </span>
            </div>
        </div>
    );
}

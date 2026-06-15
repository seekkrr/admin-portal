import { useCallback, useEffect, useRef, useState } from "react";
import type { ExperienceMarker } from "@/types";

export interface GuidedTour {
    isPlaying: boolean;
    activeIndex: number;        // -1 = not started
    start: () => void;
    stop: () => void;
    next: () => void;
    prev: () => void;
    goTo: (index: number) => void;
}

/**
 * Drives a marker-by-marker cinematic tour. On each step it calls `onFocus`
 * with the marker (the map flies + opens its card). When playing, it advances
 * automatically every `dwellMs`.
 */
export function useGuidedTour(
    markers: ExperienceMarker[],
    onFocus: (marker: ExperienceMarker, index: number) => void,
    dwellMs = 5200
): GuidedTour {
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const playable = markers.filter((m) => m.coordinates);

    const focusIndex = useCallback((index: number) => {
        const m = playable[index];
        if (!m) return;
        setActiveIndex(index);
        onFocus(m, index);
    }, [playable, onFocus]);

    const stop = useCallback(() => {
        setIsPlaying(false);
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    }, []);

    const start = useCallback(() => {
        if (playable.length === 0) return;
        setIsPlaying(true);
        focusIndex(0);
    }, [playable.length, focusIndex]);

    const next = useCallback(() => {
        setActiveIndex((i) => {
            const ni = Math.min(i + 1, playable.length - 1);
            focusIndex(ni);
            return ni;
        });
    }, [playable.length, focusIndex]);

    const prev = useCallback(() => {
        setActiveIndex((i) => {
            const pi = Math.max(i - 1, 0);
            focusIndex(pi);
            return pi;
        });
    }, [focusIndex]);

    const goTo = useCallback((index: number) => {
        stop();
        focusIndex(index);
    }, [stop, focusIndex]);

    // Auto-advance while playing
    useEffect(() => {
        if (!isPlaying) return;
        if (activeIndex >= playable.length - 1) { setIsPlaying(false); return; }
        timer.current = setTimeout(() => focusIndex(activeIndex + 1), dwellMs);
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, [isPlaying, activeIndex, playable.length, dwellMs, focusIndex]);

    return { isPlaying, activeIndex, start, stop, next, prev, goTo };
}

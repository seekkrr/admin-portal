import { useCallback, useMemo, useRef, useState } from "react";
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
 * Drives a marker-by-marker cinematic tour. On each step it calls `onFocus`.
 * Advancement is driven externally by the consumer (e.g. when the narration
 * audio ends) — there is intentionally no internal dwell timer.
 */
export function useGuidedTour(
    markers: ExperienceMarker[],
    onFocus: (marker: ExperienceMarker, index: number) => void,
): GuidedTour {
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    // Stable across renders so consumers can safely depend on the callbacks.
    const playable = useMemo(() => markers.filter((m) => m.coordinates), [markers]);
    const playableRef = useRef(playable);
    playableRef.current = playable;
    const onFocusRef = useRef(onFocus);
    onFocusRef.current = onFocus;

    const focusIndex = useCallback((index: number) => {
        const m = playableRef.current[index];
        if (!m) return;
        setActiveIndex(index);
        onFocusRef.current(m, index);
    }, []);

    const stop = useCallback(() => setIsPlaying(false), []);

    const start = useCallback(() => {
        if (playableRef.current.length === 0) return;
        setIsPlaying(true);
        focusIndex(0);
    }, [focusIndex]);

    const next = useCallback(() => {
        setActiveIndex((i) => {
            if (i >= playableRef.current.length - 1) { setIsPlaying(false); return i; }
            const ni = i + 1;
            focusIndex(ni);
            return ni;
        });
    }, [focusIndex]);

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

    return { isPlaying, activeIndex, start, stop, next, prev, goTo };
}

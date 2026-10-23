import { useEffect, useState, useRef } from "react";
import { Play, Square, Mic, AlertTriangle } from "lucide-react";
import type { VoicePersona } from "@/types";
import { PERSONAS, speechSupported, type PersonaConfig } from "./voicePersonas";

interface VoicePersonaSamplesProps {
    selected?: VoicePersona;
    onSelect?: (persona: VoicePersona) => void;
    customVoiceId?: string;
    onCustomVoiceIdChange?: (value: string) => void;
}

export function VoicePersonaSamples({
    selected,
    onSelect,
    customVoiceId,
    onCustomVoiceIdChange,
}: VoicePersonaSamplesProps) {
    const [speakingId, setSpeakingId] = useState<VoicePersona | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false;
            if (speechSupported) window.speechSynthesis.cancel();
        };
    }, []);

    const stop = () => {
        if (speechSupported) window.speechSynthesis.cancel();
        setSpeakingId(null);
    };

    const preview = (persona: PersonaConfig) => {
        if (!speechSupported) return;
        if (speakingId === persona.id) {
            stop();
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(persona.sampleLine);
        utterance.rate = persona.rate;
        utterance.pitch = persona.pitch;
        utterance.onend = () => { if (isMounted.current) setSpeakingId(null); };
        utterance.onerror = () => { if (isMounted.current) setSpeakingId(null); };
        setSpeakingId(persona.id);
        window.speechSynthesis.speak(utterance);
    };

    return (
        <div className="space-y-3">
            {!speechSupported && (
                <div className="flex items-center gap-3 rounded-control border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
                    <AlertTriangle className="h-5 w-5 text-warn" />
                    Voice preview is not supported in this browser.
                </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PERSONAS.map((persona) => {
                    const isSelected = selected === persona.id;
                    const isSpeaking = speakingId === persona.id;
                    return (
                        <div
                            key={persona.id}
                            className={`flex items-center justify-between gap-3 rounded-control border px-4 py-3 transition-colors ${
                                isSelected
                                    ? "border-accent-300 bg-accent-50"
                                    : "border-line bg-surface hover:border-accent-200"
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => onSelect?.(persona.id)}
                                disabled={!onSelect}
                                className="flex flex-1 items-center gap-3 text-left disabled:cursor-default"
                            >
                                <span
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                        isSelected ? "bg-brand-900 text-white" : "bg-brand-50 text-brand-700"
                                    }`}
                                >
                                    <Mic className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-ink">
                                        {persona.label}
                                    </span>
                                    <span className="block truncate text-xs text-ink-muted">
                                        {persona.description}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => preview(persona)}
                                aria-label={isSpeaking ? `Stop ${persona.label} preview` : `Preview ${persona.label}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-accent-700 transition-colors hover:bg-accent-50"
                            >
                                {isSpeaking ? <Square className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-4 w-4" />}
                            </button>
                        </div>
                    );
                })}
                {/* Custom card — no speech preview */}
                <button
                    type="button"
                    onClick={() => onSelect?.("custom")}
                    disabled={!onSelect}
                    className={`flex items-center gap-3 rounded-control border px-4 py-3 text-left transition-colors ${
                        selected === "custom"
                            ? "border-accent-300 bg-accent-50"
                            : "border-line bg-surface hover:border-accent-200"
                    } disabled:cursor-default`}
                >
                    <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            selected === "custom" ? "bg-brand-900 text-white" : "bg-brand-50 text-brand-700"
                        }`}
                    >
                        <Mic className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">Custom</span>
                        <span className="block truncate text-xs text-ink-muted">Your ElevenLabs voice ID</span>
                    </span>
                </button>
            </div>
            {selected === "custom" && (
                <div>
                    <input
                        type="text"
                        value={customVoiceId ?? ""}
                        onChange={(e) => onCustomVoiceIdChange?.(e.target.value)}
                        placeholder="e.g. pNInz6obpgDQGcFmaJgB"
                        aria-label="ElevenLabs voice ID"
                        className="h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    <p className="mt-1 text-xs text-ink-muted">20-character voice ID from your ElevenLabs voice library.</p>
                </div>
            )}
        </div>
    );
}

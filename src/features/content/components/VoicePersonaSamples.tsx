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
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
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
                            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                                isSelected
                                    ? "border-orange-400 bg-orange-50"
                                    : "border-neutral-200 bg-white hover:border-orange-200"
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => onSelect?.(persona.id)}
                                disabled={!onSelect}
                                className="flex flex-1 items-center gap-3 text-left disabled:cursor-default"
                            >
                                <span
                                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                                        isSelected ? "bg-orange-600 text-white" : "bg-neutral-100 text-neutral-500"
                                    }`}
                                >
                                    <Mic className="h-4 w-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-neutral-900">
                                        {persona.label}
                                    </span>
                                    <span className="block truncate text-xs text-neutral-500">
                                        {persona.description}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => preview(persona)}
                                aria-label={isSpeaking ? `Stop ${persona.label} preview` : `Preview ${persona.label}`}
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-orange-200 text-orange-600 transition-colors hover:bg-orange-100"
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
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        selected === "custom"
                            ? "border-orange-400 bg-orange-50"
                            : "border-neutral-200 bg-white hover:border-orange-200"
                    } disabled:cursor-default`}
                >
                    <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                            selected === "custom" ? "bg-orange-600 text-white" : "bg-neutral-100 text-neutral-500"
                        }`}
                    >
                        <Mic className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-neutral-900">Custom</span>
                        <span className="block truncate text-xs text-neutral-500">Your ElevenLabs voice ID</span>
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
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-neutral-500">20-character voice ID from your ElevenLabs voice library.</p>
                </div>
            )}
        </div>
    );
}

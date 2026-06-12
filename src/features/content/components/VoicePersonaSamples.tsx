import { useEffect, useState } from "react";
import { Play, Square, Mic, AlertTriangle } from "lucide-react";
import type { VoicePersona } from "@/types";
import { PERSONAS, speechSupported, type PersonaConfig } from "./voicePersonas";

interface VoicePersonaSamplesProps {
    selected?: VoicePersona;
    onSelect?: (persona: VoicePersona) => void;
}

export function VoicePersonaSamples({ selected, onSelect }: VoicePersonaSamplesProps) {
    const [speakingId, setSpeakingId] = useState<VoicePersona | null>(null);

    useEffect(() => {
        return () => {
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
        utterance.onend = () => setSpeakingId(null);
        utterance.onerror = () => setSpeakingId(null);
        setSpeakingId(persona.id);
        window.speechSynthesis.speak(utterance);
    };

    if (!speechSupported) {
        return (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Voice preview is not supported in this browser.
            </div>
        );
    }

    return (
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
        </div>
    );
}

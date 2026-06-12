import type { VoicePersona } from "@/types";

export interface PersonaConfig {
    id: VoicePersona;
    label: string;
    description: string;
    sampleLine: string;
    rate: number;
    pitch: number;
}

export const PERSONAS: PersonaConfig[] = [
    {
        id: "historian_warm",
        label: "Historian (Warm)",
        description: "Measured, scholarly, inviting",
        sampleLine:
            "Long ago, these stones witnessed the rise and fall of an empire. Let me tell you their story.",
        rate: 0.95,
        pitch: 1.0,
    },
    {
        id: "mystery_whisper",
        label: "Mystery (Whisper)",
        description: "Hushed, suspenseful, low",
        sampleLine: "Listen closely... not everything here is as it seems. A secret waits just ahead.",
        rate: 0.8,
        pitch: 0.7,
    },
    {
        id: "energetic_guide",
        label: "Energetic Guide",
        description: "Bright, upbeat, fast",
        sampleLine: "Alright, adventurers! Get ready, because what comes next is absolutely incredible!",
        rate: 1.15,
        pitch: 1.2,
    },
    {
        id: "elder_storyteller",
        label: "Elder Storyteller",
        description: "Slow, wise, grounded",
        sampleLine: "Sit with me a moment, child, and I shall share the wisdom these old paths have taught.",
        rate: 0.85,
        pitch: 0.85,
    },
];

export const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

export function playVoicePreview(id: VoicePersona) {
    if (!speechSupported) return;
    const persona = PERSONAS.find((p) => p.id === id);
    if (!persona) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(persona.sampleLine);
    utterance.rate = persona.rate;
    utterance.pitch = persona.pitch;
    window.speechSynthesis.speak(utterance);
}

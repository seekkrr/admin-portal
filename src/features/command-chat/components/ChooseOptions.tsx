import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { ChooseOption, ChooseResult } from "@/services/commands.types";
import { focusRing, Thumb } from "./chatUi";

/** "Which one did you mean?" — tappable options; picking re-sends the command with that record. */
export function ChooseOptions({
    result,
    pickedId,
    superseded,
    busy,
    autoFocus,
    onChoose,
}: {
    result: ChooseResult;
    pickedId?: string;
    superseded?: boolean;
    busy: boolean;
    autoFocus: boolean;
    onChoose: (option: ChooseOption) => void;
}) {
    const firstRef = useRef<HTMLButtonElement>(null);
    const locked = Boolean(pickedId) || Boolean(superseded);

    useEffect(() => {
        if (autoFocus && !locked) firstRef.current?.focus({ preventScroll: true });
    }, [autoFocus, locked]);

    return (
        <div>
            <p className="text-sm text-neutral-800">{result.prompt}</p>
            {result.options.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">Nothing matched.</p>
            ) : (
                <div role="group" aria-label={result.prompt} className="mt-3 grid gap-2 sm:grid-cols-2">
                    {result.options.map((o, i) => {
                        const picked = pickedId === o.id;
                        return (
                            <button
                                key={o.id}
                                ref={i === 0 ? firstRef : undefined}
                                type="button"
                                onClick={() => onChoose(o)}
                                disabled={locked || busy}
                                aria-pressed={picked}
                                className={`flex items-center gap-3 p-2 pr-3 rounded-xl border text-left transition-colors min-w-0 ${focusRing} ${
                                    picked
                                        ? "border-[#00A49E] bg-[#00A49E]/10"
                                        : locked
                                          ? "border-neutral-200 bg-white opacity-50"
                                          : "border-neutral-200 bg-white hover:border-[#00A49E] hover:bg-[#00A49E]/5 disabled:opacity-60"
                                }`}
                            >
                                <Thumb src={o.image_url} />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-neutral-900 truncate">{o.label}</span>
                                    {o.sublabel && <span className="block text-xs text-neutral-500 truncate">{o.sublabel}</span>}
                                </span>
                                {picked && <Check className="w-4 h-4 text-[#00716d] shrink-0" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            )}
            {superseded && !pickedId && <p className="mt-2 text-xs text-neutral-400">Skipped</p>}
        </div>
    );
}

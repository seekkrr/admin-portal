import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";

/**
 * A list of short words (tags, keywords, hobbies): type and press Enter or a
 * comma to add; tap × to remove.
 */
export function ChipsInput({
    id,
    value,
    onChange,
    placeholder = "Type and press Enter",
    max,
    maxLength = 40,
    disabled,
    lowercase,
}: {
    id?: string;
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    max?: number;
    maxLength?: number;
    disabled?: boolean;
    lowercase?: boolean;
}) {
    const [text, setText] = useState("");
    const full = max !== undefined && value.length >= max;

    const add = (raw: string) => {
        const words = raw
            .split(",")
            .map((w) => (lowercase ? w.trim().toLowerCase() : w.trim()))
            .filter(Boolean)
            .map((w) => w.slice(0, maxLength));
        if (!words.length) return;
        const next = [...value];
        for (const w of words) {
            if (max !== undefined && next.length >= max) break;
            if (!next.some((v) => v.toLowerCase() === w.toLowerCase())) next.push(w);
        }
        onChange(next);
        setText("");
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
        } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Added">
                    {value.map((v) => (
                        <li key={v}>
                            <Tag tone="brand" className="py-1 text-xs">
                                {v}
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => onChange(value.filter((x) => x !== v))}
                                        className="-mr-1 rounded p-0.5 hover:bg-accent-100"
                                        aria-label={`Remove ${v}`}
                                    >
                                        <X className="h-3 w-3" aria-hidden />
                                    </button>
                                )}
                            </Tag>
                        </li>
                    ))}
                </ul>
            )}
            {!disabled && (
                <TextInput
                    id={id}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={() => text.trim() && add(text)}
                    placeholder={full ? `Up to ${max}` : placeholder}
                    disabled={full}
                    maxLength={maxLength * 3}
                />
            )}
        </div>
    );
}

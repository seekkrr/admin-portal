import { type ReactNode, useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export interface DropdownOption {
    value: string;
    label: string;
    dot?: string;
}

interface FilterDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (v: string) => void;
    icon?: ReactNode;
    placeholder: string;
}

/**
 * Custom dropdown filter component with optional icon and dot indicators.
 * Closes on outside click.
 */
export function FilterDropdown({ options, value, onChange, icon, placeholder }: FilterDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selected = options.find((o) => o.value === value);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all
                    ${value ? "border-indigo-300 bg-indigo-50/50 text-indigo-700" : "border-neutral-200 bg-neutral-50 text-neutral-600"}
                    hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
                {icon}
                <span>{selected?.label || placeholder}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute top-full mt-1 left-0 z-30 min-w-[180px] bg-white rounded-xl border border-neutral-200 shadow-lg py-1 animate-fade-in">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3.5 py-2 text-sm flex items-center gap-2 transition-colors
                                ${value === opt.value ? "bg-indigo-50 text-indigo-700 font-medium" : "text-neutral-700 hover:bg-neutral-50"}`}
                        >
                            {opt.dot && <span className={`w-2 h-2 rounded-full ${opt.dot}`} />}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

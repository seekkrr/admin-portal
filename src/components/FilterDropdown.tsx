import { type ReactNode, useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
    value: string;
    label: string;
    dot?: string;
}

export type ThemeColor = "indigo" | "orange" | "cyan" | "amber" | "emerald" | "blue" | "rose" | "teal" | "neutral";

interface FilterDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (v: string) => void;
    icon?: ReactNode;
    placeholder: string;
    theme?: ThemeColor;
}

const themeClasses: Record<ThemeColor, { border: string; bg: string; text: string; ring: string; hoverBorder: string; hoverBg: string }> = {
    indigo: { border: "border-indigo-300", bg: "bg-indigo-50/50", text: "text-indigo-700", ring: "focus:ring-indigo-500", hoverBorder: "hover:border-indigo-300", hoverBg: "hover:bg-indigo-50" },
    orange: { border: "border-orange-300", bg: "bg-orange-50/50", text: "text-orange-700", ring: "focus:ring-orange-500", hoverBorder: "hover:border-orange-300", hoverBg: "hover:bg-orange-50" },
    cyan: { border: "border-cyan-300", bg: "bg-cyan-50/50", text: "text-cyan-700", ring: "focus:ring-cyan-500", hoverBorder: "hover:border-cyan-300", hoverBg: "hover:bg-cyan-50" },
    amber: { border: "border-amber-300", bg: "bg-amber-50/50", text: "text-amber-700", ring: "focus:ring-amber-500", hoverBorder: "hover:border-amber-300", hoverBg: "hover:bg-amber-50" },
    emerald: { border: "border-emerald-300", bg: "bg-emerald-50/50", text: "text-emerald-700", ring: "focus:ring-emerald-500", hoverBorder: "hover:border-emerald-300", hoverBg: "hover:bg-emerald-50" },
    blue: { border: "border-blue-300", bg: "bg-blue-50/50", text: "text-blue-700", ring: "focus:ring-blue-500", hoverBorder: "hover:border-blue-300", hoverBg: "hover:bg-blue-50" },
    rose: { border: "border-rose-300", bg: "bg-rose-50/50", text: "text-rose-700", ring: "focus:ring-rose-500", hoverBorder: "hover:border-rose-300", hoverBg: "hover:bg-rose-50" },
    teal: { border: "border-teal-300", bg: "bg-teal-50/50", text: "text-teal-700", ring: "focus:ring-teal-500", hoverBorder: "hover:border-teal-300", hoverBg: "hover:bg-teal-50" },
    neutral: { border: "border-neutral-300", bg: "bg-neutral-50/50", text: "text-neutral-700", ring: "focus:ring-neutral-500", hoverBorder: "hover:border-neutral-300", hoverBg: "hover:bg-neutral-50" },
};

/**
 * Custom dropdown filter component with optional icon and dot indicators.
 * Closes on outside click.
 */
export function FilterDropdown({ options, value, onChange, icon, placeholder, theme = "indigo" }: FilterDropdownProps) {
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
    const t = themeClasses[theme];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.98]
                    ${value ? `${t.border} ${t.bg} ${t.text} shadow-sm` : "border-neutral-200 bg-neutral-50 text-neutral-600"}
                    ${t.hoverBorder} focus:outline-none focus-visible:ring-2 ${t.ring}`}
            >
                {icon}
                <span>{selected?.label || placeholder}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute top-full mt-1.5 left-0 z-30 min-w-[190px] bg-white rounded-xl border border-neutral-200/80 shadow-xl ring-1 ring-neutral-900/5 p-1 origin-top-left animate-scale-in" role="listbox">
                    {options.map((opt) => {
                        const isSel = value === opt.value;
                        return (
                            <button
                                key={opt.value}
                                role="option"
                                aria-selected={isSel}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors
                                    ${isSel ? `${t.bg.replace('/50', '')} ${t.text} font-semibold` : `text-neutral-700 ${t.hoverBg}`}`}
                            >
                                {opt.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />}
                                <span className="flex-1 truncate">{opt.label}</span>
                                {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

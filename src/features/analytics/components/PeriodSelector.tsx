import type { AnalyticsPeriod } from "@/types";

interface PeriodSelectorProps {
    value: AnalyticsPeriod;
    onChange: (period: AnalyticsPeriod) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
    const periods: AnalyticsPeriod[] = ["7d", "30d", "60d", "90d"];

    return (
        <div className="flex gap-1 bg-neutral-100/80 p-1 rounded-xl ring-1 ring-neutral-200/50 backdrop-blur-sm shadow-inner w-fit">
            {periods.map(p => (
                <button
                    key={p}
                    onClick={() => onChange(p)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                        value === p 
                            ? "bg-white text-indigo-600 shadow-sm ring-1 ring-neutral-200/50" 
                            : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50"
                    }`}
                >
                    {p}
                </button>
            ))}
        </div>
    );
}

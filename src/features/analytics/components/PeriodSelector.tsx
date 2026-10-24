import type { AnalyticsPeriod } from "@/types";
import { Tabs } from "@/components/ui/Tabs";

interface PeriodSelectorProps {
    value: AnalyticsPeriod;
    onChange: (period: AnalyticsPeriod) => void;
}

const PERIODS: AnalyticsPeriod[] = ["7d", "30d", "60d", "90d"];

/** 7d / 30d / 60d / 90d segmented control. */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
    return <Tabs label="Period" variant="pill" value={value} onChange={onChange} tabs={PERIODS.map((p) => ({ value: p, label: p }))} />;
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { ErrorState, LoadingState } from "@/components/ui/States";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface CrowdMeterSectionProps {
    regionId: string;
    canApprove: boolean;
}

export function CrowdMeterSection({ regionId, canApprove }: CrowdMeterSectionProps) {
    const queryClient = useQueryClient();
    const [crowdMonth, setCrowdMonth] = useState("Jan");
    const [crowdValue, setCrowdValue] = useState("");

    const crowdQuery = useQuery<Record<string, number>>({
        queryKey: ["region-crowd-meter", regionId],
        queryFn: () => regionsService.getCrowdMeter(regionId),
        enabled: !!regionId,
    });

    const crowdMutation = useMutation({
        mutationFn: ({ month, value }: { month: string; value: number }) => regionsService.updateCrowdMeter(regionId, month, value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-crowd-meter", regionId] });
            toast.success("Crowd meter updated");
            setCrowdValue("");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update crowd meter"),
    });

    const crowd = crowdQuery.data ?? {};
    const maxCrowd = Math.max(100, ...Object.values(crowd));

    const submit = () => {
        const v = Number(crowdValue);
        if (!Number.isFinite(v) || v < 0) {
            toast.error("Value must be 0 or greater");
            return;
        }
        crowdMutation.mutate({ month: crowdMonth, value: Math.round(v) });
    };

    return (
        <Panel title="Crowd meter" icon={Users} description="Expected visitors per month">
            {crowdQuery.isLoading ? (
                <LoadingState label="Loading crowd meter…" className="min-h-[160px]" />
            ) : crowdQuery.error ? (
                <ErrorState error={crowdQuery.error} onRetry={() => crowdQuery.refetch()} compact />
            ) : (
                <div className="flex h-40 items-end gap-1 sm:gap-2" role="img" aria-label="Visitors by month">
                    {MONTHS.map((m) => {
                        const v = crowd[m] ?? 0;
                        const pct = maxCrowd > 0 ? (v / maxCrowd) * 100 : 0;
                        return (
                            <div key={m} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                                <div className="mb-1 text-[10px] tabular-nums text-ink-muted">{v}</div>
                                <div className="w-full rounded-t bg-accent-500 transition-all duration-300" style={{ height: `${pct}%`, minHeight: v > 0 ? "2px" : "0" }} />
                                <div className="mt-1 text-[10px] text-ink-muted">{m}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {canApprove && (
                <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">
                    <Field label="Month" className="w-32">
                        <SelectInput value={crowdMonth} onChange={(e) => setCrowdMonth(e.target.value)} options={MONTHS.map((m) => ({ value: m, label: m }))} />
                    </Field>
                    <Field label="Visitors" className="w-32">
                        <TextInput type="number" min={0} value={crowdValue} onChange={(e) => setCrowdValue(e.target.value)} />
                    </Field>
                    <Button variant="primary" onClick={submit} loading={crowdMutation.isPending} disabled={crowdValue === ""}>
                        Update
                    </Button>
                </div>
            )}
        </Panel>
    );
}

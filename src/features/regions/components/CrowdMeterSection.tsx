import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

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
        mutationFn: ({ month, value }: { month: string; value: number }) =>
            regionsService.updateCrowdMeter(regionId, month, value),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-crowd-meter", regionId] });
            toast.success("Crowd meter updated");
            setCrowdValue("");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update crowd meter"),
    });

    const crowd = crowdQuery.data ?? {};
    const maxCrowd = Math.max(100, ...Object.values(crowd));

    return (
        <Card padding="md">
            <CardHeader className="border-b border-neutral-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-600" />
                    <CardTitle>Crowd Meter</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {crowdQuery.isLoading ? (
                        <p className="text-sm text-neutral-500">Loading crowd meter...</p>
                    ) : (
                        <div className="flex items-end gap-2 h-40">
                            {MONTHS.map((m) => {
                                const v = crowd[m] ?? 0;
                                const pct = maxCrowd > 0 ? (v / maxCrowd) * 100 : 0;
                                return (
                                    <div key={m} className="flex-1 flex flex-col items-center justify-end h-full">
                                        <div className="text-[10px] text-neutral-500 mb-1">{v}</div>
                                        <div
                                            className="w-full bg-cyan-500 rounded-t transition-all duration-300"
                                            style={{ height: `${pct}%`, minHeight: v > 0 ? "2px" : "0" }}
                                        />
                                        <div className="text-[10px] text-neutral-500 mt-1">{m}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {canApprove && (
                        <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Month</label>
                                <select
                                    value={crowdMonth}
                                    onChange={(e) => setCrowdMonth(e.target.value)}
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all min-w-[120px]"
                                >
                                    {MONTHS.map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Value (0–100)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={crowdValue}
                                    onChange={(e) => setCrowdValue(e.target.value)}
                                    className="w-32 rounded-xl py-2.5 px-4 border border-neutral-200 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const v = Number(crowdValue);
                                    if (!Number.isFinite(v) || v < 0 || v > 100) {
                                        toast.error("Value must be between 0 and 100");
                                        return;
                                    }
                                    crowdMutation.mutate({ month: crowdMonth, value: Math.round(v) });
                                }}
                                disabled={crowdMutation.isPending || crowdValue === ""}
                                className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                            >
                                Update
                            </button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

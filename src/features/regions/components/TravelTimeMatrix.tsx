import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Route as RouteIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

interface TravelTimeMatrixProps {
    regionId: string;
    canApprove: boolean;
}

function formatDuration(seconds: number | undefined | null): string {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${s}s`;
}

function formatDistance(metres: number | undefined | null): string {
    if (metres === null || metres === undefined || !Number.isFinite(metres)) return "—";
    if (metres >= 1000) return `${(metres / 1000).toFixed(2)} km`;
    return `${Math.round(metres)} m`;
}

export function TravelTimeMatrix({ regionId, canApprove }: TravelTimeMatrixProps) {
    const [matrixPolling, setMatrixPolling] = useState(false);

    const matrixQuery = useQuery({
        queryKey: ["region-matrix", regionId],
        queryFn: () => regionsService.getMatrix(regionId),
        enabled: !!regionId,
        refetchInterval: matrixPolling ? 5000 : false,
    });

    const refreshMatrixMutation = useMutation({
        mutationFn: () => regionsService.refreshMatrix(regionId),
        onSuccess: () => {
            toast.success("Matrix refresh queued");
            setMatrixPolling(true);
            window.setTimeout(() => setMatrixPolling(false), 30000);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to queue matrix refresh"),
    });

    // Normalise pair fields — the API returns from_marker_id / to_marker_id /
    // walk_duration_s / drive_duration_s / walk_distance_m. The type stub uses
    // generic `origin` / `destination` / `duration_s`; handle both shapes.
    const pairs = matrixQuery.data?.pairs ?? [];

    return (
        <Card padding="md">
            <CardHeader className="border-b border-neutral-100 pb-4 mb-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <RouteIcon className="w-5 h-5 text-cyan-600" />
                    <CardTitle>Travel-Time Matrix</CardTitle>
                </div>
                {canApprove && (
                    <button
                        onClick={() => refreshMatrixMutation.mutate()}
                        disabled={refreshMatrixMutation.isPending}
                        className="py-2 px-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-cyan-700 bg-cyan-50 hover:bg-cyan-100 text-sm disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${matrixPolling ? "animate-spin" : ""}`} />
                        Refresh Matrix
                    </button>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {matrixQuery.isLoading ? (
                        <p className="text-sm text-neutral-500">Loading matrix...</p>
                    ) : (
                        <>
                            <p className="text-sm text-neutral-600">
                                <span className="font-semibold text-neutral-900">{matrixQuery.data?.count ?? pairs.length}</span> travel-time
                                pairs computed for this region.
                                {matrixPolling && <span className="ml-2 text-cyan-600">Refreshing…</span>}
                            </p>
                            {pairs.length === 0 ? (
                                <p className="text-sm text-neutral-400">No travel-time pairs available yet. Use "Refresh Matrix" to compute them.</p>
                            ) : (
                                <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-neutral-200">
                                    <table className="min-w-full divide-y divide-neutral-200 text-sm">
                                        <thead className="bg-neutral-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                                    From
                                                </th>
                                                <th className="px-4 py-3 text-left font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                                    To
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                                    Walk
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                                    Drive
                                                </th>
                                                <th className="px-4 py-3 text-right font-semibold text-neutral-500 uppercase tracking-wider text-xs">
                                                    Distance
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-neutral-100">
                                            {pairs.map((pair, idx) => {
                                                // Support both API shapes:
                                                //   new: from_marker_id / to_marker_id / walk_duration_s / drive_duration_s / walk_distance_m
                                                //   old stub: origin / destination / duration_s
                                                const p = pair as Record<string, unknown>;
                                                const from = (p.from_marker_id ?? p.origin ?? "—") as string;
                                                const to = (p.to_marker_id ?? p.destination ?? "—") as string;
                                                const walkS = (p.walk_duration_s ?? p.duration_s ?? null) as number | null;
                                                const driveS = (p.drive_duration_s ?? null) as number | null;
                                                const distM = (p.walk_distance_m ?? p.distance_m ?? p.distance ?? null) as number | null;
                                                return (
                                                    <tr
                                                        key={`${from}-${to}-${idx}`}
                                                        className="hover:bg-neutral-50 transition-colors"
                                                    >
                                                        <td className="px-4 py-3 text-neutral-700 font-mono text-xs truncate max-w-[160px]" title={from}>
                                                            {from}
                                                        </td>
                                                        <td className="px-4 py-3 text-neutral-700 font-mono text-xs truncate max-w-[160px]" title={to}>
                                                            {to}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-neutral-700 whitespace-nowrap">
                                                            {formatDuration(walkS)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-neutral-700 whitespace-nowrap">
                                                            {formatDuration(driveS)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-neutral-500 whitespace-nowrap text-xs">
                                                            {formatDistance(distM)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

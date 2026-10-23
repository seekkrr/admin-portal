import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Route as RouteIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { IdLink } from "@/components/ui/IdLink";

interface TravelTimeMatrixProps {
    regionId: string;
    canApprove: boolean;
}

const PER_PAGE = 25;

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

interface Pair {
    key: string;
    from: string | null;
    to: string | null;
    walkS: number | null;
    driveS: number | null;
    distM: number | null;
}

export function TravelTimeMatrix({ regionId, canApprove }: TravelTimeMatrixProps) {
    const [matrixPolling, setMatrixPolling] = useState(false);
    const [page, setPage] = useState(1);

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

    // The API returns from_marker_id / to_marker_id / walk_duration_s / drive_duration_s /
    // walk_distance_m; older responses used origin / destination / duration_s. Handle both.
    const pairs: Pair[] = (matrixQuery.data?.pairs ?? []).map((pair, idx) => {
        const p = pair as Record<string, unknown>;
        const from = (p.from_marker_id ?? p.origin ?? null) as string | null;
        const to = (p.to_marker_id ?? p.destination ?? null) as string | null;
        return {
            key: `${from}-${to}-${idx}`,
            from,
            to,
            walkS: (p.walk_duration_s ?? p.duration_s ?? null) as number | null,
            driveS: (p.drive_duration_s ?? null) as number | null,
            distM: (p.walk_distance_m ?? p.distance_m ?? p.distance ?? null) as number | null,
        };
    });
    const totalPages = Math.max(1, Math.ceil(pairs.length / PER_PAGE));
    const current = Math.min(page, totalPages);
    const rows = pairs.slice((current - 1) * PER_PAGE, current * PER_PAGE);

    const columns: DataColumn<Pair>[] = [
        { id: "from", header: "From", csv: (p) => p.from, cell: (p) => <IdLink kind="place" id={p.from} /> },
        { id: "to", header: "To", csv: (p) => p.to, cell: (p) => <IdLink kind="place" id={p.to} /> },
        { id: "walk", header: "Walk", align: "right", sortValue: (p) => p.walkS, cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatDuration(p.walkS)}</span> },
        { id: "drive", header: "Drive", align: "right", sortValue: (p) => p.driveS, cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatDuration(p.driveS)}</span> },
        {
            id: "distance",
            header: "Distance",
            align: "right",
            sortValue: (p) => p.distM,
            cell: (p) => <span className="whitespace-nowrap tabular-nums text-ink-muted">{formatDistance(p.distM)}</span>,
        },
    ];

    return (
        <Panel
            title="Travel-time matrix"
            icon={RouteIcon}
            description={
                <>
                    {(matrixQuery.data?.count ?? pairs.length).toLocaleString("en-IN")} travel-time pairs for this region
                    {matrixPolling && <span className="text-accent-700"> · refreshing…</span>}
                </>
            }
            actions={
                canApprove && (
                    <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => refreshMatrixMutation.mutate()} loading={refreshMatrixMutation.isPending}>
                        Refresh matrix
                    </Button>
                )
            }
            bodyClassName="p-0"
        >
            <DataTable
                label="Travel times"
                rows={rows}
                columns={columns}
                rowKey={(p) => p.key}
                isLoading={matrixQuery.isLoading}
                error={matrixQuery.error}
                onRetry={() => matrixQuery.refetch()}
                empty={{ icon: RouteIcon, title: "No travel times yet.", description: canApprove ? "Use Refresh matrix to compute them." : undefined }}
                frame="bare"
                toolbar={false}
                card={{ title: (p) => <IdLink kind="place" id={p.from} />, subtitle: () => "to", fields: ["to", "walk", "drive", "distance"] }}
                footer={<Pagination page={current} totalPages={totalPages} total={pairs.length} pageSize={PER_PAGE} onPageChange={setPage} />}
            />
        </Panel>
    );
}

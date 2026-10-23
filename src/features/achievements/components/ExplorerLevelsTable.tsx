import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { achievementsService } from "../services/achievements.service";
import type { ExplorerLevel } from "@/types";

const COLUMNS: DataColumn<ExplorerLevel>[] = [
    { id: "level", header: "Level", hideable: false, sortValue: (l) => l.level, cell: (l) => <span className="font-semibold tabular-nums">{l.level}</span> },
    { id: "title", header: "Title", sortValue: (l) => l.title, cell: (l) => l.title },
    { id: "min", header: "Min XP", align: "right", sortValue: (l) => l.min_xp, cell: (l) => <span className="tabular-nums">{l.min_xp.toLocaleString("en-IN")}</span> },
    {
        id: "max",
        header: "Max XP",
        align: "right",
        sortValue: (l) => l.max_xp ?? Number.MAX_SAFE_INTEGER,
        csv: (l) => (l.max_xp === null ? "" : l.max_xp),
        cell: (l) => <span className="tabular-nums">{l.max_xp === null ? "∞" : l.max_xp.toLocaleString("en-IN")}</span>,
    },
    {
        id: "perks",
        header: "Perks",
        csv: (l) => l.perks.join(", "),
        cell: (l) => (l.perks.length > 0 ? <span className="text-ink-muted">{l.perks.join(", ")}</span> : <span className="text-ink-faint">—</span>),
    },
];

/** Reference: XP thresholds and perks per explorer level (read-only). */
export function ExplorerLevelsTable() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["explorer-levels"],
        queryFn: () => achievementsService.explorerLevels(),
        staleTime: 30 * 60 * 1000,
    });
    const levels = data ?? [];
    return (
        <DataTable
            label="Explorer levels"
            rows={levels}
            columns={COLUMNS}
            rowKey={(l) => String(l.level)}
            isLoading={isLoading}
            error={error}
            onRetry={() => refetch()}
            empty={{ icon: Layers, title: "No explorer levels configured." }}
            exportName="explorer-levels"
            summary={data ? `${levels.length} levels · XP thresholds and perks per level` : undefined}
            card={{
                title: (l) => `Level ${l.level} · ${l.title}`,
                fields: ["min", "max", "perks"],
            }}
        />
    );
}

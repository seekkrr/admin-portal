import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { IdLink } from "@/components/ui/IdLink";

interface LinkedQuestsProps {
    regionId: string;
    questIds: string[];
    canEdit: boolean;
}

export function LinkedQuests({ regionId, questIds, canEdit }: LinkedQuestsProps) {
    const queryClient = useQueryClient();
    const [attachId, setAttachId] = useState("");
    const [attachLabel, setAttachLabel] = useState<string | null>(null);
    const [detachId, setDetachId] = useState<string | null>(null);

    const attachMutation = useMutation({
        mutationFn: (questId: string) => regionsService.attachQuest(regionId, questId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
            toast.success(attachLabel ? `“${attachLabel}” linked` : "Quest linked");
            setAttachId("");
            setAttachLabel(null);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to link quest"),
    });

    const detachMutation = useMutation({
        mutationFn: (questId: string) => regionsService.detachQuest(regionId, questId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
            toast.success("Quest unlinked");
            setDetachId(null);
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to unlink quest");
            setDetachId(null);
        },
    });

    return (
        <Panel title="Linked quests" icon={Link2} description={`${questIds.length} quest${questIds.length === 1 ? "" : "s"} in this region`}>
            {questIds.length === 0 ? (
                <EmptyState compact icon={Link2} title="No quests linked to this region yet." />
            ) : (
                <ul className="divide-y divide-line">
                    {questIds.map((qid) => (
                        <li key={qid} className="flex items-center justify-between gap-3 py-2.5">
                            <IdLink kind="quest" id={qid} short={false} className="min-w-0 truncate" />
                            {canEdit && (
                                <Button size="sm" variant="ghost" icon={Unlink} onClick={() => setDetachId(qid)} className="hover:bg-bad-soft hover:text-bad">
                                    Unlink
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {canEdit && (
                <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end">
                    <Field label="Link a quest" htmlFor="region-attach-quest" className="min-w-0 flex-1">
                        <EntityPicker
                            id="region-attach-quest"
                            type="quest"
                            label="Quest"
                            value={attachId}
                            onChange={(id, hit) => {
                                setAttachId(id);
                                setAttachLabel(hit?.title ?? null);
                            }}
                        />
                    </Field>
                    <Button variant="primary" icon={Link2} onClick={() => attachMutation.mutate(attachId)} loading={attachMutation.isPending} disabled={!attachId}>
                        Link quest
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={!!detachId}
                title="Unlink quest?"
                description="The quest stays as it is; it is just no longer listed under this region."
                confirmLabel="Unlink"
                tone="warning"
                onConfirm={() => detachId && detachMutation.mutate(detachId)}
                onCancel={() => setDetachId(null)}
                isPending={detachMutation.isPending}
            />
        </Panel>
    );
}

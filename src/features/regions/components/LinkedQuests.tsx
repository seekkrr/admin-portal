import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

interface LinkedQuestsProps {
    regionId: string;
    questIds: string[];
    canEdit: boolean;
}

export function LinkedQuests({ regionId, questIds, canEdit }: LinkedQuestsProps) {
    const queryClient = useQueryClient();
    const [attachInput, setAttachInput] = useState("");

    const attachMutation = useMutation({
        mutationFn: (questId: string) => regionsService.attachQuest(regionId, questId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
            toast.success("Quest attached");
            setAttachInput("");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to attach quest"),
    });

    const detachMutation = useMutation({
        mutationFn: (questId: string) => regionsService.detachQuest(regionId, questId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["region-detail", regionId] });
            toast.success("Quest detached");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to detach quest"),
    });

    return (
        <Card padding="md">
            <CardHeader className="border-b border-neutral-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-cyan-600" />
                    <CardTitle>Linked Quests</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {questIds.length === 0 ? (
                        <p className="text-sm text-neutral-500">No quests linked to this region yet.</p>
                    ) : (
                        <ul className="divide-y divide-neutral-100">
                            {questIds.map((qid) => (
                                <li key={qid} className="py-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="font-mono text-sm text-neutral-600 truncate">{qid}</span>
                                        <Link
                                            to={`/quests/${qid}`}
                                            className="flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-900 whitespace-nowrap"
                                        >
                                            View
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    </div>
                                    {canEdit && (
                                        <button
                                            onClick={() => detachMutation.mutate(qid)}
                                            disabled={detachMutation.isPending}
                                            className="py-1.5 px-3 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors text-red-600 bg-red-50 hover:bg-red-100 text-xs disabled:opacity-50 whitespace-nowrap"
                                        >
                                            {detachMutation.isPending && detachMutation.variables === qid && (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            )}
                                            Detach
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}

                    {canEdit && (
                        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-4">
                            <div className="flex-1 min-w-[200px]">
                                <label htmlFor="attach-quest" className="block text-xs font-medium text-neutral-500 mb-1">
                                    Attach quest by ID
                                </label>
                                <input
                                    id="attach-quest"
                                    type="text"
                                    value={attachInput}
                                    onChange={(e) => setAttachInput(e.target.value)}
                                    placeholder="quest id"
                                    className="w-full rounded-xl py-2.5 px-4 border border-neutral-200 text-sm font-mono focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const value = attachInput.trim();
                                    if (!value) {
                                        toast.error("Enter a quest id");
                                        return;
                                    }
                                    attachMutation.mutate(value);
                                }}
                                disabled={attachMutation.isPending || attachInput.trim() === ""}
                                className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                            >
                                {attachMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Attach quest
                            </button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

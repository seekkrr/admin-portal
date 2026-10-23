import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DangerZoneProps {
    regionId: string;
    regionName: string;
    canEdit: boolean;
    isSuper: boolean;
}

export function DangerZone({ regionId, regionName, canEdit, isSuper }: DangerZoneProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [hardDelete, setHardDelete] = useState(false);

    const deleteMutation = useMutation({
        mutationFn: (hard: boolean) => regionsService.remove(regionId, hard),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-regions"] });
            toast.success("Region deleted");
            navigate("/regions", { replace: true });
        },
        onError: (e: Error) => {
            toast.error(e.message || "Failed to delete region");
            setConfirmDelete(false);
        },
    });

    if (!canEdit) return null;

    const close = () => {
        setConfirmDelete(false);
        setHardDelete(false);
    };

    return (
        <Panel title={<span className="text-bad">Danger zone</span>} className="border-bad-line">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">Remove this region from the app and the admin lists. Regions with quests attached can't be deleted.</p>
                <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                    Delete region
                </Button>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                title={hardDelete ? "Permanently delete region?" : "Delete region?"}
                description={
                    hardDelete
                        ? `“${regionName}” and its data are removed for good.`
                        : `“${regionName}” is removed from the app and the admin lists.`
                }
                confirmLabel={hardDelete ? "Delete permanently" : "Delete"}
                tone="danger"
                level={hardDelete ? "type" : "simple"}
                typeToConfirm={regionName.trim() || "DELETE"}
                onConfirm={() => deleteMutation.mutate(hardDelete)}
                onCancel={close}
                isPending={deleteMutation.isPending}
            >
                {isSuper && (
                    <Checkbox
                        checked={hardDelete}
                        onChange={setHardDelete}
                        label="Delete permanently"
                        hint="Super admins only. This can't be undone."
                    />
                )}
            </ConfirmDialog>
        </Panel>
    );
}

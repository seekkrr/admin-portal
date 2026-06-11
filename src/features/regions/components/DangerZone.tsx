import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { regionsService } from "../services/regions.service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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

    return (
        <Card padding="md" className="border-red-200">
            <CardHeader className="border-b border-red-100 pb-4 mb-4">
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="py-2.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-red-600 bg-red-50 hover:bg-red-100 w-max"
                    >
                        <Trash2 className="w-5 h-5" />
                        Delete Region
                    </button>
                </div>
            </CardContent>

            <ConfirmModal
                open={confirmDelete}
                title="Delete Region"
                message={`Are you sure you want to delete "${regionName}"? ${hardDelete ? "This will permanently remove the region and cannot be undone." : "This action cannot be undone."}`}
                confirmLabel={hardDelete ? "Permanently Delete" : "Delete"}
                confirmStyle="bg-red-600 hover:bg-red-700"
                onConfirm={() => deleteMutation.mutate(hardDelete)}
                onCancel={() => {
                    setConfirmDelete(false);
                    setHardDelete(false);
                }}
                isPending={deleteMutation.isPending}
            >
                {isSuper && (
                    <label className="flex items-center gap-2 mt-3 mb-1 px-1 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={hardDelete}
                            onChange={(e) => setHardDelete(e.target.checked)}
                            className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 accent-red-600"
                        />
                        <span className="text-xs text-red-600 font-medium">Permanently delete (super-admin, irreversible)</span>
                    </label>
                )}
            </ConfirmModal>
        </Card>
    );
}

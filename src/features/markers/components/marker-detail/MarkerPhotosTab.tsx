import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Images } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { PhotoListEditor } from "@/components/detail/PhotoListEditor";
import { SaveBar } from "@/components/detail/SaveBar";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { sameList } from "@/components/detail/detailFormat";
import { placeDetailApi } from "@/services/admin-detail.service";
import type { Marker } from "@/types";

/** Upload, reorder (drag or arrows) and remove the place's photos; saved together. */
export function MarkerPhotosTab({ marker, canEdit, onSaved }: { marker: Marker; canEdit: boolean; onSaved: () => void }) {
    const base = useMemo(() => (marker.media ?? []).filter(Boolean), [marker.media]);
    const [photos, setPhotos, reset] = useSyncedDraft<string[]>(base);
    const dirty = !sameList(photos, base);

    const save = useMutation({
        mutationFn: () => placeDetailApi.update(marker.id, { media: photos }),
        onSuccess: () => {
            toast.success(`Photos saved (${photos.length})`);
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className="space-y-4">
            <Panel title={`Photos (${photos.length})`} icon={Images} description="The first photo is the one the app shows first.">
                <PhotoListEditor value={photos} onChange={setPhotos} upload={{ category: "marker", entityId: marker.id }} max={30} disabled={!canEdit} label="Place photos" />
            </Panel>
            <SaveBar dirty={dirty && canEdit} saving={save.isPending} onSave={() => save.mutate()} onDiscard={reset} saveLabel="Save photos" />
        </div>
    );
}

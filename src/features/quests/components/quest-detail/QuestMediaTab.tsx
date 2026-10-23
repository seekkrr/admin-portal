import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Images } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { PhotoListEditor } from "@/components/detail/PhotoListEditor";
import { SaveBar } from "@/components/detail/SaveBar";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { sameList } from "@/components/detail/detailFormat";
import { MEDIA_DELIVERY_BASE } from "@/services/media.service";
import type { CloudinaryAsset, V2QuestDetail } from "@/types";
import { questsService } from "../../services/quests.service";

/** Quest photos: upload, reorder, remove. Existing photo records are kept as they are. */
export function QuestMediaTab({ quest, canEdit, onSaved }: { quest: V2QuestDetail; canEdit: boolean; onSaved: () => void }) {
    const assets = useMemo(() => quest.cloudinary_assets ?? [], [quest.cloudinary_assets]);
    const base = useMemo(() => assets.map((a) => a.secure_url).filter(Boolean), [assets]);
    const [urls, setUrls, reset] = useSyncedDraft<string[]>(base);
    const dirty = !sameList(urls, base);

    const save = useMutation({
        mutationFn: () => {
            const byUrl = new Map(assets.map((a) => [a.secure_url, a] as const));
            const next: CloudinaryAsset[] = urls.map(
                (url) =>
                    byUrl.get(url) ?? {
                        public_id: url.startsWith(`${MEDIA_DELIVERY_BASE}/`) ? url.slice(MEDIA_DELIVERY_BASE.length + 1) : url,
                        secure_url: url,
                        resource_type: "image",
                        format: (url.split(".").pop() ?? "").toLowerCase(),
                        alt_text: "",
                    }
            );
            // The server takes string values only (Dict[str, str]).
            const clean = next.map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => typeof v === "string")) as unknown as CloudinaryAsset);
            return questsService.updateQuest(quest.id, { cloudinary_assets: clean });
        },
        onSuccess: () => {
            toast.success(`Photos saved (${urls.length})`);
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className="space-y-4">
            <Panel title={`Photos (${urls.length})`} icon={Images} description="The first photo is the quest's cover.">
                <PhotoListEditor value={urls} onChange={setUrls} upload={{ category: "quest", entityId: quest.id }} max={30} disabled={!canEdit} label="Quest photos" />
            </Panel>
            <SaveBar dirty={dirty && canEdit} saving={save.isPending} onSave={() => save.mutate()} onDiscard={reset} saveLabel="Save photos" />
        </div>
    );
}

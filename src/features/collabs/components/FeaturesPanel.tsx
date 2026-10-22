import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ToggleRight } from "lucide-react";
import { businessesService } from "../services/businesses.service";
import { SectionCard, Switch } from "./CollabsUi";
import { featuresOf } from "../utils";
import type { AdminBusiness, BusinessFeatures } from "../types";

const FEATURES: { key: keyof BusinessFeatures; label: string; hint: string }[] = [
    {
        key: "collabs",
        label: "Collabs",
        hint: "UGC briefs, creator requests, content library and the rest of the creator tools in the Partner Portal and app.",
    },
    {
        key: "experiences",
        label: "Experiences",
        hint: "List bookable experiences with time slots; customers book them in the app.",
    },
];

/** Collabs / Experiences switches for one business (PATCH /businesses/admin/{id} {features}). */
export function FeaturesPanel({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const current = featuresOf(business);
    const [pending, setPending] = useState<keyof BusinessFeatures | null>(null);

    const save = useMutation({
        mutationFn: (patch: Partial<BusinessFeatures>) => businessesService.update(business.id, { features: patch }),
        onSuccess: (updated, patch) => {
            // Older responses may not echo `features`; keep what we just set.
            const features = { ...current, ...patch, ...(updated.features ?? {}) };
            queryClient.setQueryData(["collabs-business", business.id], { ...updated, features });
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
            toast.success("Saved");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save the features"),
        onSettled: () => setPending(null),
    });

    return (
        <SectionCard title="Features" icon={ToggleRight}>
            <p className="text-xs text-neutral-500 mb-4">What this business can use. Changes apply right away and are audit-logged.</p>
            <ul className="space-y-3">
                {FEATURES.map((f) => {
                    const on = current[f.key];
                    return (
                        <li key={f.key} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-neutral-100 bg-neutral-50/60">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-neutral-900">
                                    {f.label}
                                    <span className={`ml-2 text-xs font-semibold ${on ? "text-teal-700" : "text-neutral-400"}`}>{on ? "On" : "Off"}</span>
                                </p>
                                <p className="text-xs text-neutral-500 mt-0.5">{f.hint}</p>
                            </div>
                            {pending === f.key ? (
                                <Loader2 className="w-5 h-5 animate-spin text-teal-600 shrink-0 mt-0.5" />
                            ) : (
                                <Switch
                                    on={on}
                                    label={f.label}
                                    disabled={!canEdit || save.isPending}
                                    onToggle={() => {
                                        setPending(f.key);
                                        save.mutate({ [f.key]: !on });
                                    }}
                                />
                            )}
                        </li>
                    );
                })}
            </ul>
            {current.experiences && (
                <Link
                    to={`/collabs/experiences?business_id=${business.id}`}
                    className="inline-block mt-4 text-xs font-medium text-teal-700 hover:underline"
                >
                    View this business's experiences
                </Link>
            )}
            {!canEdit && <p className="text-xs text-neutral-400 mt-3">View only.</p>}
        </SectionCard>
    );
}

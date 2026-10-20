import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { businessesService } from "../services/businesses.service";
import { DetailRow, Field, LoadingButtonIcon, MonoId, SectionCard, btnPrimary, inputClass } from "./CollabsUi";
import { fmtDateTime } from "../utils";
import type { AdminBusiness } from "../types";

/**
 * Owner of a business. Admins assign or change it by user ID or email; the
 * business goes live and the user gets Partner Portal access straight away.
 */
export function OwnerPanel({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const [userRef, setUserRef] = useState("");
    const hasOwner = !!business.owner_user_id;

    const assign = useMutation({
        mutationFn: () => businessesService.setOwner(business.id, userRef.trim()),
        onSuccess: (updated) => {
            toast.success(hasOwner ? "Owner changed" : "Owner assigned — the business is live");
            queryClient.setQueryData(["collabs-business", business.id], updated);
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
            setUserRef("");
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't set the owner"),
    });

    return (
        <SectionCard title="Owner" icon={UserCheck}>
            <div className="space-y-4">
                {hasOwner ? (
                    <div className="space-y-2">
                        <DetailRow label="Owner" value={<MonoId id={business.owner_user_id} short={false} />} />
                        <DetailRow label="Since" value={fmtDateTime(business.claimed_at)} />
                    </div>
                ) : (
                    <p className="text-sm text-neutral-500">No owner yet. Assign one to make the business live.</p>
                )}
                {canEdit && (
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (userRef.trim()) assign.mutate();
                        }}
                    >
                        <Field
                            label={hasOwner ? "Change owner" : "Assign owner"}
                            htmlFor={`owner-${business.id}`}
                            hint={hasOwner ? "The current owner stays on the team as a manager." : "User ID or the email they sign in with."}
                        >
                            <input
                                id={`owner-${business.id}`}
                                type="text"
                                value={userRef}
                                onChange={(e) => setUserRef(e.target.value)}
                                placeholder="User ID or email"
                                className={inputClass}
                                maxLength={255}
                            />
                        </Field>
                        <button type="submit" disabled={!userRef.trim() || assign.isPending} className={btnPrimary}>
                            <LoadingButtonIcon loading={assign.isPending} icon={UserCheck} /> {hasOwner ? "Change owner" : "Make owner"}
                        </button>
                    </form>
                )}
            </div>
        </SectionCard>
    );
}

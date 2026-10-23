import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Link2, Store, Unlink, UserRound } from "lucide-react";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { LoadingState } from "@/components/ui/States";
import { Notice } from "@/components/detail/DetailStates";
import { OBJECT_ID, fullName } from "@/components/detail/detailFormat";
import { businessDetailApi, isNotAvailable, placeDetailApi, userDetailApi } from "@/services/admin-detail.service";
import { formatDate } from "@/utils/date";
import type { Marker } from "@/types";
import type { MarkerExtras } from "@/types/admin-detail";
import { useMarkerBusiness } from "./useMarkerBusiness";

/** Who owns the place, which business runs it, and its redeem code. */
export function MarkerOwnerTab({ marker, canEdit, onSaved }: { marker: Marker & MarkerExtras; canEdit: boolean; onSaved: () => void }) {
    const queryClient = useQueryClient();
    const ownerId = marker.owner_id ?? null;
    const { business, isLoading } = useMarkerBusiness(marker.id);
    const [newOwner, setNewOwner] = useState("");
    const [linkId, setLinkId] = useState("");
    const [code, setCode] = useState("");
    const [confirm, setConfirm] = useState<"clear-owner" | "unlink" | null>(null);

    const owner = useQuery({
        queryKey: ["user-summary", ownerId],
        queryFn: () => userDetailApi.summary(ownerId ?? ""),
        enabled: !!ownerId,
        staleTime: 5 * 60_000,
        retry: false,
    });
    const redeem = useQuery({
        queryKey: ["business-redeem-code", business?.id, marker.id],
        queryFn: () => businessDetailApi.redeemCode(business?.id ?? "", marker.id),
        enabled: !!business?.id,
        retry: false,
    });

    const refreshAll = () => {
        onSaved();
        queryClient.invalidateQueries({ queryKey: ["marker-collabs", marker.id] });
        queryClient.invalidateQueries({ queryKey: ["marker-experiences", marker.id] });
    };

    const setOwner = useMutation({
        mutationFn: (id: string) => placeDetailApi.update(marker.id, { owner_id: id }),
        onSuccess: (_, id) => {
            toast.success(id ? "Owner changed" : "Owner removed");
            setNewOwner("");
            setConfirm(null);
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const link = useMutation({
        mutationFn: (bid: string) => businessDetailApi.linkPlace(bid, marker.id),
        onSuccess: (_, bid) => {
            toast.success("Linked to the business");
            setLinkId("");
            queryClient.invalidateQueries({ queryKey: ["collabs-business", bid] });
            refreshAll();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const unlink = useMutation({
        mutationFn: (bid: string) => businessDetailApi.unlinkPlace(bid, marker.id),
        onSuccess: (_, bid) => {
            toast.success("Removed from the business");
            setConfirm(null);
            queryClient.invalidateQueries({ queryKey: ["collabs-business", bid] });
            refreshAll();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const saveCode = useMutation({
        mutationFn: () => businessDetailApi.setRedeemCode(business?.id ?? "", marker.id, code),
        onSuccess: () => {
            toast.success("Redeem code saved");
            setCode("");
            redeem.refetch();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const ownerName = owner.data ? fullName(owner.data.first_name, owner.data.last_name) || owner.data.email : null;

    return (
        <div className="space-y-5">
            <Panel title="Owner" icon={UserRound} description="The person who manages this place for its business.">
                <div className="space-y-4">
                    <DetailList>
                        <DetailRow
                            label="Owner"
                            value={
                                ownerId ? (
                                    <Link to={`/users/${ownerId}`} className="text-accent-700 hover:underline">
                                        {ownerName ?? `User …${ownerId.slice(-6)}`}
                                    </Link>
                                ) : (
                                    "No owner"
                                )
                            }
                        />
                        <DetailRow
                            label="Added by"
                            value={
                                marker.created_by ? (
                                    <Link to={`/users/${marker.created_by}`} className="text-accent-700 hover:underline">
                                        {marker.creator_name ?? `User …${marker.created_by.slice(-6)}`}
                                    </Link>
                                ) : (
                                    "—"
                                )
                            }
                        />
                        <DetailRow label="Source" value={marker.source ?? "—"} />
                    </DetailList>
                    {canEdit && (
                        <form
                            className="flex flex-col gap-3 sm:flex-row sm:items-end"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (OBJECT_ID.test(newOwner.trim())) setOwner.mutate(newOwner.trim());
                            }}
                        >
                            <Field label={ownerId ? "Change owner" : "Set owner"} hint="A user ID." className="flex-1">
                                <TextInput value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="24-character user ID" className="font-mono" maxLength={24} />
                            </Field>
                            <div className="flex gap-2">
                                <Button type="submit" variant="primary" disabled={!OBJECT_ID.test(newOwner.trim())} loading={setOwner.isPending && setOwner.variables !== ""}>
                                    Save owner
                                </Button>
                                {ownerId && (
                                    <Button variant="ghost" onClick={() => setConfirm("clear-owner")}>
                                        Remove owner
                                    </Button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </Panel>

            <Panel title="Business" icon={Store}>
                {isLoading ? (
                    <LoadingState />
                ) : business ? (
                    <div className="space-y-4">
                        <DetailList>
                            <DetailRow
                                label="Run by"
                                value={
                                    <Link to={`/collabs/businesses/${business.id}`} className="font-medium text-accent-700 hover:underline">
                                        {business.name ?? business.id}
                                    </Link>
                                }
                            />
                            <DetailRow
                                label="Redeem code"
                                value={
                                    redeem.isLoading ? (
                                        "…"
                                    ) : redeem.error ? (
                                        <span className="text-ink-faint">{isNotAvailable(redeem.error) ? "Not available yet" : "Couldn't load"}</span>
                                    ) : redeem.data?.is_set ? (
                                        <span className="flex flex-wrap items-center gap-1.5">
                                            <Tag tone="good">Set</Tag>
                                            <span className="font-mono">{redeem.data.code}</span>
                                            {redeem.data.set_at && <span className="text-xs text-ink-faint">{formatDate(redeem.data.set_at)}</span>}
                                        </span>
                                    ) : (
                                        <Tag tone="warn">Not set</Tag>
                                    )
                                }
                            />
                        </DetailList>
                        {canEdit && (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <Field label="New redeem code" hint="4 digits staff type to confirm a creator's visit." className="sm:w-56">
                                    <TextInput
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                        inputMode="numeric"
                                        autoComplete="off"
                                        className="font-mono tracking-[0.4em]"
                                    />
                                </Field>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="secondary" icon={KeyRound} disabled={!/^\d{4}$/.test(code)} loading={saveCode.isPending} onClick={() => saveCode.mutate()}>
                                        Save code
                                    </Button>
                                    <Button variant="ghost" icon={Unlink} onClick={() => setConfirm("unlink")}>
                                        Remove from business
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Notice tone="info" title="No business found for this place">
                            Businesses are found from their live collabs and experiences. A hidden business can still be linked here by its ID.
                        </Notice>
                        {canEdit && (
                            <form
                                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (OBJECT_ID.test(linkId.trim())) link.mutate(linkId.trim());
                                }}
                            >
                                <Field label="Link to a business" hint="The business ID (from its page)." className="flex-1">
                                    <TextInput value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="24-character business ID" className="font-mono" maxLength={24} />
                                </Field>
                                <Button type="submit" variant="primary" icon={Link2} disabled={!OBJECT_ID.test(linkId.trim())} loading={link.isPending}>
                                    Link
                                </Button>
                            </form>
                        )}
                    </div>
                )}
            </Panel>

            <ConfirmDialog
                open={confirm === "clear-owner"}
                title="Remove the owner?"
                description="The place stays; nobody is recorded as its owner."
                confirmLabel="Remove owner"
                tone="warning"
                isPending={setOwner.isPending}
                onConfirm={() => setOwner.mutate("")}
                onCancel={() => setConfirm(null)}
            />
            <ConfirmDialog
                open={confirm === "unlink"}
                title={`Remove this place from ${business?.name ?? "the business"}?`}
                description="The place stays on SeekKrr. Archive its collabs first."
                confirmLabel="Remove"
                tone="warning"
                isPending={unlink.isPending}
                onConfirm={() => business && unlink.mutate(business.id)}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

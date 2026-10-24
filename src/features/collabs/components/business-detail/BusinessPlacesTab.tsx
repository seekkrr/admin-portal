import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, MapPin, Unlink, Plus } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { PlaceSearchPicker } from "@/components/detail/PlaceSearchPicker";
import { markersService } from "@/features/markers/services/markers.service";
import { businessDetailApi, isNotAvailable } from "@/services/admin-detail.service";
import { formatDate } from "@/utils/date";
import type { Marker } from "@/types";
import type { RedeemCodeStatus } from "@/types/admin-detail";
import type { AdminBusiness } from "../../types";

interface PlaceRow {
    id: string;
    marker: Marker | undefined;
    loading: boolean;
    code: RedeemCodeStatus | undefined;
    codeError: unknown;
}

/** Places this business runs, their redeem codes, and link / unlink. */
export function BusinessPlacesTab({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const ids = business.marker_ids;
    const [unlinking, setUnlinking] = useState<PlaceRow | null>(null);
    const [codeFor, setCodeFor] = useState<PlaceRow | null>(null);
    const [code, setCode] = useState("");

    const markers = useQueries({
        queries: ids.map((id) => ({
            queryKey: ["marker-detail", id],
            queryFn: () => markersService.getById(id),
            staleTime: 5 * 60_000,
            retry: false,
        })),
    });
    const codes = useQueries({
        queries: ids.map((id) => ({
            queryKey: ["business-redeem-code", business.id, id],
            queryFn: () => businessDetailApi.redeemCode(business.id, id),
            staleTime: 60_000,
            retry: false,
        })),
    });

    const rows: PlaceRow[] = useMemo(
        () =>
            ids.map((id, i) => ({
                id,
                marker: markers[i]?.data,
                loading: !!markers[i]?.isLoading,
                code: codes[i]?.data,
                codeError: codes[i]?.error,
            })),
        [ids, markers, codes]
    );

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["collabs-business", business.id] });
        queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
        queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", business.id] });
    };

    const link = useMutation({
        mutationFn: (m: Marker) => businessDetailApi.linkPlace(business.id, m.id),
        onSuccess: (_, m) => {
            toast.success(`${m.title} linked`);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const unlink = useMutation({
        mutationFn: (row: PlaceRow) => businessDetailApi.unlinkPlace(business.id, row.id),
        onSuccess: (_, row) => {
            toast.success(`${row.marker?.title ?? "Place"} removed from ${business.name}`);
            setUnlinking(null);
            refresh();
        },
        onError: (e: Error) => toast.error(e.message),
    });
    const saveCode = useMutation({
        mutationFn: (row: PlaceRow) => businessDetailApi.setRedeemCode(business.id, row.id, code.trim()),
        onSuccess: (_, row) => {
            toast.success(`Redeem code set for ${row.marker?.title ?? "the place"}`);
            queryClient.invalidateQueries({ queryKey: ["business-redeem-code", business.id, row.id] });
            setCodeFor(null);
            setCode("");
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const codeCell = (r: PlaceRow) => {
        if (r.codeError) return <span className="text-xs text-ink-faint">{isNotAvailable(r.codeError) ? "Not available yet" : "Couldn't load"}</span>;
        if (!r.code) return <span className="text-xs text-ink-faint">…</span>;
        return r.code.is_set ? (
            <span className="flex flex-wrap items-center gap-1.5">
                <Tag tone="good">Set</Tag>
                <span className="font-mono text-xs text-ink">{r.code.code}</span>
                {r.code.set_at && <span className="text-xs text-ink-faint">{formatDate(r.code.set_at)}</span>}
            </span>
        ) : (
            <Tag tone="warn">Not set</Tag>
        );
    };

    const columns: DataColumn<PlaceRow>[] = [
        {
            id: "place",
            header: "Place",
            hideable: false,
            sortValue: (r) => r.marker?.title ?? r.id,
            cell: (r) => (
                <div className="min-w-0">
                    <Link to={`/markers/${r.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                        {r.loading ? "Loading…" : (r.marker?.title ?? r.id)}
                    </Link>
                    {r.marker?.address && <div className="truncate text-xs text-ink-muted">{r.marker.address}</div>}
                </div>
            ),
        },
        { id: "status", header: "Status", cell: (r) => <StatusPill status={r.marker?.status ?? null} /> },
        { id: "code", header: "Redeem code", cell: codeCell },
    ];

    return (
        <div className="space-y-5">
            <Panel title={`Places (${ids.length})`} icon={MapPin} description="Collabs and experiences happen at these places." bodyClassName="p-0">
                <DataTable
                    label="Linked places"
                    rows={rows}
                    columns={columns}
                    rowKey={(r) => r.id}
                    toolbar={false}
                    frame="bare"
                    empty={{ icon: MapPin, title: "No places linked yet" }}
                    card={{ title: (r) => r.marker?.title ?? r.id, subtitle: (r) => r.marker?.address ?? null, fields: ["status", "code"] }}
                    rowActions={
                        canEdit
                            ? (r) => (
                                  <>
                                      <IconButton
                                          icon={KeyRound}
                                          size="sm"
                                          label={`Set redeem code for ${r.marker?.title ?? "place"}`}
                                          onClick={() => {
                                              setCode("");
                                              setCodeFor(r);
                                          }}
                                      />
                                      <IconButton
                                          icon={Unlink}
                                          size="sm"
                                          label={`Remove ${r.marker?.title ?? "place"} from this business`}
                                          className="hover:bg-bad-soft hover:text-bad"
                                          onClick={() => setUnlinking(r)}
                                      />
                                  </>
                              )
                            : undefined
                    }
                />
            </Panel>

            {canEdit && (
                <Panel title="Link a place" icon={Plus} description="Only approved places. A place another business manages can't be linked.">
                    <PlaceSearchPicker
                        onPick={(m) => link.mutate(m)}
                        excludeIds={ids}
                        status="approved"
                        busyId={link.isPending ? (link.variables?.id ?? null) : null}
                    />
                </Panel>
            )}

            <ConfirmDialog
                open={!!unlinking}
                title={`Remove ${unlinking?.marker?.title ?? "this place"}?`}
                description="The place stays on SeekKrr; it just isn't run by this business any more. Archive its collabs first."
                confirmLabel="Remove place"
                tone="warning"
                isPending={unlink.isPending}
                onConfirm={() => unlinking && unlink.mutate(unlinking)}
                onCancel={() => setUnlinking(null)}
            />

            <Modal
                open={!!codeFor}
                onClose={() => setCodeFor(null)}
                dismissible={!saveCode.isPending}
                title="Set redeem code"
                description={codeFor?.marker?.title}
                icon={KeyRound}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCodeFor(null)} disabled={saveCode.isPending}>
                            Cancel
                        </Button>
                        <Button variant="primary" disabled={!/^\d{4}$/.test(code.trim())} loading={saveCode.isPending} onClick={() => codeFor && saveCode.mutate(codeFor)}>
                            Save code
                        </Button>
                    </>
                }
            >
                <Field label="4-digit code" hint="Staff type this to confirm a creator's visit. Avoid 1111 or 1234.">
                    <TextInput
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        inputMode="numeric"
                        autoComplete="off"
                        className="font-mono tracking-[0.4em]"
                        placeholder="••••"
                    />
                </Field>
            </Modal>
        </div>
    );
}

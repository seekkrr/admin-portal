import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgePercent, Info, Store, ToggleRight, UserCheck } from "lucide-react";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { StatusPill, Tag } from "@/components/ui/StatusPill";
import { Switch, Field, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyText } from "@/components/ui/CopyText";
import { Notice } from "@/components/detail/DetailStates";
import { inr, pct } from "@/features/experience-payments/money";
import { formatDate, formatDateTime } from "@/utils/date";
import { businessesService } from "../../services/businesses.service";
import { featuresOf, humanize } from "../../utils";
import type { AdminBusiness, BusinessFeatures } from "../../types";

const FEATURES: { key: keyof BusinessFeatures; label: string; hint: string }[] = [
    { key: "collabs", label: "Collabs", hint: "Creator briefs, requests, content library and the other creator tools." },
    { key: "experiences", label: "Experiences", hint: "Bookable experiences with time slots that customers book in the app." },
];

/** Collabs / Experiences switches (PATCH /businesses/admin/{id} {features}; audit-logged). */
function FeaturesCard({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const current = featuresOf(business);
    const save = useMutation({
        mutationFn: (patch: Partial<BusinessFeatures>) => businessesService.update(business.id, { features: patch }),
        onSuccess: (updated, patch) => {
            const features = { ...current, ...patch, ...(updated.features ?? {}) };
            queryClient.setQueryData(["collabs-business", business.id], { ...updated, features });
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
            queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", business.id] });
            const [key, on] = Object.entries(patch)[0] ?? [];
            toast.success(`${humanize(key ?? "")} turned ${on ? "on" : "off"}`);
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't save the features"),
    });
    return (
        <Panel title="Features" icon={ToggleRight} description="What this business can use. Changes apply right away.">
            <div className="space-y-4">
                {FEATURES.map((f) => (
                    <Switch
                        key={f.key}
                        checked={current[f.key]}
                        label={f.label}
                        description={f.hint}
                        disabled={!canEdit || save.isPending}
                        onChange={(on) => save.mutate({ [f.key]: on })}
                    />
                ))}
            </div>
        </Panel>
    );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * SeekKrr's commission on this business's experience bookings
 * (PATCH /businesses/admin/{id} {commission_pct}; audit-logged). It applies to
 * the price before GST, whether GST is on or off; GST is never commissioned.
 */
function CommissionCard({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const current = typeof business.commission_pct === "number" ? business.commission_pct : null;
    const [value, setValue] = useState(current === null ? "" : String(current));
    const [seen, setSeen] = useState(current);
    const [notLive, setNotLive] = useState(false);
    if (seen !== current) {
        setSeen(current);
        setValue(current === null ? "" : String(current));
    }
    const n = Number(value);
    const valid = value.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
    const dirty = valid && round2(n) !== (current ?? 0);
    const example = valid ? round2(n) : (current ?? 0);

    const save = useMutation({
        mutationFn: () => businessesService.update(business.id, { commission_pct: round2(n) }),
        onSuccess: (updated) => {
            const saved = typeof updated.commission_pct === "number" ? updated.commission_pct : null;
            // An older server ignores the field and answers 200 without it.
            if (saved === null || Math.abs(saved - round2(n)) > 1e-6) {
                setNotLive(true);
                toast.error("This isn't available on the server yet.");
                return;
            }
            setNotLive(false);
            queryClient.setQueryData(["collabs-business", business.id], { ...business, ...updated });
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
            queryClient.invalidateQueries({ queryKey: ["experience-finance"] });
            queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", business.id] });
            toast.success(`Commission set to ${pct(saved)}`);
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't save the commission"),
    });

    return (
        <Panel title="Commission" icon={BadgePercent} description="SeekKrr's share of each experience booking, on the price before GST (with or without GST).">
            <div className="space-y-3">
                {canEdit ? (
                    <form
                        className="flex items-end gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (dirty && !save.isPending) save.mutate();
                        }}
                    >
                        <Field label="Commission %" className="flex-1" error={value.trim() && !valid ? "0 to 100." : undefined}>
                            <TextInput type="number" min={0} max={100} step="0.01" inputMode="decimal" value={value} placeholder="0" onChange={(e) => setValue(e.target.value)} />
                        </Field>
                        <Button type="submit" variant="primary" disabled={!dirty} loading={save.isPending}>
                            Save
                        </Button>
                    </form>
                ) : (
                    <p className="text-2xl font-semibold tabular-nums text-ink">{pct(current ?? 0)}</p>
                )}
                <p className="text-xs text-ink-muted">
                    A {inr(1000)} booking → SeekKrr {inr(round2((1000 * example) / 100))} · business {inr(round2(1000 - (1000 * example) / 100))}. GST is
                    never commissioned or paid to the business.
                </p>
                {notLive && <Notice tone="warn">This isn't available on the server yet.</Notice>}
            </div>
        </Panel>
    );
}

/** Owner: assign or change by user ID or email (the business goes live). */
function OwnerCard({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const [ref, setRef] = useState("");
    const hasOwner = !!business.owner_user_id;
    const assign = useMutation({
        mutationFn: () => businessesService.setOwner(business.id, ref.trim()),
        onSuccess: (updated) => {
            toast.success(hasOwner ? "Owner changed" : "Owner assigned — the business is live");
            queryClient.setQueryData(["collabs-business", business.id], updated);
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
            queryClient.invalidateQueries({ queryKey: ["admin-audit", "business", business.id] });
            setRef("");
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't set the owner"),
    });
    return (
        <Panel title="Owner" icon={UserCheck}>
            <div className="space-y-4">
                {hasOwner ? (
                    <DetailList>
                        <DetailRow
                            label="Owner"
                            value={
                                <Link to={`/users/${business.owner_user_id}`} className="font-mono text-xs text-accent-700 hover:underline">
                                    {business.owner_user_id}
                                </Link>
                            }
                        />
                        <DetailRow label="Since" value={formatDateTime(business.claimed_at)} />
                    </DetailList>
                ) : (
                    <p className="text-sm text-ink-muted">No owner yet. Assign one to make the business live.</p>
                )}
                {canEdit && (
                    <form
                        className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (ref.trim()) assign.mutate();
                        }}
                    >
                        <Field
                            label={hasOwner ? "Change owner" : "Assign owner"}
                            hint={hasOwner ? "The current owner stays on the team as a manager." : "User ID or the email they sign in with."}
                            className="flex-1"
                        >
                            <TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="User ID or email" maxLength={255} />
                        </Field>
                        <Button type="submit" variant="primary" icon={UserCheck} disabled={!ref.trim()} loading={assign.isPending}>
                            {hasOwner ? "Change owner" : "Make owner"}
                        </Button>
                    </form>
                )}
            </div>
        </Panel>
    );
}

export function BusinessOverviewTab({ business, isAdmin, isStaff }: { business: AdminBusiness; isAdmin: boolean; isStaff: boolean }) {
    return (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
                <Panel title="At a glance" icon={Store}>
                    <DetailList>
                        <DetailRow label="Status" value={<StatusPill status={business.status} />} />
                        <DetailRow label="Verified" value={business.verified ? <Tag tone="good">Verified</Tag> : <Tag>Not verified</Tag>} />
                        <DetailRow label="Plan" value={<Tag tone="brand">{humanize(business.plan_code ?? "free")}</Tag>} />
                        <DetailRow label="Commission" value={typeof business.commission_pct === "number" ? pct(business.commission_pct) : "—"} />
                        <DetailRow label="Contact phone" value={business.contact_phone ? <CopyText value={business.contact_phone} /> : "—"} />
                        <DetailRow label="Contact email" value={business.contact_email ? <CopyText value={business.contact_email} /> : "—"} />
                        <DetailRow
                            label="Website listing"
                            value={
                                <span className="flex flex-wrap gap-1.5">
                                    <Tag tone={business.show_on_website ? "good" : "neutral"}>{business.show_on_website ? "Shown" : "Hidden"}</Tag>
                                    {business.website_featured && <Tag tone="warn">Featured</Tag>}
                                    <span className="font-mono text-xs text-ink-muted">/{business.slug}</span>
                                </span>
                            }
                        />
                        <DetailRow label="Places" value={`${business.marker_ids.length}`} />
                        <DetailRow label="Team" value={`${business.members.length}`} />
                    </DetailList>
                </Panel>
                <OwnerCard business={business} canEdit={isAdmin} />
            </div>
            <div className="space-y-5">
                <FeaturesCard business={business} canEdit={isStaff} />
                <CommissionCard business={business} canEdit={isAdmin} />
                <Panel title="Details" icon={Info}>
                    <DetailList>
                        <DetailRow label="ID" value={<CopyText value={business.id} mono truncate={false} />} />
                        <DetailRow label="Created" value={formatDate(business.created_at)} />
                        <DetailRow label="Updated" value={formatDateTime(business.updated_at)} />
                        {business.created_by_admin && <DetailRow label="Source" value="Created by an admin" />}
                        {business.application_id && <DetailRow label="Application" value={<CopyText value={business.application_id} mono />} />}
                        <DetailRow label="Legal name" value={business.billing?.legal_name || "—"} />
                        <DetailRow label="GSTIN" value={business.billing?.gstin ? <span className="font-mono">{business.billing.gstin}</span> : "—"} />
                        {business.socials.length > 0 && (
                            <DetailRow
                                label="Socials"
                                value={
                                    <span className="flex flex-col gap-1">
                                        {business.socials.map((s) => (
                                            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent-700 hover:underline">
                                                {s.platform ? `${s.platform}: ` : ""}
                                                {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                                            </a>
                                        ))}
                                    </span>
                                }
                            />
                        )}
                    </DetailList>
                </Panel>
            </div>
        </div>
    );
}

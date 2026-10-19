import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft, Store, BadgeCheck, Save, Users, Send, MessageCircle, Clock, ShieldCheck, Sparkles, Receipt, Info, ExternalLink, GitPullRequestArrow,
} from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { LoadingFallback } from "@components/LoadingFallback";
import { Card } from "@/components/ui/Card";
import { businessesService } from "../services/businesses.service";
import { collabsAdminService } from "../services/collabs-admin.service";
import { useCollabAccess } from "../roles";
import {
    Chip, CopyButton, DetailRow, Field, LoadingButtonIcon, MonoId, SectionCard, StatusPill, btnPrimary, inputClass, thClass,
} from "../components/CollabsUi";
import { BusinessFormFields } from "../components/BusinessFormFields";
import { OverridePanel } from "../components/OverridePanel";
import { diffBusinessDraft, draftFromBusiness, slugError, type BusinessDraft } from "../businessDraft";
import { fmtDate, fmtDateTime, humanize, whatsappShareUrl } from "../utils";
import type { AdminBusiness, ClaimInvite } from "../types";

function EditBusinessForm({ business, canEdit }: { business: AdminBusiness; canEdit: boolean }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<BusinessDraft>(() => draftFromBusiness(business));
    const changes = diffBusinessDraft(draft, business);
    const dirty = Object.keys(changes).length > 0;

    const save = useMutation({
        mutationFn: () => businessesService.update(business.id, changes),
        onSuccess: (updated) => {
            toast.success("Business updated");
            queryClient.setQueryData(["collabs-business", business.id], updated);
            queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update business"),
    });

    const invalid = !draft.name.trim() || !!slugError(draft.public_slug);

    return (
        <SectionCard
            title="Profile & listing"
            icon={Store}
            actions={
                canEdit ? (
                    <div className="flex items-center gap-2">
                        {dirty && (
                            <button
                                type="button"
                                onClick={() => setDraft(draftFromBusiness(business))}
                                disabled={save.isPending}
                                className="px-3 py-2 rounded-xl text-sm text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
                            >
                                Discard
                            </button>
                        )}
                        <button type="button" onClick={() => save.mutate()} disabled={!dirty || invalid || save.isPending} className={btnPrimary}>
                            <LoadingButtonIcon loading={save.isPending} icon={Save} /> Save changes
                        </button>
                    </div>
                ) : (
                    <Chip>View only</Chip>
                )
            }
        >
            <BusinessFormFields draft={draft} onChange={setDraft} mode="edit" disabled={!canEdit || save.isPending} idPrefix={`biz-${business.id}`} />
        </SectionCard>
    );
}

function ClaimLinkPanel({ business }: { business: AdminBusiness }) {
    const [phone, setPhone] = useState(business.contact_phone ?? "");
    const [invite, setInvite] = useState<ClaimInvite | null>(null);

    const create = useMutation({
        mutationFn: () => businessesService.createClaimInvite(business.id, phone.trim() || undefined),
        onSuccess: (inv) => {
            setInvite(inv);
            toast.success("Claim link created");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create claim link"),
    });

    if (business.owner_user_id) {
        return (
            <SectionCard title="Claim status" icon={ShieldCheck}>
                <div className="space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-emerald-700 font-medium">
                        <BadgeCheck className="w-4 h-4" /> Claimed
                    </p>
                    <DetailRow label="Owner" value={<MonoId id={business.owner_user_id} short={false} />} />
                    <DetailRow label="Claimed" value={fmtDateTime(business.claimed_at)} />
                </div>
            </SectionCard>
        );
    }

    const message = invite
        ? `Hi! ${business.name} is listed on SeekKrr. Claim your business profile here to start running creator collabs: ${invite.claim_url}`
        : "";

    return (
        <SectionCard title="Send claim link" icon={Send}>
            <div className="space-y-4">
                <p className="text-xs text-neutral-500">
                    Not yet claimed. Generate a single-use link for the owner; claiming verifies by OTP to the phone below.
                </p>
                <Field label="Owner phone" htmlFor={`claim-phone-${business.id}`} hint="Optional — defaults to the business contact phone.">
                    <input
                        id={`claim-phone-${business.id}`}
                        type="tel"
                        maxLength={20}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputClass}
                        placeholder="+91…"
                    />
                </Field>
                <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className={`${btnPrimary} w-full`}>
                    <LoadingButtonIcon loading={create.isPending} icon={Send} />
                    {invite ? "Generate a new link" : "Generate claim link"}
                </button>

                {invite && (
                    <div className="p-3 rounded-xl border border-teal-200 bg-teal-50/40 space-y-3">
                        <div className="flex items-center gap-2">
                            <input readOnly value={invite.claim_url} className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
                            <CopyButton value={invite.claim_url} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href={whatsappShareUrl(message)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700"
                            >
                                <MessageCircle className="w-3.5 h-3.5" /> Share on WhatsApp
                            </a>
                            <CopyButton value={message} label="Copy message" />
                        </div>
                        <div className="text-xs text-neutral-600 space-y-1">
                            <p className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Expires {fmtDateTime(invite.expires_at)}
                            </p>
                            {invite.phone && <p>Bound to {invite.phone}</p>}
                            {invite.requires_phone_verification && <p>The owner will verify by OTP before claiming.</p>}
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

function BusinessCollabs({ businessId }: { businessId: string }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["collabs-admin-collabs", { business_id: businessId }],
        queryFn: () => collabsAdminService.listCollabs({ business_id: businessId, page: 1 }),
        staleTime: 30 * 1000,
    });
    const collabs = data?.collabs ?? [];
    return (
        <SectionCard
            title={`Collabs${data ? ` (${data.total})` : ""}`}
            icon={Sparkles}
            bodyClassName="p-0"
            actions={
                <Link to={`/collabs/applications?business_id=${businessId}`} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
                    <GitPullRequestArrow className="w-3.5 h-3.5" /> View requests
                </Link>
            }
        >
            {isLoading ? (
                <p className="p-6 text-center text-sm text-neutral-500">Loading collabs…</p>
            ) : error ? (
                <p className="p-6 text-center text-sm text-red-500">{(error as Error).message}</p>
            ) : collabs.length === 0 ? (
                <p className="p-6 text-center text-sm text-neutral-400">No collabs posted yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                <th className={thClass}>Offer</th>
                                <th className={thClass}>Mode</th>
                                <th className={thClass}>Status</th>
                                <th className={thClass}>Moderation</th>
                                <th className={`${thClass} text-right`}>Slots</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                            {collabs.map((c) => (
                                <tr key={c.id}>
                                    <td className="px-4 py-2.5">
                                        <div className="font-medium text-neutral-900">{c.offer}</div>
                                        <div className="text-[11px] text-neutral-400 truncate max-w-[280px]">Wants: {c.want || "—"}</div>
                                    </td>
                                    <td className="px-4 py-2.5 text-neutral-600">{humanize(c.mode)}</td>
                                    <td className="px-4 py-2.5">
                                        <StatusPill status={c.status} />
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <StatusPill status={c.moderation?.status} />
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-neutral-600">
                                        {c.slots_used}/{c.slots_total}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SectionCard>
    );
}

export function BusinessDetailPage() {
    const { businessId: param } = useParams<{ businessId: string }>();
    const businessId = param ?? "";
    const { isStaff, isAdmin } = useCollabAccess();

    const { data: business, isLoading, error } = useQuery({
        queryKey: ["collabs-business", businessId],
        queryFn: () => businessesService.getById(businessId),
        enabled: isStaff && !!businessId,
    });

    if (!isStaff) return <AccessDenied message="You need an admin or moderator role to view businesses." />;
    if (isLoading) return <LoadingFallback message="Loading business..." />;
    if (error || !business) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-500 mb-4">{error instanceof Error ? error.message : "Business not found."}</p>
                <Link to="/collabs/businesses" className="text-teal-600 hover:underline">
                    Back to Businesses
                </Link>
            </div>
        );
    }

    return (
        <div className="p-6 animate-fade-in max-w-[1400px] mx-auto space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Link
                    to="/collabs/businesses"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white border border-neutral-200 py-2 px-3 rounded-xl shadow-sm hover:bg-neutral-50"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
                {business.show_on_website && business.verified && business.status === "active" && (
                    <a
                        href={`https://seekkrr.com/places/${business.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
                    >
                        <ExternalLink className="w-4 h-4" /> View public page
                    </a>
                )}
            </div>

            <Card padding="md">
                <div className="flex items-start gap-4 flex-wrap">
                    {business.logo_url ? (
                        <img src={business.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-neutral-200" />
                    ) : (
                        <div className="bg-teal-100 text-teal-600 rounded-xl w-12 h-12 flex items-center justify-center shrink-0">
                            <Store className="w-6 h-6" />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                            {business.name}
                            {business.verified && <BadgeCheck className="w-5 h-5 text-teal-600" aria-label="Verified" />}
                        </h1>
                        {business.tagline && <p className="text-sm text-neutral-500 mt-0.5">{business.tagline}</p>}
                        <div className="flex items-center gap-2 flex-wrap mt-2">
                            <StatusPill status={business.status} />
                            <Chip tone="teal">Plan: {humanize(business.plan_code ?? "free")}</Chip>
                            <Chip>/{business.slug}</Chip>
                            {business.created_by_admin && <Chip tone="violet">Created by admin</Chip>}
                            {business.website_featured && <Chip tone="amber">Featured</Chip>}
                            {!business.show_on_website && <Chip>Hidden from website</Chip>}
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                <div className="xl:col-span-2 space-y-4">
                    <EditBusinessForm key={`${business.id}-${business.updated_at ?? ""}`} business={business} canEdit={isAdmin} />

                    <SectionCard title={`Team members (${business.members.length})`} icon={Users} bodyClassName="p-0">
                        <p className="px-6 pt-4 text-xs text-neutral-500">Read-only. Owners manage their team (invite, roles, removal) from the app or Partner Portal.</p>
                        {business.members.length === 0 ? (
                            <p className="p-6 text-center text-sm text-neutral-400">No members yet — the profile hasn't been claimed.</p>
                        ) : (
                            <table className="w-full text-sm mt-2">
                                <thead>
                                    <tr className="border-b border-neutral-100 bg-neutral-50/60">
                                        <th className={thClass}>User</th>
                                        <th className={thClass}>Role</th>
                                        <th className={thClass}>Added</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50">
                                    {business.members.map((m, i) => (
                                        <tr key={`${m.user_id ?? "member"}-${i}`}>
                                            <td className="px-4 py-2.5">
                                                <MonoId id={m.user_id} short={false} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <Chip tone={m.role === "owner" ? "teal" : "neutral"}>{humanize(m.role)}</Chip>
                                            </td>
                                            <td className="px-4 py-2.5 text-neutral-500">{fmtDate(m.added_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </SectionCard>

                    <BusinessCollabs businessId={business.id} />
                </div>

                <div className="space-y-4">
                    {isAdmin ? (
                        <ClaimLinkPanel key={business.id} business={business} />
                    ) : (
                        !business.owner_user_id && (
                            <SectionCard title="Claim status" icon={ShieldCheck}>
                                <p className="text-sm text-neutral-500">Not yet claimed. An admin can send the owner a claim link.</p>
                            </SectionCard>
                        )
                    )}

                    {isAdmin && (
                        <SectionCard title="Plan override" icon={Receipt}>
                            <p className="text-xs text-neutral-500 mb-4">
                                Profile plan: <strong>{business.plan_code}</strong>. Existing overrides are listed under Plans & Billing → Subscriptions.
                            </p>
                            <OverridePanel businessId={business.id} currentPlanCode={business.plan_code} />
                        </SectionCard>
                    )}

                    <SectionCard title="Details" icon={Info}>
                        <div className="space-y-3">
                            <DetailRow label="ID" value={<MonoId id={business.id} short={false} />} />
                            <DetailRow label="Created" value={fmtDateTime(business.created_at)} />
                            <DetailRow label="Updated" value={fmtDateTime(business.updated_at)} />
                            {business.application_id && <DetailRow label="Application" value={<MonoId id={business.application_id} short={false} />} />}
                            <DetailRow label="Legal name" value={business.billing?.legal_name || "—"} />
                            <DetailRow label="GSTIN" value={business.billing?.gstin ? <span className="font-mono">{business.billing.gstin}</span> : "—"} />
                            <DetailRow label="State code" value={business.billing?.state_code || "—"} />
                            {business.socials.length > 0 && (
                                <DetailRow
                                    label="Socials"
                                    value={
                                        <span className="flex flex-col gap-1">
                                            {business.socials.map((s) => (
                                                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline break-all">
                                                    {s.platform ? `${s.platform}: ` : ""}
                                                    {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                                                </a>
                                            ))}
                                        </span>
                                    }
                                />
                            )}
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Building2, CheckCircle2, ExternalLink, Loader2, Plus, Search, ToggleRight, UserPlus, X } from "lucide-react";
import { businessesService } from "../services/businesses.service";
import { experiencesAdminService } from "../services/experiences-admin.service";
import { useDebouncedValue } from "../hooks";
import { FeatureChips, Field, LoadingButtonIcon, Modal, StatusPill, btnPrimary, btnSecondary, btnSmNeutral, inputClass } from "./CollabsUi";
import { OBJECT_ID_RE, featuresOf, partnerPortalUrl } from "../utils";
import type { AdminBusiness, AdminExperience, SetupHostResult } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPERIENCES_OFF_RE = /experiences are turned off/i;

const monoInputClass = `${inputClass} font-mono`;

/** Opens in a new tab; staff land in the Partner Portal's admin view of the business. */
function PartnerPortalLink({ businessId, experienceId, label = "Open in Partner Portal" }: { businessId: string; experienceId?: string; label?: string }) {
    return (
        <a href={partnerPortalUrl(businessId, experienceId)} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
            <ExternalLink className="w-4 h-4" />
            {label}
        </a>
    );
}

function invalidateExperienceQueries(queryClient: ReturnType<typeof useQueryClient>, businessId?: string) {
    queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
    queryClient.invalidateQueries({ queryKey: ["collabs-businesses"] });
    queryClient.invalidateQueries({ queryKey: ["experience-host-businesses"] });
    if (businessId) queryClient.invalidateQueries({ queryKey: ["collabs-business", businessId] });
}

// ── Set up a host ──────────────────────────────────────────

/**
 * Like "Provision creator": paste a User ID, Business ID or email. A business
 * gets Experiences switched on; a user gets it on their newest business, or a
 * new business they own (Experiences on, Collabs off).
 */
export function SetupHostModal({
    open,
    onClose,
    onNewExperience,
}: {
    open: boolean;
    onClose: () => void;
    onNewExperience: (business: AdminBusiness) => void;
}) {
    const queryClient = useQueryClient();
    const [ref, setRef] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [result, setResult] = useState<SetupHostResult | null>(null);

    useEffect(() => {
        if (open) {
            setRef("");
            setBusinessName("");
            setResult(null);
        }
    }, [open]);

    const trimmed = ref.trim();
    const valid = OBJECT_ID_RE.test(trimmed) || EMAIL_RE.test(trimmed);

    const setup = useMutation({
        mutationFn: () => experiencesAdminService.setupHost({ id: trimmed, business_name: businessName }),
        onSuccess: (res) => {
            const name = res.business.name;
            if (res.created) toast.success(`Created ${name} with Experiences on`);
            else if (res.already_enabled) toast.success(`Experiences was already on for ${name}`);
            else toast.success(`Experiences turned on for ${name}`);
            setResult(res);
            invalidateExperienceQueries(queryClient, res.business.id);
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't set up the host"),
    });

    const close = () => !setup.isPending && onClose();
    const business = result?.business;
    const others = (result?.businesses?.length ?? 0) - 1;

    return (
        <Modal
            open={open}
            onClose={close}
            title="Set up an Experiences host"
            icon={UserPlus}
            size="lg"
            footer={
                business ? (
                    <>
                        <button type="button" onClick={onClose} className={btnSecondary}>
                            Done
                        </button>
                        <button type="button" onClick={() => onNewExperience(business)} className={btnPrimary}>
                            <Plus className="w-4 h-4" /> New experience
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={close} disabled={setup.isPending} className={btnSecondary}>
                            Cancel
                        </button>
                        <button type="button" onClick={() => setup.mutate()} disabled={!valid || setup.isPending} className={btnPrimary}>
                            <LoadingButtonIcon loading={setup.isPending} icon={UserPlus} />
                            {setup.isPending ? "Setting up..." : "Set up host"}
                        </button>
                    </>
                )
            }
        >
            {business ? (
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 rounded-control border border-good-line bg-good-soft/60">
                        <CheckCircle2 className="w-5 h-5 text-good shrink-0 mt-0.5" />
                        <div className="min-w-0 text-sm text-ink-muted space-y-1">
                            <p className="font-semibold text-ink">
                                {result?.created ? `Created ${business.name} with Experiences on` : `Experiences is on for ${business.name}`}
                            </p>
                            {result?.created && <p>They're the owner and can sign in to the Partner Portal with their SeekKrr account.</p>}
                            {others > 0 && (
                                <p className="text-xs text-ink-muted">
                                    They own {others + 1} businesses; Experiences was turned on for the newest one.
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <StatusPill status={business.status} />
                                <FeatureChips business={business} />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link to={`/collabs/businesses/${business.id}`} className={btnSmNeutral} onClick={onClose}>
                            <Building2 className="w-3.5 h-3.5" /> Open business
                        </Link>
                        <a href={partnerPortalUrl(business.id)} target="_blank" rel="noopener noreferrer" className={btnSmNeutral}>
                            <ExternalLink className="w-3.5 h-3.5" /> Open in Partner Portal
                        </a>
                    </div>
                </div>
            ) : (
                <>
                    <p className="text-sm text-ink-muted leading-relaxed">
                        Turns on Experiences for a business. With a user, it uses the newest business they own, or creates one with them as the owner
                        (Experiences on, Collabs off).
                    </p>
                    <Field label="User ID, Business ID or email" htmlFor="host-ref" required>
                        <input
                            id="host-ref"
                            type="text"
                            value={ref}
                            onChange={(e) => setRef(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && valid && !setup.isPending && setup.mutate()}
                            placeholder="Paste a User ID, Business ID or email"
                            className={
                                trimmed && !valid
                                    ? monoInputClass.replace("border-line", "border-bad-line").replace("bg-surface", "bg-bad-soft")
                                    : monoInputClass
                            }
                            disabled={setup.isPending}
                            autoFocus
                        />
                        {trimmed && !valid && <p className="mt-1 text-xs text-bad">Must be a 24-character ID or an email address</p>}
                    </Field>
                    <Field label="Business name (for a new business)" htmlFor="host-business-name" hint="Optional. Defaults to “<first name>'s Experiences”.">
                        <input
                            id="host-business-name"
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            maxLength={150}
                            placeholder="e.g. Mountain Yoga Retreats"
                            className={inputClass}
                            disabled={setup.isPending}
                        />
                    </Field>
                </>
            )}
        </Modal>
    );
}

// ── Business picker (paste an ID or search) ────────────────

/** Text box for a Business ID; typing a name searches businesses with Experiences on. */
function BusinessIdPicker({
    value,
    onChange,
    disabled,
}: {
    /** The raw text (a picked or pasted id once valid). */
    value: string;
    onChange: (text: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const isId = OBJECT_ID_RE.test(value.trim());
    const q = useDebouncedValue(isId ? "" : value, 300);

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    const search = useQuery({
        queryKey: ["experience-host-businesses", q],
        queryFn: () => businessesService.list({ experiences: true, search: q || undefined, page_size: 8 }),
        enabled: open && !isId && !disabled,
        staleTime: 30_000,
    });
    // Older backends ignore the `experiences` filter; keep only businesses with it on.
    const results = (search.data?.businesses ?? []).filter((b) => featuresOf(b).experiences);

    return (
        <div ref={boxRef} className="relative">
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                <input
                    id="new-exp-business"
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder="Paste a Business ID or search by name"
                    className={`${inputClass} pl-10 pr-10 ${isId ? "font-mono" : ""}`}
                    disabled={disabled}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open && !isId}
                    aria-controls="new-exp-business-list"
                />
                {search.isFetching ? (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-500 animate-spin" />
                ) : (
                    value && (
                        <button
                            type="button"
                            onClick={() => onChange("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                            aria-label="Clear business"
                            disabled={disabled}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )
                )}
            </div>
            {open && !isId && !disabled && (
                <ul
                    id="new-exp-business-list"
                    role="listbox"
                    className="absolute left-0 right-0 top-full mt-1.5 z-10 bg-surface border border-line rounded-control shadow-xl max-h-64 overflow-y-auto divide-y divide-line"
                >
                    {search.isError && <li className="px-4 py-3 text-xs text-bad">Couldn't load businesses. Paste the ID instead.</li>}
                    {!search.isError && !search.isFetching && results.length === 0 && (
                        <li className="px-4 py-3 text-xs text-ink-muted">
                            {q ? `No business with Experiences on matches “${q}”.` : "No businesses have Experiences on yet."} Use “Set up a host” first, or
                            paste a Business ID.
                        </li>
                    )}
                    {results.map((b) => (
                        <li key={b.id} role="option" aria-selected={b.id === value.trim()}>
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(b.id);
                                    setOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent-50/60 transition-colors"
                            >
                                <Building2 className="w-4 h-4 text-accent-600 shrink-0" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-ink truncate">{b.name}</span>
                                    <span className="block font-mono text-[11px] text-ink-faint truncate">{b.id}</span>
                                </span>
                                <StatusPill status={b.status} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** Name, status and switches of the picked business (so a turned-off switch shows before submitting). */
function PickedBusiness({ businessId, onTurnOn, turningOn }: { businessId: string; onTurnOn: () => void; turningOn: boolean }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ["collabs-business", businessId],
        queryFn: () => businessesService.getById(businessId),
        staleTime: 30_000,
        retry: false,
    });
    if (isLoading) return <p className="text-xs text-ink-muted flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up the business…</p>;
    if (error || !data) return <p className="text-xs text-bad">{error instanceof Error ? error.message : "Business not found"}</p>;
    const on = featuresOf(data).experiences;
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            <span className="font-medium text-ink">{data.name}</span>
            <StatusPill status={data.status} />
            <FeatureChips business={data} />
            {!on && (
                <button type="button" onClick={onTurnOn} disabled={turningOn} className={btnSmNeutral}>
                    <LoadingButtonIcon loading={turningOn} icon={ToggleRight} /> Turn on Experiences
                </button>
            )}
        </div>
    );
}

// ── New experience ─────────────────────────────────────────

/**
 * Starts a draft experience on any business (staff act as its owner), then
 * hands off to the Partner Portal for photos, sections and slots.
 */
export function NewExperienceModal({
    open,
    onClose,
    initialBusinessId,
    onShowInList,
}: {
    open: boolean;
    onClose: () => void;
    initialBusinessId?: string;
    /** Filter the Experiences table down to this business. */
    onShowInList: (businessId: string) => void;
}) {
    const queryClient = useQueryClient();
    const [businessInput, setBusinessInput] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [experiencesOff, setExperiencesOff] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [created, setCreated] = useState<AdminExperience | null>(null);

    useEffect(() => {
        if (open) {
            setBusinessInput(initialBusinessId ?? "");
            setTitle("");
            setDescription("");
            setExperiencesOff(false);
            setError(null);
            setCreated(null);
        }
    }, [open, initialBusinessId]);

    const businessId = OBJECT_ID_RE.test(businessInput.trim()) ? businessInput.trim() : "";

    useEffect(() => {
        setExperiencesOff(false);
        setError(null);
    }, [businessId]);

    const create = useMutation({
        mutationFn: () => experiencesAdminService.create(businessId, { title, description }),
        onSuccess: (exp) => {
            toast.success(`Draft “${exp.title}” created`);
            setCreated(exp);
            setError(null);
            invalidateExperienceQueries(queryClient);
        },
        onError: (e: Error) => {
            const message = e.message || "Couldn't create the experience";
            setExperiencesOff(EXPERIENCES_OFF_RE.test(message));
            setError(message);
        },
    });

    const turnOn = useMutation({
        mutationFn: (_opts: { thenCreate: boolean }) => businessesService.update(businessId, { features: { experiences: true } }),
        onSuccess: (updated, { thenCreate }) => {
            queryClient.setQueryData(["collabs-business", businessId], {
                ...updated,
                features: { ...featuresOf(updated), experiences: true },
            });
            invalidateExperienceQueries(queryClient, businessId);
            toast.success(`Experiences turned on for ${updated.name}`);
            setExperiencesOff(false);
            setError(null);
            if (thenCreate && title.trim()) create.mutate();   // retry the create that was refused
        },
        onError: (e: Error) => toast.error(e.message || "Couldn't turn on Experiences"),
    });

    const busy = create.isPending || turnOn.isPending;
    const canSubmit = !!businessId && title.trim().length > 0 && !busy;
    const close = () => !busy && onClose();

    return (
        <Modal
            open={open}
            onClose={close}
            title={created ? "Experience created" : "New experience"}
            icon={created ? CheckCircle2 : Plus}
            size="lg"
            footer={
                created ? (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                onShowInList(created.business_id || businessId);
                                onClose();
                            }}
                            className={btnSecondary}
                        >
                            Show in the list
                        </button>
                        <PartnerPortalLink businessId={created.business_id || businessId} experienceId={created.id} />
                    </>
                ) : (
                    <>
                        <button type="button" onClick={close} disabled={busy} className={btnSecondary}>
                            Cancel
                        </button>
                        <button type="button" onClick={() => create.mutate()} disabled={!canSubmit} className={btnPrimary}>
                            <LoadingButtonIcon loading={create.isPending} icon={Plus} />
                            {create.isPending ? "Creating..." : "Create draft"}
                        </button>
                    </>
                )
            }
        >
            {created ? (
                <div className="space-y-3 text-sm text-ink-muted">
                    <p>
                        <strong>{created.title}</strong> is saved as a draft
                        {created.business?.name || created.business_name ? ` for ${created.business?.name || created.business_name}` : ""}. It isn't visible in
                        the app yet.
                    </p>
                    <p className="p-3 rounded-control bg-info-soft border border-info-line text-info">
                        Open in Partner Portal to finish (photos, sections, slots), then publish it there.
                    </p>
                </div>
            ) : (
                <>
                    <Field label="Business" htmlFor="new-exp-business" required hint="Businesses with Experiences on are listed; any Business ID works.">
                        <BusinessIdPicker value={businessInput} onChange={setBusinessInput} disabled={busy} />
                    </Field>
                    {businessId && (
                        <PickedBusiness businessId={businessId} onTurnOn={() => turnOn.mutate({ thenCreate: false })} turningOn={turnOn.isPending} />
                    )}
                    <Field label="Title" htmlFor="new-exp-title" required>
                        <input
                            id="new-exp-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={120}
                            placeholder="e.g. Sunrise Yoga by the Lake"
                            className={inputClass}
                            disabled={busy}
                        />
                    </Field>
                    <Field label="Short description" htmlFor="new-exp-description" hint="Optional. Shown under “At a Glance”; the rest is added in the Partner Portal.">
                        <textarea
                            id="new-exp-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={5000}
                            rows={3}
                            placeholder="What guests will do, in a sentence or two"
                            className={`${inputClass} resize-none`}
                            disabled={busy}
                        />
                    </Field>
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-control border border-bad-line bg-bad-soft text-sm text-bad">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <p>{error}</p>
                                {experiencesOff && (
                                    <button type="button" onClick={() => turnOn.mutate({ thenCreate: true })} disabled={busy} className={btnSmNeutral}>
                                        <LoadingButtonIcon loading={turnOn.isPending} icon={ToggleRight} /> Turn on Experiences and create
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}

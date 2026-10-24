import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, Save } from "lucide-react";
import { collabsAdminService } from "../services/collabs-admin.service";
import { isoToLocalInput, localInputToIso, fmtDateTime } from "../utils";
import { DetailRow, Field, LoadingButtonIcon, StatusPill, btnPrimary, btnSecondary, inputClass } from "./CollabsUi";
import { EntitlementsSummary, OverrideEntitlementsEditor } from "./EntitlementsEditor";
import type { EffectiveEntitlements, Entitlements, SubscriptionOverride } from "../types";

/**
 * Admin-only plan override for one business:
 * PUT /admin/collabs/subscriptions/{business_id}/override
 * {plan_code, entitlements, until, reason}. Sending neither a plan nor any
 * entitlement clears the override.
 */
export function OverridePanel({
    businessId,
    current,
    currentPlanCode,
    onSaved,
}: {
    businessId: string;
    /** The business's own plan, used for the "inherited" hints. */
    currentPlanCode?: string | null;
    /** Existing override when known (subscriptions list). */
    current?: SubscriptionOverride | null;
    onSaved?: (effective: EffectiveEntitlements) => void;
}) {
    const queryClient = useQueryClient();
    const plansQuery = useQuery({
        queryKey: ["collabs-plans"],
        queryFn: collabsAdminService.listPlans,
        staleTime: 5 * 60 * 1000,
    });

    const [planCode, setPlanCode] = useState("");
    const [entitlements, setEntitlements] = useState<Partial<Entitlements>>({});
    const [until, setUntil] = useState("");
    const [reason, setReason] = useState("");
    const [effective, setEffective] = useState<EffectiveEntitlements | null>(null);

    useEffect(() => {
        setEffective(null);
    }, [businessId]);

    useEffect(() => {
        setPlanCode(current?.plan_code ?? "");
        setEntitlements(current?.entitlements ?? {});
        setUntil(isoToLocalInput(current?.until));
        setReason(current?.reason ?? "");
    }, [current]);

    const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
    const basePlan = useMemo(() => plans.find((p) => p.code === (planCode || currentPlanCode || "free")), [plans, planCode, currentPlanCode]);
    const isClearing = !planCode && Object.keys(entitlements).length === 0;

    const mutation = useMutation({
        mutationFn: (clear: boolean) =>
            collabsAdminService.setOverride(
                businessId,
                clear
                    ? { plan_code: null, entitlements: null, until: null, reason: null }
                    : {
                          plan_code: planCode || null,
                          entitlements: Object.keys(entitlements).length ? entitlements : null,
                          until: localInputToIso(until),
                          reason: reason.trim() || null,
                      }
            ),
        onSuccess: (eff, clear) => {
            setEffective(eff);
            if (clear) {
                setPlanCode("");
                setEntitlements({});
                setUntil("");
                setReason("");
            }
            toast.success(clear ? "Override cleared" : "Override saved");
            queryClient.invalidateQueries({ queryKey: ["collabs-subscriptions"] });
            onSaved?.(eff);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to save override"),
    });

    return (
        <div className="space-y-4">
            {current && (
                <div className="p-3 rounded-control bg-warn-soft border border-warn-line text-xs text-warn space-y-1">
                    <p className="font-semibold">Override active</p>
                    <p>
                        Plan: {current.plan_code ?? "unchanged"} · Until: {current.until ? fmtDateTime(current.until) : "no expiry"}
                        {current.reason ? ` · ${current.reason}` : ""}
                    </p>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Plan" htmlFor={`ovr-plan-${businessId}`} hint="Leave as “Keep plan” to only override limits.">
                    <select
                        id={`ovr-plan-${businessId}`}
                        value={planCode}
                        onChange={(e) => setPlanCode(e.target.value)}
                        className={inputClass}
                        disabled={plansQuery.isLoading}
                    >
                        <option value="">Keep plan</option>
                        {plans.map((p) => (
                            <option key={p.code} value={p.code}>
                                {p.name ?? p.code} ({p.code})
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Until" htmlFor={`ovr-until-${businessId}`} hint="Empty = until removed.">
                    <input
                        id={`ovr-until-${businessId}`}
                        type="datetime-local"
                        value={until}
                        onChange={(e) => setUntil(e.target.value)}
                        className={inputClass}
                    />
                </Field>
            </div>
            <Field label="Entitlement overrides">
                <OverrideEntitlementsEditor value={entitlements} onChange={setEntitlements} base={basePlan?.entitlements} />
            </Field>
            <Field label="Reason" htmlFor={`ovr-reason-${businessId}`} hint="Recorded on the subscription for audit.">
                <input
                    id={`ovr-reason-${businessId}`}
                    type="text"
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Bir pilot partner — Pro free until March"
                />
            </Field>
            <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => mutation.mutate(true)} disabled={mutation.isPending} className={btnSecondary}>
                    <LoadingButtonIcon loading={mutation.isPending && mutation.variables === true} icon={Eraser} />
                    Clear override
                </button>
                <button type="button" onClick={() => mutation.mutate(isClearing)} disabled={mutation.isPending} className={btnPrimary}>
                    <LoadingButtonIcon loading={mutation.isPending && mutation.variables !== true} icon={Save} />
                    {isClearing ? "Save (clears override)" : "Save override"}
                </button>
            </div>
            {effective && (
                <div className="p-4 rounded-control border border-accent-200 bg-accent-50/40 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">Effective now</p>
                    <DetailRow label="Plan" value={effective.plan_code} />
                    <DetailRow label="Status" value={<StatusPill status={effective.status} />} />
                    <DetailRow label="Override until" value={effective.override_until ? fmtDateTime(effective.override_until) : "—"} />
                    <DetailRow label="Entitlements" value={<EntitlementsSummary value={effective.entitlements} />} />
                </div>
            )}
        </div>
    );
}

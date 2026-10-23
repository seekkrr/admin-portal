import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { stepRewardsService } from "../services/step-rewards.service";
import type { CreateStepRewardPayload, StepReward, StepRewardContextType, UpdateStepRewardPayload } from "@/types";
import { BonusConditionsEditor } from "./BonusConditionsEditor";
import { buildBonusConditions, CONTEXT_OPTIONS, contextTarget, EMPTY_REWARD_FORM, rewardToForm, splitList, type StepRewardForm } from "./stepRewardForm";

/** The context id input: a search picker for quests and places, a text box otherwise. */
export function ContextIdInput({
    id,
    contextType,
    value,
    onChange,
    disabled,
}: {
    id?: string;
    contextType: StepRewardContextType;
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
}) {
    const target = contextTarget(contextType);
    if (target.search) {
        return <EntityPicker id={id} type={target.search} label={target.label} value={value} onChange={(v) => onChange(v)} disabled={disabled} />;
    }
    return (
        <TextInput
            id={id}
            type="text"
            className="font-mono"
            placeholder={target.label}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

/** Create a step reward (reward === null) or edit one (context can't change). */
export function StepRewardFormModal({ open, reward, onClose }: { open: boolean; reward: StepReward | null; onClose: () => void }) {
    const queryClient = useQueryClient();
    const editId = reward?._id ?? null;
    const [form, setForm] = useState<StepRewardForm>(EMPTY_REWARD_FORM);
    const set = (patch: Partial<StepRewardForm>) => setForm((f) => ({ ...f, ...patch }));

    useEffect(() => {
        if (!open) return;
        if (!reward) {
            setForm(EMPTY_REWARD_FORM);
            return;
        }
        // Seed from the row, then refetch so the form reflects the latest server state.
        setForm(rewardToForm(reward));
        let cancelled = false;
        stepRewardsService
            .getById(reward._id)
            .then((fresh) => {
                if (!cancelled) setForm(rewardToForm(fresh));
            })
            .catch(() => {
                // Keep the row-seeded form if the refetch fails.
            });
        return () => {
            cancelled = true;
        };
    }, [open, reward]);

    const createMutation = useMutation({
        mutationFn: (payload: CreateStepRewardPayload) => stepRewardsService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-step-rewards"] });
            toast.success("Step reward created");
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create step reward"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateStepRewardPayload }) => stepRewardsService.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-step-rewards"] });
            toast.success("Step reward updated");
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update step reward"),
    });

    const isPending = createMutation.isPending || updateMutation.isPending;
    const target = contextTarget(form.context_type);

    const submit = () => {
        if (!form.context_id.trim()) {
            toast.error(`${target.label} is required`);
            return;
        }
        const common = {
            base_points: Number(form.base_points) || 0,
            bonus_conditions: buildBonusConditions(form.bonus_conditions),
            unlocked_badges: splitList(form.unlocked_badges),
            unlocked_content: splitList(form.unlocked_content),
        };
        if (editId) updateMutation.mutate({ id: editId, payload: common });
        else createMutation.mutate({ context_type: form.context_type, context_id: form.context_id.trim(), ...common });
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!isPending}
            title={editId ? "Edit step reward" : "New step reward"}
            icon={Gift}
            size="2xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={submit} loading={isPending}>
                        {editId ? "Save" : "Create"}
                    </Button>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Context" required>
                    <SelectInput
                        value={form.context_type}
                        disabled={!!editId}
                        onChange={(e) => set({ context_type: e.target.value as StepRewardContextType, context_id: "" })}
                        options={CONTEXT_OPTIONS}
                    />
                </Field>
                <Field label="Base points" required>
                    <TextInput type="number" inputMode="numeric" value={form.base_points} onChange={(e) => set({ base_points: e.target.value })} />
                </Field>
            </div>
            <Field label={target.label} required htmlFor="reward-context-id" hint={editId ? "The context can't be changed after creation." : undefined}>
                <ContextIdInput id="reward-context-id" contextType={form.context_type} value={form.context_id} onChange={(v) => set({ context_id: v })} disabled={!!editId} />
            </Field>

            <BonusConditionsEditor rows={form.bonus_conditions} onChange={(rows) => set({ bonus_conditions: rows })} />

            <Field label="Unlocked badges" hint="Comma-separated.">
                <TextInput type="text" value={form.unlocked_badges} onChange={(e) => set({ unlocked_badges: e.target.value })} />
            </Field>
            <Field label="Unlocked content" hint="Comma-separated.">
                <TextInput type="text" value={form.unlocked_content} onChange={(e) => set({ unlocked_content: e.target.value })} />
            </Field>
        </Modal>
    );
}

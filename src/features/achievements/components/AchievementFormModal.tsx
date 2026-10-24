import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { achievementsService } from "../services/achievements.service";
import type { Achievement, AchievementRarity, AchievementTriggerType, CreateAchievementPayload, UpdateAchievementPayload } from "@/types";
import {
    buildAchievementCreate,
    buildAchievementUpdate,
    EMPTY_ACHIEVEMENT_FORM,
    RARITY_OPTIONS,
    readNumbers,
    toAchievementForm,
    TRIGGER_OPTIONS,
    triggerLabel,
    type AchievementForm,
} from "./achievementForm";

/** Create an achievement (achievement === null) or edit one. The trigger type can't change after creation. */
export function AchievementFormModal({ open, achievement, onClose }: { open: boolean; achievement: Achievement | null; onClose: () => void }) {
    const queryClient = useQueryClient();
    const editId = achievement?._id ?? null;
    const [form, setForm] = useState<AchievementForm>(EMPTY_ACHIEVEMENT_FORM);
    const set = (patch: Partial<AchievementForm>) => setForm((f) => ({ ...f, ...patch }));

    useEffect(() => {
        if (open) setForm(achievement ? toAchievementForm(achievement) : EMPTY_ACHIEVEMENT_FORM);
    }, [open, achievement]);

    const createMutation = useMutation({
        mutationFn: (payload: CreateAchievementPayload) => achievementsService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            toast.success("Achievement created");
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create achievement"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateAchievementPayload }) => achievementsService.update(id, payload),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ["admin-achievements"] });
            queryClient.invalidateQueries({ queryKey: ["achievement-detail", id] });
            toast.success("Achievement updated");
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update achievement"),
    });

    const isPending = createMutation.isPending || updateMutation.isPending;

    const submit = () => {
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        const nums = readNumbers(form);
        if ("error" in nums) {
            toast.error(nums.error);
            return;
        }
        if (editId) updateMutation.mutate({ id: editId, payload: buildAchievementUpdate(form, nums.threshold, nums.points) });
        else createMutation.mutate(buildAchievementCreate(form, nums.threshold, nums.points));
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!isPending}
            title={editId ? "Edit achievement" : "New achievement"}
            icon={Trophy}
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={submit} loading={isPending}>
                        {editId ? "Save changes" : "Create"}
                    </Button>
                </>
            }
        >
            <Field label="Title" required>
                <TextInput type="text" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Description">
                <TextArea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Trigger type" required hint={editId ? "Can't be changed after creation." : undefined}>
                    {editId ? (
                        <TextInput type="text" value={triggerLabel(form.trigger_type)} readOnly disabled />
                    ) : (
                        <SelectInput value={form.trigger_type} onChange={(e) => set({ trigger_type: e.target.value as AchievementTriggerType })} options={TRIGGER_OPTIONS} />
                    )}
                </Field>
                <Field label="Trigger threshold" required>
                    <TextInput type="number" inputMode="numeric" value={form.trigger_threshold} onChange={(e) => set({ trigger_threshold: e.target.value })} />
                </Field>
                <Field label="Reward points">
                    <TextInput type="number" inputMode="numeric" value={form.rewards_points} onChange={(e) => set({ rewards_points: e.target.value })} />
                </Field>
                <Field label="Rarity">
                    <SelectInput value={form.rarity} onChange={(e) => set({ rarity: e.target.value as AchievementRarity })} options={RARITY_OPTIONS} />
                </Field>
            </div>
            <Field label="Icon URL">
                <TextInput type="url" className="font-mono" value={form.icon_url} onChange={(e) => set({ icon_url: e.target.value })} />
            </Field>
            <Field label="Perks" hint="Comma-separated, e.g. Early access, Bonus XP.">
                <TextInput type="text" value={form.perks} onChange={(e) => set({ perks: e.target.value })} />
            </Field>
            <Checkbox checked={form.is_active} onChange={(v) => set({ is_active: v })} label="Active" />
        </Modal>
    );
}

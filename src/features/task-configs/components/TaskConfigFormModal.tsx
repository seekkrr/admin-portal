import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { taskConfigsService } from "../services/task-configs.service";
import type { CreateTaskConfigPayload, TaskConfig, TaskConfigType, UpdateTaskConfigPayload } from "@/types";
import { buildCreatePayload, buildUpdatePayload, EMPTY_TASK_FORM, TASK_TYPE_OPTIONS, taskConfigToForm, type TaskConfigForm } from "./taskConfigForm";

/** The type-specific block (quiz / QR / photo) inside the task form. */
function TypeSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <fieldset className="space-y-4 rounded-card border border-line bg-surface-muted p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</legend>
            {children}
        </fieldset>
    );
}

/**
 * Create a task config (task === null) or edit one. Editing first shows the
 * list row, then loads the /full record so the answer keys prefill — otherwise
 * saving would clear the stored quiz answer / QR value.
 */
export function TaskConfigFormModal({ open, task, onClose }: { open: boolean; task: TaskConfig | null; onClose: () => void }) {
    const queryClient = useQueryClient();
    const editId = task?._id ?? null;
    const [form, setForm] = useState<TaskConfigForm>(EMPTY_TASK_FORM);
    const set = (patch: Partial<TaskConfigForm>) => setForm((f) => ({ ...f, ...patch }));

    useEffect(() => {
        if (!open) return;
        if (!task) {
            setForm(EMPTY_TASK_FORM);
            return;
        }
        setForm(taskConfigToForm(task));
        let cancelled = false;
        taskConfigsService
            .getFull(task._id)
            .then((full) => {
                if (!cancelled) setForm(taskConfigToForm(full));
            })
            .catch(() => {
                // Fall back to the public-dict form; answer fields may be blank.
            });
        return () => {
            cancelled = true;
        };
    }, [open, task]);

    const createMutation = useMutation({
        mutationFn: (payload: CreateTaskConfigPayload) => taskConfigsService.create(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            toast.success("Task config created");
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create task config"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateTaskConfigPayload }) => taskConfigsService.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-task-configs"] });
            queryClient.invalidateQueries({ queryKey: ["task-config-detail"] });
            toast.success("Task config updated");
            onClose();
        },
        onError: (e: Error) => toast.error(e.message || "Failed to update task config"),
    });

    const isPending = createMutation.isPending || updateMutation.isPending;

    const submit = () => {
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (!form.marker_id.trim()) {
            toast.error("Choose the place this task belongs to");
            return;
        }
        if (editId) updateMutation.mutate({ id: editId, payload: buildUpdatePayload(form) });
        else createMutation.mutate(buildCreatePayload(form));
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!isPending}
            title={editId ? "Edit task config" : "New task config"}
            icon={Settings2}
            size="2xl"
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
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                {editId && <p className="rounded-control border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn">Task type, place and quest can't be changed after creation.</p>}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Task type" required>
                        <SelectInput
                            value={form.task_type}
                            disabled={!!editId}
                            onChange={(e) => set({ task_type: e.target.value as TaskConfigType })}
                            options={TASK_TYPE_OPTIONS}
                        />
                    </Field>
                    <Field label="Base points">
                        <TextInput type="number" inputMode="numeric" value={form.base_points} onChange={(e) => set({ base_points: e.target.value })} />
                    </Field>
                </div>
                <Field label="Title" required>
                    <TextInput type="text" value={form.title} onChange={(e) => set({ title: e.target.value })} />
                </Field>
                <Field label="Description">
                    <TextArea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
                </Field>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Place" required htmlFor="task-place">
                        <EntityPicker id="task-place" type="place" label="Place" value={form.marker_id} onChange={(id) => set({ marker_id: id })} disabled={!!editId} />
                    </Field>
                    <Field label={<>Quest <span className="font-normal text-ink-faint">(optional)</span></>} htmlFor="task-quest">
                        <EntityPicker id="task-quest" type="quest" label="Quest" value={form.quest_id} onChange={(id) => set({ quest_id: id })} disabled={!!editId} />
                    </Field>
                </div>

                {form.task_type === "quiz" && (
                    <TypeSection title="Quiz">
                        <Field label="Question">
                            <TextInput type="text" value={form.quiz_question} onChange={(e) => set({ quiz_question: e.target.value })} />
                        </Field>
                        <Field label="Options" hint="One per line.">
                            <TextArea rows={3} value={form.quiz_options} onChange={(e) => set({ quiz_options: e.target.value })} />
                        </Field>
                        <Field label="Correct answer">
                            <TextInput type="text" value={form.quiz_correct_answer} onChange={(e) => set({ quiz_correct_answer: e.target.value })} />
                        </Field>
                    </TypeSection>
                )}

                {form.task_type === "qr_scan" && (
                    <TypeSection title="QR code">
                        <Field label="Expected value">
                            <TextInput type="text" value={form.qr_expected_value} onChange={(e) => set({ qr_expected_value: e.target.value })} />
                        </Field>
                    </TypeSection>
                )}

                {form.task_type === "photo_challenge" && (
                    <TypeSection title="Photo requirements">
                        <Field label="Minimum photos">
                            <TextInput
                                type="number"
                                inputMode="numeric"
                                min={1}
                                placeholder="e.g. 1"
                                value={form.photo_min_photos}
                                onChange={(e) => set({ photo_min_photos: e.target.value })}
                            />
                        </Field>
                    </TypeSection>
                )}

                <Checkbox checked={form.is_active} onChange={(v) => set({ is_active: v })} label="Active" />
                <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
        </Modal>
    );
}

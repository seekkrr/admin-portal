import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, TextInput } from "@/components/ui/Field";
import { calendarDate } from "@/components/detail/detailFormat";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { ExperienceDetail, ExperienceSlot, SlotPatch } from "@/types/admin-detail";
import { PriceReadOnly } from "./AddSlotsDrawer";

/** Change one slot's spots or time (booked slots keep their time; spots never below what's booked). */
export function EditSlotModal({
    experience,
    slot,
    onClose,
    onSaved,
}: {
    experience: ExperienceDetail;
    slot: ExperienceSlot;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [edit, setEdit] = useState({ capacity: String(slot.capacity), start: slot.start_time, end: slot.end_time });
    const options = experience.options ?? [];
    const price = slot.price ?? options.find((o) => o.id === slot.option_id)?.price ?? experience.price_per_person ?? null;

    const patch = ((): SlotPatch | null => {
        const out: SlotPatch = {};
        const cap = Number.parseInt(edit.capacity, 10);
        if (!Number.isFinite(cap) || cap < 1) return null;
        if (cap !== slot.capacity) out.capacity = cap;
        if (edit.start !== slot.start_time || edit.end !== slot.end_time) {
            if (!edit.start || !edit.end || edit.end <= edit.start) return null;
            out.start_time = edit.start;
            out.end_time = edit.end;
        }
        return out;
    })();

    const save = useMutation({
        mutationFn: () => experienceDetailApi.updateSlot(experience.business_id, slot.id, patch ?? {}),
        onSuccess: () => {
            toast.success("Slot saved");
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <Modal
            open
            onClose={onClose}
            dismissible={!save.isPending}
            title="Edit slot"
            description={`${calendarDate(slot.date)} · ${slot.booked} booked`}
            icon={Pencil}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" disabled={!patch || Object.keys(patch).length === 0} loading={save.isPending} onClick={() => save.mutate()}>
                        Save slot
                    </Button>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-3">
                <Field label="Spots" hint={slot.booked ? `At least ${slot.booked} (already booked).` : undefined}>
                    <TextInput type="number" min={Math.max(1, slot.booked)} inputMode="numeric" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} />
                </Field>
                <PriceReadOnly label="Price" price={price} />
                <Field label="Starts" hint={slot.booked ? "Booked slots keep their time." : undefined}>
                    <TextInput type="time" value={edit.start} disabled={slot.booked > 0} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
                </Field>
                <Field label="Ends">
                    <TextInput type="time" value={edit.end} disabled={slot.booked > 0} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
                </Field>
            </div>
        </Modal>
    );
}

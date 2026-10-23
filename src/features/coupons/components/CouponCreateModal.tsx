import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, SelectInput, TextInput } from "@/components/ui/Field";
import { EntityPicker } from "@/components/ui/EntityPicker";
import { couponsService } from "../services/coupons.service";
import type { CouponDiscountType, CouponLinkItem, CreateCouponPayload } from "@/types";

interface CouponCreateModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: (id: string) => void;
}

const DISCOUNT_TYPES: { value: CouponDiscountType; label: string }[] = [
    { value: "flat", label: "Flat amount" },
    { value: "percent", label: "Percent" },
    { value: "percent_range", label: "Percent range" },
];

const FORM_ID = "coupon-create-form";

export function CouponCreateModal({ open, onClose, onSuccess }: CouponCreateModalProps) {
    const queryClient = useQueryClient();

    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [discountType, setDiscountType] = useState<CouponDiscountType>("flat");
    const [discountValue, setDiscountValue] = useState("");
    const [discountMin, setDiscountMin] = useState("");
    const [discountMax, setDiscountMax] = useState("");
    const [linkItem, setLinkItem] = useState<CouponLinkItem>("all");
    const [linkId, setLinkId] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [perUserLimit, setPerUserLimit] = useState("1");
    const [maxRedemptions, setMaxRedemptions] = useState("");
    const [isActive, setIsActive] = useState(true);

    // A fresh form every time it opens.
    useEffect(() => {
        if (!open) return;
        setName("");
        setCode("");
        setDiscountType("flat");
        setDiscountValue("");
        setDiscountMin("");
        setDiscountMax("");
        setLinkItem("all");
        setLinkId("");
        setExpiresAt("");
        setPerUserLimit("1");
        setMaxRedemptions("");
        setIsActive(true);
    }, [open]);

    const createMutation = useMutation({
        mutationFn: (payload: CreateCouponPayload) => couponsService.create(payload),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon created");
            onClose();
            if (onSuccess) onSuccess(created._id);
        },
        onError: (e: Error) => toast.error(e.message || "Failed to create coupon"),
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        const trimmedName = name.trim();
        const trimmedCode = code.trim();
        if (!trimmedName) {
            toast.error("Name is required");
            return;
        }
        if (!trimmedCode) {
            toast.error("Code is required");
            return;
        }

        const payload: CreateCouponPayload = {
            name: trimmedName,
            code: trimmedCode,
            discount_type: discountType,
            link_item: linkItem,
            is_active: isActive,
        };

        if (discountType === "flat" || discountType === "percent") {
            const value = Number(discountValue);
            if (discountValue.trim() === "" || !Number.isFinite(value) || value <= 0) {
                toast.error("Discount value is required and must be greater than 0");
                return;
            }
            payload.discount_value = value;
        } else {
            const min = Number(discountMin);
            const max = Number(discountMax);
            if (discountMin.trim() === "" || discountMax.trim() === "" || !Number.isFinite(min) || !Number.isFinite(max)) {
                toast.error("Min and max discount are both required for a percent range");
                return;
            }
            if (min > max) {
                toast.error("Min discount cannot exceed max discount");
                return;
            }
            payload.discount_min = min;
            payload.discount_max = max;
        }

        if (linkItem === "quest") {
            if (!linkId.trim()) {
                toast.error("Select a quest to link this coupon to");
                return;
            }
            payload.link_id = linkId.trim();
        }

        if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();

        const limit = Number(perUserLimit);
        if (perUserLimit.trim() !== "" && Number.isFinite(limit) && limit > 0) {
            payload.per_user_limit = Math.trunc(limit);
        }

        if (maxRedemptions.trim() !== "") {
            const max = Number(maxRedemptions);
            if (!Number.isFinite(max) || max <= 0) {
                toast.error("Max redemptions must be a positive number");
                return;
            }
            payload.max_redemptions = Math.trunc(max);
        }

        createMutation.mutate(payload);
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            dismissible={!createMutation.isPending}
            icon={Tag}
            title="New coupon"
            size="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={createMutation.isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" form={FORM_ID} variant="primary" loading={createMutation.isPending}>
                        Create coupon
                    </Button>
                </>
            }
        >
            <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
                <Field label="Name" required>
                    <TextInput required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monsoon launch offer" />
                </Field>

                <Field label="Code" required>
                    <TextInput
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="font-mono uppercase tracking-wider"
                        placeholder="e.g. MONSOON25"
                        autoComplete="off"
                    />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Discount type" required>
                        <SelectInput value={discountType} onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)} options={DISCOUNT_TYPES} />
                    </Field>

                    {discountType !== "percent_range" ? (
                        <Field label={discountType === "flat" ? "Amount off" : "Percent off"} required>
                            <TextInput type="number" min={0} step="0.01" required value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                        </Field>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Min %" required>
                                <TextInput type="number" min={0} step="0.01" required value={discountMin} onChange={(e) => setDiscountMin(e.target.value)} />
                            </Field>
                            <Field label="Max %" required>
                                <TextInput type="number" min={0} step="0.01" required value={discountMax} onChange={(e) => setDiscountMax(e.target.value)} />
                            </Field>
                        </div>
                    )}
                </div>

                <Field label="Applies to" required>
                    <SelectInput
                        value={linkItem}
                        onChange={(e) => {
                            setLinkItem(e.target.value as CouponLinkItem);
                            setLinkId("");
                        }}
                    >
                        <option value="all">All quests</option>
                        <option value="quest">A specific quest</option>
                    </SelectInput>
                </Field>

                {linkItem === "quest" && (
                    <Field label="Quest" htmlFor="coupon-link-quest" required>
                        <EntityPicker id="coupon-link-quest" type="quest" label="Quest" value={linkId} onChange={(id) => setLinkId(id)} />
                    </Field>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Expires at" hint="Optional — never expires when blank.">
                        <TextInput type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                    </Field>
                    <Field label="Per-user limit">
                        <TextInput type="number" min={1} value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} />
                    </Field>
                </div>

                <Field label="Max total redemptions" hint="Leave blank for unlimited.">
                    <TextInput type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
                </Field>

                <Checkbox checked={isActive} onChange={setIsActive} label="Active" hint="People can use it straight away." />
            </form>
        </Modal>
    );
}

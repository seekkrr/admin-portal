import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { couponsService } from "../services/coupons.service";
import { questsService } from "@/features/quests/services/quests.service";
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

const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent";

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

    // Quest picker — only fetched when a specific quest link is needed.
    const questsQuery = useQuery({
        queryKey: ["admin-quests-picker"],
        queryFn: () => questsService.listQuests({ per_page: 100 }),
        enabled: open && linkItem === "quest",
        staleTime: 5 * 60 * 1000,
    });

    const reset = () => {
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
        onClose();
    };

    const createMutation = useMutation({
        mutationFn: (payload: CreateCouponPayload) => couponsService.create(payload),
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
            toast.success("Coupon created");
            reset();
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
            if (
                discountMin.trim() === "" ||
                discountMax.trim() === "" ||
                !Number.isFinite(min) ||
                !Number.isFinite(max)
            ) {
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

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-neutral-200">
                    <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-violet-100 text-violet-600">
                            <Tag className="w-4 h-4" />
                        </span>
                        New Coupon
                    </h3>
                    <button
                        onClick={reset}
                        disabled={createMutation.isPending}
                        className="p-1.5 rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors disabled:opacity-50"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label htmlFor="coupon-name" className="block text-sm font-medium text-neutral-700 mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="coupon-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputClass}
                            placeholder="e.g. Monsoon Launch Offer"
                        />
                    </div>

                    <div>
                        <label htmlFor="coupon-code" className="block text-sm font-medium text-neutral-700 mb-1">
                            Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="coupon-code"
                            type="text"
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className={`${inputClass} font-mono uppercase tracking-wider`}
                            placeholder="e.g. MONSOON25"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="coupon-discount-type" className="block text-sm font-medium text-neutral-700 mb-1">
                                Discount type <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="coupon-discount-type"
                                value={discountType}
                                onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)}
                                className={`${inputClass} bg-white`}
                            >
                                {DISCOUNT_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {discountType !== "percent_range" ? (
                            <div>
                                <label htmlFor="coupon-discount-value" className="block text-sm font-medium text-neutral-700 mb-1">
                                    {discountType === "flat" ? "Amount off" : "Percent off"}{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="coupon-discount-value"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    required
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="coupon-discount-min" className="block text-sm font-medium text-neutral-700 mb-1">
                                        Min % <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="coupon-discount-min"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        required
                                        value={discountMin}
                                        onChange={(e) => setDiscountMin(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="coupon-discount-max" className="block text-sm font-medium text-neutral-700 mb-1">
                                        Max % <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="coupon-discount-max"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        required
                                        value={discountMax}
                                        onChange={(e) => setDiscountMax(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="coupon-link-item" className="block text-sm font-medium text-neutral-700 mb-1">
                            Applies to <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="coupon-link-item"
                            value={linkItem}
                            onChange={(e) => {
                                setLinkItem(e.target.value as CouponLinkItem);
                                setLinkId("");
                            }}
                            className={`${inputClass} bg-white`}
                        >
                            <option value="all">All quests</option>
                            <option value="quest">A specific quest</option>
                        </select>
                    </div>

                    {linkItem === "quest" && (
                        <div>
                            <label htmlFor="coupon-link-id" className="block text-sm font-medium text-neutral-700 mb-1">
                                Quest <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="coupon-link-id"
                                value={linkId}
                                onChange={(e) => setLinkId(e.target.value)}
                                disabled={questsQuery.isLoading}
                                className={`${inputClass} bg-white disabled:opacity-50`}
                            >
                                <option value="">
                                    {questsQuery.isLoading ? "Loading quests…" : "— Select a quest —"}
                                </option>
                                {(questsQuery.data?.quests ?? []).map((q) => (
                                    <option key={q.id} value={q.id}>
                                        {q.title ?? q.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="coupon-expires-at" className="block text-sm font-medium text-neutral-700 mb-1">
                                Expires at
                            </label>
                            <input
                                id="coupon-expires-at"
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="coupon-per-user-limit" className="block text-sm font-medium text-neutral-700 mb-1">
                                Per-user limit
                            </label>
                            <input
                                id="coupon-per-user-limit"
                                type="number"
                                min={1}
                                value={perUserLimit}
                                onChange={(e) => setPerUserLimit(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="coupon-max-redemptions" className="block text-sm font-medium text-neutral-700 mb-1">
                            Max total redemptions
                        </label>
                        <input
                            id="coupon-max-redemptions"
                            type="number"
                            min={1}
                            value={maxRedemptions}
                            onChange={(e) => setMaxRedemptions(e.target.value)}
                            className={inputClass}
                            placeholder="Leave blank for unlimited"
                        />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-4 h-4 rounded border-neutral-300 text-violet-600 focus:ring-violet-500 accent-violet-600"
                        />
                        <span className="text-sm text-neutral-700 font-medium">Active</span>
                    </label>

                    <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                        <button
                            type="button"
                            onClick={reset}
                            disabled={createMutation.isPending}
                            className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Coupon
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

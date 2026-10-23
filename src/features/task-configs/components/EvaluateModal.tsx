import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { StatTile } from "@/components/ui/Stat";
import { Tag } from "@/components/ui/StatusPill";
import { humanizeStatus } from "@/components/ui/status";
import { stepRewardsService } from "../services/step-rewards.service";
import type { RewardEvaluation, StepReward } from "@/types";

/** Base / bonus / total from an evaluation. */
export function RewardResult({ result }: { result: RewardEvaluation }) {
    return (
        <div className="grid grid-cols-3 gap-3" aria-live="polite">
            <StatTile label="Base" value={result.base_points.toLocaleString("en-IN")} />
            <StatTile label="Bonus" value={result.bonus_points.toLocaleString("en-IN")} />
            <StatTile label="Total" value={result.total_points.toLocaleString("en-IN")} className="border-accent-300 bg-accent-50" />
        </div>
    );
}

/**
 * Try a step reward with sample values: one labelled input per field its
 * bonus conditions use, then POST /rewards/{id}/evaluate.
 */
export function EvaluateModal({ reward, onClose }: { reward: StepReward | null; onClose: () => void }) {
    return reward ? <EvaluateBody key={reward._id} reward={reward} onClose={onClose} /> : null;
}

function EvaluateBody({ reward, onClose }: { reward: StepReward; onClose: () => void }) {
    const contextFields: string[] = Array.from(new Set((reward.bonus_conditions ?? []).map((c) => c.field).filter(Boolean)));
    const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => Object.fromEntries(contextFields.map((f) => [f, ""])));
    const [result, setResult] = useState<RewardEvaluation | null>(null);

    const evaluateMutation = useMutation({
        mutationFn: (context: Record<string, unknown>) => stepRewardsService.evaluate(reward._id, context),
        onSuccess: (res) => setResult(res),
        onError: (e: Error) => toast.error(e.message || "Failed to evaluate reward"),
    });

    const handleEvaluate = () => {
        const context: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fieldValues)) {
            if (v === "") continue;
            const num = Number(v);
            context[k] = isNaN(num) ? v : num;
        }
        evaluateMutation.mutate(context);
    };

    const bonusCount = reward.bonus_conditions?.length ?? 0;

    return (
        <Modal
            open
            onClose={onClose}
            title="Evaluate reward"
            icon={Calculator}
            size="lg"
            description={
                <span className="flex flex-wrap items-center gap-2">
                    <Tag>{humanizeStatus(reward.context_type)}</Tag>
                    <span>Base {reward.base_points} pts</span>
                    {bonusCount > 0 && (
                        <span>
                            · {bonusCount} bonus condition{bonusCount === 1 ? "" : "s"}
                        </span>
                    )}
                </span>
            }
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    <Button variant="primary" icon={Calculator} onClick={handleEvaluate} loading={evaluateMutation.isPending}>
                        Evaluate
                    </Button>
                </>
            }
        >
            {contextFields.length === 0 ? (
                <p className="text-sm text-ink-muted">No bonus conditions — the result equals the base points ({reward.base_points} pts).</p>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sample values</p>
                    {contextFields.map((field) => (
                        <Field key={field} label={humanizeStatus(field)}>
                            <TextInput
                                type="number"
                                placeholder="Enter a value"
                                value={fieldValues[field] ?? ""}
                                onChange={(e) => setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))}
                            />
                        </Field>
                    ))}
                </div>
            )}
            {result && <RewardResult result={result} />}
        </Modal>
    );
}

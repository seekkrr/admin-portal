import { useState } from "react";
import { Check, HelpCircle, Camera, Trophy } from "lucide-react";
import type { ExperienceTask } from "@/types";

function optionClass(picked: number | null, index: number, answer: number): string {
    if (picked === null) return "bg-white/5 hover:bg-white/10 text-neutral-200 border-transparent";
    if (index === answer) return "bg-emerald-500/25 text-emerald-200 border-emerald-400/40";
    if (index === picked) return "bg-rose-500/25 text-rose-200 border-rose-400/40";
    return "bg-white/5 text-neutral-500 border-transparent";
}

export function TaskPlayer({ task }: { task: ExperienceTask }) {
    const [done, setDone] = useState(false);
    const [picked, setPicked] = useState<number | null>(null);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [showHint, setShowHint] = useState(false);

    const quiz = task.quiz_data;
    const items = task.collection_items;
    const hint = task.hints[0];

    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-violet-100">{task.title}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/30 text-violet-200 flex-shrink-0">
                    {task.task_type.replace("_", " ")}
                </span>
            </div>

            {quiz && (
                <div className="space-y-1.5">
                    <p className="text-xs text-neutral-200">{quiz.question}</p>
                    <div className="grid gap-1.5">
                        {quiz.options.map((opt, i) => (
                            <button
                                key={i}
                                disabled={picked !== null}
                                onClick={() => { setPicked(i); if (i === quiz.correct_answer) setDone(true); }}
                                className={`text-left text-xs px-2.5 py-1.5 rounded-lg border transition ${optionClass(picked, i, quiz.correct_answer)}`}
                            >
                                {opt}{picked !== null && i === quiz.correct_answer ? "  ✓" : ""}
                            </button>
                        ))}
                    </div>
                    {picked !== null && (
                        <p className={`text-xs ${picked === quiz.correct_answer ? "text-emerald-300" : "text-rose-300"}`}>
                            {picked === quiz.correct_answer ? `Correct! +${task.base_points} pts` : "Not quite — the journey teaches."}
                        </p>
                    )}
                </div>
            )}

            {items && items.length > 0 && (
                <div className="space-y-1">
                    {items.map((it) => {
                        const on = checked.has(it);
                        return (
                            <button
                                key={it}
                                onClick={() => setChecked((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(it)) n.delete(it); else n.add(it);
                                    if (n.size === items.length) setDone(true);
                                    return n;
                                })}
                                className={`w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg transition ${on ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-neutral-300 hover:bg-white/10"}`}
                            >
                                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? "bg-emerald-500 border-emerald-400" : "border-white/30"}`}>
                                    {on && <Check className="w-3 h-3 text-white" />}
                                </span>
                                Collect: {it}
                            </button>
                        );
                    })}
                </div>
            )}

            {task.photo_requirements && !quiz && !items && (
                <div className="space-y-1.5">
                    <p className="text-xs text-neutral-300 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" /> Capture a photo to complete this challenge.
                    </p>
                    {!done && (
                        <button onClick={() => setDone(true)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition">
                            Mark as captured
                        </button>
                    )}
                </div>
            )}

            {!quiz && !items && !task.photo_requirements && !done && (
                <button onClick={() => setDone(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition">
                    Mark complete
                </button>
            )}

            {hint && !done && (
                <button onClick={() => setShowHint((s) => !s)}
                    className="text-[11px] text-amber-300/80 flex items-center gap-1 hover:text-amber-200">
                    <HelpCircle className="w-3 h-3" /> {showHint ? hint.text : `Reveal hint (−${hint.cost} pts)`}
                </button>
            )}

            {done && (
                <p className="text-xs text-emerald-300 flex items-center gap-1.5 font-medium">
                    <Trophy className="w-3.5 h-3.5" /> Completed · +{task.base_points} pts
                </p>
            )}
        </div>
    );
}

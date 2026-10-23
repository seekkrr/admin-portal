import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Compass, IndianRupee, MapPin, Trophy, UserCircle } from "lucide-react";
import { Panel, DetailList, DetailRow } from "@/components/ui/Panel";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { SaveBar } from "@/components/detail/SaveBar";
import { ChipsInput } from "@/components/detail/ChipsInput";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { count } from "@/components/detail/detailFormat";
import { cx } from "@/utils/cx";
import type { QuestTheme, UpdateQuestPayload, V2QuestDetail } from "@/types";
import { questsService } from "../../services/quests.service";

const THEMES: { value: QuestTheme; label: string }[] = [
    { value: "adventure", label: "Adventure" },
    { value: "romance", label: "Romance" },
    { value: "culture", label: "Culture" },
    { value: "food", label: "Food" },
    { value: "history", label: "History" },
    { value: "nature", label: "Nature" },
    { value: "spiritual", label: "Spiritual" },
    { value: "photography", label: "Photography" },
    { value: "archaeological", label: "Archaeological" },
    { value: "offbeat", label: "Offbeat" },
    { value: "finding_yourself", label: "Finding yourself" },
    { value: "other", label: "Other" },
];
const DIFFICULTIES = [
    { value: "", label: "Not set" },
    { value: "easy", label: "Easy" },
    { value: "moderate", label: "Moderate" },
    { value: "hard", label: "Hard" },
    { value: "expert", label: "Expert" },
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface QuestForm {
    title: string;
    description: string;
    theme: string[];
    difficulty: string;
    keywords: string[];
    price: string;
    points: string;
    duration_minutes: string;
    hints_allowed: string;
    min_expense: string;
    max_expense: string;
    best_month_start: string;
    best_month_end: string;
}

const str = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));

function formOf(q: V2QuestDetail): QuestForm {
    return {
        title: q.title ?? "",
        description: q.description ?? "",
        theme: q.theme ?? [],
        difficulty: q.difficulty ?? "",
        keywords: q.keywords ?? [],
        price: str(q.price),
        points: str(q.points),
        duration_minutes: str(q.duration_minutes),
        hints_allowed: str(q.hints_allowed),
        min_expense: str(q.min_expense),
        max_expense: str(q.max_expense),
        best_month_start: q.best_month_start ?? "",
        best_month_end: q.best_month_end ?? "",
    };
}

const NUMBER_FIELDS = ["price", "points", "duration_minutes", "hints_allowed", "min_expense", "max_expense"] as const;
const INT_FIELDS = new Set(["points", "duration_minutes", "hints_allowed"]);

function errorsOf(f: QuestForm): Partial<Record<keyof QuestForm, string>> {
    const out: Partial<Record<keyof QuestForm, string>> = {};
    if (f.title.trim().length < 3) out.title = "At least 3 characters.";
    NUMBER_FIELDS.forEach((k) => {
        if (!f[k].trim()) return;
        const n = Number(f[k]);
        if (!Number.isFinite(n) || n < (k === "duration_minutes" ? 1 : 0)) out[k] = k === "duration_minutes" ? "1 or more." : "0 or more.";
        else if (INT_FIELDS.has(k) && !Number.isInteger(n)) out[k] = "A whole number.";
    });
    if (!out.min_expense && !out.max_expense && f.min_expense.trim() && f.max_expense.trim() && Number(f.min_expense) > Number(f.max_expense)) {
        out.max_expense = "Can't be below the minimum.";
    }
    return out;
}

function changesOf(f: QuestForm, b: QuestForm): UpdateQuestPayload {
    const out: UpdateQuestPayload = {};
    if (f.title.trim() !== b.title) out.title = f.title.trim();
    if (f.description.trim() !== b.description) out.description = f.description.trim();
    if (JSON.stringify(f.theme) !== JSON.stringify(b.theme)) out.theme = f.theme;
    if (JSON.stringify(f.keywords) !== JSON.stringify(b.keywords)) out.keywords = f.keywords;
    if (f.difficulty !== b.difficulty && f.difficulty) out.difficulty = f.difficulty;
    NUMBER_FIELDS.forEach((k) => {
        if (f[k].trim() !== b[k] && f[k].trim()) out[k] = Number(f[k]);
    });
    if (f.best_month_start !== b.best_month_start) out.best_month_start = f.best_month_start || null;
    if (f.best_month_end !== b.best_month_end) out.best_month_end = f.best_month_end || null;
    return out;
}

/** Every quest field (title, theme, difficulty, keywords, price, …) plus region / creator / achievement. */
export function QuestDetailsTab({ quest, canEdit, onSaved }: { quest: V2QuestDetail; canEdit: boolean; onSaved: () => void }) {
    const base = useMemo(() => formOf(quest), [quest]);
    const [form, setForm, reset] = useSyncedDraft<QuestForm>(base);
    const set = <K extends keyof QuestForm>(k: K, v: QuestForm[K]) => setForm((f) => ({ ...f, [k]: v }));
    const changes = changesOf(form, base);
    const errors = errorsOf(form);
    const dirty = Object.keys(changes).length > 0;
    const disabled = !canEdit;

    const save = useMutation({
        mutationFn: () => questsService.updateQuest(quest.id, changes),
        onSuccess: () => {
            toast.success("Quest saved");
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const numberField = (k: (typeof NUMBER_FIELDS)[number], label: string, hint?: string) => (
        <Field label={label} error={errors[k]} hint={hint}>
            <TextInput type="number" min={0} inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} disabled={disabled} />
        </Field>
    );

    return (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
                <Panel title="Quest" icon={Compass}>
                    <div className="space-y-4">
                        <Field label="Title" required error={errors.title}>
                            <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} disabled={disabled} />
                        </Field>
                        <Field label="Description">
                            <TextArea value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} maxLength={5000} disabled={disabled} />
                        </Field>
                        <Field label="Theme">
                            <div role="group" aria-label="Theme" className="flex flex-wrap gap-1.5">
                                {THEMES.map((t) => {
                                    const on = form.theme.includes(t.value);
                                    return (
                                        <button
                                            key={t.value}
                                            type="button"
                                            aria-pressed={on}
                                            disabled={disabled}
                                            onClick={() => set("theme", on ? form.theme.filter((x) => x !== t.value) : [...form.theme, t.value])}
                                            className={cx(
                                                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                                                on ? "border-brand-900 bg-brand-900 text-white" : "border-line-strong bg-surface text-ink hover:border-accent-300"
                                            )}
                                        >
                                            {t.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Difficulty">
                                <SelectInput value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)} options={DIFFICULTIES} disabled={disabled} />
                            </Field>
                            {numberField("duration_minutes", "Duration (minutes)")}
                        </div>
                        <Field label="Keywords" hint="Help people find it in search. Press Enter after each.">
                            <ChipsInput value={form.keywords} onChange={(v) => set("keywords", v)} maxLength={60} disabled={disabled} lowercase />
                        </Field>
                    </div>
                </Panel>

                <Panel title="Price and rewards" icon={IndianRupee}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {numberField("price", "Price (₹)", "0 = free.")}
                        {numberField("points", "Points")}
                        {numberField("hints_allowed", "Hints allowed")}
                        <div className="hidden sm:block" />
                        {numberField("min_expense", "Min spend on the way (₹)")}
                        {numberField("max_expense", "Max spend on the way (₹)")}
                    </div>
                </Panel>

                <Panel title="Best time to go" icon={CalendarClock}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="From">
                            <SelectInput
                                value={form.best_month_start}
                                onChange={(e) => set("best_month_start", e.target.value)}
                                options={[{ value: "", label: "Any time" }, ...MONTHS.map((m) => ({ value: m, label: m }))]}
                                disabled={disabled}
                            />
                        </Field>
                        <Field label="To">
                            <SelectInput
                                value={form.best_month_end}
                                onChange={(e) => set("best_month_end", e.target.value)}
                                options={[{ value: "", label: "Any time" }, ...MONTHS.map((m) => ({ value: m, label: m }))]}
                                disabled={disabled}
                            />
                        </Field>
                    </div>
                </Panel>
                <SaveBar dirty={dirty && canEdit} saving={save.isPending} invalid={Object.keys(errors).length > 0} onSave={() => save.mutate()} onDiscard={reset} />
            </div>

            <div className="space-y-5">
                <Panel title="Numbers" icon={Trophy}>
                    <DetailList>
                        <DetailRow label="Views" value={count(quest.view_count)} />
                        <DetailRow label="Completed" value={count(quest.completion_count)} />
                        <DetailRow label="Rating" value={quest.average_rating ? `${quest.average_rating.toFixed(1)} (${count(quest.review_count)} reviews)` : "—"} />
                        <DetailRow label="Stops" value={count(quest.total_markers)} />
                    </DetailList>
                </Panel>
                <Panel title="Region" icon={MapPin}>
                    {quest.region_summary?.id ? (
                        <Link to={`/regions/${quest.region_summary.id}`} className="font-medium text-accent-700 hover:underline">
                            {quest.region_summary.name ?? quest.region_summary.id}
                        </Link>
                    ) : (
                        <p className="text-sm text-ink-faint">No region</p>
                    )}
                </Panel>
                <Panel title="Creator" icon={UserCircle}>
                    {quest.creator_summary?.id ? (
                        <div className="flex items-center gap-3">
                            {quest.creator_summary.avatar_url ? (
                                <img src={quest.creator_summary.avatar_url} alt="" className="h-10 w-10 rounded-full border border-line object-cover" />
                            ) : (
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                                    <UserCircle className="h-5 w-5" aria-hidden />
                                </span>
                            )}
                            <div className="min-w-0">
                                <Link to={`/creators/${quest.creator_summary.id}`} className="font-medium text-accent-700 hover:underline">
                                    {quest.creator_summary.name || "Creator"}
                                </Link>
                                {quest.creator_summary.tagline && <p className="truncate text-xs text-ink-muted">{quest.creator_summary.tagline}</p>}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-ink-faint">Creator info unavailable</p>
                    )}
                </Panel>
                {quest.linked_achievement && (
                    <Panel title="Achievement" icon={Trophy}>
                        <div className="flex items-center gap-3">
                            {quest.linked_achievement.icon_url && <img src={quest.linked_achievement.icon_url} alt="" className="h-9 w-9 rounded-control object-cover" />}
                            <div>
                                <p className="text-sm font-medium text-ink">{quest.linked_achievement.name}</p>
                                {quest.linked_achievement.xp_reward ? <p className="text-xs text-warn">+{quest.linked_achievement.xp_reward} XP</p> : null}
                            </div>
                        </div>
                    </Panel>
                )}
            </div>
        </div>
    );
}

import type { CreateTaskConfigPayload, TaskConfig, TaskConfigType, UpdateTaskConfigPayload } from "@/types";
import { humanizeStatus } from "@/components/ui/status";

export const TASK_TYPES: TaskConfigType[] = ["photo_challenge", "qr_scan", "quiz", "collection", "social", "checkin"];

export const TASK_TYPE_OPTIONS = TASK_TYPES.map((t) => ({ value: t, label: humanizeStatus(t) }));

export interface TaskConfigForm {
    task_type: TaskConfigType;
    title: string;
    description: string;
    marker_id: string;
    quest_id: string;
    base_points: string;
    is_active: boolean;
    quiz_question: string;
    quiz_options: string;
    quiz_correct_answer: string;
    qr_expected_value: string;
    photo_min_photos: string;
}

export const EMPTY_TASK_FORM: TaskConfigForm = {
    task_type: "photo_challenge",
    title: "",
    description: "",
    marker_id: "",
    quest_id: "",
    base_points: "0",
    is_active: true,
    quiz_question: "",
    quiz_options: "",
    quiz_correct_answer: "",
    qr_expected_value: "",
    photo_min_photos: "",
};

export function taskConfigToForm(t: TaskConfig): TaskConfigForm {
    const quiz = (t.quiz_data ?? {}) as Record<string, unknown>;
    const qr = (t.qr_data ?? {}) as Record<string, unknown>;
    const options = Array.isArray(quiz.options) ? (quiz.options as string[]).join("\n") : "";
    return {
        task_type: t.task_type,
        title: t.title ?? "",
        description: t.description ?? "",
        marker_id: t.marker_id ?? "",
        quest_id: t.quest_id ?? "",
        base_points: String(t.base_points ?? 0),
        is_active: t.is_active,
        quiz_question: typeof quiz.question === "string" ? quiz.question : "",
        quiz_options: options,
        quiz_correct_answer: typeof quiz.correct_answer === "string" ? quiz.correct_answer : "",
        qr_expected_value: typeof qr.expected_value === "string" ? qr.expected_value : "",
        photo_min_photos: t.photo_requirements ? String((t.photo_requirements as Record<string, unknown>).min_photos ?? "") : "",
    };
}

/** Type-specific fields, shared by create and edit (task_type can't change on edit). */
function typeFieldsOf(form: TaskConfigForm): Partial<CreateTaskConfigPayload> {
    const typeFields: Partial<CreateTaskConfigPayload> = {};
    if (form.task_type === "quiz") {
        const options = form.quiz_options
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean);
        const quiz: Record<string, unknown> = {};
        if (form.quiz_question.trim()) quiz.question = form.quiz_question.trim();
        if (options.length > 0) quiz.options = options;
        if (form.quiz_correct_answer.trim()) quiz.correct_answer = form.quiz_correct_answer.trim();
        typeFields.quiz_data = quiz;
    } else if (form.task_type === "qr_scan") {
        if (form.qr_expected_value.trim()) {
            typeFields.qr_data = { expected_value: form.qr_expected_value.trim() };
        }
    } else if (form.task_type === "photo_challenge") {
        const minPhotos = parseInt(form.photo_min_photos, 10);
        if (!isNaN(minPhotos) && minPhotos > 0) {
            typeFields.photo_requirements = { min_photos: minPhotos };
        }
    }
    return typeFields;
}

/** PUT cannot change task_type / marker_id / quest_id. */
export function buildUpdatePayload(form: TaskConfigForm): UpdateTaskConfigPayload {
    return {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        base_points: Number(form.base_points) || 0,
        is_active: form.is_active,
        ...typeFieldsOf(form),
    };
}

export function buildCreatePayload(form: TaskConfigForm): CreateTaskConfigPayload {
    const payload: CreateTaskConfigPayload = {
        task_type: form.task_type,
        title: form.title.trim(),
        marker_id: form.marker_id.trim(),
        base_points: Number(form.base_points) || 0,
        is_active: form.is_active,
        ...typeFieldsOf(form),
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.quest_id.trim()) payload.quest_id = form.quest_id.trim();
    return payload;
}

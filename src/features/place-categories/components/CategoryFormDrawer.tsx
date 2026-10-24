import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Drawer } from "@/components/ui/Modal";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Switch, TextInput } from "@/components/ui/Field";
import { Tag } from "@/components/ui/StatusPill";
import { mediaService } from "@/services/media.service";
import { errorMessage } from "@/utils/errors";
import { placeCategoriesService, type PlaceCategory, type PlaceCategoryInput } from "../services/place-categories.service";

const HEX = /^#[0-9a-f]{6}$/i;

/** Sub-categories: type and press Enter (or a comma) to add; × removes. */
function SubCategoryInput({ id, value, onChange }: { id: string; value: string[]; onChange: (next: string[]) => void }) {
    const [text, setText] = useState("");
    const add = (raw: string) => {
        const words = raw
            .split(",")
            .map((w) => w.trim())
            .filter(Boolean);
        if (words.length === 0) return;
        const next = [...value];
        words.forEach((w) => {
            if (!next.some((v) => v.toLowerCase() === w.toLowerCase())) next.push(w.slice(0, 100));
        });
        onChange(next.slice(0, 100));
        setText("");
    };
    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
        } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
        }
    };
    return (
        <div className="space-y-2">
            {value.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Sub-categories">
                    {value.map((v) => (
                        <li key={v}>
                            <Tag className="py-1 pr-1 text-xs">
                                {v}
                                <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded p-0.5 hover:bg-brand-50">
                                    <X className="h-3 w-3" aria-hidden />
                                </button>
                            </Tag>
                        </li>
                    ))}
                </ul>
            )}
            <TextInput id={id} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} onBlur={() => add(text)} placeholder="e.g. Cafe, Bakery — press Enter to add" />
        </div>
    );
}

function emptyInput(): PlaceCategoryInput {
    return { name: "", sub_categories: [], is_active: true, color: null, icon: null, cdn_frame: null };
}

/** Create or edit one place category in a side panel. */
export function CategoryFormDrawer({ open, category, onClose }: { open: boolean; category: PlaceCategory | null; onClose: () => void }) {
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<PlaceCategoryInput>(emptyInput);
    const [submitted, setSubmitted] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSubmitted(false);
        setForm(
            category
                ? { name: category.name, sub_categories: category.sub_categories, is_active: category.is_active, color: category.color, icon: category.icon, cdn_frame: category.cdn_frame }
                : emptyInput()
        );
    }, [open, category]);

    const patch = (p: Partial<PlaceCategoryInput>) => setForm((f) => ({ ...f, ...p }));
    const nameError = !form.name.trim() ? "Add a name." : undefined;
    const colorError = form.color && !HEX.test(form.color) ? "Use a colour like #4A90D9." : undefined;

    const save = useMutation({
        mutationFn: () => {
            const body: PlaceCategoryInput = {
                ...form,
                name: form.name.trim(),
                color: form.color?.trim() || null,
                icon: form.icon?.trim() || null,
                cdn_frame: form.cdn_frame?.trim() || null,
            };
            return category ? placeCategoriesService.update(category.id, body) : placeCategoriesService.create(body);
        },
        onSuccess: (saved) => {
            queryClient.invalidateQueries({ queryKey: ["place-categories"] });
            toast.success(category ? `Saved ${saved.name}` : `Created ${saved.name}`);
            onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
    });

    const submit = () => {
        setSubmitted(true);
        if (nameError || colorError) return;
        save.mutate();
    };

    const upload = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        try {
            const res = await mediaService.uploadImage(file, { category: "icons" });
            patch({ cdn_frame: res.secure_url });
        } catch (e) {
            toast.error(errorMessage(e, "Upload failed"));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            dismissible={!save.isPending}
            title={category ? `Edit ${category.name}` : "New category"}
            subtitle="Places pick one of these; the app uses the colour and pin frame on the map."
            footer={
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button onClick={onClose} disabled={save.isPending}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={submit} loading={save.isPending}>
                        {category ? "Save" : "Create category"}
                    </Button>
                </div>
            }
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
            >
                <Field label="Name" required error={submitted ? nameError : undefined}>
                    <TextInput value={form.name} maxLength={100} onChange={(e) => patch({ name: e.target.value })} placeholder="Food and drink" autoFocus />
                </Field>
                <Field label="Sub-categories" htmlFor="cat-subs" hint="Optional. Places can be tagged with these.">
                    <SubCategoryInput id="cat-subs" value={form.sub_categories} onChange={(sub_categories) => patch({ sub_categories })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Colour" htmlFor="cat-color" error={submitted ? colorError : undefined} hint="Map pins and chips.">
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                aria-label="Pick a colour"
                                value={form.color && HEX.test(form.color) ? form.color : "#00a49e"}
                                onChange={(e) => patch({ color: e.target.value })}
                                className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-line-strong bg-surface p-1"
                            />
                            <TextInput id="cat-color" value={form.color ?? ""} maxLength={30} onChange={(e) => patch({ color: e.target.value })} placeholder="#4A90D9" />
                        </div>
                    </Field>
                    <Field label="Icon name" hint="Optional. As the app expects it, e.g. coffee.">
                        <TextInput value={form.icon ?? ""} maxLength={100} onChange={(e) => patch({ icon: e.target.value })} />
                    </Field>
                </div>
                <Field label="Map pin frame" htmlFor="cat-frame" hint="Optional image URL used around the map pin.">
                    <div className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <TextInput id="cat-frame" value={form.cdn_frame ?? ""} maxLength={1000} onChange={(e) => patch({ cdn_frame: e.target.value })} placeholder="https://img.seekkrr.com/…" />
                            <div className="flex shrink-0 gap-2">
                                <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                                <Button icon={ImagePlus} loading={uploading} onClick={() => fileRef.current?.click()}>
                                    Upload
                                </Button>
                                {form.cdn_frame && <IconButton icon={X} label="Remove pin frame" onClick={() => patch({ cdn_frame: null })} />}
                            </div>
                        </div>
                        {form.cdn_frame && <img src={form.cdn_frame} alt="Pin frame preview" className="h-16 w-16 rounded-control border border-line bg-surface-muted object-contain p-1" />}
                    </div>
                </Field>
                <Switch checked={form.is_active} onChange={(is_active) => patch({ is_active })} label="Active" description="Inactive categories are hidden from the app and from new places." />
                <button type="submit" hidden aria-hidden tabIndex={-1} />
            </form>
        </Drawer>
    );
}

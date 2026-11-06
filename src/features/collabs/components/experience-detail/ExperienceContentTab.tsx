import { useMemo } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, CircleHelp, Image as ImageIcon, ListChecks, MapPin, Route, ShieldX, Sparkles, Tags, UserRound, Layers } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Field, SelectInput, Switch, TextArea, TextInput } from "@/components/ui/Field";
import { SaveBar } from "@/components/detail/SaveBar";
import { ChipsInput } from "@/components/detail/ChipsInput";
import { PhotoListEditor } from "@/components/detail/PhotoListEditor";
import { Notice } from "@/components/detail/DetailStates";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { RegionPicker } from "@/features/regions/components/RegionPicker";
import { markersService } from "@/features/markers/services/markers.service";
import { experienceDetailApi } from "@/services/admin-detail.service";
import type { ExperienceDetail } from "@/types/admin-detail";
import { businessesService } from "../../services/businesses.service";
import { RepeatableList } from "./RepeatableList";
import { SingleImageField } from "@/components/detail/SingleImageField";
import { changedPayload, formErrors, formFrom, type ContentForm, type FaqForm, type ItineraryForm, type OptionForm, type TitledForm } from "./experienceForm";

const blankTitled = (): TitledForm => ({ title: "", description: "" });
const blankStep = (): ItineraryForm => ({ time_label: "", title: "", description: "", image_url: "" });
const blankFaq = (): FaqForm => ({ question: "", answer: "" });
const blankOption = (): OptionForm => ({ id: "", name: "", description: "", duration_minutes: "", price: "" });

/** Everything the business can edit, compact: one form, one sticky save bar. */
export function ExperienceContentTab({
    experience,
    canEdit,
    onSaved,
}: {
    experience: ExperienceDetail;
    canEdit: boolean;
    onSaved: (next: ExperienceDetail) => void;
}) {
    const base = useMemo(() => formFrom(experience), [experience]);
    const [form, setForm, reset] = useSyncedDraft<ContentForm>(base);
    const set = <K extends keyof ContentForm>(k: K, v: ContentForm[K]) => setForm((f) => ({ ...f, [k]: v }));
    const changes = changedPayload(form, base);
    const dirty = Object.keys(changes).length > 0;
    const errors = formErrors(form);
    const upload = { category: "website", entityId: experience.business_id };
    const disabled = !canEdit;

    // The place must be one of the business's places.
    const business = useQuery({
        queryKey: ["collabs-business", experience.business_id],
        queryFn: () => businessesService.getById(experience.business_id),
        staleTime: 60_000,
    });
    const placeIds = business.data?.marker_ids ?? (experience.marker_id ? [experience.marker_id] : []);
    const places = useQueries({
        queries: placeIds.map((id) => ({ queryKey: ["marker-detail", id], queryFn: () => markersService.getById(id), staleTime: 5 * 60_000, retry: false })),
    });
    const placeOptions = [
        { value: "", label: "No SeekKrr place (use an address)" },
        ...placeIds.map((id, i) => ({ value: id, label: places[i]?.data?.title ?? (places[i]?.isLoading ? "Loading…" : id) })),
    ];

    const save = useMutation({
        mutationFn: () => experienceDetailApi.update(experience.business_id, experience.id, changes),
        onSuccess: (next) => {
            toast.success("Experience saved");
            onSaved(next);
        },
        onError: (e: Error) => toast.error(e.message),
    });

    return (
        <div className="space-y-5">
            <Panel title="Basics" icon={BookOpen}>
                <div className="space-y-4">
                    <Field label="Title" required error={!form.title.trim() ? "Add a title." : undefined}>
                        <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} disabled={disabled} />
                    </Field>
                    <Field label="Tagline" hint="One line under the title.">
                        <TextInput value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={160} disabled={disabled} />
                    </Field>
                    <Field label="Description">
                        <TextArea value={form.description} onChange={(e) => set("description", e.target.value)} rows={6} maxLength={5000} disabled={disabled} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Duration" hint='e.g. "3–4 hours"'>
                            <TextInput value={form.duration_text} onChange={(e) => set("duration_text", e.target.value)} maxLength={60} disabled={disabled} />
                        </Field>
                        <Field label="Tags" hint="Up to 10.">
                            <ChipsInput value={form.tags} onChange={(v) => set("tags", v)} max={10} disabled={disabled} />
                        </Field>
                    </div>
                </div>
            </Panel>

            <Panel title="Place" icon={MapPin} description="A linked place decides the location and region.">
                <div className="space-y-4">
                    <Field label="SeekKrr place">
                        <SelectInput value={form.marker_id} onChange={(e) => set("marker_id", e.target.value)} options={placeOptions} disabled={disabled} />
                    </Field>
                    {!form.marker_id && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Address" className="sm:col-span-2">
                                <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={300} disabled={disabled} />
                            </Field>
                            <Field label="Map link" hint="https://…">
                                <TextInput value={form.map_url} onChange={(e) => set("map_url", e.target.value)} maxLength={1000} disabled={disabled} />
                            </Field>
                            <Field label="Region">
                                <RegionPicker value={form.region_id} onChange={(id) => set("region_id", id)} ringClass="focus:ring-accent-500" />
                            </Field>
                        </div>
                    )}
                </div>
            </Panel>

            <Panel title="Photos" icon={ImageIcon} description="The first photo is the cover. Drag or use the arrows to reorder.">
                <PhotoListEditor value={form.media} onChange={(v) => set("media", v)} upload={upload} max={20} disabled={disabled} label="Experience photos" />
            </Panel>

            <Panel title="Curator" icon={UserRound} description="Who leads it.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Name">
                        <TextInput value={form.curator.name} onChange={(e) => set("curator", { ...form.curator, name: e.target.value })} maxLength={80} disabled={disabled} />
                    </Field>
                    <Field label="Title">
                        <TextInput value={form.curator.title} onChange={(e) => set("curator", { ...form.curator, title: e.target.value })} maxLength={80} disabled={disabled} />
                    </Field>
                    <Field label="Years of experience">
                        <TextInput
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            value={form.curator.years}
                            onChange={(e) => set("curator", { ...form.curator, years: e.target.value })}
                            disabled={disabled}
                        />
                    </Field>
                    <Field label="Photo">
                        <SingleImageField
                            value={form.curator.photo_url}
                            onChange={(url) => set("curator", { ...form.curator, photo_url: url })}
                            category={upload.category}
                            entityId={upload.entityId}
                            disabled={disabled}
                            label="Curator photo"
                        />
                    </Field>
                    <Field label="Note" className="sm:col-span-2">
                        <TextArea value={form.curator.note} onChange={(e) => set("curator", { ...form.curator, note: e.target.value })} rows={3} maxLength={2000} disabled={disabled} />
                    </Field>
                </div>
            </Panel>

            <Panel title="Highlights" icon={Sparkles}>
                <RepeatableList
                    items={form.highlights}
                    onChange={(v) => set("highlights", v)}
                    blank={blankTitled}
                    itemLabel="Highlight"
                    addLabel="Add highlight"
                    max={12}
                    disabled={disabled}
                    fields={[
                        { key: "title", label: "Title", maxLength: 100, required: true, wide: true },
                        { key: "description", label: "Description", kind: "textarea", maxLength: 1000 },
                    ]}
                />
            </Panel>

            <Panel title="Itinerary" icon={Route}>
                <RepeatableList
                    items={form.itinerary}
                    onChange={(v) => set("itinerary", v)}
                    blank={blankStep}
                    itemLabel="Step"
                    addLabel="Add step"
                    max={20}
                    disabled={disabled}
                    upload={upload}
                    fields={[
                        { key: "time_label", label: "When", maxLength: 40, placeholder: "e.g. 7:00 AM" },
                        { key: "title", label: "Title", maxLength: 100, required: true },
                        { key: "description", label: "Description", kind: "textarea", maxLength: 1000 },
                        { key: "image_url", label: "Photo", kind: "image" },
                    ]}
                />
            </Panel>

            <Panel title="What's included" icon={ListChecks}>
                <RepeatableList
                    items={form.included}
                    onChange={(v) => set("included", v)}
                    blank={blankTitled}
                    itemLabel="Item"
                    addLabel="Add item"
                    max={20}
                    disabled={disabled}
                    fields={[
                        { key: "title", label: "Title", maxLength: 100, required: true, wide: true },
                        { key: "description", label: "Description", kind: "textarea", maxLength: 1000 },
                    ]}
                />
            </Panel>

            <Panel title="Cancellation policy" icon={ShieldX}>
                <RepeatableList
                    items={form.cancellation_policy}
                    onChange={(v) => set("cancellation_policy", v)}
                    blank={blankTitled}
                    itemLabel="Rule"
                    addLabel="Add rule"
                    max={10}
                    disabled={disabled}
                    fields={[
                        { key: "title", label: "Title", maxLength: 100, required: true, wide: true },
                        { key: "description", label: "Description", kind: "textarea", maxLength: 1000 },
                    ]}
                />
            </Panel>

            <Panel title="FAQs" icon={CircleHelp}>
                <RepeatableList
                    items={form.faqs}
                    onChange={(v) => set("faqs", v)}
                    blank={blankFaq}
                    itemLabel="FAQ"
                    addLabel="Add FAQ"
                    max={30}
                    disabled={disabled}
                    fields={[
                        { key: "question", label: "Question", maxLength: 200, required: true, wide: true },
                        { key: "answer", label: "Answer", kind: "textarea", maxLength: 2000 },
                    ]}
                />
            </Panel>

            <Panel title="Options" icon={Layers} description="Different versions people can book (e.g. Hatha, Vinyasa). Slots belong to one option. Prices are on the Pricing tab.">
                <RepeatableList
                    items={form.options}
                    onChange={(v) => set("options", v)}
                    blank={blankOption}
                    itemLabel="Option"
                    addLabel="Add option"
                    max={20}
                    disabled={disabled}
                    fields={[
                        { key: "name", label: "Name", maxLength: 80, required: true, wide: true },
                        { key: "duration_minutes", label: "Duration (minutes)", kind: "number" },
                        { key: "description", label: "Description", kind: "textarea", maxLength: 500 },
                    ]}
                />
            </Panel>

            <Panel title="How bookings work" icon={Layers} description="Leave both off for group sessions where every slot has its own spots.">
                <div className="space-y-4">
                    <Switch
                        checked={form.shared_space}
                        onChange={(v) => set("shared_space", v)}
                        disabled={disabled}
                        label="Options share one space"
                        description="Only one session runs at a time (e.g. go-karting on one track). Once a time is booked, overlapping times of every option close; more people can still join the booked session."
                    />
                    <Switch
                        checked={form.private_slots}
                        onChange={(v) => set("private_slots", v)}
                        disabled={disabled}
                        label="One group per slot"
                        description="The first booking takes the whole slot (e.g. a private boat ride)."
                    />
                </div>
            </Panel>

            <Panel title="More photos" icon={Tags} description="Extra photo strips shown further down the experience page.">
                <div className="space-y-5">
                    <Field label="Experience photos">
                        <PhotoListEditor
                            value={form.experience_media}
                            onChange={(v) => set("experience_media", v)}
                            upload={upload}
                            max={20}
                            coverLabel={null}
                            disabled={disabled}
                            label="Experience strip photos"
                        />
                    </Field>
                    <Field label="Gallery">
                        <PhotoListEditor value={form.gallery} onChange={(v) => set("gallery", v)} upload={upload} max={50} coverLabel={null} disabled={disabled} label="Gallery photos" />
                    </Field>
                </div>
            </Panel>

            {dirty && errors.length > 0 && (
                <Notice tone="warn" title="Fix these before saving">
                    <ul className="list-disc pl-4">
                        {errors.map((e) => (
                            <li key={e}>{e}</li>
                        ))}
                    </ul>
                </Notice>
            )}
            <SaveBar dirty={dirty && canEdit} saving={save.isPending} invalid={errors.length > 0} onSave={() => save.mutate()} onDiscard={reset} />
        </div>
    );
}

import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { IdCard } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { SaveBar } from "@/components/detail/SaveBar";
import { ChipsInput } from "@/components/detail/ChipsInput";
import { Notice } from "@/components/detail/DetailStates";
import { sameList } from "@/components/detail/detailFormat";
import { useSyncedDraft } from "@/components/detail/useSyncedDraft";
import { userDetailApi } from "@/services/admin-detail.service";
import type { AdminUserProfile, UserPatch } from "@/types/admin-detail";

interface ProfileForm {
    first_name: string;
    last_name: string;
    username: string;
    bio: string;
    phone: string;
    email: string;
    hobbies: string[];
}

function formOf(u: AdminUserProfile): ProfileForm {
    return {
        first_name: u.first_name ?? "",
        last_name: u.last_name ?? "",
        username: u.username ?? "",
        bio: u.bio ?? "",
        phone: u.phone ?? "",
        email: u.email ?? "",
        hobbies: u.hobbies ?? [],
    };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z0-9._]{3,30}$/i;

function changesOf(form: ProfileForm, base: ProfileForm): UserPatch {
    const out: UserPatch = {};
    (["first_name", "last_name", "username", "bio", "phone", "email"] as const).forEach((k) => {
        if (form[k].trim() !== base[k]) out[k] = form[k].trim();
    });
    if (!sameList(form.hobbies, base.hobbies)) out.hobbies = form.hobbies;
    return out;
}

/** Profile editor: names, username, bio, phone, email, hobbies (PATCH /admin/users/{id}). */
export function UserProfileTab({
    user,
    full,
    canEdit,
    onSaved,
}: {
    user: AdminUserProfile;
    full: boolean;
    canEdit: boolean;
    onSaved: () => void;
}) {
    const base = useMemo(() => formOf(user), [user]);
    const [form, setForm, resetForm] = useSyncedDraft<ProfileForm>(base);
    const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => ({ ...f, [k]: v }));
    const changes = changesOf(form, base);
    const dirty = Object.keys(changes).length > 0;

    const errors: Partial<Record<keyof ProfileForm, string>> = {};
    if (!form.first_name.trim()) errors.first_name = "First name is required.";
    if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.email = "That doesn't look like an email address.";
    if (form.username.trim() && !USERNAME.test(form.username.trim())) errors.username = "3–30 letters, digits, dots or underscores.";
    if (form.phone.trim() && !/^\+?[0-9 ()-]{6,20}$/.test(form.phone.trim())) errors.phone = "Use digits, spaces and an optional + (6–20 characters).";
    const invalid = Object.keys(errors).length > 0;

    const save = useMutation({
        mutationFn: () => userDetailApi.patch(user.id, changes),
        onSuccess: ({ skipped }) => {
            if (skipped.length) toast.warning(`Saved. ${skipped.join(", ")} couldn't be changed yet — the server update isn't live.`);
            else toast.success("Profile saved");
            onSaved();
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const disabled = !canEdit || save.isPending;
    const limited = !full;

    return (
        <div className="space-y-4">
            {limited && (
                <Notice tone="info" title="Some fields can't be changed yet">
                    Username, phone and email can be edited once the server update is live. Names, bio and hobbies save now.
                </Notice>
            )}
            <Panel title="Profile" icon={IdCard} description={canEdit ? "What this person shows in the app" : "View only"}>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (dirty && !invalid) save.mutate();
                    }}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="First name" required error={errors.first_name}>
                            <TextInput value={form.first_name} onChange={(e) => set("first_name", e.target.value)} maxLength={100} disabled={disabled} autoComplete="off" />
                        </Field>
                        <Field label="Last name">
                            <TextInput value={form.last_name} onChange={(e) => set("last_name", e.target.value)} maxLength={100} disabled={disabled} autoComplete="off" />
                        </Field>
                        <Field label="Username" error={errors.username} hint={limited ? "Editable once the server update is live." : undefined}>
                            <TextInput
                                value={form.username}
                                onChange={(e) => set("username", e.target.value)}
                                maxLength={30}
                                disabled={disabled || limited}
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder="e.g. mountain.maya"
                            />
                        </Field>
                        <Field label="Phone" error={errors.phone}>
                            <TextInput
                                type="tel"
                                value={form.phone}
                                onChange={(e) => set("phone", e.target.value)}
                                maxLength={20}
                                disabled={disabled || limited}
                                placeholder="+91…"
                            />
                        </Field>
                        <Field label="Email" error={errors.email} className="sm:col-span-2" hint="They sign in with this. Changing it changes their login.">
                            <TextInput
                                type="email"
                                value={form.email}
                                onChange={(e) => set("email", e.target.value)}
                                maxLength={255}
                                disabled={disabled || limited}
                                autoCapitalize="off"
                                spellCheck={false}
                            />
                        </Field>
                    </div>
                    <Field label="Bio">
                        <TextArea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={4} maxLength={5000} disabled={disabled} />
                    </Field>
                    <Field label="Hobbies" hint="Press Enter after each one. Up to 50.">
                        <ChipsInput value={form.hobbies} onChange={(v) => set("hobbies", v)} max={50} disabled={disabled} />
                    </Field>
                    <button type="submit" hidden aria-hidden tabIndex={-1} />
                </form>
            </Panel>
            <SaveBar dirty={dirty && canEdit} saving={save.isPending} invalid={invalid} onSave={() => save.mutate()} onDiscard={resetForm} />
        </div>
    );
}

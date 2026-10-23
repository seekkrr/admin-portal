import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, AtSign, ChevronRight, Mail, PanelTop, Send, ServerCog } from "lucide-react";
import { AccessDenied } from "@components/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { Panel } from "@/components/ui/Panel";
import { PanelState } from "@/components/ui/States";
import { StatGrid, StatTile } from "@/components/ui/Stat";
import { CountBadge, Tag } from "@/components/ui/StatusPill";
import { useDebouncedUrlInput, useUrlState } from "@/hooks/useUrlState";
import { formatDateTime } from "@/utils/date";
import { useCollabAccess } from "@/features/collabs/roles";
import { Notice } from "@/features/collabs/components/AdminBits";
import { emailTemplatesService, emailTemplatePath } from "../services/email-templates.service";
import type { EmailDeliveryStatus, EmailTemplateListItem } from "../types";

const GROUP_ORDER = ["Layout", "Creators", "Support", "Places", "Quests", "Businesses", "Legacy (V1)"];

/** Which transport is live, who emails come from, and whether anything can send at all. */
function DeliveryStats({ delivery }: { delivery: EmailDeliveryStatus }) {
    const nothing = !delivery.smtp_configured && !delivery.zeptomail_configured;
    const configured = [delivery.smtp_configured && "Zoho SMTP", delivery.zeptomail_configured && "ZeptoMail"].filter(Boolean).join(" + ");
    return (
        <div className="space-y-3">
            <StatGrid cols={3}>
                <StatTile icon={Send} label="Sending via" value={delivery.transport === "zeptomail" ? "ZeptoMail API" : "SMTP (Zoho)"} />
                <StatTile icon={AtSign} label="From" value={<span className="text-base">{delivery.from?.address ?? "—"}</span>} hint={delivery.from?.name || undefined} />
                <StatTile
                    icon={ServerCog}
                    label="Configured"
                    value={<span className="text-base">{configured || "Nothing"}</span>}
                    hint={delivery.smtp_configured && delivery.smtp_host ? delivery.smtp_host : undefined}
                    hintTone="neutral"
                />
            </StatGrid>
            {nothing && (
                <Notice tone="bad" icon={AlertTriangle} title="Emails won't send">
                    Neither Zoho SMTP nor ZeptoMail is configured on the server.
                </Notice>
            )}
        </div>
    );
}

function TemplateRow({ t }: { t: EmailTemplateListItem }) {
    return (
        <Link
            to={emailTemplatePath(t.key)}
            className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted focus-visible:bg-accent-50 focus-visible:outline-none sm:px-5"
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700 group-hover:bg-accent-50 group-hover:text-accent-700">
                {t.is_layout ? <PanelTop className="h-4 w-4" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{t.name}</span>
                    {t.has_override && <Tag tone="brand">Customized</Tag>}
                    {t.provider === "zeptomail" && <Tag tone="info">ZeptoMail template</Tag>}
                    {t.source === "v1" && <Tag tone="warn">V1</Tag>}
                </span>
                <span className="block truncate text-xs text-ink-muted">{t.description}</span>
                <span className="block font-mono text-[11px] text-ink-faint">{t.key}</span>
            </span>
            <span className="hidden whitespace-nowrap text-xs text-ink-faint sm:block">
                {t.updated_at ? `Updated ${formatDateTime(t.updated_at)}` : "Built-in design"}
                {t.version ? ` · v${t.version}` : ""}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-ink-muted" aria-hidden />
        </Link>
    );
}

export function EmailTemplatesPage() {
    const { isAdmin } = useCollabAccess();
    const { state, set } = useUrlState({ q: "" });
    const [search, setSearch] = useDebouncedUrlInput(state.q, (q) => set({ q }, { replace: true }));

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["email-templates"],
        queryFn: emailTemplatesService.list,
        enabled: isAdmin,
    });

    const groups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const items = (data?.templates ?? []).filter(
            (t) => !q || t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
        );
        const map = new Map<string, EmailTemplateListItem[]>();
        items.forEach((t) => map.set(t.group, [...(map.get(t.group) ?? []), t]));
        return [...map.entries()].sort(([a], [b]) => {
            const ia = GROUP_ORDER.indexOf(a);
            const ib = GROUP_ORDER.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
        });
    }, [data, search]);

    if (!isAdmin) return <AccessDenied message="Only admins can edit email templates." />;

    const total = data?.templates.length ?? 0;
    const customized = data?.templates.filter((t) => t.has_override).length ?? 0;

    return (
        <div className="space-y-5">
            <PageHeader
                icon={Mail}
                title="Email templates"
                description={data ? `${total} templates · ${customized} customized · changes reach sending within about a minute` : "Every email SeekKrr sends"}
            />

            {data?.delivery && <DeliveryStats delivery={data.delivery} />}

            <FilterBar search={{ value: search, onChange: setSearch, placeholder: "Search by name, key or description…" }} onReset={() => setSearch("")} />

            <PanelState
                isLoading={isLoading}
                error={error}
                isEmpty={groups.length === 0}
                emptyIcon={Mail}
                emptyText={search ? "No templates match your search" : "No templates found"}
                onRetry={() => refetch()}
            >
                <div className="space-y-4">
                    {groups.map(([group, items]) => (
                        <Panel key={group} title={group} actions={<CountBadge count={items.length} tone="neutral" />} bodyClassName="p-0">
                            <ul className="divide-y divide-line">
                                {items.map((t) => (
                                    <li key={t.key}>
                                        <TemplateRow t={t} />
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    ))}
                </div>
            </PanelState>
        </div>
    );
}

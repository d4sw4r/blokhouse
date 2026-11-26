"use client";

import Link from "next/link";
import { KeyRound, ListChecks, ScrollText, Settings, Users, Webhook, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

const SECTIONS: { href: string; title: string; description: string; icon: LucideIcon }[] = [
    { href: "/admin/users", title: "Users", description: "Create accounts, change roles, deactivate or delete users.", icon: Users },
    { href: "/admin/api", title: "API tokens", description: "Generate and revoke tokens for automation and scripts.", icon: KeyRound },
    { href: "/admin/webhooks", title: "Webhooks", description: "Send signed events to other systems when items change.", icon: Webhook },
    { href: "/admin/custom-fields", title: "Custom fields", description: "Define extra metadata fields for configuration items.", icon: ListChecks },
    { href: "/admin/audit-logs", title: "Audit log", description: "Review who changed what and when, and export the log.", icon: ScrollText },
    { href: "/admin/settings", title: "Settings", description: "General application settings.", icon: Settings },
];

export default function AdminDashboard() {
    return (
        <div>
            <PageHeader title="Admin" description="Manage users, integrations and system configuration." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SECTIONS.map(({ href, title, description, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group flex min-w-0 items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors duration-150 motion-reduce:transition-none hover:bg-surface-2"
                    >
                        <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-text">{title}</span>
                            <span className="mt-1 block text-sm text-muted">{description}</span>
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

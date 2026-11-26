'use client';

import { useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "./apidom-registrations";
import "swagger-ui-react/swagger-ui.css";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";

const SPECS = [
    {
        id: "v1",
        label: "API v1 (recommended)",
        url: "/api/v1/openapi.json",
        hint: "Stable, versioned API for automation. Generated from the request validation schemas.",
    },
    {
        id: "legacy",
        label: "Legacy API",
        url: "/api/docs",
        hint: "Unversioned endpoints used by the web UI. They may change without notice; use v1 for integrations.",
    },
] as const;

export default function ApiDocsPage() {
    const [active, setActive] = useState<(typeof SPECS)[number]["id"]>("v1");
    const spec = SPECS.find((s) => s.id === active)!;

    return (
        <div>
            <PageHeader
                title="Blokhouse API Documentation"
                description={
                    <>
                        Authenticate with{" "}
                        <code className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] break-all text-text">
                            Authorization: Bearer &lt;token&gt;
                        </code>
                        . Create tokens under Admin → API Tokens.
                    </>
                }
            />
            <Tabs value={active} onValueChange={(v) => setActive(v as typeof active)}>
                <TabsList aria-label="API version">
                    {SPECS.map((s) => (
                        <TabsTrigger key={s.id} value={s.id}>
                            {s.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <p className="mt-3 mb-4 text-sm text-muted">
                {spec.hint}{" "}
                <a className="text-accent underline" href={spec.url}>
                    Raw spec
                </a>
            </p>
            <div className="swagger-host overflow-x-auto rounded-lg border border-border bg-surface p-2 sm:p-4">
                <SwaggerUI key={spec.id} url={spec.url} docExpansion="list" />
            </div>
        </div>
    );
}

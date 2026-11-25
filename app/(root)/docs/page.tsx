'use client';

import { useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

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
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Blokhouse API Documentation</h1>
                        <p className="text-gray-600 mt-1">
                            Authenticate with <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
                            Create tokens under Admin → API Tokens.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="API version">
                        {SPECS.map((s) => (
                            <button
                                key={s.id}
                                role="tab"
                                aria-selected={active === s.id}
                                onClick={() => setActive(s.id)}
                                className={`px-3 py-1.5 rounded-sm border text-sm ${
                                    active === s.id
                                        ? "bg-brand-primary text-white border-brand-primary"
                                        : "bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-sm text-gray-600">
                        {spec.hint}{" "}
                        <a className="underline" href={spec.url}>
                            Raw spec
                        </a>
                    </p>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="bg-white rounded-lg shadow">
                    <SwaggerUI key={spec.id} url={spec.url} docExpansion="list" />
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

export default function AdminSettingsPage() {
    // Example setting – replace with real settings and API integration as needed.
    const [setting, setSetting] = useState("Default Value");
    const [newSetting, setNewSetting] = useState("");

    const updateSetting = () => {
        // In a real app, you'd send an API request here.
        setSetting(newSetting);
        setNewSetting("");
    };

    return (
        <div>
            <PageHeader title="Settings" description="General application settings." />
            <Panel title="General app settings" className="max-w-2xl">
                <div className="space-y-4">
                    <Field label="Example setting" htmlFor="example-setting">
                        <Input
                            id="example-setting"
                            type="text"
                            value={newSetting}
                            onChange={(e) => setNewSetting(e.target.value)}
                            placeholder="Enter new setting value"
                        />
                    </Field>
                    <Button onClick={updateSetting}>Update setting</Button>
                    <p className="text-sm text-muted">
                        Current setting: <span className="font-mono text-text break-all">{setting}</span>
                    </p>
                </div>
            </Panel>
        </div>
    );
}

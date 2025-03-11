"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

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
        <div className="space-y-6">
            <h1 className="text-4xl font-bold text-gray-800">Settings</h1>
            <div className="bg-white p-6 rounded-sm shadow-sm">
                <h2 className="text-2xl font-semibold mb-4">General App Settings</h2>
                <div className="space-y-4">
                    <label className="block text-lg text-gray-700">Example Setting:</label>
                    <input
                        type="text"
                        value={newSetting}
                        onChange={(e) => setNewSetting(e.target.value)}
                        placeholder="Enter new setting value"
                        className="w-full border rounded-sm p-2"
                    />
                    <Button onClick={updateSetting}>Update Setting</Button>
                </div>
                <div className="mt-4">
                    <p className="text-lg">
                        Current Setting: <span className="font-semibold text-gray-800">{setting}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

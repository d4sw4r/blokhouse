"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function DiscoveryPage() {
    const [scanning, setScanning] = useState(false);
    const [devices, setDevices] = useState([]);
    const [importedItems, setImportedItems] = useState([]);

    const fetchImportedItems = async () => {
        try {
            const res = await fetch("/api/configuration-items");
            if (res.ok) {
                const data = await res.json();
                setImportedItems(data);
            } else {
                console.error("Failed to fetch imported items:", await res.text());
            }
        } catch (error) {
            console.error("Error fetching imported items:", error);
        }
    };

    const runScan = async () => {
        setScanning(true);
        setDevices([]);
        try {
            const res = await fetch("/api/discovery");
            if (res.ok) {
                const data = await res.json();
                setDevices(data);
                await fetchImportedItems();
            } else {
                console.error("Scan failed:", await res.text());
            }
        } catch (error) {
            console.error("Error running scan:", error);
        }
        setScanning(false);
    };

    const importDevice = async (device) => {
        const payload = {
            name: device.name,
            description: "Imported from network discovery",
            ip: device.ip,
            mac: device.mac,
            itemTypeId: "",
        };

        try {
            const res = await fetch("/api/configuration-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                console.error("Import failed:", await res.text());
            } else {
                await fetchImportedItems();
            }
        } catch (error) {
            console.error("Error importing device:", error);
        }
    };

    useEffect(() => {
        const load = async () => { await fetchImportedItems(); };
        load();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-5xl mx-auto p-8 flex flex-col items-center">
                <h1 className="text-4xl font-bold text-gray-800 mb-8">Network Discovery</h1>
                <Button onClick={runScan} className="mb-8">
                    {scanning ? "Scanning..." : "Run Network Scan"}
                </Button>
                {scanning && (
                    <div className="flex items-center justify-center mb-8">
                        <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                {devices.length > 0 && (
                    <div className="w-full overflow-x-auto">
                        <table className="min-w-full bg-white shadow-sm rounded-sm">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="py-3 px-4 border">Name</th>
                                    <th className="py-3 px-4 border">IP Address</th>
                                    <th className="py-3 px-4 border">MAC Address</th>
                                    <th className="py-3 px-4 border">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {devices.map((device, index) => {
                                    const isImported = importedItems.some(
                                        (item) => item.mac === device.mac
                                    );
                                    return (
                                        <tr key={index}>
                                            <td className="py-2 px-4 border">{device.name}</td>
                                            <td className="py-2 px-4 border">{device.ip}</td>
                                            <td className="py-2 px-4 border">{device.mac}</td>
                                            <td className="py-2 px-4 border">
                                                {isImported ? (
                                                    <span className="text-gray-500 italic">Imported</span>
                                                ) : (
                                                    <Button onClick={() => importDevice(device)}>Import</Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}

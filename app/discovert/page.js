"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function DiscoveryPage() {
    const [scanning, setScanning] = useState(false);
    const [devices, setDevices] = useState([]);
    const [importedItems, setImportedItems] = useState([]);

    // Fetch the configuration items (imported devices) for the current user.
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

    // Run the network scan.
    const runScan = async () => {
        setScanning(true);
        setDevices([]);
        try {
            const res = await fetch("/api/discovery");
            if (res.ok) {
                const data = await res.json();
                setDevices(data);
                // After scanning, refresh the list of imported configuration items.
                await fetchImportedItems();
            } else {
                console.error("Scan failed:", await res.text());
            }
        } catch (error) {
            console.error("Error running scan:", error);
        }
        setScanning(false);
    };

    // Import a scanned device into configuration items.
    const importDevice = async (device) => {
        const payload = {
            name: device.name,
            description: "Imported from network discovery",
            ip: device.ip,
            mac: device.mac,
            itemTypeId: "", // leave empty if no type is assigned
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
                const imported = await res.json();
                console.log("Imported device:", imported);
                // Update the list of imported items so the UI can reflect the change.
                await fetchImportedItems();
            }
        } catch (error) {
            console.error("Error importing device:", error);
        }
    };

    // Optionally, you could fetch imported items on component mount.
    useEffect(() => {
        fetchImportedItems();
    }, []);

    return (
        <div className="min-h-screen bg-gray-100">
            <main className="max-w-7xl mx-auto p-6 flex flex-col items-center">
                <h1 className="text-3xl font-bold mb-6">Network Discovery</h1>

                <Button onClick={runScan} className="mb-6">
                    {scanning ? "Scanning..." : "Run Network Scan"}
                </Button>

                {scanning && (
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {devices.length > 0 && (
                    <table className="min-w-full bg-white shadow rounded">
                        <thead>
                            <tr>
                                <th className="py-2 px-4 border-b">Name</th>
                                <th className="py-2 px-4 border-b">IP Address</th>
                                <th className="py-2 px-4 border-b">MAC Address</th>
                                <th className="py-2 px-4 border-b">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map((device, index) => {
                                // Check if this device (by MAC) is already imported.
                                const isImported = importedItems.some(
                                    (item) => item.mac === device.mac
                                );
                                return (
                                    <tr key={index}>
                                        <td className="py-2 px-4 border-b">{device.name}</td>
                                        <td className="py-2 px-4 border-b">{device.ip}</td>
                                        <td className="py-2 px-4 border-b">{device.mac}</td>
                                        <td className="py-2 px-4 border-b">
                                            {isImported ? (
                                                <span className="text-gray-500 italic">Imported</span>
                                            ) : (
                                                <Button onClick={() => importDevice(device)}>
                                                    Import
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </main>
        </div>
    );
}

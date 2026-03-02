"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { SkeletonCard, LoadingSpinner } from "@/components/Skeleton";
import Link from "next/link";

interface DiscoveredDevice {
    name: string;
    ip: string;
    mac: string | null;
    status: "new" | "existing" | "imported";
    existingAssetId?: string;
}

interface ImportResult {
    success: boolean;
    device: DiscoveredDevice;
    assetId?: string;
    error?: string;
}

export default function DiscoveryPage() {
    const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [subnet, setSubnet] = useState("192.168.1.0/24");
    const [error, setError] = useState<string | null>(null);
    const [existingAssets, setExistingAssets] = useState<Map<string, string>>(new Map());
    const [importing, setImporting] = useState<Set<string>>(new Set());
    const [importResults, setImportResults] = useState<ImportResult[]>([]);
    const [showImportModal, setShowImportModal] = useState(false);

    // Fetch existing assets to check for duplicates
    useEffect(() => {
        fetchExistingAssets();
    }, []);

    const fetchExistingAssets = async () => {
        try {
            const res = await fetch("/api/configuration-items?limit=10000");
            if (res.ok) {
                const data = await res.json();
                const assetMap = new Map<string, string>();
                data.items?.forEach((item: any) => {
                    if (item.ip) assetMap.set(item.ip, item.id);
                    if (item.mac) assetMap.set(item.mac.toLowerCase(), item.id);
                });
                setExistingAssets(assetMap);
            }
        } catch (error) {
            console.error("Error fetching existing assets:", error);
        }
    };

    const startDiscovery = async () => {
        try {
            setScanning(true);
            setError(null);
            setDevices([]);
            setImportResults([]);

            const res = await fetch("/api/discovery");
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Discovery failed");
            }

            const discoveredDevices: DiscoveredDevice[] = await res.json();
            
            // Check against existing assets
            const enrichedDevices: DiscoveredDevice[] = discoveredDevices.map((device) => {
                const existingByIp = existingAssets.get(device.ip);
                const existingByMac = device.mac ? existingAssets.get(device.mac.toLowerCase()) : undefined;
                const existingId = existingByIp || existingByMac;
                
                if (existingId) {
                    return {
                        ...device,
                        status: "existing",
                        existingAssetId: existingId,
                    };
                }
                return { ...device, status: "new" };
            });

            setDevices(enrichedDevices);
        } catch (err: any) {
            setError(err.message || "Failed to scan network");
        } finally {
            setScanning(false);
        }
    };

    const importDevice = async (device: DiscoveredDevice) => {
        try {
            setImporting((prev) => new Set(prev).add(device.ip));
            
            const assetData = {
                name: device.name !== device.ip ? device.name : `Device-${device.ip}`,
                description: `Auto-discovered device via network scan`,
                ip: device.ip,
                mac: device.mac || undefined,
                status: "ACTIVE",
            };

            const res = await fetch("/api/configuration-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(assetData),
            });

            if (res.ok) {
                const created = await res.json();
                setDevices((prev) =>
                    prev.map((d) =>
                        d.ip === device.ip
                            ? { ...d, status: "imported", existingAssetId: created.id }
                            : d
                    )
                );
                setImportResults((prev) => [
                    ...prev,
                    { success: true, device, assetId: created.id },
                ]);
                // Update existing assets map
                setExistingAssets((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(device.ip, created.id);
                    if (device.mac) newMap.set(device.mac.toLowerCase(), created.id);
                    return newMap;
                });
            } else {
                const err = await res.json();
                throw new Error(err.error || "Import failed");
            }
        } catch (err: any) {
            setImportResults((prev) => [
                ...prev,
                { success: false, device, error: err.message },
            ]);
        } finally {
            setImporting((prev) => {
                const newSet = new Set(prev);
                newSet.delete(device.ip);
                return newSet;
            });
        }
    };

    const importAllNew = async () => {
        const newDevices = devices.filter((d) => d.status === "new");
        for (const device of newDevices) {
            await importDevice(device);
        }
    };

    const newDevicesCount = devices.filter((d) => d.status === "new").length;
    const existingDevicesCount = devices.filter((d) => d.status === "existing").length;
    const importedDevicesCount = devices.filter((d) => d.status === "imported").length;

    return (
        <div className="min-h-screen bg-gray-50">
            <main className="max-w-7xl mx-auto p-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-800">Network Discovery</h1>
                        <p className="text-gray-600 mt-1">
                            Scan your network to discover and import new devices
                        </p>
                    </div>
                </div>

                {/* Configuration Card */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Scan Configuration</h2>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                Network Subnet
                            </label>
                            <input
                                type="text"
                                value={subnet}
                                onChange={(e) => setSubnet(e.target.value)}
                                placeholder="192.168.1.0/24"
                                className="w-full border rounded-lg p-2"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Format: IP/CIDR (e.g., 192.168.1.0/24)
                            </p>
                        </div>
                        <Button
                            onClick={startDiscovery}
                            disabled={scanning}
                            className="min-w-[150px]"
                        >
                            {scanning ? (
                                <>
                                    <span className="mr-2"><LoadingSpinner size="sm" /></span>
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    Start Discovery
                                </>
                            )}
                        </Button>
                    </div>
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 text-red-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{error}</span>
                            </div>
                            <p className="text-sm text-red-600 mt-1">
                                Make sure nmap is installed and accessible: <code>sudo apt install nmap</code>
                            </p>
                        </div>
                    )}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-blue-700">
                                <p className="font-medium">How it works:</p>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                    <li>Uses nmap ping scan (-sn) to discover devices without port scanning</li>
                                    <li>Requires sudo privileges for MAC address detection</li>
                                    <li>Matches discovered devices against existing assets by IP/MAC</li>
                                    <li>Import new devices directly as configuration items</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results */}
                {devices.length > 0 && (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-sm font-medium text-gray-600">Total Found</p>
                                <p className="text-2xl font-bold text-brand-primary">{devices.length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-sm font-medium text-gray-600">New Devices</p>
                                <p className="text-2xl font-bold text-green-600">{newDevicesCount}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-sm font-medium text-gray-600">Existing</p>
                                <p className="text-2xl font-bold text-blue-600">{existingDevicesCount}</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <p className="text-sm font-medium text-gray-600">Imported</p>
                                <p className="text-2xl font-bold text-purple-600">{importedDevicesCount}</p>
                            </div>
                        </div>

                        {/* Actions */}
                        {newDevicesCount > 0 && (
                            <div className="flex gap-2 mb-6">
                                <Button onClick={importAllNew} disabled={importing.size > 0}>
                                    Import All New Devices ({newDevicesCount})
                                </Button>
                                {importResults.length > 0 && (
                                    <Button
                                        onClick={() => setShowImportModal(true)}
                                        variant="outline"
                                    >
                                        View Import Results
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Devices Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <table className="min-w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Status</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Name</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">IP Address</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">MAC Address</th>
                                        <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {devices.map((device) => (
                                        <tr key={device.ip} className="hover:bg-gray-50">
                                            <td className="py-3 px-4">
                                                {device.status === "new" && (
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                                        New
                                                    </span>
                                                )}
                                                {device.status === "existing" && (
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                                        Exists
                                                    </span>
                                                )}
                                                {device.status === "imported" && (
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                                        Imported
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-medium text-gray-800">
                                                {device.name}
                                            </td>
                                            <td className="py-3 px-4">
                                                <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                                    {device.ip}
                                                </code>
                                            </td>
                                            <td className="py-3 px-4">
                                                {device.mac ? (
                                                    <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                                                        {device.mac}
                                                    </code>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {device.status === "new" && (
                                                    <Button
                                                        onClick={() => importDevice(device)}
                                                        disabled={importing.has(device.ip)}
                                                        size="sm"
                                                    >
                                                        {importing.has(device.ip) ? (
                                                            <LoadingSpinner size="sm" />
                                                        ) : (
                                                            "Import"
                                                        )}
                                                    </Button>
                                                )}
                                                {device.status === "existing" && device.existingAssetId && (
                                                    <Link href={`/items/${device.existingAssetId}`}>
                                                        <Button variant="outline" size="sm">
                                                            View Asset
                                                        </Button>
                                                    </Link>
                                                )}
                                                {device.status === "imported" && device.existingAssetId && (
                                                    <Link href={`/items/${device.existingAssetId}`}>
                                                        <Button variant="outline" size="sm">
                                                            View Asset
                                                        </Button>
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Empty State */}
                {!scanning && devices.length === 0 && !error && (
                    <div className="bg-white p-12 rounded-lg shadow-sm text-center">
                        <svg
                            className="w-16 h-16 mx-auto mb-4 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">Ready to Discover</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Configure your network subnet and click "Start Discovery" to scan for devices on your network.
                        </p>
                    </div>
                )}

                {/* Import Results Modal */}
                {showImportModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                            <h2 className="text-xl font-semibold mb-4">Import Results</h2>
                            <div className="space-y-2">
                                {importResults.map((result, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg ${
                                            result.success ? "bg-green-50" : "bg-red-50"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {result.success ? (
                                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            )}
                                            <span className="font-medium">{result.device.ip}</span>
                                            {result.success && result.assetId && (
                                                <Link
                                                    href={`/items/${result.assetId}`}
                                                    className="text-brand-primary hover:underline text-sm ml-auto"
                                                >
                                                    View →
                                                </Link>
                                            )}
                                        </div>
                                        {result.error && (
                                            <p className="text-sm text-red-600 mt-1">{result.error}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-6">
                                <Button onClick={() => setShowImportModal(false)}>Close</Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

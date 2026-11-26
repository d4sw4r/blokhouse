"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Info, Radar, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatTile } from "@/components/ui/StatTile";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

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
                data.items?.forEach((item: { ip?: string; mac?: string; id: string }) => {
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to scan network");
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
        } catch (err: unknown) {
            setImportResults((prev) => [
                ...prev,
                { success: false, device, error: err instanceof Error ? err.message : "Import failed" },
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
        <div>
            <PageHeader
                title="Network discovery"
                description="Scan your network to discover and import new devices"
            />

            <Panel title="Scan configuration" className="mb-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="min-w-0 flex-1">
                        <Field
                            label="Network subnet"
                            htmlFor="discovery-subnet"
                            hint="Format: IP/CIDR (e.g., 192.168.1.0/24)"
                        >
                            <Input
                                id="discovery-subnet"
                                type="text"
                                value={subnet}
                                onChange={(e) => setSubnet(e.target.value)}
                                placeholder="192.168.1.0/24"
                                className="font-mono"
                            />
                        </Field>
                    </div>
                    <Button
                        onClick={startDiscovery}
                        loading={scanning}
                        className="md:mt-[22px] md:min-w-[150px]"
                    >
                        {scanning ? (
                            "Scanning..."
                        ) : (
                            <>
                                <Search className="size-4" aria-hidden="true" />
                                Start discovery
                            </>
                        )}
                    </Button>
                </div>
                {error && (
                    <Callout tone="danger" role="alert" className="mt-4" title={error}>
                        <p className="mt-1 text-muted">
                            Make sure nmap is installed and accessible:{" "}
                            <code className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-text">
                                sudo apt install nmap
                            </code>
                        </p>
                    </Callout>
                )}
                <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4">
                    <div className="flex items-start gap-3">
                        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                        <div className="min-w-0 text-sm text-muted">
                            <p className="font-medium text-text">How it works:</p>
                            <ul className="mt-1 list-inside list-disc space-y-1">
                                <li>Uses nmap ping scan (-sn) to discover devices without port scanning</li>
                                <li>Requires sudo privileges for MAC address detection</li>
                                <li>Matches discovered devices against existing assets by IP/MAC</li>
                                <li>Import new devices directly as configuration items</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </Panel>

            {devices.length > 0 && (
                <>
                    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                        <StatTile label="Total found" value={devices.length} />
                        <StatTile label="New devices" value={newDevicesCount} tone="success" />
                        <StatTile label="Existing" value={existingDevicesCount} />
                        <StatTile label="Imported" value={importedDevicesCount} tone="accent" />
                    </div>

                    {newDevicesCount > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                            <Button onClick={importAllNew} disabled={importing.size > 0}>
                                Import all new devices ({newDevicesCount})
                            </Button>
                            {importResults.length > 0 && (
                                <Button onClick={() => setShowImportModal(true)} variant="secondary">
                                    View import results
                                </Button>
                            )}
                        </div>
                    )}

                    <Table>
                        <THead>
                            <TR>
                                <TH>Status</TH>
                                <TH>Name</TH>
                                <TH>IP address</TH>
                                <TH>MAC address</TH>
                                <TH>Actions</TH>
                            </TR>
                        </THead>
                        <TBody>
                            {devices.map((device) => (
                                <TR key={device.ip}>
                                    <TD>
                                        {device.status === "new" && <Badge tone="success">New</Badge>}
                                        {device.status === "existing" && <Badge tone="accent">Exists</Badge>}
                                        {device.status === "imported" && <Badge tone="neutral">Imported</Badge>}
                                    </TD>
                                    <TD mono className="max-w-[16rem] truncate" title={device.name}>
                                        {device.name}
                                    </TD>
                                    <TD mono className="whitespace-nowrap">{device.ip}</TD>
                                    <TD mono className="whitespace-nowrap">
                                        {device.mac ? device.mac : <span className="text-muted">—</span>}
                                    </TD>
                                    <TD>
                                        {device.status === "new" && (
                                            <Button
                                                onClick={() => importDevice(device)}
                                                loading={importing.has(device.ip)}
                                                size="sm"
                                            >
                                                Import
                                            </Button>
                                        )}
                                        {(device.status === "existing" || device.status === "imported") &&
                                            device.existingAssetId && (
                                                <Link href={`/items/${device.existingAssetId}`}>
                                                    <Button variant="secondary" size="sm" tabIndex={-1}>
                                                        View asset
                                                    </Button>
                                                </Link>
                                            )}
                                    </TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                </>
            )}

            {!scanning && devices.length === 0 && !error && (
                <EmptyState
                    icon={Radar}
                    title="Ready to discover"
                    description='Configure your network subnet and click "Start discovery" to scan for devices on your network.'
                />
            )}

            <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
                <DialogContent
                    title="Import results"
                    className="max-w-2xl"
                    footer={<Button onClick={() => setShowImportModal(false)}>Close</Button>}
                >
                    <div className="space-y-2">
                        {importResults.map((result, idx) => (
                            <div
                                key={idx}
                                className="rounded-lg border border-border bg-surface-2 p-3"
                            >
                                <div className="flex items-center gap-2">
                                    {result.success ? (
                                        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                                    ) : (
                                        <XCircle className="size-4 shrink-0 text-danger" aria-hidden="true" />
                                    )}
                                    <span className="min-w-0 font-mono text-sm break-all">{result.device.ip}</span>
                                    <span className="text-sm text-muted">
                                        {result.success ? "Imported" : "Failed"}
                                    </span>
                                    {result.success && result.assetId && (
                                        <Link
                                            href={`/items/${result.assetId}`}
                                            className="ml-auto text-sm text-accent hover:underline"
                                        >
                                            View →
                                        </Link>
                                    )}
                                </div>
                                {result.error && (
                                    <p className="mt-1 text-sm break-words text-danger">{result.error}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

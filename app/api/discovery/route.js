// app/api/discovery/route.js
// Network discovery via `nmap -sn` (ping scan). Admin only.
//
// Configuration:
//   DISCOVERY_ENABLED=true        – feature switch (default: disabled)
//   NETWORK_SUBNET=10.0.0.0/24    – default subnet to scan
//   DISCOVERY_USE_SUDO=true       – prefix nmap with sudo (needed for MAC addresses)
//
// Optional query parameter ?subnet=<IPv4 CIDR> overrides NETWORK_SUBNET.
import { execFile } from "child_process";
import { requireAuth, jsonError } from "@/lib/auth";

const CIDR_RE = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\/(?:[89]|[12]\d|3[0-2])$/;

export function isValidSubnet(subnet) {
    return typeof subnet === "string" && CIDR_RE.test(subnet);
}

export function parseNmapOutput(stdout) {
    const devices = [];
    let current = null;
    for (const line of stdout.split("\n")) {
        if (line.startsWith("Nmap scan report for ")) {
            const hostInfo = line.replace("Nmap scan report for ", "").trim();
            const ipMatch = hostInfo.match(/\(([^)]+)\)/);
            const ip = ipMatch ? ipMatch[1] : hostInfo;
            const name = ipMatch ? hostInfo.split("(")[0].trim() : hostInfo;
            current = { name, ip, mac: null };
            devices.push(current);
        } else if (line.trim().startsWith("MAC Address:") && current) {
            const macMatch = line.match(/MAC Address:\s+([\w:]+)/);
            if (macMatch) current.mac = macMatch[1];
        }
    }
    return devices;
}

export async function GET(request) {
    const { response } = await requireAuth(request, "admin");
    if (response) return response;

    if (String(process.env.DISCOVERY_ENABLED || "").toLowerCase() !== "true") {
        return jsonError(403, "Network discovery is disabled. Set DISCOVERY_ENABLED=true to enable it.");
    }

    const { searchParams } = new URL(request.url);
    const subnet = searchParams.get("subnet") || process.env.NETWORK_SUBNET || "192.168.1.0/24";
    // nmap needs a /8 or smaller range here; anything larger would take ages.
    if (!isValidSubnet(subnet)) {
        return jsonError(400, "subnet must be an IPv4 CIDR between /8 and /32, e.g. 10.0.0.0/24");
    }

    const useSudo = String(process.env.DISCOVERY_USE_SUDO || "").toLowerCase() === "true";
    const [cmd, args] = useSudo ? ["sudo", ["-n", "nmap", "-sn", subnet]] : ["nmap", ["-sn", subnet]];

    return new Promise((resolve) => {
        // execFile: no shell, arguments are passed verbatim.
        execFile(cmd, args, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
            if (error) {
                console.error("Error executing nmap:", error);
                resolve(jsonError(500, "Network scan failed"));
                return;
            }
            resolve(
                new Response(JSON.stringify(parseNmapOutput(stdout)), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            );
        });
    });
}

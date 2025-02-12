// app/api/discovery/route.js
import { exec } from "child_process";

export async function GET() {
    // Use an environment variable to define the subnet to scan, defaulting to 192.168.1.0/24.
    const subnet = process.env.NETWORK_SUBNET || "192.168.2.0/24";

    // Wrap the exec call in a Promise so we can wait for the scan to complete.
    return new Promise((resolve, reject) => {
        // Run nmap in "ping scan" mode (-sn) to discover hosts without doing a port scan.
        exec(`sudo nmap -sn ${subnet}`, (error, stdout, stderr) => {
            if (error) {
                console.error("Error executing nmap:", error);
                return reject(
                    new Response(
                        JSON.stringify({
                            error: "Network scan failed",
                            details: stderr,
                        }),
                        { status: 500 }
                    )
                );
            }

            // Parse the stdout from nmap.
            const devices = [];
            const lines = stdout.split("\n");
            let currentDevice = null;

            for (const line of lines) {
                // Look for a line indicating the start of a new host.
                if (line.startsWith("Nmap scan report for ")) {
                    // The line might be in one of two formats:
                    // 1. "Nmap scan report for hostname (192.168.1.10)"
                    // 2. "Nmap scan report for 192.168.1.10"
                    const hostInfo = line.replace("Nmap scan report for ", "").trim();
                    let ip = "";
                    let name = "";
                    const ipMatch = hostInfo.match(/\(([^)]+)\)/);
                    if (ipMatch) {
                        ip = ipMatch[1];
                        name = hostInfo.split("(")[0].trim();
                    } else {
                        ip = hostInfo;
                        name = hostInfo;
                    }
                    currentDevice = { name, ip, mac: null };
                    devices.push(currentDevice);
                }
                // Look for a line with the MAC address.
                else if (line.trim().startsWith("MAC Address:") && currentDevice) {
                    const macMatch = line.match(/MAC Address:\s+([\w:]+)/);
                    if (macMatch) {
                        currentDevice.mac = macMatch[1];
                    }
                }
            }

            resolve(new Response(JSON.stringify(devices), { status: 200 }));
        });
    });
}

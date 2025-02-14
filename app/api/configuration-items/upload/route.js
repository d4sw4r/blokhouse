// app/api/configuration-items/upload/route.js
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import authOptions from "@/lib/authOptions";

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    try {
        const { csv } = await request.json();
        if (!csv) {
            return new Response(JSON.stringify({ error: "No CSV content provided" }), { status: 400 });
        }
        // Split into lines and remove empty lines
        const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) {
            return new Response(JSON.stringify({ error: "CSV must have header and at least one row" }), { status: 400 });
        }
        // Assume the first line is a header, e.g., "name,description,ip,mac,itemTypeId"
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const itemsData = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(",").map((cell) => cell.trim());
            if (row.length === 0) continue;
            const item = {};
            header.forEach((col, index) => {
                item[col] = row[index] || "";
            });
            // Map CSV columns to our fields – assuming headers are exactly:
            // name, description, ip, mac, itemtypeid
            itemsData.push({
                name: item.name,
                description: item.description,
                ip: item.ip,
                mac: item.mac,
                itemTypeId: item.itemtypeid || null,
                userId: session.user.id,
            });
        }
        // Bulk insert (createMany returns an object with a count)
        const result = await prisma.configurationItem.createMany({
            data: itemsData,
        });
        return new Response(JSON.stringify({ message: "CSV processed", count: result.count }), { status: 201 });
    } catch (error) {
        console.error("CSV upload error:", error);
        return new Response(JSON.stringify({ error: "CSV processing failed", details: error.message }), { status: 500 });
    }
}

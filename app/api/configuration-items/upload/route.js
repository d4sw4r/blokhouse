// app/api/configuration-items/upload/route.js
import prisma from "@/lib/prisma";
import { parseCsv } from "@/lib/csv-parser";
import { requireAuth } from "@/lib/auth";

export async function POST(request) {
    const { auth, response } = await requireAuth(request, "write");
    if (response) return response;

    try {
        const { csv } = await request.json();

        const { items, errors, skipped } = parseCsv(csv, auth.user.id);

        // If every row failed validation, return early with a 400
        if (items.length === 0) {
            return new Response(
                JSON.stringify({ error: "No valid rows found", details: errors }),
                { status: 400 }
            );
        }

        const result = await prisma.configurationItem.createMany({ data: items });

        return new Response(
            JSON.stringify({
                message: "CSV processed",
                inserted: result.count,
                skipped,
                errors: errors.length > 0 ? errors : undefined,
            }),
            { status: 201 }
        );
    } catch (error) {
        console.error("CSV upload error:", error);
        return new Response(
            JSON.stringify({ error: "CSV processing failed", details: error.message }),
            { status: 500 }
        );
    }
}

// app/api/health/route.js
// Health check endpoint for Docker/Kubernetes readiness and liveness probes
// Returns system status and database connectivity information

import prisma from "@/lib/prisma";

const START_TIME = Date.now();

/**
 * GET /api/health
 * 
 * Returns health status of the application including:
 * - Database connectivity
 * - System uptime
 * - Memory usage
 * - Response time
 * 
 * Query parameters:
 * - detailed=true (optional) - Include additional system metrics
 */
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get("detailed") === "true";
    
    const checkStartTime = Date.now();
    const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - START_TIME) / 1000), // seconds
    };

    const checks = {
        database: { status: "unknown", responseTime: 0 },
    };

    try {
        // Test database connectivity with a simple query
        const dbCheckStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        checks.database = {
            status: "healthy",
            responseTime: Date.now() - dbCheckStart,
        };
    } catch {
        checks.database = {
            status: "unhealthy",
            error: "Database connection failed",
            responseTime: Date.now() - checkStartTime,
        };
        health.status = "unhealthy";
    }

    // Add system metrics if detailed mode is requested
    if (detailed) {
        const memUsage = process.memoryUsage();
        health.system = {
            nodeVersion: process.version,
            platform: process.platform,
            memory: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
                rss: Math.round(memUsage.rss / 1024 / 1024), // MB
            },
        };
    }

    health.checks = checks;
    health.responseTime = Date.now() - checkStartTime;

    const statusCode = health.status === "healthy" ? 200 : 503;
    
    return new Response(JSON.stringify(health, null, 2), {
        status: statusCode,
        headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    });
}

/**
 * lib/audit.js
 * Helper functions for creating audit log entries.
 */

import prisma from "./prisma";

/**
 * Create an audit log entry.
 *
 * @param {Object} params
 * @param {import('@prisma/client').AuditAction} params.action - The action type
 * @param {string} params.entityType - The type of entity affected (e.g., "ConfigurationItem")
 * @param {string} [params.entityId] - The ID of the affected entity
 * @param {string} [params.userId] - The ID of the user who performed the action
 * @param {string} [params.description] - Human-readable description
 * @param {Object} [params.oldValues] - Previous values (for updates/deletes)
 * @param {Object} [params.newValues] - New values (for creates/updates)
 * @param {Request} [params.req] - The request object (to extract IP and user agent)
 * @returns {Promise<import('@prisma/client').AuditLog>}
 */
export async function createAuditLog({
    action,
    entityType,
    entityId,
    userId,
    description,
    oldValues,
    newValues,
    req,
}) {
    try {
        const data = {
            action,
            entityType,
            ...(entityId && { entityId }),
            ...(userId && { userId }),
            ...(description && { description }),
            ...(oldValues && { oldValues }),
            ...(newValues && { newValues }),
        };

        // Extract IP and user agent from request if provided
        if (req) {
            // Get IP from various headers (for proxied requests)
            const ip = req.headers.get("x-forwarded-for") ||
                      req.headers.get("x-real-ip") ||
                      req.headers.get("cf-connecting-ip") ||
                      "unknown";
            data.ipAddress = ip.split(",")[0].trim(); // Take first IP if multiple
            data.userAgent = req.headers.get("user-agent") || "unknown";
        }

        const log = await prisma.auditLog.create({ data });
        return log;
    } catch (error) {
        console.error("Failed to create audit log:", error);
        // Don't throw - audit logging should not break the main operation
        return null;
    }
}

/**
 * Log configuration item creation.
 */
export async function logItemCreated({ item, userId, req }) {
    return createAuditLog({
        action: "CREATE",
        entityType: "ConfigurationItem",
        entityId: item.id,
        userId,
        description: `Created configuration item "${item.name}"`,
        newValues: sanitizeItem(item),
        req,
    });
}

/**
 * Log configuration item update.
 */
export async function logItemUpdated({ oldItem, newItem, userId, req }) {
    return createAuditLog({
        action: "UPDATE",
        entityType: "ConfigurationItem",
        entityId: newItem.id,
        userId,
        description: `Updated configuration item "${newItem.name}"`,
        oldValues: sanitizeItem(oldItem),
        newValues: sanitizeItem(newItem),
        req,
    });
}

/**
 * Log configuration item deletion.
 */
export async function logItemDeleted({ item, userId, req }) {
    return createAuditLog({
        action: "DELETE",
        entityType: "ConfigurationItem",
        entityId: item.id,
        userId,
        description: `Deleted configuration item "${item.name}"`,
        oldValues: sanitizeItem(item),
        req,
    });
}

/**
 * Log API token creation.
 */
export async function logTokenCreated({ token, userId, req }) {
    return createAuditLog({
        action: "API_TOKEN_CREATED",
        entityType: "ApiToken",
        entityId: token.id,
        userId,
        description: `Created API token`,
        newValues: { tokenId: token.id },
        req,
    });
}

/**
 * Log API token deletion.
 */
export async function logTokenDeleted({ tokenId, userId, req }) {
    return createAuditLog({
        action: "API_TOKEN_DELETED",
        entityType: "ApiToken",
        entityId: tokenId,
        userId,
        description: `Deleted API token`,
        oldValues: { tokenId },
        req,
    });
}

/**
 * Sanitize a configuration item for logging (remove sensitive/internal fields).
 */
function sanitizeItem(item) {
    if (!item) return null;
    const { id, name, description, ip, mac, status, itemTypeId, createdAt, updatedAt } = item;
    return { id, name, description, ip, mac, status, itemTypeId, createdAt, updatedAt };
}

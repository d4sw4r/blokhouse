/**
 * lib/notifications.ts
 * Helper functions for creating notifications
 */

import prisma from "./prisma";

export type NotificationType = 
  | "ASSET_STATUS_CHANGED"
  | "ASSET_CREATED"
  | "ASSET_DELETED"
  | "RELATION_CREATED"
  | "RELATION_DELETED"
  | "MAINTENANCE_DUE"
  | "CUSTOM_FIELD_CHANGED"
  | "SYSTEM";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Create a notification for a specific user
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  entityType,
  entityId,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        entityType,
        entityId,
      },
    });
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    // Don't throw - notification failures shouldn't break main operations
    return null;
  }
}

/**
 * Create notifications for all admins
 */
export async function notifyAllAdmins({
  type,
  title,
  message,
  entityType,
  entityId,
}: Omit<CreateNotificationParams, "userId">) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const notifications = await Promise.all(
      admins.map((admin: { id: string }) =>
        createNotification({
          userId: admin.id,
          type,
          title,
          message,
          entityType,
          entityId,
        })
      )
    );

    return notifications;
  } catch (error) {
    console.error("Failed to notify admins:", error);
    return null;
  }
}

/**
 * Notify asset owner and admins about asset changes
 */
export async function notifyAssetChange({
  assetId,
  assetName,
  type,
  message,
  changedByUserId,
}: {
  assetId: string;
  assetName: string;
  type: NotificationType;
  message: string;
  changedByUserId?: string;
}) {
  try {
    // Get asset owner
    const asset = await prisma.configurationItem.findUnique({
      where: { id: assetId },
      select: { userId: true },
    });

    const notifiedUserIds = new Set<string>();

    // Notify owner (if exists and not the one who made the change)
    if (asset?.userId && asset.userId !== changedByUserId) {
      await createNotification({
        userId: asset.userId,
        type,
        title: `Asset Update: ${assetName}`,
        message,
        entityType: "ConfigurationItem",
        entityId: assetId,
      });
      notifiedUserIds.add(asset.userId);
    }

    // Notify all admins (except the one who made the change and the owner)
    const admins = await prisma.user.findMany({
      where: { 
        role: "ADMIN",
        id: { 
          not: changedByUserId,
          notIn: asset?.userId ? [asset.userId] : [],
        },
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin: { id: string }) =>
        createNotification({
          userId: admin.id,
          type,
          title: `Asset Update: ${assetName}`,
          message,
          entityType: "ConfigurationItem",
          entityId: assetId,
        })
      )
    );

    return true;
  } catch (error) {
    console.error("Failed to notify asset change:", error);
    return null;
  }
}

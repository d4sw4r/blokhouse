'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { notificationIconColor, notificationTypeMeta } from "@/lib/ui/notificationTypes";
import { cn } from "@/lib/utils";
import { SkeletonTable } from "@/components/Skeleton";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [confirmClearRead, setConfirmClearRead] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=100");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const deleteAllRead = async () => {
    const readNotifications = notifications.filter((n) => n.read);
    await Promise.all(
      readNotifications.map((n) =>
        fetch(`/api/notifications/${n.id}`, { method: "DELETE" })
      )
    );
    setNotifications((prev) => prev.filter((n) => !n.read));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0 ? (
            <span className="font-medium text-accent">
              <span className="font-mono tabular-nums">{unreadCount}</span> unread
            </span>
          ) : (
            "All caught up!"
          )
        }
        actions={
          <>
            <Button
              onClick={() => setFilter(filter === "all" ? "unread" : "all")}
              variant="secondary"
            >
              {filter === "all" ? "Show unread" : "Show all"}
            </Button>
            {unreadCount > 0 && <Button onClick={markAllAsRead}>Mark all as read</Button>}
            {notifications.some((n) => n.read) && (
              <Button onClick={() => setConfirmClearRead(true)} variant="danger">
                Clear read
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <SkeletonTable rows={5} />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
        />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {filteredNotifications.map((notification) => {
              const meta = notificationTypeMeta(notification.type);
              const Icon = meta.icon;
              return (
                <li
                  key={notification.id}
                  className={cn("border-l-2 p-4", notification.read ? "border-l-transparent" : "border-l-accent")}
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                    <Badge tone={meta.tone} className="shrink-0 gap-1.5 self-start">
                      <Icon className={cn("size-3.5", notificationIconColor[meta.tone])} aria-hidden="true" />
                      {meta.label}
                    </Badge>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <h3 className="min-w-0 text-sm font-semibold break-words text-text">
                          {notification.title}
                          {!notification.read && (
                            <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-accent">
                              <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                              Unread
                            </span>
                          )}
                        </h3>
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm break-words text-muted">{notification.message}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="rounded-md text-sm font-medium text-accent hover:underline max-sm:min-h-11"
                          >
                            Mark as read
                          </button>
                        )}
                        {notification.entityType === "ConfigurationItem" && notification.entityId && (
                          <Link
                            href={`/items?highlight=${notification.entityId}`}
                            className="text-sm font-medium text-accent hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"
                          >
                            View asset →
                          </Link>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="ml-auto rounded-md text-sm font-medium text-danger hover:underline max-sm:min-h-11"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <ConfirmDialog
        open={confirmClearRead}
        onOpenChange={setConfirmClearRead}
        title="Clear read notifications?"
        description="All read notifications will be deleted."
        confirmLabel="Clear read"
        tone="danger"
        onConfirm={deleteAllRead}
      />
    </div>
  );
}

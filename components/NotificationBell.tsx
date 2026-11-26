'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { Bell, X } from "lucide-react";
import { notificationIconColor, notificationTypeMeta } from "@/lib/ui/notificationTypes";
import { cn } from "@/lib/utils";

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

export default function NotificationBell({ navItem = false }: { navItem?: boolean } = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    const load = async () => { await fetchNotifications(); };
    load();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
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
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const deleted = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (deleted && !deleted.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.entityType === "ConfigurationItem" && notification.entityId) {
      return `/items?highlight=${notification.entityId}`;
    }
    return null;
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          {...(navItem ? { "data-nav-item": true } : {})}
          className="relative inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text motion-reduce:transition-none max-sm:size-11"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        >
          <Bell className="size-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] leading-4 font-semibold text-accent-fg"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 flex max-h-[min(34rem,80dvh)] w-96 max-w-[calc(100vw-1rem)] flex-col rounded-lg border border-border bg-surface text-text shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="rounded-md text-sm font-medium text-accent hover:underline max-sm:min-h-11"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted">
                <Bell className="size-8" aria-hidden="true" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => {
                  const link = getNotificationLink(notification);
                  const meta = notificationTypeMeta(notification.type);
                  const Icon = meta.icon;
                  const body = (
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2"
                        title={meta.label}
                      >
                        <Icon className={cn("size-4", notificationIconColor[meta.tone])} aria-hidden="true" />
                        <span className="sr-only">{meta.label}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold break-words">{notification.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-muted">{formatTimeAgo(notification.createdAt)}</p>
                      </div>
                      {!notification.read && (
                        <span className="mt-1.5 flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
                          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                          <span className="sr-only">Unread</span>
                        </span>
                      )}
                    </div>
                  );
                  const onActivate = () => {
                    if (!notification.read) markAsRead(notification.id);
                  };

                  return (
                    <li
                      key={notification.id}
                      className={cn("relative flex items-start border-l-2 hover:bg-surface-2/60", notification.read ? "border-l-transparent" : "border-l-accent")}
                    >
                      {link ? (
                        <Link
                          href={link}
                          onClick={() => {
                            onActivate();
                            setIsOpen(false);
                          }}
                          className="block min-w-0 flex-1 py-3 pr-1 pl-4"
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={onActivate}
                          className="block min-w-0 flex-1 py-3 pr-1 pl-4 text-left"
                        >
                          {body}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => deleteNotification(notification.id, e)}
                        className="mt-1.5 mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text max-sm:size-11"
                        title="Delete"
                        aria-label={`Delete notification: ${notification.title}`}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-3">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block text-center text-sm font-medium text-accent hover:underline max-sm:py-2"
            >
              View all notifications
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

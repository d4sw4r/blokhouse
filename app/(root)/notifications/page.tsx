'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

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

const notificationTypeColors: Record<string, string> = {
  ASSET_STATUS_CHANGED: "bg-blue-100 text-blue-800 border-blue-300",
  ASSET_CREATED: "bg-green-100 text-green-800 border-green-300",
  ASSET_DELETED: "bg-red-100 text-red-800 border-red-300",
  RELATION_CREATED: "bg-purple-100 text-purple-800 border-purple-300",
  RELATION_DELETED: "bg-orange-100 text-orange-800 border-orange-300",
  MAINTENANCE_DUE: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CUSTOM_FIELD_CHANGED: "bg-cyan-100 text-cyan-800 border-cyan-300",
  SYSTEM: "bg-gray-100 text-gray-800 border-gray-300",
};

const notificationTypeLabels: Record<string, string> = {
  ASSET_STATUS_CHANGED: "Status Changed",
  ASSET_CREATED: "Asset Created",
  ASSET_DELETED: "Asset Deleted",
  RELATION_CREATED: "Relation Created",
  RELATION_DELETED: "Relation Deleted",
  MAINTENANCE_DUE: "Maintenance Due",
  CUSTOM_FIELD_CHANGED: "Field Changed",
  SYSTEM: "System",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="p-6 border-b">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
                <p className="text-gray-500 mt-1">
                  {unreadCount > 0 ? (
                    <span className="text-blue-600 font-medium">
                      {unreadCount} unread
                    </span>
                  ) : (
                    "All caught up!"
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setFilter(filter === "all" ? "unread" : "all")}
                  variant="outline"
                >
                  {filter === "all" ? "Show Unread" : "Show All"}
                </Button>
                {unreadCount > 0 && (
                  <Button onClick={markAllAsRead}>Mark All as Read</Button>
                )}
                {notifications.some((n) => n.read) && (
                  <Button onClick={deleteAllRead} variant="destructive">
                    Clear Read
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="divide-y">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="text-lg">
                  {filter === "unread"
                    ? "No unread notifications"
                    : "No notifications yet"}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    !notification.read ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Type Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        notificationTypeColors[notification.type] ||
                        "bg-gray-100 text-gray-800 border-gray-300"
                      }`}
                    >
                      {notificationTypeLabels[notification.type] ||
                        notification.type}
                    </span>

                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {notification.title}
                        </h3>
                        <span className="text-sm text-gray-400">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">{notification.message}</p>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Mark as read
                          </button>
                        )}
                        {notification.entityType === "ConfigurationItem" &&
                          notification.entityId && (
                            <Link
                              href={`/items?highlight=${notification.entityId}`}
                              className="text-sm text-green-600 hover:text-green-800 font-medium"
                            >
                              View Asset →
                            </Link>
                          )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-sm text-red-600 hover:text-red-800 font-medium ml-auto"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

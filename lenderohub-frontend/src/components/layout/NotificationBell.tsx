"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Info,
  CheckCheck,
} from "lucide-react";
import {
  notificationsService,
  type AppNotification,
} from "@/services/notifications.service";

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Map notification type to icon and color
 */
function getNotificationStyle(type: string) {
  switch (type) {
    case "transfer_received":
      return {
        icon: ArrowDownLeft,
        color: "text-emerald-500",
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
      };
    case "transfer_sent":
      return {
        icon: ArrowUpRight,
        color: "text-blue-500",
        bg: "bg-blue-100 dark:bg-blue-900/30",
      };
    case "transfer_failed":
      return {
        icon: AlertTriangle,
        color: "text-red-500",
        bg: "bg-red-100 dark:bg-red-900/30",
      };
    case "commission_approved":
      return {
        icon: CheckCircle2,
        color: "text-emerald-500",
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
      };
    case "commission_rejected":
      return {
        icon: XCircle,
        color: "text-red-500",
        bg: "bg-red-100 dark:bg-red-900/30",
      };
    case "commission_request":
      return {
        icon: FileText,
        color: "text-amber-500",
        bg: "bg-amber-100 dark:bg-amber-900/30",
      };
    case "monthly_charge":
      return {
        icon: DollarSign,
        color: "text-violet-500",
        bg: "bg-violet-100 dark:bg-violet-900/30",
      };
    case "system_alert":
    default:
      return {
        icon: Info,
        color: "text-gray-500",
        bg: "bg-gray-100 dark:bg-gray-900/30",
      };
  }
}

/**
 * Format relative time (e.g., "hace 5 min", "hace 2h")
 */
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr < 24) return `hace ${diffHr}h`;
  if (diffDay < 7) return `hace ${diffDay}d`;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationsService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    // Fetch immediately
    fetchUnreadCount();

    // Set up polling
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchUnreadCount]);

  // Load full notifications when dropdown opens
  useEffect(() => {
    if (!isOpen || loaded) return;

    const loadNotifications = async () => {
      try {
        setLoading(true);
        const res = await notificationsService.getNotifications({ limit: 15 });
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      } catch (error) {
        console.error("Error loading notifications:", error);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };

    loadNotifications();
  }, [isOpen, loaded]);

  const handleNotificationClick = async (notification: AppNotification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await notificationsService.markAsRead(notification._id);
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === notification._id ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Ignore
      }
    }

    // Navigate if link exists
    if (notification.link) {
      setIsOpen(false);
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    // Reset loaded state so it refreshes on next open
    if (!next) {
      setLoaded(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={handleToggle}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background shadow-lg z-50">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Notificaciones
                </p>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {unreadCount} sin leer
                  </p>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <CheckCheck size={14} />
                  Marcar todo como leido
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-[400px] overflow-auto">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Cargando notificaciones...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell
                    size={32}
                    className="mx-auto mb-2 text-muted-foreground/40"
                  />
                  <p className="text-sm text-muted-foreground">
                    No hay notificaciones
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const style = getNotificationStyle(notification.type);
                  const Icon = style.icon;

                  return (
                    <button
                      key={notification._id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full px-4 py-3 border-b border-border last:border-b-0 text-left transition-colors",
                        "hover:bg-accent/50",
                        !notification.isRead && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                            style.bg
                          )}
                        >
                          <Icon size={16} className={style.color} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={cn(
                                "text-sm truncate",
                                !notification.isRead
                                  ? "font-semibold text-foreground"
                                  : "font-medium text-foreground/80"
                              )}
                            >
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            {timeAgo(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStaffFetch } from "@/src/hooks/use-staff-auth";
import type { StaffNotification } from "@/src/types/staff";

type NotificationsState = {
  notifications: StaffNotification[];
  unreadCount: number;
};

export function useStaffNotifications(pollMs = 8000) {
  const staffFetch = useStaffFetch();
  const lastUnread = useRef(0);
  const permissionAsked = useRef(false);

  const requestBrowserPermission = useCallback(async () => {
    if (permissionAsked.current || typeof window === "undefined") return;
    permissionAsked.current = true;
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string, link?: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;

    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "darsi-staff",
    });
    n.onclick = () => {
      window.focus();
      if (link) window.location.href = link;
      n.close();
    };
  }, []);

  const fetchNotifications = useCallback(async (): Promise<NotificationsState | null> => {
    try {
      const res = await staffFetch("/api/staff/notifications");
      const json = await res.json();
      if (!res.ok) return null;

      const unreadCount = Number(json.unreadCount ?? 0);
      if (unreadCount > lastUnread.current && json.notifications?.length) {
        const latest = json.notifications.find(
          (n: StaffNotification) => !n.readAt
        ) as StaffNotification | undefined;
        if (latest) {
          showBrowserNotification(latest.title, latest.body ?? "", latest.linkPath ?? undefined);
        }
      }
      lastUnread.current = unreadCount;

      return {
        notifications: json.notifications ?? [],
        unreadCount,
      };
    } catch {
      return null;
    }
  }, [staffFetch, showBrowserNotification]);

  useEffect(() => {
    void requestBrowserPermission();
  }, [requestBrowserPermission]);

  return { fetchNotifications, pollMs, requestBrowserPermission };
}

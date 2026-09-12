"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSavedRecommendations } from "@/lib/saved-recommendations-context";
import { loadUnreadNotificationCount, onNotificationsRead } from "@/lib/notifications";

export function NotificationsNavLink() {
  const { userId } = useSavedRecommendations();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    let active = true;

    function refresh() {
      loadUnreadNotificationCount(uid)
        .then((count) => {
          if (active) setUnreadCount(count);
        })
        .catch(() => {});
    }

    refresh();
    const unsubscribe = onNotificationsRead(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  if (!userId) return null;

  return (
    <Link href="/notifications" className="nav-link">
      Pranešimai{unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
    </Link>
  );
}

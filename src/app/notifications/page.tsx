"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { loadProfileNames } from "@/lib/public-profiles";
import { loadNotifications, loadRecommendationTitles, notifyNotificationsRead, type Notification } from "@/lib/notifications";

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Vilnius" }).format(date);
}

function notificationText(notification: Notification, actorName: string, title: string) {
  if (notification.type === "comment_reply") {
    return `${actorName} atsakė į jūsų komentarą prie „${title}“.`;
  }
  return `${actorName} pakomentavo jūsų rekomendaciją „${title}“.`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const userIdRef = useRef<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let active = true;
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load(userId: string, requestVersion: number) {
      const isCurrent = () => active && requestVersion === version;
      try {
        const rows = await loadNotifications(userId);
        if (!isCurrent()) return;
        setNotifications(rows);
        const actorIds = rows.map((row) => row.actor_user_id).filter((id): id is string => id !== null);
        const [names, titleMap] = await Promise.all([
          loadProfileNames(actorIds),
          loadRecommendationTitles(rows.map((row) => row.recommendation_id)),
        ]);
        if (!isCurrent()) return;
        setActorNames(names);
        setTitles(titleMap);
      } catch (error) {
        if (isCurrent()) {
          setErrorMessage(uiErrorMessage(error, "Nepavyko įkelti pranešimų. Atnaujinkite puslapį ir bandykite dar kartą."));
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const requestVersion = ++version;
      clearTimeout(timer);
      const uid = session?.user?.id ?? null;
      // Clear the previous account's notifications immediately, including on logout.
      userIdRef.current = uid;
      setNotifications([]);
      setErrorMessage("");
      setSignedIn(Boolean(uid));
      setLoading(Boolean(uid));
      if (uid) {
        // Run Auth-dependent requests after the Auth event callback has finished.
        timer = setTimeout(() => {
          if (active) void load(uid, requestVersion);
        }, 0);
      }
    });

    return () => {
      active = false;
      version++;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function handleOpen(notification: Notification) {
    // Already-read notifications need no further UPDATE -- just navigate.
    if (notification.read_at !== null) {
      router.push(`/recommendations/${notification.recommendation_id}`);
      return;
    }
    const uid = userIdRef.current;
    if (uid) {
      const now = new Date().toISOString();
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ read_at: now })
          .eq("id", notification.id)
          .eq("user_id", uid);
        if (error) throw error;
        setNotifications((rows) => rows.map((row) => (row.id === notification.id ? { ...row, read_at: now } : row)));
        notifyNotificationsRead();
      } catch (error) {
        // Marking read is best-effort: log it, but still navigate below --
        // a failed read receipt must never trap the user on this page.
        console.error("Nepavyko pažymėti pranešimo kaip perskaityto.", error);
      }
    }
    router.push(`/recommendations/${notification.recommendation_id}`);
  }

  async function handleMarkAllRead() {
    const uid = userIdRef.current;
    const unreadIds = notifications.filter((row) => row.read_at === null).map((row) => row.id);
    if (!uid || markingAll || unreadIds.length === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("notifications").update({ read_at: now }).eq("user_id", uid).is("read_at", null);
    if (error) {
      setErrorMessage(uiErrorMessage(error, "Nepavyko pažymėti pranešimų kaip perskaitytų."));
    } else {
      setNotifications((rows) => rows.map((row) => (row.read_at === null ? { ...row, read_at: now } : row)));
      notifyNotificationsRead();
    }
    setMarkingAll(false);
  }

  const unreadCount = notifications.filter((row) => row.read_at === null).length;

  return (
    <main className="recommendations-page my-recommendations-page">
      <header className="homepage-header">
        <Link href="/" className="auth-link">← Visos rekomendacijos</Link>
      </header>
      <h1>Pranešimai</h1>
      {loading ? (
        <p role="status">Įkeliama…</p>
      ) : errorMessage ? (
        <p className="auth-error" role="alert">{errorMessage}</p>
      ) : !signedIn ? (
        <p>Norėdami matyti pranešimus, <Link href="/login" className="auth-link">prisijunkite</Link>.</p>
      ) : notifications.length === 0 ? (
        <>
          <p>Pranešimų dar nėra.</p>
          <p className="notifications-empty-hint">
            Čia matysite, kai kas nors pakomentuos jūsų rekomendaciją arba atsakys į jūsų komentarą.
          </p>
        </>
      ) : (
        <>
          {unreadCount > 0 && (
            <div className="notifications-toolbar">
              <button type="button" className="auth-link" disabled={markingAll} onClick={handleMarkAllRead}>
                Pažymėti visus kaip perskaitytus
              </button>
            </div>
          )}
          <ul className="notifications-list">
            {notifications.map((notification) => {
              const actorName = (notification.actor_user_id && actorNames[notification.actor_user_id]) || "Skaitytojas";
              const title = titles[notification.recommendation_id] || "";
              const isUnread = notification.read_at === null;
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={isUnread ? "notification-item notification-unread" : "notification-item"}
                    onClick={() => void handleOpen(notification)}
                  >
                    {isUnread && <span className="notification-badge-new">Nauja</span>}
                    <span className="notification-text">{notificationText(notification, actorName, title)}</span>
                    <time dateTime={notification.created_at} className="notification-time">
                      {formatNotificationDate(notification.created_at)}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

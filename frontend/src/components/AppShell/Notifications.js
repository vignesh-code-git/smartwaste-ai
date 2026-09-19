"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { api } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { updateSettings, useSettings } from "../../lib/settings";
import Icon from "../Icons/Icons";
import styles from "./Notifications.module.css";

const REFRESH_MS = 60000;

// Bell with recent high-severity reports and citizen issues.
export default function Notifications() {
  const settings = useSettings();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const overview = await api("overview/");
        if (cancelled) return;
        setEvents(overview.events);
        setError("");
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => event.key === "Escape" && setOpen(false);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const seenAt = settings.notificationsSeenAt ? new Date(settings.notificationsSeenAt).getTime() : 0;
  const visible = settings.alertsEnabled ? events : events.filter((event) => event.type !== "report");
  const unread = visible.filter((event) => new Date(event.created_at).getTime() > seenAt).length;

  const markRead = () => updateSettings({ notificationsSeenAt: new Date().toISOString() }).catch(() => {});

  return (
    <div className={styles.wrap} ref={panelRef}>
      <button
        className={styles.bell}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && <span className={styles.count}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.head}>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button onClick={markRead} className={styles.markRead}>
                Mark all read
              </button>
            )}
          </div>

          {error ? (
            <p className={styles.empty}>{error}</p>
          ) : visible.length === 0 ? (
            <p className={styles.empty}>You are all caught up.</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((event) => {
                const isUnread = new Date(event.created_at).getTime() > seenAt;
                return (
                  <li key={`${event.type}-${event.id}`}>
                    <Link href={event.link} onClick={() => setOpen(false)} className={isUnread ? styles.unread : ""}>
                      <span className={`${styles.icon} ${event.type === "report" ? styles.alert : styles.issue}`}>
                        <Icon name={event.type === "report" ? "alert" : "flag"} size={15} />
                      </span>
                      <span className={styles.body}>
                        <strong>{event.title}</strong>
                        <small>
                          {event.detail} · {formatDate(event.created_at, true)}
                        </small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

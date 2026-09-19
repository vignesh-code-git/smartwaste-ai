"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSettings } from "../../lib/settings";
import Icon, { Emblem } from "../Icons/Icons";
import styles from "./Sidebar.module.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

const HEALTH_POLL_MS = 30000;

export const NAV_SECTIONS = [
  {
    title: "Operations",
    items: [
      { href: "/", label: "Live Detection", icon: "live", badge: "LIVE" },
      { href: "/reports", label: "Detection Reports", icon: "reports" },
      { href: "/waste-map", label: "Waste Map", icon: "map" },
    ],
  },
  {
    title: "Field Management",
    items: [
      { href: "/cleanup-tasks", label: "Cleanup Tasks", icon: "tasks" },
      { href: "/priority-areas", label: "Priority Areas", icon: "alert" },
      { href: "/solutions", label: "Solutions", icon: "layers" },
    ],
  },
  {
    title: "Citizen Services",
    items: [
      { href: "/report-issue", label: "Report an Issue", icon: "flag" },
      { href: "/government-helpline", label: "Government Helpline", icon: "phone" },
      { href: "/help-support", label: "Help & Support", icon: "help" },
    ],
  },
];

export const SETTINGS_ITEM = {
  href: "/settings",
  label: "Settings",
  icon: "settings",
};

export function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function Sidebar({ open, onNavigate }) {
  const pathname = usePathname();
  const apiStatus = useApiStatus();
  const settings = useSettings();

  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : ""}`}>
      <div className={styles.brand}>
        <Emblem size={42} />
        <div>
          <strong>SmartWaste AI</strong>
          <span>Waste Monitoring Command Centre</span>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className={styles.section}>
            <p className={styles.sectionTitle}>{section.title}</p>

            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.bottom}>
        <div className={styles.systemCard}>
          <div className={styles.systemRow}>
            <span className={styles.systemLabel}>
              <Icon name="cpu" size={15} />
              Detection Engine
            </span>
            <span className={`${styles.systemState} ${styles[apiStatus]}`}>
              <i />
              {apiStatus === "online"
                ? "Online"
                : apiStatus === "offline"
                  ? "Offline"
                  : "Checking"}
            </span>
          </div>
          <div className={styles.systemMeta}>
            <span>Model</span>
            <b>YOLOE-26L</b>
          </div>
          <div className={styles.systemMeta}>
            <span>Jurisdiction</span>
            <b>
              {settings.defaultSiteDistrict
                ? `${settings.defaultSiteDistrict}, ${settings.defaultSiteState}`
                : "Not set"}
            </b>
          </div>
        </div>

        <NavLink
          item={SETTINGS_ITEM}
          active={isActive(pathname, SETTINGS_ITEM.href)}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}

function NavLink({ item, active, onNavigate }) {
  return (
    <Link
      href={item.href}
      className={`${styles.navItem} ${active ? styles.active : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon name={item.icon} size={18} />
      <span>{item.label}</span>
      {item.badge && <em className={styles.badge}>{item.badge}</em>}
    </Link>
  );
}

// Polls the backend health endpoint so the status reflects the real API.
function useApiStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(`${API_URL}/smartwaste/health/`, {
          cache: "no-store",
        });
        if (!cancelled) setStatus(response.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    check();
    const timer = setInterval(check, HEALTH_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return status;
}

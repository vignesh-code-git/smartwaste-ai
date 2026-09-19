"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useSettings } from "../../lib/settings";
import Icon from "../Icons/Icons";
import LocationPicker from "../LocationPicker/LocationPicker";
import GlobalSearch from "./GlobalSearch";
import Notifications from "./Notifications";
import Sidebar, { NAV_SECTIONS, SETTINGS_ITEM, isActive } from "../Sidebar/Sidebar";
import styles from "./AppShell.module.css";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useSettings();

  const current = findNavItem(pathname);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      <div className={styles.govBar}>
        <div className={styles.govStripe} aria-hidden="true" />
        <div className={styles.govInner}>
          <span className={styles.govTitle}>
            <Icon name="shieldCheck" size={14} />
            {settings.organisation}
            <span className={styles.govDivider}>|</span>
            <span className={styles.govSub}>Official Command Centre Portal</span>
          </span>
          <span className={styles.govRight}>
            <span>Public Sanitation &amp; Civic Services</span>
            <span className={styles.govDivider}>|</span>
            <span>English</span>
          </span>
        </div>
      </div>

      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />

      {menuOpen && (
        <button
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.topLeft}>
            <button
              className={styles.menuButton}
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? "close" : "menu"} size={20} />
            </button>

            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <span>Command Centre</span>
              <Icon name="chevron" size={14} />
              <span>{current.section}</span>
              <Icon name="chevron" size={14} />
              <strong>{current.label}</strong>
            </nav>
          </div>

          <GlobalSearch />

          <div className={styles.topRight}>
            <LocationPicker />

            <LiveClock />

            <Notifications />
          </div>
        </header>

        <div id="main-content" className={styles.content}>
          {children}
        </div>

        <footer className={styles.footer}>
          <span>
            © {new Date().getFullYear()} SmartWaste AI · Roadside Waste
            Monitoring Programme
          </span>
          <span>AI-assisted detection · Verify before field action</span>
        </footer>
      </div>
    </div>
  );
}

// Renders only after mount so the server and client never disagree on the time.
function LiveClock() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  return (
    <span className={`${styles.chip} ${styles.clock}`}>
      <Icon name="clock" size={15} />
      {now
        ? `${now.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })} · ${now.toLocaleTimeString("en-IN", { hour12: false })}`
        : "--"}
    </span>
  );
}

function findNavItem(pathname) {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((entry) => isActive(pathname, entry.href));
    if (item) return { section: section.title, label: item.label };
  }

  if (isActive(pathname, SETTINGS_ITEM.href)) {
    return { section: "System", label: SETTINGS_ITEM.label };
  }

  return { section: "Operations", label: "Overview" };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "../../lib/api";
import Icon from "../Icons/Icons";
import { NAV_SECTIONS, SETTINGS_ITEM } from "../Sidebar/Sidebar";
import styles from "./GlobalSearch.module.css";

const DEBOUNCE_MS = 220;

const GROUPS = [
  ["page", "Pages"],
  ["site", "Monitoring sites"],
  ["report", "Detection reports"],
  ["task", "Cleanup tasks"],
  ["issue", "Citizen issues"],
];

const ICONS = { page: "grid", site: "pin", report: "reports", task: "tasks", issue: "flag" };

const PAGES = [...NAV_SECTIONS.flatMap((section) => section.items), SETTINGS_ITEM].map((item) => ({
  type: "page",
  id: item.href,
  title: item.label,
  subtitle: "Go to page",
  link: item.href,
  icon: item.icon,
}));

// Search across pages, sites, reports, cleanup tasks and citizen issues.
// Ctrl+K (⌘K) focuses it from anywhere.
export default function GlobalSearch() {
  const router = useRouter();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Results are stored with the query they answer, so stale ones never show
  const [found, setFound] = useState({ query: "", results: [], error: "" });

  const term = query.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    if (!searching) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api(`search/?q=${encodeURIComponent(term)}`);
        if (!cancelled) setFound({ query: term, results: data.results, error: "" });
      } catch (error) {
        if (!cancelled) setFound({ query: term, results: [], error: error.message });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, searching]);

  const loading = searching && found.query !== term;

  const results = useMemo(() => {
    if (!searching) return [];
    const lowered = term.toLowerCase();
    const pages = PAGES.filter((page) => page.title.toLowerCase().includes(lowered));
    return [...pages, ...(found.query === term ? found.results : [])];
  }, [searching, term, found]);

  const grouped = GROUPS.map(([type, label]) => [label, results.filter((result) => result.type === type)]).filter(
    ([, items]) => items.length > 0
  );

  // Keyboard order follows the grouped display order
  const ordered = grouped.flatMap(([, items]) => items);
  const activeIndex = Math.min(active, Math.max(0, ordered.length - 1));

  // Ctrl+K / ⌘K focuses search
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const go = (result) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(result.link);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive(Math.min(activeIndex + 1, ordered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter" && ordered[activeIndex]) {
      event.preventDefault();
      go(ordered[activeIndex]);
    }
  };

  const showPanel = open && searching;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label className={`${styles.field} ${open ? styles.focused : ""}`}>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search sites, reports, tasks, issues…"
          aria-label="Search the command centre"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          role="combobox"
          autoComplete="off"
        />
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : <kbd className={styles.hint}>Ctrl K</kbd>}
      </label>

      {showPanel && (
        <div className={styles.panel} id="global-search-results" role="listbox">
          {grouped.length === 0 ? (
            <p className={styles.empty}>
              {loading ? "Searching…" : found.error ? found.error : <>No results for “{term}”</>}
            </p>
          ) : (
            grouped.map(([label, items]) => (
              <div key={label} className={styles.group}>
                <span className={styles.groupLabel}>{label}</span>
                {items.map((result) => {
                  const index = ordered.indexOf(result);
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`${styles.result} ${index === activeIndex ? styles.active : ""}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(result)}
                    >
                      <span className={`${styles.icon} ${styles[`icon_${result.type}`]}`}>
                        <Icon name={result.icon || ICONS[result.type]} size={15} />
                      </span>
                      <span className={styles.text}>
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </span>
                      <Icon name="arrowRight" size={14} className={styles.go} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
          <div className={styles.footer}>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate
            </span>
            <span>
              <kbd>Enter</kbd> open
            </span>
            <span>
              <kbd>Esc</kbd> close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

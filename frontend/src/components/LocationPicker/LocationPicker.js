"use client";

import { useEffect, useRef, useState } from "react";

import { api, useApi } from "../../lib/api";
import { updateSettings, useSettings } from "../../lib/settings";
import Icon from "../Icons/Icons";
import styles from "./LocationPicker.module.css";

const DEBOUNCE_MS = 300;

// The active monitoring location. Operators pick one of the registered
// sites or search any place in India; a new place becomes a monitoring site.
export default function LocationPicker({ className = "" }) {
  const settings = useSettings();
  const sites = useApi("sites/");
  const wrapRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [found, setFound] = useState({ query: "", sites: [], places: [], error: "" });
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState("");

  const term = query.trim();
  const searching = term.length >= 2;

  useEffect(() => {
    if (!searching) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api(`places/search/?q=${encodeURIComponent(term)}`);
        if (!cancelled) setFound({ query: term, ...data, error: "" });
      } catch (searchError) {
        if (!cancelled) setFound({ query: term, sites: [], places: [], error: searchError.message });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, searching]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const loading = searching && found.query !== term;
  const current = found.query === term ? found : { sites: [], places: [], error: "" };

  // Registered sites first, then places from the map
  const siteRows = (searching ? current.sites : (sites.data || []).slice(0, 8)).map((site) => ({
    kind: "site",
    key: `site-${site.id}`,
    site,
    title: site.name,
    subtitle: `${site.district}, ${site.state}`,
  }));

  const placeRows = searching
    ? current.places.map((place) => ({
        kind: "place",
        key: `place-${place.latitude},${place.longitude}`,
        place,
        title: place.name,
        subtitle: place.context || "India",
        tag: place.kind,
      }))
    : [];

  const rows = [...siteRows, ...placeRows];
  const activeIndex = Math.min(active, Math.max(0, rows.length - 1));

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const choose = async (row) => {
    setError("");

    if (row.kind === "site") {
      updateSettings({ defaultSite: String(row.site.id) }).catch((saveError) => setError(saveError.message));
      close();
      return;
    }

    setAdding(row.key);
    try {
      const site = await api("sites/from-place/", {
        method: "POST",
        body: { name: row.place.name, latitude: row.place.latitude, longitude: row.place.longitude },
      });
      await updateSettings({ defaultSite: String(site.id) });
      sites.reload();
      close();
    } catch (addError) {
      setError(addError.message);
    }
    setAdding(null);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter" && rows[activeIndex]) {
      event.preventDefault();
      choose(rows[activeIndex]);
    }
  };

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    setError("");
  };

  const renderRow = (row) => {
    const index = rows.indexOf(row);
    const selected = row.kind === "site" && String(row.site.id) === settings.defaultSite;

    return (
      <button
        key={row.key}
        role="option"
        aria-selected={index === activeIndex}
        className={`${styles.row} ${index === activeIndex ? styles.active : ""}`}
        onMouseEnter={() => setActive(index)}
        onClick={() => choose(row)}
        disabled={Boolean(adding)}
      >
        <span className={`${styles.rowIcon} ${row.kind === "place" ? styles.placeIcon : ""}`}>
          <Icon name={row.kind === "site" ? "pin" : "globe"} size={15} />
        </span>
        <span className={styles.rowText}>
          <strong>{row.title}</strong>
          <small>
            {row.subtitle}
            {row.tag && <em>{row.tag}</em>}
          </small>
        </span>
        {adding === row.key ? (
          <span className={styles.spinner} aria-label="Adding location" />
        ) : selected ? (
          <Icon name="check" size={16} className={styles.check} />
        ) : null}
      </button>
    );
  };

  return (
    <div className={`${styles.wrap} ${className}`} ref={wrapRef}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Change the active monitoring location"
      >
        <span className={styles.triggerIcon}>
          <Icon name="pin" size={15} />
        </span>
        <span className={styles.triggerText}>
          <strong>{settings.defaultSiteName || (settings.loaded ? "Choose location" : "Loading…")}</strong>
          {settings.defaultSiteName && (
            <small>
              {settings.defaultSiteDistrict}, {settings.defaultSiteState}
            </small>
          )}
        </span>
        <Icon name="chevronDown" size={15} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Choose monitoring location">
          <div className={styles.search}>
            <Icon name="search" size={16} />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search any city, town, road or landmark in India"
              aria-label="Search locations in India"
              autoComplete="off"
            />
            {loading && <span className={styles.spinner} aria-hidden="true" />}
          </div>

          <div className={styles.results} role="listbox">
            {error && <p className={styles.error}>{error}</p>}

            {siteRows.length > 0 && (
              <div className={styles.group}>
                <span className={styles.groupLabel}>{searching ? "Monitoring sites" : "Your monitoring sites"}</span>
                {siteRows.map(renderRow)}
              </div>
            )}

            {placeRows.length > 0 && (
              <div className={styles.group}>
                <span className={styles.groupLabel}>Places in India</span>
                {placeRows.map(renderRow)}
              </div>
            )}

            {searching && !loading && rows.length === 0 && (
              <p className={styles.empty}>{current.error || `No places in India match “${term}”.`}</p>
            )}

            {!searching && sites.loading && <p className={styles.empty}>Loading sites…</p>}
          </div>

          <p className={styles.footnote}>
            <Icon name="info" size={13} />
            Places from OpenStreetMap. Choosing one registers it as a monitoring site.
          </p>
        </div>
      )}
    </div>
  );
}

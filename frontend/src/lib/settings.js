"use client";

import { useSyncExternalStore } from "react";

import { api } from "./api";

// Command-centre preferences, stored in the database (SystemSettings) and
// shared by every page. Reads come from an in-memory copy that is fetched
// once and kept in sync with each change.

export const DEFAULT_SETTINGS = {
  loaded: false,
  organisation: "Roadside Waste Monitoring Programme",
  defaultSite: "",
  defaultSiteName: "",
  defaultSiteDistrict: "",
  defaultSiteState: "",
  minConfidence: 0.3,
  showOutlines: true,
  showBoxes: false,
  showLabels: true,
  alertsEnabled: true,
  notificationsSeenAt: null,
};

// camelCase field -> API field
const FIELDS = {
  organisation: "organisation",
  defaultSite: "default_site",
  minConfidence: "min_confidence",
  showOutlines: "show_outlines",
  showBoxes: "show_boxes",
  showLabels: "show_labels",
  alertsEnabled: "alerts_enabled",
  notificationsSeenAt: "notifications_seen_at",
};

const listeners = new Set();
let current = DEFAULT_SETTINGS;
let request = null;

function fromApi(data) {
  return {
    loaded: true,
    organisation: data.organisation,
    defaultSite: data.default_site ? String(data.default_site) : "",
    defaultSiteName: data.default_site_name || "",
    defaultSiteDistrict: data.default_site_district || "",
    defaultSiteState: data.default_site_state || "",
    minConfidence: data.min_confidence,
    showOutlines: data.show_outlines,
    showBoxes: data.show_boxes,
    showLabels: data.show_labels,
    alertsEnabled: data.alerts_enabled,
    notificationsSeenAt: data.notifications_seen_at,
  };
}

function publish(next) {
  current = next;
  listeners.forEach((listener) => listener());
}

function load() {
  if (!request) {
    request = api("settings/").then(
      (data) => publish(fromApi(data)),
      () => {
        // Keep defaults; the next subscriber retries
        request = null;
      }
    );
  }
  return request;
}

export function getSettings() {
  return current;
}

// Applies a change immediately and saves it; reverts if the save fails.
export async function updateSettings(patch) {
  const previous = current;
  publish({ ...current, ...patch });

  const body = {};
  for (const [key, value] of Object.entries(patch)) {
    if (FIELDS[key]) body[FIELDS[key]] = key === "defaultSite" ? (value ? Number(value) : null) : value;
  }

  try {
    publish(fromApi(await api("settings/", { method: "PATCH", body })));
  } catch (error) {
    publish(previous);
    throw error;
  }
}

// Restores the display and detection preferences; site and organisation stay.
export function resetSettings() {
  const { minConfidence, showOutlines, showBoxes, showLabels, alertsEnabled } = DEFAULT_SETTINGS;
  return updateSettings({ minConfidence, showOutlines, showBoxes, showLabels, alertsEnabled });
}

function subscribe(listener) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}

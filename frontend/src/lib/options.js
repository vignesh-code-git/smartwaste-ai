// Option lists for Dropdown, built from API data.

import { PRIORITY_META } from "./format";

const PRIORITY_COLORS = {
  low: "#16a34a",
  medium: "#eab308",
  high: "#f97316",
  critical: "#dc2626",
};

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_META).map(([value, meta]) => ({
  value,
  label: meta.label,
  color: PRIORITY_COLORS[value],
}));

export function siteOptions(sites) {
  return (sites || []).map((site) => ({
    value: String(site.id),
    label: site.name,
    hint: `${site.district}, ${site.state}`,
  }));
}

export function teamOptions(teams) {
  return (teams || [])
    .filter((team) => team.is_active)
    .map((team) => ({
      value: String(team.id),
      label: team.name,
      hint: team.supervisor || undefined,
    }));
}

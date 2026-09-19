// Display helpers shared by the operations pages.

export const SEVERITY_META = {
  clean: { label: "Clean", tone: "ok" },
  low: { label: "Low", tone: "ok" },
  moderate: { label: "Moderate", tone: "warn" },
  high: { label: "High", tone: "danger" },
  critical: { label: "Critical", tone: "critical" },
};

export const PRIORITY_META = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "warn" },
  high: { label: "High", tone: "danger" },
  critical: { label: "Critical", tone: "critical" },
};

export const REPORT_STATUS = {
  pending: { label: "Pending review", tone: "warn" },
  reviewed: { label: "Reviewed", tone: "info" },
  actioned: { label: "Cleanup assigned", tone: "accent" },
  resolved: { label: "Resolved", tone: "ok" },
};

export const TASK_STATUS = {
  open: { label: "Open", tone: "warn" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "ok" },
};

export const ISSUE_STATUS = {
  received: { label: "Received", tone: "warn" },
  assigned: { label: "Assigned", tone: "info" },
  resolved: { label: "Resolved", tone: "ok" },
};

export function severityFromCount(total) {
  if (total === 0) return "clean";
  if (total <= 5) return "low";
  if (total <= 15) return "moderate";
  if (total <= 30) return "high";
  return "critical";
}

export function reportCode(id) {
  return `RPT-${String(id).padStart(4, "0")}`;
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
}

export function timeAgo(value) {
  if (!value) return "—";

  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const units = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];

  for (const [size, name] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${name}${count === 1 ? "" : "s"} ago`;
    }
  }

  return "just now";
}

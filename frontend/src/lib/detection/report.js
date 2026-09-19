// Report exports for an analysed piece of footage.

import { MATERIALS } from "./overlay";

export function downloadCsv(tracks, meta) {
  const rows = [
    ["SmartWaste AI - Roadside Waste Detection Report"],
    ["Source", meta.source],
    ["Location", meta.location],
    ["Generated", new Date().toLocaleString("en-IN")],
    ["Items identified", meta.summary.total],
    ["Plastic items", meta.summary.plastic],
    ["Litter severity", meta.summary.severity.label],
    ["Minimum confidence", `${Math.round(meta.minConfidence * 100)}%`],
    [],
    ["Item ID", "Waste type", "Material", "First seen", "Last seen", "Peak confidence"],
    ...tracks.map((track) => [
      track.id,
      track.label,
      MATERIALS[track.material]?.label || track.material,
      formatTime(track.firstTime),
      formatTime(track.lastTime),
      `${Math.round(track.peak * 100)}%`,
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  downloadBlob(new Blob([csv], { type: "text/csv" }), `${fileStem()}.csv`);
}

export function downloadJson(tracks, meta) {
  const report = {
    generatedAt: new Date().toISOString(),
    source: meta.source,
    location: meta.location,
    minConfidence: meta.minConfidence,
    summary: {
      total: meta.summary.total,
      plastic: meta.summary.plastic,
      severity: meta.summary.severity.label,
      categories: meta.summary.categories,
    },
    items: tracks.map((track) => ({
      id: track.id,
      type: track.label,
      material: track.material,
      firstSeen: Number(track.firstTime.toFixed(2)),
      lastSeen: Number(track.lastTime.toFixed(2)),
      peakConfidence: Number(track.peak.toFixed(3)),
    })),
  };

  downloadBlob(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    `${fileStem()}.json`
  );
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatTime(seconds) {
  const total = Math.floor(seconds || 0);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function fileStem() {
  return `smartwaste-report-${new Date().toISOString().slice(0, 10)}`;
}

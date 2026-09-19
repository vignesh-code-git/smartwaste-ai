"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Icon from "../components/Icons/Icons";
import VideoStage from "../components/VideoStage/VideoStage";
import { Button, Dropdown, ErrorNote, Field, Modal } from "../components/ui/UI";
import { api, useApi } from "../lib/api";
import { MATERIALS } from "../lib/detection/overlay";
import { downloadCsv, formatTime } from "../lib/detection/report";
import { captureFrame, detectFrame, loadAnalysis, scanFootage } from "../lib/detection/scan";
import { buildTimeline, buildTracks, itemsAt, summarise } from "../lib/detection/tracking";
import { reportCode } from "../lib/format";
import { siteOptions } from "../lib/options";
import { useSettings } from "../lib/settings";
import styles from "./page.module.css";

const DEMO_VIDEO = "/demo/clean_Roadside.mp4";

// Written by `python manage.py analyse_video`, so the demo opens instantly
const DEMO_ANALYSIS = "/demo/clean_Roadside.analysis.json";

const MODES = [
  ["demo", "Demo Footage", "play"],
  ["upload", "Upload Footage", "upload"],
  ["camera", "Live Camera", "camera"],
];

// Recorded footage lists every item once; a live camera lists what is in view
const FOOTAGE_PANELS = [
  ["register", "Item Register", "list"],
  ["inventory", "Inventory", "grid"],
];

const CAMERA_PANELS = [
  ["view", "In View", "eye"],
  ["inventory", "Inventory", "grid"],
];

const NO_ITEMS = [];

export default function Home() {
  const playerRef = useRef(null);
  const loadingRef = useRef(new Set());
  const liveItemsRef = useRef([]);
  const streamRef = useRef(null);

  const [mode, setMode] = useState("demo");
  const [upload, setUpload] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [analyses, setAnalyses] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [camera, setCamera] = useState({ stream: null, size: null, rate: 0, error: "" });

  // Operator defaults from Settings, overridable for this session
  const settings = useSettings();
  const [overrides, setOverrides] = useState({});
  const minConfidence = overrides.minConfidence ?? settings.minConfidence;
  const location = settings.defaultSiteName
    ? `${settings.defaultSiteName}, ${settings.defaultSiteDistrict}`
    : "Monitoring site";
  const fullLocation = settings.defaultSiteName ? `${location}, ${settings.defaultSiteState}` : "No location selected";
  const [saving, setSaving] = useState(false);
  const [savedReport, setSavedReport] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [inView, setInView] = useState(NO_ITEMS);
  const [hiddenMaterials, setHiddenMaterials] = useState([]);
  const [panel, setPanel] = useState("register");
  // How far each footage has been watched: { [src]: { time, done } }
  const [watched, setWatched] = useState({});

  const src = mode === "demo" ? DEMO_VIDEO : mode === "upload" ? upload?.url || "" : "";
  const entry = analyses[src] || {};
  const analysis = entry.analysis || null;
  const isCamera = mode === "camera";

  // Results build up while the footage plays for the first time and are
  // final once it has been watched through; replays do not change them.
  const watch = watched[src] || { time: 0, done: false };
  const firstPassDone = Boolean(analysis?.complete && watch.done);
  const revealTime = watch.done ? Infinity : watch.time;

  const status = isCamera
    ? camera.stream
      ? "live"
      : "idle"
    : !src
      ? "idle"
      : entry.error
        ? "error"
        : firstPassDone
          ? "ready"
          : "scanning";

  const watchProgress = watch.done ? 1 : analysis?.duration ? Math.min(1, watch.time / analysis.duration) : 0;
  const scanProgress = analysis?.progress ?? (analysis ? 1 : 0);
  const progress = Math.round(Math.min(watchProgress, scanProgress) * 100);

  // ==================================================
  // TRACKS AND FILTERS
  // ==================================================

  const allTracks = useMemo(
    () => (analysis ? buildTracks(analysis.samples) : NO_ITEMS),
    [analysis]
  );

  const confidentTracks = useMemo(
    () => allTracks.filter((track) => track.peak >= minConfidence),
    [allTracks, minConfidence]
  );

  const tracks = useMemo(
    () => confidentTracks.filter((track) => !hiddenMaterials.includes(track.material)),
    [confidentTracks, hiddenMaterials]
  );

  // Items counted so far: those that have appeared during the first playback
  const counted = useMemo(
    () => tracks.filter((track) => track.firstTime <= revealTime),
    [tracks, revealTime]
  );

  const materialCounts = useMemo(
    () => summarise(confidentTracks.filter((track) => track.firstTime <= revealTime)).byMaterial,
    [confidentTracks, revealTime]
  );
  const summary = useMemo(() => summarise(isCamera ? inView : counted), [isCamera, inView, counted]);
  const timeline = useMemo(() => buildTimeline(analysis, tracks), [analysis, tracks]);

  const register = useMemo(
    () => [...counted].sort((a, b) => a.firstTime - b.firstTime),
    [counted]
  );

  const getItems = useCallback(
    (time) => {
      if (isCamera) {
        return liveItemsRef.current.filter(
          (item) => item.confidence >= minConfidence && !hiddenMaterials.includes(item.material)
        );
      }
      return analysis ? itemsAt(analysis, tracks, time) : NO_ITEMS;
    },
    [isCamera, analysis, tracks, minConfidence, hiddenMaterials]
  );

  const frameSize = isCamera
    ? camera.size
    : analysis
      ? { width: analysis.width, height: analysis.height }
      : null;

  // ==================================================
  // LOAD OR SCAN FOOTAGE
  // ==================================================

  useEffect(() => {
    if (!src || loadingRef.current.has(src)) return;

    const loading = loadingRef.current;
    let cancelled = false;
    let finished = false;

    const update = (patch) =>
      setAnalyses((previous) => ({
        ...previous,
        [src]: { ...previous[src], ...patch },
      }));

    const scan = () =>
      scanFootage(src, {
        isCancelled: () => cancelled,
        onUpdate: (result) => update({ analysis: result }),
      });

    loading.add(src);

    // The demo has a pre-computed analysis; anything else is scanned
    // progressively while it plays
    const job =
      src === DEMO_VIDEO
        ? loadAnalysis(DEMO_ANALYSIS).then((result) => {
            if (!cancelled) update({ analysis: result });
          }, scan)
        : scan();

    job.then(
      () => {
        finished = true;
      },
      (error) => {
        finished = true;
        if (!cancelled) update({ error: error.message });
      }
    );

    return () => {
      cancelled = true;
      // An interrupted scan restarts when this footage is reopened
      if (!finished) loading.delete(src);
    };
  }, [src, attempt]);

  // ==================================================
  // LIVE CAMERA
  // ==================================================

  useEffect(() => {
    if (!camera.stream) return;

    let active = true;
    const canvas = document.createElement("canvas");

    const loop = async () => {
      while (active) {
        const video = playerRef.current?.video;

        if (!video || video.readyState < 2) {
          await wait(200);
          continue;
        }

        const started = performance.now();

        try {
          const detections = await detectFrame(await captureFrame(video, canvas));
          if (!active) return;

          liveItemsRef.current = detections.map((detection, index) => ({
            ...detection,
            id: index + 1,
          }));

          const width = canvas.width;
          const height = canvas.height;

          setCamera((previous) => ({
            ...previous,
            error: "",
            rate: 1000 / (performance.now() - started),
            size:
              previous.size?.width === width && previous.size?.height === height
                ? previous.size
                : { width, height },
          }));
        } catch (error) {
          if (!active) return;
          setCamera((previous) => ({ ...previous, error: error.message }));
          await wait(2000);
        }
      }
    };

    loop();

    return () => {
      active = false;
    };
  }, [camera.stream]);

  // Release the camera when leaving the page
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamera({ stream, size: null, rate: 0, error: "" });
    } catch (error) {
      setCamera((previous) => ({
        ...previous,
        error:
          error.name === "NotAllowedError"
            ? "Camera access was blocked. Allow camera access in the browser to use live detection."
            : "No camera is available on this device.",
      }));
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    liveItemsRef.current = [];
    setCamera({ stream: null, size: null, rate: 0, error: "" });
  };

  // ==================================================
  // HANDLERS
  // ==================================================

  const resetView = () => {
    setInView(NO_ITEMS);
    setSelectedId(null);
    setSavedReport(null);
  };

  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    if (camera.stream) stopCamera();
    resetView();
    setMode(newMode);
  };

  const acceptFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setUploadError("Please choose a video file (MP4, MOV or WebM).");
      return;
    }

    // The previous file and its analysis are no longer reachable
    if (upload) {
      URL.revokeObjectURL(upload.url);
      loadingRef.current.delete(upload.url);
      setAnalyses((previous) => {
        const next = { ...previous };
        delete next[upload.url];
        return next;
      });
    }

    setUploadError("");
    resetView();
    setUpload({ url: URL.createObjectURL(file), name: file.name });
  };

  const handleRetry = () => {
    loadingRef.current.delete(src);
    setAnalyses((previous) => {
      const next = { ...previous };
      delete next[src];
      return next;
    });
    setAttempt((value) => value + 1);
  };

  const display = useMemo(
    () => ({
      outlines: overrides.outlines ?? settings.showOutlines,
      boxes: overrides.boxes ?? settings.showBoxes,
      labels: overrides.labels ?? settings.showLabels,
    }),
    [overrides, settings]
  );

  const toggleDisplay = useCallback(
    (key) => setOverrides((previous) => ({ ...previous, [key]: !display[key] })),
    [display]
  );

  const setMinConfidence = (value) => setOverrides((previous) => ({ ...previous, minConfidence: value }));

  const toggleMaterial = (material) =>
    setHiddenMaterials((previous) =>
      previous.includes(material)
        ? previous.filter((value) => value !== material)
        : [...previous, material]
    );

  const handleWatched = useCallback(
    (time, completed) =>
      setWatched((previous) => {
        const current = previous[src] || { time: 0, done: false };
        if (current.done || (!completed && time <= current.time)) return previous;
        return { ...previous, [src]: { time: Math.max(time, current.time), done: completed } };
      }),
    [src]
  );

  const selectItem = (item, time) => {
    if (selectedId === item.id) {
      setSelectedId(null);
      return;
    }

    setSelectedId(item.id);

    if (time !== undefined) {
      playerRef.current?.video?.pause();
      playerRef.current?.seek(time);
    }
  };

  const exportMeta = () => ({
    source: mode === "demo" ? "Demo footage" : upload?.name || "Uploaded footage",
    location,
    summary,
    minConfidence,
  });

  const handleInViewChange = useCallback((items) => setInView(items), []);

  // ==================================================
  // RENDER
  // ==================================================

  const showStage = isCamera ? Boolean(camera.stream) : Boolean(src);

  const panels = isCamera ? CAMERA_PANELS : FOOTAGE_PANELS;
  const activePanel = panels.some(([value]) => value === panel) ? panel : panels[0][0];

  const statusChip =
    status === "scanning"
      ? `Analysing ${progress}%`
      : status === "live" && camera.rate
        ? `Detecting · ${camera.rate.toFixed(1)}/s`
        : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Operations · Roadside Surveillance</span>
          <h1>Plastic Waste Detection</h1>
          <p className={styles.headerMeta}>
            <span>
              <Icon name="pin" size={14} />
              {fullLocation}
            </span>
            <span>
              <Icon name="camera" size={14} />
              CAM-01
            </span>
            <span>
              <Icon name="cpu" size={14} />
              YOLOE-26L detection engine
            </span>
          </p>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.segmented} role="tablist" aria-label="Footage source">
            {MODES.map(([value, label, icon]) => (
              <button
                key={value}
                role="tab"
                aria-selected={mode === value}
                className={mode === value ? styles.segmentActive : styles.segment}
                onClick={() => handleModeChange(value)}
              >
                <Icon name={icon} size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.workspace}>
        <section className={styles.playerCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <span className={styles.cardIcon}>
                <Icon name="camera" size={16} />
              </span>
              <div>
                <h2>Surveillance Feed</h2>
                <p>
                  CAM-01 ·{" "}
                  {mode === "demo"
                    ? location
                    : mode === "upload"
                      ? upload?.name || "No footage selected"
                      : camera.stream
                        ? "Live camera"
                        : "Not connected"}
                </p>
              </div>
            </div>

            {(showStage || analysis) && (
              <div className={styles.headerMetrics} aria-label="Detection results">
                <HeaderMetric label={isCamera ? "In view" : "Waste items"} value={analysis || isCamera ? summary.total : "—"} />
                <HeaderMetric label="Plastic" value={analysis || isCamera ? summary.plastic : "—"} tone="ok" />
                <HeaderMetric label="Other" value={analysis || isCamera ? summary.total - summary.plastic : "—"} />
                <HeaderMetric
                  label="Severity"
                  value={analysis || isCamera ? summary.severity.label : "—"}
                  tone={analysis || isCamera ? summary.severity.tone : "muted"}
                />
              </div>
            )}

            <div className={styles.cardActions}>
              {mode === "upload" && upload && (
                <label className={styles.ghostButton}>
                  <Icon name="upload" size={15} />
                  Replace
                  <input
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(event) => {
                      acceptFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              )}

              {isCamera && camera.stream && (
                <button className={styles.ghostButton} onClick={stopCamera}>
                  <Icon name="stop" size={14} />
                  Stop
                </button>
              )}

              {!isCamera && analysis && (
                <>
                  <button
                    className={styles.ghostButton}
                    onClick={() => downloadCsv(register, exportMeta())}
                    disabled={!firstPassDone}
                    title={firstPassDone ? "Download the item register as CSV" : "Available after the first full playback"}
                  >
                    <Icon name="download" size={15} />
                    CSV
                  </button>
                  {savedReport ? (
                    <Link href={`/reports?report=${savedReport.id}`} className={styles.savedLink}>
                      <Icon name="check" size={15} />
                      {reportCode(savedReport.id)}
                    </Link>
                  ) : (
                    <button
                      className={styles.primaryButton}
                      onClick={() => setSaving(true)}
                      disabled={!firstPassDone}
                      title={firstPassDone ? "File this analysis as a detection report" : "Available after the first full playback"}
                    >
                      <Icon name="reports" size={15} />
                      Save report
                    </button>
                  )}
                </>
              )}
            </div>

            {summary.total > 0 && (
              <div className={styles.stripBar} aria-hidden="true">
                {Object.entries(MATERIALS).map(([key, material]) =>
                  summary.byMaterial[key] ? (
                    <span
                      key={key}
                      style={{ width: `${(summary.byMaterial[key] / summary.total) * 100}%`, background: material.color }}
                    />
                  ) : null
                )}
              </div>
            )}
          </div>

          {mode === "upload" && !upload && (
            <UploadArea onFile={acceptFile} error={uploadError} />
          )}

          {isCamera && !camera.stream && (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>
                <Icon name="camera" size={26} />
              </div>
              <strong>Live camera detection</strong>
              <span>
                Connect this device&apos;s camera to detect roadside waste in
                real time with the same detection engine.
              </span>
              <button className={styles.primaryButton} onClick={startCamera}>
                <Icon name="play" size={14} />
                Start camera
              </button>
              {camera.error && <p className={styles.placeholderError}>{camera.error}</p>}
            </div>
          )}

          {showStage && (
            <div className={styles.stageWrap}>
              <div className={styles.stageFrame}>
                <VideoStage
                  key={isCamera ? "camera" : src}
                  src={src}
                  stream={isCamera ? camera.stream : null}
                  loop={mode === "demo"}
                  frameSize={frameSize}
                  getItems={getItems}
                  display={display}
                  selectedId={selectedId}
                  timeline={timeline}
                  coverage={analysis ? (analysis.complete ? 1 : lastSampleFraction(analysis)) : 0}
                  statusChip={statusChip}
                  snapshotCaption={`SmartWaste AI · CAM-01 · ${location}`}
                  playerRef={playerRef}
                  onInViewChange={handleInViewChange}
                  onToggleDisplay={toggleDisplay}
                  onWatched={isCamera ? undefined : handleWatched}
                  fullscreenDetails={<FullscreenSummary summary={summary} ready={Boolean(analysis) || isCamera} />}
                />
              </div>

              {status === "error" && (
                <div className={styles.errorBanner} role="alert">
                  <Icon name="alert" size={16} />
                  <span>{entry.error}</span>
                  <button className={styles.primaryButton} onClick={handleRetry}>
                    Retry analysis
                  </button>
                </div>
              )}

              {isCamera && camera.error && (
                <div className={styles.errorBanner} role="alert">
                  <Icon name="alert" size={16} />
                  <span>{camera.error}</span>
                </div>
              )}
            </div>
          )}

          <Toolbar
            minConfidence={minConfidence}
            onConfidenceChange={setMinConfidence}
            materialCounts={materialCounts}
            hiddenMaterials={hiddenMaterials}
            onToggleMaterial={toggleMaterial}
            display={display}
            onToggleDisplay={toggleDisplay}
            showCounts={!isCamera && Boolean(analysis)}
          />
        </section>

        <aside className={styles.side}>
          <section className={styles.results} aria-label="Detected items">
            <div className={styles.resultsHead}>
              <div>
                <h2>{isCamera ? "Live detections" : "Detected items"}</h2>
                <p>
                  {isCamera
                    ? "In the current frame"
                    : firstPassDone
                      ? "Found in the footage"
                      : "Added as the footage plays"}
                </p>
              </div>
              {status !== "idle" && <StatusPill status={status} progress={progress} />}
            </div>

            <div className={styles.tabs} role="tablist">
              {panels.map(([value, label, icon]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={activePanel === value}
                  className={activePanel === value ? styles.tabActive : styles.tab}
                  onClick={() => setPanel(value)}
                >
                  <Icon name={icon} size={15} />
                  {label}
                  <span className={styles.tabCount}>
                    {value === "view"
                      ? inView.length
                      : value === "register"
                        ? isCamera ? "—" : register.length
                        : summary.categories.length}
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.panelBody}>
              {activePanel === "view" && (
                <InViewList items={inView} selectedId={selectedId} onSelect={selectItem} status={status} />
              )}

              {activePanel === "register" && (
                <Register
                  tracks={register}
                  selectedId={selectedId}
                  onSelect={selectItem}
                  isCamera={isCamera}
                  scanning={status === "scanning"}
                />
              )}

              {activePanel === "inventory" && <Inventory summary={summary} />}
            </div>

            <div className={styles.shortcuts}>
              <Icon name="keyboard" size={14} />
              <span>
                <kbd>Space</kbd> play · <kbd>F</kbd> fullscreen · <kbd>S</kbd> snapshot · <kbd>O</kbd> outlines ·{" "}
                <kbd>←</kbd>
                <kbd>→</kbd> seek
              </span>
            </div>
          </section>
        </aside>
      </div>

      {saving && analysis && (
        <SaveReport
          defaultSite={settings.defaultSite}
          summary={summary}
          register={register}
          source={mode === "demo" ? "demo" : "upload"}
          sourceName={mode === "demo" ? "Demo footage · clean_Roadside.mp4" : upload?.name}
          onClose={() => setSaving(false)}
          onSaved={(report) => {
            setSaving(false);
            setSavedReport(report);
          }}
        />
      )}
    </main>
  );
}

// ==================================================
// COMPONENTS
// ==================================================

function SaveReport({ defaultSite, summary, register, source, sourceName, onClose, onSaved }) {
  const sites = useApi("sites/");
  const [site, setSite] = useState(defaultSite);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const report = await api("reports/", {
        method: "POST",
        body: {
          site: Number(site),
          source,
          source_name: sourceName || "",
          total_items: summary.total,
          plastic_items: summary.plastic,
          severity: summary.severity.label.toLowerCase(),
          items: register.map((track) => ({
            track: track.id,
            type: track.label,
            material: track.material,
            firstSeen: Number(track.firstTime.toFixed(2)),
            lastSeen: Number(track.lastTime.toFixed(2)),
            peakConfidence: Number(track.peak.toFixed(3)),
          })),
          notes,
        },
      });
      onSaved(report);
    } catch (saveError) {
      setError(saveError.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Save detection report"
      subtitle={`${summary.total} items · ${summary.plastic} plastic · ${summary.severity.label} severity`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="save-report" icon="check" disabled={busy}>
            {busy ? "Saving…" : "Save report"}
          </Button>
        </>
      }
    >
      <form id="save-report" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <ErrorNote message={error} />}
        <Field label="Monitoring site" required hint="Set a default site in Settings to skip this step">
          <Dropdown
            value={site}
            onChange={setSite}
            options={siteOptions(sites.data)}
            placeholder={sites.loading ? "Loading sites…" : "Select the site this footage covers"}
            required
          />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observations for the reviewing officer" />
        </Field>
      </form>
    </Modal>
  );
}

// Detection summary shown in the player's control bar in fullscreen
function FullscreenSummary({ summary, ready }) {
  return (
    <div className={styles.fsSummary}>
      <span>
        Identified <b>{ready ? summary.total : "—"}</b>
      </span>
      <span>
        Plastic <b className={styles.fsPlastic}>{ready ? summary.plastic : "—"}</b>
      </span>
      <span>
        Other <b>{ready ? summary.total - summary.plastic : "—"}</b>
      </span>
      <span>
        Severity <b className={styles[`fs_${summary.severity.tone}`]}>{ready ? summary.severity.label : "—"}</b>
      </span>
    </div>
  );
}

function StatusPill({ status, progress }) {
  const text = {
    idle: "Standby",
    scanning: `Analysing · ${progress}%`,
    ready: "Analysis complete",
    live: "Live detection",
    error: "Analysis failed",
  }[status];

  return (
    <span className={`${styles.status} ${styles[`status_${status}`]}`}>
      <i className={styles.statusDot} />
      {text}
    </span>
  );
}

function HeaderMetric({ label, value, tone }) {
  return (
    <div className={styles.headerMetric}>
      <strong className={tone ? styles[`text_${tone}`] : ""}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Toolbar({
  minConfidence,
  onConfidenceChange,
  materialCounts,
  hiddenMaterials,
  onToggleMaterial,
  display,
  onToggleDisplay,
  showCounts,
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <span className={styles.toolLabel}>
          <Icon name="sliders" size={14} />
          Min. confidence
        </span>
        <input
          type="range"
          min="0.25"
          max="0.9"
          step="0.05"
          value={minConfidence}
          onChange={(event) => onConfidenceChange(Number(event.target.value))}
          className={styles.range}
          aria-label="Minimum confidence"
          style={{ "--fill": `${((minConfidence - 0.25) / 0.65) * 100}%` }}
        />
        <b className={styles.rangeValue}>{Math.round(minConfidence * 100)}%</b>
      </div>

      <div className={styles.toolGroup}>
        <span className={styles.toolLabel}>Materials</span>
        {Object.entries(MATERIALS).map(([key, material]) => {
          const hidden = hiddenMaterials.includes(key);
          return (
            <button
              key={key}
              className={`${styles.chip} ${hidden ? styles.chipOff : styles.chipOn}`}
              onClick={() => onToggleMaterial(key)}
              aria-pressed={!hidden}
            >
              <i style={{ background: material.color }} />
              {material.label}
              {showCounts && <b>{materialCounts[key] || 0}</b>}
            </button>
          );
        })}
      </div>

      <div className={styles.toolGroup}>
        <span className={styles.toolLabel}>Display</span>
        {[
          ["outlines", "Outlines", "shape"],
          ["boxes", "Boxes", "box"],
          ["labels", "Labels", "tag"],
        ].map(([key, label, icon]) => (
          <button
            key={key}
            className={`${styles.chip} ${display[key] ? styles.chipOn : styles.chipOff}`}
            onClick={() => onToggleDisplay(key)}
            aria-pressed={display[key]}
          >
            <Icon name={icon} size={13} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UploadArea({ onFile, error }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      className={`${styles.placeholder} ${styles.dropZone} ${dragging ? styles.dragging : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFile(event.dataTransfer.files?.[0]);
      }}
    >
      <div className={styles.placeholderIcon}>
        <Icon name="upload" size={26} />
      </div>
      <strong>Drop roadside footage here</strong>
      <span>
        MP4, MOV or WebM. Playback starts immediately while the detection engine
        analyses the footage. Nothing leaves this system.
      </span>
      <em>Browse files</em>
      {error && <p className={styles.placeholderError}>{error}</p>}
      <input
        type="file"
        accept="video/*"
        hidden
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function InViewList({ items, selectedId, onSelect, status }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={status === "idle" ? "No footage selected" : "No litter in view"}
        text={
          status === "idle"
            ? "Choose demo footage, upload a video or start the camera."
            : "Play or scrub the footage to review detections."
        }
      />
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            className={`${styles.row} ${selectedId === item.id ? styles.rowActive : ""}`}
            onClick={() => onSelect(item)}
          >
            <span className={styles.dot} style={{ background: MATERIALS[item.material]?.color }} />
            <span className={styles.rowMain}>
              <strong>{item.label}</strong>
              <small>
                Item #{item.id} · {MATERIALS[item.material]?.label}
              </small>
            </span>
            <ConfidenceBar value={item.confidence} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Register({ tracks, selectedId, onSelect, isCamera, scanning }) {
  if (isCamera) {
    return (
      <EmptyState
        title="Not available for live cameras"
        text="The item register is built from recorded footage, where every item can be followed from start to end."
      />
    );
  }

  if (tracks.length === 0) {
    return (
      <EmptyState
        title={scanning ? "Building register…" : "No items registered"}
        text={scanning ? "Items appear here as the footage is analysed." : "No litter passed the current filters."}
      />
    );
  }

  return (
    <ul className={styles.list}>
      {tracks.map((track) => (
        <li key={track.id}>
          <button
            className={`${styles.row} ${selectedId === track.id ? styles.rowActive : ""}`}
            onClick={() => onSelect(track, track.peakTime)}
            title="Jump to the clearest view of this item"
          >
            <span className={styles.idBadge}>#{track.id}</span>
            <span className={styles.rowMain}>
              <strong>{track.label}</strong>
              <small>
                {formatTime(track.firstTime)} – {formatTime(track.lastTime)} ·{" "}
                {MATERIALS[track.material]?.label}
              </small>
            </span>
            <ConfidenceBar value={track.peak} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Inventory({ summary }) {
  if (summary.total === 0) {
    return <EmptyState title="Nothing to summarise" text="The breakdown appears once litter is detected." />;
  }

  return (
    <div className={styles.inventory}>
      <div className={`${styles.severity} ${styles[`severity_${summary.severity.tone}`]}`}>
        <span>Severity</span>
        <strong>{summary.severity.label}</strong>
        <small>{summary.severity.note}</small>
      </div>

      <div>
        <h3 className={styles.subhead}>By material</h3>
        <div className={styles.stack}>
          {Object.entries(MATERIALS).map(([key, material]) =>
            summary.byMaterial[key] ? (
              <span
                key={key}
                style={{
                  width: `${(summary.byMaterial[key] / summary.total) * 100}%`,
                  background: material.color,
                }}
                title={`${material.label}: ${summary.byMaterial[key]}`}
              />
            ) : null
          )}
        </div>
        <div className={styles.legend}>
          {Object.entries(MATERIALS).map(([key, material]) => (
            <span key={key}>
              <i style={{ background: material.color }} />
              {material.label} <b>{summary.byMaterial[key] || 0}</b>
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className={styles.subhead}>By waste type</h3>
        <ul className={styles.categories}>
          {summary.categories.map((category) => (
            <li key={category.label}>
              <div>
                <span>
                  <i style={{ background: MATERIALS[category.material]?.color }} />
                  {category.label}
                </span>
                <b>{category.count}</b>
              </div>
              <span className={styles.bar}>
                <span
                  style={{
                    width: `${(category.count / summary.total) * 100}%`,
                    background: MATERIALS[category.material]?.color,
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name="shieldCheck" size={20} />
      </div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function ConfidenceBar({ value }) {
  const percent = Math.round((value || 0) * 100);

  return (
    <span className={styles.confidence}>
      <b>{percent}%</b>
      <span className={styles.confidenceTrack}>
        <span style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

// ==================================================
// HELPERS
// ==================================================

function lastSampleFraction(analysis) {
  const last = analysis.samples.at(-1);
  return last && analysis.duration ? Math.min(1, last.time / analysis.duration) : 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

"use client";

import { useEffect, useRef, useState } from "react";

import Icon from "../Icons/Icons";
import Dropdown from "../ui/Dropdown";
import { captureSnapshot, renderOverlay } from "../../lib/detection/overlay";
import { downloadBlob, formatTime } from "../../lib/detection/report";
import styles from "./VideoStage.module.css";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const SEEK_STEP = 2;

// How often playback progress is reported to the page, in seconds of video
const WATCH_STEP = 0.2;

// Video player with the detection overlay drawn on top and a control bar
// underneath that is always visible. Fullscreen is applied to the whole
// stage, so the overlay, HUD and control bar come along; `fullscreenDetails`
// is shown inside the control bar there, never over the picture.
export default function VideoStage({
  src,
  stream,
  loop = false,
  frameSize,
  getItems,
  display,
  selectedId,
  timeline,
  coverage,
  statusChip,
  snapshotCaption,
  playerRef,
  onInViewChange,
  onToggleDisplay,
  onWatched,
  fullscreenDetails,
}) {
  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const progressRef = useRef(null);
  const timeRef = useRef(null);
  const controlTimeRef = useRef(null);
  const inViewKeyRef = useRef("");
  const draggingRef = useRef(false);
  const durationRef = useRef(0);
  const startedRef = useRef(false);
  const lastTimeRef = useRef(0);
  const reportedRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [hoverTime, setHoverTime] = useState(null);

  const isLive = Boolean(stream);

  // --------------------------------------------------
  // Source
  // --------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {});

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const startPlayback = (video) => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Chrome can abort a play() made before the first frame is decoded
    // ("background media paused to save power"), so try once more when it can play
    video.play().catch(() => {
      const retry = () => video.play().catch(() => {});
      if (video.readyState >= 3) setTimeout(retry, 400);
      else video.addEventListener("canplay", retry, { once: true });
    });
  };

  // Metadata may have loaded before hydration attached onLoadedMetadata
  useEffect(() => {
    const video = videoRef.current;
    if (video && !stream && video.readyState >= 1) startPlayback(video);
  });

  // --------------------------------------------------
  // Overlay loop
  // --------------------------------------------------

  useEffect(() => {
    let frame;

    const render = () => {
      const video = videoRef.current;

      if (video) {
        const items = getItems(video.currentTime);

        renderOverlay(canvasRef.current, frameSize, items, {
          ...display,
          selectedId,
          fit: isFullscreen ? "cover" : "contain",
        });

        const key = items
          .map((item) => `${item.id}:${item.label}:${Math.round(item.confidence * 20)}`)
          .join(",");

        if (key !== inViewKeyRef.current) {
          inViewKeyRef.current = key;
          onInViewChange(items);
        }

        if (!isLive && video.duration) {
          // Metadata can load before React attaches onLoadedMetadata
          if (video.duration !== durationRef.current) {
            durationRef.current = video.duration;
            setDuration(video.duration);
          }

          if (progressRef.current) {
            progressRef.current.style.width = `${(video.currentTime / video.duration) * 100}%`;
          }
          const time = formatTime(video.currentTime);
          if (timeRef.current) timeRef.current.textContent = time;
          if (controlTimeRef.current) controlTimeRef.current.textContent = time;

          reportWatched(video);
        }
      }

      frame = requestAnimationFrame(render);
    };

    // How far the footage has been watched; a jump back from the end
    // (a loop) means it has been watched through once
    const reportWatched = (video) => {
      if (!onWatched) return;

      const time = video.currentTime;
      const last = lastTimeRef.current;
      lastTimeRef.current = time;

      if (time < last - 1 && last > video.duration - 1.5) {
        onWatched(video.duration, true);
      } else if (time > reportedRef.current + WATCH_STEP) {
        reportedRef.current = time;
        onWatched(time, false);
      }
    };

    frame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frame);
  }, [getItems, frameSize, display, selectedId, isLive, isFullscreen, onInViewChange, onWatched]);

  // --------------------------------------------------
  // Player API for the page
  // --------------------------------------------------

  useEffect(() => {
    if (!playerRef) return;

    playerRef.current = {
      video: videoRef.current,
      seek: (time) => {
        const video = videoRef.current;
        if (!video || isLive) return;
        video.currentTime = time;
      },
    };
  });

  // --------------------------------------------------
  // Fullscreen
  // --------------------------------------------------

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen();
  };

  // --------------------------------------------------
  // Playback
  // --------------------------------------------------

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const seekBy = (seconds) => {
    const video = videoRef.current;
    if (!video || isLive) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), video.duration || 0);
  };

  const changeSpeed = (value) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  };

  const takeSnapshot = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;

    const size = frameSize || { width: video.videoWidth, height: video.videoHeight };
    const items = frameSize ? getItems(video.currentTime) : [];
    const moment = isLive
      ? new Date().toLocaleTimeString("en-IN", { hour12: false })
      : formatTime(video.currentTime);

    const blob = await captureSnapshot(
      video,
      size,
      items,
      { ...display, selectedId: null },
      `${snapshotCaption} · ${new Date().toLocaleDateString("en-IN")} · ${moment} · ${
        items.length
      } item${items.length === 1 ? "" : "s"} detected`
    );

    downloadBlob(blob, `smartwaste-evidence-${Date.now()}.png`);
  };

  // --------------------------------------------------
  // Keyboard shortcuts
  // --------------------------------------------------

  // Re-subscribed every render so the handlers see current state
  useEffect(() => {
    const shortcuts = {
      " ": togglePlay,
      k: togglePlay,
      f: toggleFullscreen,
      s: takeSnapshot,
      ArrowLeft: () => seekBy(-SEEK_STEP),
      ArrowRight: () => seekBy(SEEK_STEP),
      o: () => onToggleDisplay("outlines"),
      b: () => onToggleDisplay("boxes"),
      l: () => onToggleDisplay("labels"),
    };

    const onKeyDown = (event) => {
      const target = event.target;
      if (
        // Already handled, e.g. by a dropdown or button
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target.closest?.("input, select, textarea, [contenteditable]")
      ) {
        return;
      }

      const action = shortcuts[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!action) return;

      event.preventDefault();
      action();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // --------------------------------------------------
  // Scrubber
  // --------------------------------------------------

  const timeFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return fraction * (duration || 0);
  };

  const onScrubStart = (event) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (videoRef.current) videoRef.current.currentTime = timeFromPointer(event);
  };

  const onScrubMove = (event) => {
    const time = timeFromPointer(event);
    setHoverTime(time);
    if (draggingRef.current && videoRef.current) videoRef.current.currentTime = time;
  };

  const onScrubEnd = () => {
    draggingRef.current = false;
  };

  const peak = Math.max(1, ...timeline.map((point) => point.count));
  const barWidth = timeline.length > 1 ? (timeline[1].time - timeline[0].time) / (duration || 1) : 0;

  const toggles = [
    ["outlines", "Outlines", "shape", "O"],
    ["boxes", "Boxes", "box", "B"],
    ["labels", "Labels", "tag", "L"],
  ];

  return (
    <div ref={stageRef} className={`${styles.stage} ${isFullscreen ? styles.fullscreen : ""}`}>
      <div className={styles.viewport}>
        <video
          ref={videoRef}
          className={styles.video}
          src={stream ? undefined : src}
          preload="auto"
          loop={loop && !stream}
          muted
          playsInline
          disablePictureInPicture
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => onWatched?.(durationRef.current, true)}
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = speed;
            startPlayback(event.currentTarget);
          }}
        />

        <canvas ref={canvasRef} className={styles.overlay} />

        <div className={styles.hud}>
          <span className={`${styles.hudTag} ${isPlaying ? styles.rec : ""}`}>
            <i />
            {isLive ? "LIVE · CAM-01" : "CAM-01"}
          </span>
          {!isLive && (
            <span className={styles.hudTag} ref={timeRef}>
              00:00
            </span>
          )}
        </div>

        {statusChip && (
          <div className={styles.hudRight}>
            <span className={styles.statusChip}>{statusChip}</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        {!isLive && (
          <div
            className={styles.scrubber}
            onPointerDown={onScrubStart}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubEnd}
            onPointerLeave={() => setHoverTime(null)}
            title="Seek (← / → keys)"
          >
            <div className={styles.density} aria-hidden="true">
              {timeline.map((point) => (
                <span
                  key={point.time}
                  style={{
                    left: `${(point.time / (duration || 1)) * 100}%`,
                    width: `${barWidth * 100}%`,
                    height: `${(point.count / peak) * 100}%`,
                  }}
                />
              ))}
            </div>
            <div className={styles.track}>
              <span className={styles.coverage} style={{ width: `${coverage * 100}%` }} />
              <span ref={progressRef} className={styles.progress} />
            </div>
            {hoverTime !== null && (
              <span className={styles.hoverTime} style={{ left: `${(hoverTime / (duration || 1)) * 100}%` }}>
                {formatTime(hoverTime)}
              </span>
            )}
          </div>
        )}

        <div className={styles.controlRow}>
          <div className={styles.group}>
            <button
              className={`${styles.control} ${styles.play}`}
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              <Icon name={isPlaying ? "pause" : "play"} size={17} strokeWidth={2.2} />
            </button>

            {!isLive && (
              <>
                <button className={styles.control} onClick={() => seekBy(-SEEK_STEP)} aria-label="Back 2 seconds" title="Back 2 s (←)">
                  <Icon name="back" size={17} />
                </button>
                <button className={styles.control} onClick={() => seekBy(SEEK_STEP)} aria-label="Forward 2 seconds" title="Forward 2 s (→)">
                  <Icon name="forward" size={17} />
                </button>
                <span className={styles.time}>
                  <span ref={controlTimeRef}>00:00</span>
                  <i>/</i>
                  {formatTime(duration)}
                </span>
              </>
            )}
          </div>

          {isFullscreen && fullscreenDetails && <div className={styles.details}>{fullscreenDetails}</div>}

          <div className={styles.group}>
            {!isLive && (
              <Dropdown
                variant="dark"
                size="sm"
                className={styles.speed}
                label="Playback speed"
                value={speed}
                onChange={(value) => changeSpeed(Number(value))}
                options={SPEEDS.map((value) => [value, `${value}×`])}
              />
            )}

            <span className={styles.divider} aria-hidden="true" />

            {toggles.map(([key, label, icon, shortcut]) => (
              <button
                key={key}
                className={`${styles.control} ${display[key] ? styles.on : ""}`}
                onClick={() => onToggleDisplay(key)}
                aria-pressed={display[key]}
                aria-label={label}
                title={`${label} (${shortcut})`}
              >
                <Icon name={icon} size={17} />
              </button>
            ))}

            <span className={styles.divider} aria-hidden="true" />

            <button className={styles.control} onClick={takeSnapshot} aria-label="Save evidence snapshot" title="Evidence snapshot (S)">
              <Icon name="image" size={17} />
            </button>
            <button
              className={styles.control}
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              <Icon name={isFullscreen ? "shrink" : "expand"} size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

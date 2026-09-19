// Talks to the detection engine: pre-computed analyses, progressive scans
// of local footage, and single frames from a live camera.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

// Matches the detection engine's input size (IMAGE_SIZE in detection.py);
// larger frames only add upload time.
export const CAPTURE_WIDTH = 960;

// Footage is sampled every MIN_SAMPLE_STEP seconds, stretched for long
// videos so one scan never sends more than MAX_SAMPLES frames.
const MIN_SAMPLE_STEP = 0.4;
const MAX_SAMPLES = 150;

// Loads an analysis written by `manage.py analyse_video`.
export async function loadAnalysis(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Analysis not found (${response.status}).`);
  return { ...(await response.json()), complete: true };
}

// Scans footage frame by frame. `onUpdate` receives the analysis so far
// after every frame, so playback can start before the scan finishes.
export async function scanFootage(src, { isCancelled, onUpdate }) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;

  try {
    await waitFor(video, "loadeddata");

    const { duration, videoWidth, videoHeight } = video;

    if (!duration || !videoWidth || !videoHeight) {
      throw new Error("This video could not be read.");
    }

    const scale = Math.min(1, CAPTURE_WIDTH / videoWidth);
    const width = Math.round(videoWidth * scale);
    const height = Math.round(videoHeight * scale);

    const step = Math.max(MIN_SAMPLE_STEP, duration / MAX_SAMPLES);
    const times = [];
    for (let time = 0; time < duration - 0.05; time += step) times.push(time);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    const capture = async (time) => {
      await seekTo(video, Math.max(time, 0.01));
      context.drawImage(video, 0, 0, width, height);
      return toJpeg(canvas);
    };

    const samples = [];
    let nextFrame = capture(times[0]);

    for (const [index, time] of times.entries()) {
      if (isCancelled()) return null;

      const frame = await nextFrame;

      // Seeking decodes from the previous keyframe, which is slow; do it
      // for the next sample while the detection engine handles this one
      nextFrame = index + 1 < times.length ? capture(times[index + 1]) : null;

      samples.push({ time, detections: await detectFrame(frame) });

      if (isCancelled()) return null;

      onUpdate({
        duration,
        width,
        height,
        samples: [...samples],
        progress: (index + 1) / times.length,
        complete: index + 1 === times.length,
      });
    }

    return true;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

// Captures the current frame of a playing video (e.g. a camera stream).
export function captureFrame(video, canvas) {
  const scale = Math.min(1, CAPTURE_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return toJpeg(canvas);
}

export async function detectFrame(frame) {
  const formData = new FormData();
  formData.append("frame", frame, "frame.jpg");

  let response;

  try {
    response = await fetch(`${API_URL}/smartwaste/detect-frame/`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "The detection engine is unreachable. Check that the backend server is running."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Detection engine error (${response.status}).`);
  }

  return data.detections || [];
}

function toJpeg(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

function waitFor(video, event) {
  return new Promise((resolve, reject) => {
    video.addEventListener(event, resolve, { once: true });
    video.addEventListener(
      "error",
      () => reject(new Error("This video format is not supported by the browser.")),
      { once: true }
    );
  });
}

function seekTo(video, time) {
  return new Promise((resolve) => {
    video.addEventListener("seeked", resolve, { once: true });
    video.currentTime = time;
  });
}

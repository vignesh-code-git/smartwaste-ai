// Links per-frame detections into tracked items, so each physical piece of
// litter is counted once, and interpolates their positions for playback.
//
// The constants were tuned on the demo footage, where the camera moves
// quickly towards the litter and several items change apparent label as
// they come closer (a carton read as "snack packet", a packet as "bag").

// Sightings in nearby samples are the same item when their boxes overlap
// this much, or their centres sit this close relative to the box size,
// after projecting the item forward along its recent motion.
const TRACK_IOU = 0.1;
const TRACK_CENTRE_RATIO = 1.2;

// Matches across labels are allowed but penalised; more so across materials.
const LABEL_PENALTY = 0.8;
const MATERIAL_PENALTY = 0.6;

// An item may go undetected this long before its track is closed.
const MAX_GAP_SECONDS = 0.6;

// Real items stay in view at least this long; shorter tracks are noise
// unless a single sighting is this confident.
const MIN_TRACK_SECONDS = 0.4;
const SOLO_CONFIDENCE = 0.5;

export const SEVERITY = [
  { max: 0, label: "Clean", tone: "ok", note: "No litter found" },
  { max: 5, label: "Low", tone: "ok", note: "Routine cleanup" },
  { max: 15, label: "Moderate", tone: "warn", note: "Schedule cleanup" },
  { max: 30, label: "High", tone: "danger", note: "Priority cleanup" },
  { max: Infinity, label: "Critical", tone: "danger", note: "Immediate action" },
];

export function sampleStep(samples) {
  return samples.length > 1 ? samples[1].time - samples[0].time : 0.4;
}

export function buildTracks(samples) {
  const step = sampleStep(samples);
  const maxGap = Math.max(1, Math.round(MAX_GAP_SECONDS / step));
  const minPoints = Math.max(2, Math.round(MIN_TRACK_SECONDS / step) + 1);
  const tracks = [];

  samples.forEach((sample, index) => {
    const open = tracks.filter((track) => index - track.lastIndex <= maxGap + 1);
    const claimed = new Set();

    // Confident detections pick their track first
    const detections = [...sample.detections].sort(
      (a, b) => b.confidence - a.confidence
    );

    for (const detection of detections) {
      let match = null;
      let bestScore = 0;

      for (const track of open) {
        if (claimed.has(track)) continue;

        const steps = index - track.lastIndex;
        const predicted = shiftBox(
          track.points.get(track.lastIndex).box,
          track.velocity.x * steps,
          track.velocity.y * steps
        );

        let score = matchScore(predicted, detection.box);

        if (!track.labels.has(detection.label)) {
          score *= detection.material === track.material ? LABEL_PENALTY : MATERIAL_PENALTY;
        }

        if (score > bestScore) {
          match = track;
          bestScore = score;
        }
      }

      if (match) {
        const [fromX, fromY] = centre(match.points.get(match.lastIndex).box);
        const [toX, toY] = centre(detection.box);
        const steps = index - match.lastIndex;
        match.velocity = { x: (toX - fromX) / steps, y: (toY - fromY) / steps };
      } else {
        match = {
          material: detection.material,
          labels: new Map(),
          points: new Map(),
          velocity: { x: 0, y: 0 },
          peak: 0,
          firstIndex: index,
          firstTime: sample.time,
        };
        tracks.push(match);
      }

      claimed.add(match);
      match.points.set(index, detection);
      match.lastIndex = index;
      match.lastTime = sample.time;
      if (detection.confidence > match.peak) {
        match.peak = detection.confidence;
        match.peakTime = sample.time;
      }

      // Labels are weighted by confidence; the heaviest names the item
      const entry = match.labels.get(detection.label) || {
        weight: 0,
        material: detection.material,
      };
      entry.weight += detection.confidence;
      match.labels.set(detection.label, entry);
    }
  });

  return tracks
    .filter((track) => track.points.size >= minPoints || track.peak >= SOLO_CONFIDENCE)
    .map((track, index) => {
      const [label, { material }] = [...track.labels].sort(
        (a, b) => b[1].weight - a[1].weight
      )[0];

      return {
        id: index + 1,
        label,
        material,
        points: track.points,
        peak: track.peak,
        peakTime: track.peakTime,
        firstIndex: track.firstIndex,
        lastIndex: track.lastIndex,
        firstTime: track.firstTime,
        lastTime: track.lastTime,
      };
    });
}

// Tracked items at a playback time, with boxes and outlines interpolated
// between the samples either side of it.
export function itemsAt(analysis, tracks, time) {
  const { samples } = analysis;
  if (samples.length === 0) return [];

  const step = sampleStep(samples);

  let index = samples.findIndex((sample) => sample.time > time) - 1;
  if (index === -2) index = samples.length - 1;
  if (index < 0) index = 0;

  const current = samples[index];
  const next = samples[index + 1];

  // Past the end of the footage analysed so far
  if (!next && time - current.time > step) return [];

  const fraction = next
    ? Math.min(1, Math.max(0, (time - current.time) / (next.time - current.time)))
    : 0;

  const items = [];

  for (const track of tracks) {
    const from = track.points.get(index);
    const to = track.points.get(index + 1);
    let source;
    let box;
    let confidence;

    if (from && to) {
      source = fraction < 0.5 ? from : to;
      box = lerpBox(from.box, to.box, fraction);
      confidence = from.confidence + (to.confidence - from.confidence) * fraction;
    } else if (from && fraction < 0.5) {
      source = from;
      box = from.box;
      confidence = from.confidence;
    } else if (to && fraction >= 0.5) {
      source = to;
      box = to.box;
      confidence = to.confidence;
    } else {
      continue;
    }

    items.push({
      id: track.id,
      label: track.label,
      material: track.material,
      confidence,
      box,
      outline: fitOutline(source.outline, source.box, box),
    });
  }

  return items.sort((a, b) => b.confidence - a.confidence);
}

export function summarise(tracks) {
  const byLabel = new Map();
  const byMaterial = {};

  for (const track of tracks) {
    const entry = byLabel.get(track.label) || {
      label: track.label,
      material: track.material,
      count: 0,
    };
    entry.count += 1;
    byLabel.set(track.label, entry);
    byMaterial[track.material] = (byMaterial[track.material] || 0) + 1;
  }

  const total = tracks.length;

  return {
    total,
    plastic: byMaterial.plastic || 0,
    byMaterial,
    categories: [...byLabel.values()].sort((a, b) => b.count - a.count),
    severity: SEVERITY.find((level) => total <= level.max),
  };
}

// Number of tracked items visible at each sample, for the timeline.
export function buildTimeline(analysis, tracks) {
  if (!analysis) return [];

  return analysis.samples.map((sample, index) => ({
    time: sample.time,
    count: tracks.filter((track) => track.points.has(index)).length,
  }));
}

function matchScore(a, b) {
  const overlap = iou(a, b);
  if (overlap >= TRACK_IOU) return 1 + overlap;

  const size = Math.max(a.x2 - a.x1, a.y2 - a.y1, b.x2 - b.x1, b.y2 - b.y1);
  const [ax, ay] = centre(a);
  const [bx, by] = centre(b);
  const distance = Math.hypot(ax - bx, ay - by);
  const reach = size * TRACK_CENTRE_RATIO;

  return distance < reach ? 1 - distance / reach : 0;
}

function iou(a, b) {
  const width = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const height = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (width <= 0 || height <= 0) return 0;

  const intersection = width * height;
  const union =
    (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - intersection;

  return intersection / union;
}

function centre(box) {
  return [(box.x1 + box.x2) / 2, (box.y1 + box.y2) / 2];
}

function shiftBox(box, dx, dy) {
  return { x1: box.x1 + dx, y1: box.y1 + dy, x2: box.x2 + dx, y2: box.y2 + dy };
}

function lerpBox(a, b, t) {
  return {
    x1: a.x1 + (b.x1 - a.x1) * t,
    y1: a.y1 + (b.y1 - a.y1) * t,
    x2: a.x2 + (b.x2 - a.x2) * t,
    y2: a.y2 + (b.y2 - a.y2) * t,
  };
}

// Moves an outline drawn around one box onto another box.
function fitOutline(outline, from, to) {
  if (!outline || outline.length < 3) return null;

  const scaleX = (to.x2 - to.x1) / Math.max(1, from.x2 - from.x1);
  const scaleY = (to.y2 - to.y1) / Math.max(1, from.y2 - from.y1);

  return outline.map(([x, y]) => [
    to.x1 + (x - from.x1) * scaleX,
    to.y1 + (y - from.y1) * scaleY,
  ]);
}

// Draws detections over video: on the live overlay canvas, and onto
// full-resolution evidence snapshots.

export const MATERIALS = {
  plastic: { label: "Plastic", color: "#22c55e" },
  metal: { label: "Metal", color: "#3b82f6" },
  paper: { label: "Paper", color: "#f59e0b" },
};

export function materialColor(material) {
  return MATERIALS[material]?.color || MATERIALS.plastic.color;
}

// Renders items onto the overlay canvas, matching the video's letterboxed
// position inside its container (object-fit: contain).
export function renderOverlay(canvas, frameSize, items, options) {
  if (!canvas) return;

  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = container.clientHeight;
  const ratio = window.devicePixelRatio || 1;

  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }

  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  if (!frameSize || items.length === 0) return;

  // "cover" fills the container and crops, matching object-fit: cover
  const fit = options.fit === "cover" ? Math.max : Math.min;
  const scale = fit(width / frameSize.width, height / frameSize.height);

  drawItems(context, items, {
    ...options,
    scale,
    offsetX: (width - frameSize.width * scale) / 2,
    offsetY: (height - frameSize.height * scale) / 2,
    fontSize: width > 1200 ? 14 : 12,
  });
}

// A PNG of the current video frame with detections and a caption band.
export function captureSnapshot(video, frameSize, items, options, caption) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const band = Math.round(height * 0.07);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + band;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);

  drawItems(context, items, {
    ...options,
    scale: width / frameSize.width,
    offsetX: 0,
    offsetY: 0,
    fontSize: Math.max(14, Math.round(width / 70)),
  });

  context.fillStyle = "#0f3d2a";
  context.fillRect(0, height, width, band);
  context.fillStyle = "#ffffff";
  context.font = `600 ${Math.round(band * 0.36)}px system-ui, sans-serif`;
  context.textBaseline = "middle";
  context.fillText(caption, band * 0.4, height + band / 2);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function drawItems(context, items, options) {
  const { scale, offsetX, offsetY, fontSize, selectedId } = options;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);

  context.lineJoin = "round";
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = "alphabetic";

  for (const item of items) {
    const color = materialColor(item.material);
    const selected = item.id === selectedId;
    const x = offsetX + item.box.x1 * scale;
    const y = offsetY + item.box.y1 * scale;
    const w = (item.box.x2 - item.box.x1) * scale;
    const h = (item.box.y2 - item.box.y1) * scale;

    if (options.outlines && item.outline) {
      context.beginPath();
      item.outline.forEach(([px, py], index) => {
        const sx = offsetX + px * scale;
        const sy = offsetY + py * scale;
        if (index === 0) context.moveTo(sx, sy);
        else context.lineTo(sx, sy);
      });
      context.closePath();
      context.fillStyle = hexToRgba(color, selected ? 0.35 : 0.22);
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = selected ? 3 : 2;
      context.stroke();
    }

    if (options.boxes || !item.outline || !options.outlines) {
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.setLineDash(options.outlines && item.outline ? [5, 4] : []);
      context.strokeRect(x, y, w, h);
      context.setLineDash([]);
      drawCorners(context, x, y, w, h, color);
    }

    if (selected) {
      const grow = 6 + pulse * 6;
      context.strokeStyle = hexToRgba("#ffffff", 0.5 + pulse * 0.5);
      context.lineWidth = 2;
      context.strokeRect(x - grow, y - grow, w + grow * 2, h + grow * 2);
    }

    if (options.labels) {
      const text = `#${item.id} ${item.label}  ${Math.round(item.confidence * 100)}%`;
      const labelHeight = fontSize + 10;
      const labelWidth = context.measureText(text).width + 16;
      const labelY = y - labelHeight - 2 < 0 ? y + h + 2 : y - labelHeight - 2;

      context.fillStyle = selected ? color : "rgba(9, 32, 21, 0.88)";
      roundRect(context, x, labelY, labelWidth, labelHeight, 4);
      context.fill();
      context.fillStyle = selected ? "#04150c" : color;
      context.fillRect(x, labelY, 3, labelHeight);
      context.fillStyle = selected ? "#04150c" : "#ffffff";
      context.fillText(text, x + 9, labelY + labelHeight - 7);
    }
  }
}

function drawCorners(context, x, y, w, h, color) {
  const size = Math.min(12, w / 3, h / 3);

  context.strokeStyle = color;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x, y + size);
  context.lineTo(x, y);
  context.lineTo(x + size, y);
  context.moveTo(x + w - size, y);
  context.lineTo(x + w, y);
  context.lineTo(x + w, y + size);
  context.moveTo(x + w, y + h - size);
  context.lineTo(x + w, y + h);
  context.lineTo(x + w - size, y + h);
  context.moveTo(x + size, y + h);
  context.lineTo(x, y + h);
  context.lineTo(x, y + h - size);
  context.stroke();
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function hexToRgba(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

import { useState, useEffect, useRef } from 'react';

// src/hand/landmarks.ts
var WRIST = 0;
var MIDDLE_MCP = 9;
var FINGERTIPS = [8, 12, 16, 20];
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function at(hand, index) {
  const point = hand[index];
  return point === void 0 ? null : point;
}
function palmSpan(hand) {
  const wrist = at(hand, WRIST);
  const mcp = at(hand, MIDDLE_MCP);
  if (wrist === null || mcp === null) return null;
  const span = distance(wrist, mcp);
  return span > 0 ? span : null;
}
function graspRatio(hand) {
  const wrist = at(hand, WRIST);
  const span = palmSpan(hand);
  if (wrist === null || span === null) return null;
  let total = 0;
  for (const tip of FINGERTIPS) {
    const point = at(hand, tip);
    if (point === null) return null;
    total += distance(wrist, point);
  }
  return total / FINGERTIPS.length / span;
}
var GRASP_DEFAULTS = { close: 1.5, open: 1.8 };
function nextGrasp(previous, ratio, thresholds = GRASP_DEFAULTS) {
  if (ratio === null) return previous;
  if (previous) return ratio <= thresholds.open;
  return ratio < thresholds.close;
}
var MIN_SCAN_WIDTH = 0.34;
function initialRange(center = 0.5, width = MIN_SCAN_WIDTH) {
  return { low: center - width / 2, high: center + width / 2 };
}
function widenRange(range, x) {
  if (x < range.low) return { low: x, high: range.high };
  if (x > range.high) return { low: range.low, high: x };
  return range;
}
var SCAN_STICKINESS = 0.25;
function stickyIndex(previous, position, count, stickiness = SCAN_STICKINESS) {
  const clamped = Math.min(Math.max(position, 0), count - 1);
  if (previous === null) return Math.round(clamped);
  const held = Math.min(Math.max(previous, 0), count - 1);
  return Math.abs(clamped - held) <= 0.5 + stickiness ? held : Math.round(clamped);
}
function scanIndex(hand, options) {
  const { count, range } = options;
  if (count <= 0) return null;
  const palm = at(hand, MIDDLE_MCP);
  if (palm === null) return null;
  const x = options.mirror ?? true ? 1 - palm.x : palm.x;
  const width = range.high - range.low;
  if (width <= 0) return null;
  const t = Math.min(Math.max((x - range.low) / width, 0), 1);
  return stickyIndex(options.previous ?? null, t * (count - 1), count, options.stickiness);
}
var WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
var MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
function useHandPointer(options) {
  const { count, enabled } = options;
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  const active = enabled && visible;
  const [status, setStatus] = useState("idle");
  const [index, setIndex] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [handLost, setHandLost] = useState(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useEffect(() => {
    if (!active) {
      setStatus("idle");
      setIndex(null);
      setCommitting(false);
      setHandLost(true);
      return;
    }
    let cancelled = false;
    let frame = 0;
    let stream = null;
    let video = null;
    let landmarker = null;
    let grasped = false;
    let target = null;
    let range = initialRange();
    async function start() {
      try {
        setStatus("loading");
        const vision = await import('@mediapipe/tasks-vision');
        if (cancelled) return;
        const fileset = await vision.FilesetResolver.forVisionTasks(
          optionsRef.current.wasmPath ?? WASM_CDN
        );
        if (cancelled) return;
        const created = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: optionsRef.current.modelPath ?? MODEL_CDN },
          // 只追一隻手。第二隻手進畫面會讓指標在兩者之間跳。
          numHands: 1,
          runningMode: "VIDEO"
        });
        if (cancelled) {
          created.close();
          return;
        }
        landmarker = created;
        setStatus("requesting");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 }
        });
        if (cancelled) return;
        video = document.createElement("video");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
        video.srcObject = stream;
        document.body.appendChild(video);
        await video.play();
        if (cancelled) return;
        setStatus("running");
        loop();
      } catch (cause) {
        if (cancelled) return;
        const name = cause instanceof Error ? cause.name : "";
        setStatus(
          name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported"
        );
      }
    }
    function loop() {
      frame = requestAnimationFrame(loop);
      if (video === null || landmarker === null || video.readyState < 2) return;
      const result = landmarker.detectForVideo(video, performance.now());
      const hand = result.landmarks[0];
      if (hand === void 0 || hand.length === 0) {
        setHandLost(true);
        target = null;
        setIndex(null);
        return;
      }
      setHandLost(false);
      const current = optionsRef.current;
      const mirror = current.mirror ?? true;
      const palm = hand[MIDDLE_MCP];
      if (palm !== void 0) range = widenRange(range, mirror ? 1 - palm.x : palm.x);
      const next = scanIndex(hand, { count: current.count, mirror, range, previous: target });
      if (next !== target) {
        target = next;
        setIndex(next);
      }
      grasped = nextGrasp(grasped, graspRatio(hand), current.grasp ?? GRASP_DEFAULTS);
      setCommitting((previous) => previous === grasped ? previous : grasped);
    }
    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      landmarker?.close();
      stream?.getTracks().forEach((track) => track.stop());
      if (video !== null) {
        video.srcObject = null;
        video.remove();
      }
    };
  }, [active, count]);
  return {
    signal: index === null ? null : { kind: "index", value: index },
    committing,
    status,
    handLost
  };
}

export { FINGERTIPS, GRASP_DEFAULTS, MIDDLE_MCP, MIN_SCAN_WIDTH, SCAN_STICKINESS, WRIST, graspRatio, initialRange, nextGrasp, palmSpan, scanIndex, stickyIndex, useHandPointer, widenRange };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
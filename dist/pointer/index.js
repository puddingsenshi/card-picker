import { useState, useEffect, useRef } from 'react';

// src/pointer/resolve.ts
function defaultHitTest(x, y) {
  if (typeof document === "undefined") return null;
  return document.elementFromPoint(x, y);
}
function resolveSignal(signal, options = {}) {
  if (signal === null) return null;
  const { count, container } = options;
  if (signal.kind === "index") {
    if (!Number.isFinite(signal.value)) return null;
    const index2 = Math.round(signal.value);
    if (count === void 0) return index2 >= 0 ? index2 : null;
    if (count <= 0) return null;
    return Math.min(Math.max(index2, 0), count - 1);
  }
  const hitTest = options.hitTest ?? defaultHitTest;
  const element = hitTest(signal.x, signal.y);
  if (element === null) return null;
  const card = element.closest("[data-card-index]");
  if (card === null) return null;
  if (container != null && !container.contains(card)) return null;
  const raw = card.getAttribute("data-card-index");
  if (raw === null) return null;
  const index = Number(raw);
  if (!Number.isInteger(index) || index < 0) return null;
  if (count !== void 0 && index >= count) return null;
  return index;
}
var MOVE_KEYS = {
  ArrowLeft: -1,
  ArrowRight: 1
};
var COMMIT_KEYS = /* @__PURE__ */ new Set(["Enter", " ", "Spacebar"]);
function useKeyboardPointer({
  count,
  enabled = true,
  initialIndex
}) {
  const [index, setIndex] = useState(() => initialIndex ?? Math.floor((count - 1) / 2));
  const [committing, setCommitting] = useState(false);
  const [engaged, setEngaged] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setEngaged(false);
      setCommitting(false);
      return;
    }
    function onKeyDown(event) {
      const step = MOVE_KEYS[event.key];
      if (step !== void 0) {
        event.preventDefault();
        setEngaged(true);
        setIndex((current) => Math.min(Math.max(current + step, 0), count - 1));
        return;
      }
      if (!COMMIT_KEYS.has(event.key)) return;
      if (document.activeElement?.closest("[data-card-index]") != null) return;
      if (!engaged) return;
      event.preventDefault();
      setCommitting(true);
    }
    function onKeyUp(event) {
      if (COMMIT_KEYS.has(event.key)) setCommitting(false);
    }
    function onBlur() {
      setCommitting(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, count, engaged]);
  return {
    signal: enabled && engaged ? { kind: "index", value: index } : null,
    committing
  };
}
function usePointerSelection({
  input,
  onPick,
  enabled = true,
  count,
  container,
  hitTest
}) {
  const [target, setTarget] = useState(null);
  const targetRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const wasCommitting = useRef(false);
  const signal = input?.signal ?? null;
  const committing = enabled && (input?.committing ?? false);
  useEffect(() => {
    if (!enabled) {
      targetRef.current = null;
      setTarget(null);
      return;
    }
    const next = resolveSignal(signal, { count, container, hitTest });
    targetRef.current = next;
    setTarget((previous) => previous === next ? previous : next);
  }, [enabled, signal, count, container, hitTest]);
  useEffect(() => {
    if (committing && !wasCommitting.current) {
      const latched = targetRef.current;
      if (latched !== null) onPickRef.current(latched);
    }
    wasCommitting.current = committing;
  }, [committing]);
  return { target };
}

export { resolveSignal, useKeyboardPointer, usePointerSelection };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
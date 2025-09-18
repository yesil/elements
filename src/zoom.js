// Basic zoom + pan utility for #surface-wrapper inside #canvas-container
// - Wheel zoom (Ctrl/Cmd + wheel) anchored at pointer
// - Drag-to-pan with mouse or one-finger touch
// - No bounds clamping, momentum, or toolbar coupling

import { makeObservable, reaction } from "picosm";
import { ZOOM as Z, DRAG as DRAGCFG } from "./editor-constants.js";

const resolveEl = (ref, fallbackSelector) => {
  if (!ref) return document.querySelector(fallbackSelector);
  if (typeof ref === "string") return document.querySelector(ref);
  return ref; // assume Element-like
};

export class ZoomStore {
  static observableActions = [
    "setZoom",
    "zoomIn",
    "zoomOut",
    "zoomBy",
    "setPan",
    "panBy",
    "reset",
    "setEnabled",
  ];

  static computedProperties = ["transform", "canZoomIn", "canZoomOut"];

  constructor(opts = {}) {
    this.minZoom = Number.isFinite(opts.minZoom) ? opts.minZoom : (Z?.MIN ?? 0.5);
    this.maxZoom = Number.isFinite(opts.maxZoom) ? opts.maxZoom : (Z?.MAX ?? 4);
    this.step = Number.isFinite(opts.step) ? opts.step : (Z?.STEP ?? 0.1);
  }

  // View state
  x = 0;
  y = 0;
  z = 1;
  enabled = true;

  minZoom = Z?.MIN ?? 0.5;
  maxZoom = Z?.MAX ?? 4;
  step = Z?.STEP ?? 0.1;

  get transform() {
    return `translate(${this.x}px, ${this.y}px) scale(${this.z})`;
  }

  get canZoomIn() {
    return (this.z || 1) < (this.maxZoom ?? 4) - 1e-6;
  }

  get canZoomOut() {
    return (this.z || 1) > (this.minZoom ?? 0.5) + 1e-6;
  }

  setEnabled(v) {
    this.enabled = !!v;
  }

  setZoom(z, anchor) {
    const zOld = this.z;
    const zNew = Math.min(this.maxZoom, Math.max(this.minZoom, z));
    if (zNew === zOld) return;
    if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
      const r = zNew / zOld;
      const { x: px, y: py } = anchor;
      this.x = px - (px - this.x) * r;
      this.y = py - (py - this.y) * r;
    }
    this.z = zNew;
  }

  zoomBy(delta, anchor) { this.setZoom(this.z * (1 + delta), anchor); }
  zoomIn(amount = this.step, anchor) { this.setZoom(this.z * (1 + amount), anchor); }
  zoomOut(amount = this.step, anchor) { this.setZoom(this.z / (1 + amount), anchor); }

  setPan(x, y) { this.x = x; this.y = y; }
  panBy(dx, dy) { this.x += dx; this.y += dy; }
  reset() { this.x = 0; this.y = 0; this.z = 1; }
}

makeObservable(ZoomStore);

export function attachZoomPan(options = {}) {
  const container = resolveEl(options.container, "#canvas-container");
  const surface = resolveEl(options.surface, "#surface-wrapper");
  const target = resolveEl(options.target, "#surface-content") || surface;
  const debugStore = options.debugStore || null;
  const debug = (type, meta = {}) => {
    if (!debugStore || typeof debugStore.addTrace !== 'function') return;
    debugStore.addTrace('zoom', String(type || ''), meta || {});
  };
  if (!container || !surface) {
    throw new Error("attachZoomPan: container or surface not found");
  }
  const store = new ZoomStore({
    minZoom: options.minZoom,
    maxZoom: options.maxZoom,
    step: options.step,
  });

  let dragging = false;
  let pointerDown = false;
  let last = { x: 0, y: 0, id: null };
  const startThreshold = (DRAGCFG && Number.isFinite(DRAGCFG.START_THRESHOLD_PX)) ? DRAGCFG.START_THRESHOLD_PX : 2;

  // Disable text selection while dragging to avoid selecting content
  let selectionDisabled = false;
  let selectListenerAttached = false;
  const disableSelection = () => {
    if (selectionDisabled) return;
    target.style.userSelect = 'none';
    target.style.webkitUserSelect = 'none';
    selectionDisabled = true;
    if (!selectListenerAttached) {
      document.addEventListener('selectstart', preventSelect, true);
      selectListenerAttached = true;
    }
  };
  const enableSelection = () => {
    if (!selectionDisabled) return;
    target.style.userSelect = '';
    target.style.webkitUserSelect = '';
    selectionDisabled = false;
    if (selectListenerAttached) {
      document.removeEventListener('selectstart', preventSelect, true);
      selectListenerAttached = false;
    }
  };
  const preventSelect = (e) => { e.preventDefault(); };

  // Reactively apply transform to the surface when store changes
  const disposeTransform = reaction(
    store,
    (s) => [s.x, s.y, s.z],
    () => { target.style.transform = store.transform; }
  );
  // Initial paint
  target.style.transformOrigin = "0 0";
  target.style.transform = store.transform;

  const onWheel = (e) => {
    if (!store.enabled) return;
    const rect = container.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      // Zoom gesture
      e.preventDefault();
      e.stopPropagation();
      const anchor = {
        x: (e.clientX - rect.left) + container.scrollLeft,
        y: (e.clientY - rect.top) + container.scrollTop,
      };
      const gain = 0.001;
      const factor = Math.exp(-e.deltaY * gain);
      const zFrom = store.z;
      store.setZoom(store.z * factor, anchor);
      const zTo = store.z;
      debug('zoom:wheel', { zFrom, zTo, anchorX: anchor.x, anchorY: anchor.y, deltaY: e.deltaY });
      return;
    }
    // Two-finger pan with basic clamping inside the surface viewport.
    // Let default scrolling happen when not zoomed or when clamped (no movement possible).
    if ((store.z || 1) <= 1) {
      // Not zoomed in: allow the container to scroll normally
      return;
    }
    const dx = -e.deltaX; // natural scroll: move content with fingers
    const dy = -e.deltaY;
    const z = store.z || 1;
    const next = clampPan(store.x + dx / z, store.y + dy / z);
    if (next.x !== store.x || next.y !== store.y) {
      e.preventDefault();
      e.stopPropagation();
      store.setPan(next.x, next.y);
      debug('zoom:wheel-pan', { dx, dy, x: next.x, y: next.y, z });
    } else {
      // No pan change possible (already clamped): allow native scroll
      return;
    }
  };

  const onPointerDown = (e) => {
    if (!store.enabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerDown = true;
    last.x = e.clientX;
    last.y = e.clientY;
    last.id = e.pointerId;
    // If zoomed in, we are arming for possible pan; prevent selection artifacts
    if ((store.z || 1) > 1) disableSelection();
    debug('zoom:pointerdown', { clientX: e.clientX, clientY: e.clientY, z: store.z });
    // Do not prevent default yet; allow clicks to select elements when not dragging
  };

  const onPointerMove = (e) => {
    if (!store.enabled || !pointerDown) return;
    // Only allow drag-to-pan when zoomed in beyond 100%
    if ((store.z || 1) <= 1) return;
    if (last.id != null && e.pointerId !== last.id) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    if (!dragging) {
      const dist = Math.hypot(dx, dy);
      if (dist < startThreshold) return;
      dragging = true;
      if (typeof surface.setPointerCapture === 'function') {
        surface.setPointerCapture(last.id);
      }
      debug('zoom:pan-start', { startX: store.x, startY: store.y, z: store.z });
    }
    // When dragging, pan (clamped) and prevent default to avoid click
    const next = clampPan(store.x + dx, store.y + dy);
    store.setPan(next.x, next.y);
    last.x = e.clientX;
    last.y = e.clientY;
    e.preventDefault();
  };

  const endDrag = (e) => {
    if (!pointerDown) return;
    if (last.id != null && e && e.pointerId !== last.id) return;
    if (dragging) {
      e.preventDefault();
    }
    dragging = false;
    pointerDown = false;
    if (typeof surface.hasPointerCapture === 'function' && surface.hasPointerCapture(last.id)) {
      surface.releasePointerCapture(last.id);
    }
    last.id = null;
    // Restore selection
    enableSelection();
    debug('zoom:pan-end', { x: store.x, y: store.y, z: store.z });
  };

  // Attach listeners
  const wheelOpts = { passive: false, capture: true };
  container.addEventListener("wheel", onWheel, wheelOpts);
  surface.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  const destroy = () => {
    disposeTransform();
    container.removeEventListener("wheel", onWheel, wheelOpts);
    surface.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove, { passive: false });
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    enableSelection();
  };

  // Helpers for focusing elements within the wrapper viewport
  const getViewportRect = () => surface.getBoundingClientRect();
  const getSurfacePadding = (() => {
    let cache = null;
    return () => {
      if (cache) return cache;
      const cs = getComputedStyle(surface);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      cache = { pl, pr, pt, pb };
      return cache;
    };
  })();
  const getContentSize = () => ({ w: target.offsetWidth || 0, h: target.offsetHeight || 0 });
  const getScaledSize = () => {
    const z = store.z || 1;
    const base = getContentSize();
    return { w: base.w * z, h: base.h * z };
  };
  const clampPan = (x, y) => {
    const vp = surface.getBoundingClientRect();
    const pad = getSurfacePadding();
    const innerW = Math.max(0, vp.width - pad.pl - pad.pr);
    const innerH = Math.max(0, vp.height - pad.pt - pad.pb);
    const scaled = getScaledSize();
    // Horizontal clamp against inner content area (excludes surface padding)
    const centerX = innerW / 2;
    const edgeSlop = 12; // allow a small overshoot to counter rounding and show full edges
    let minX;
    let maxX;
    if (scaled.w <= innerW) {
      minX = centerX - scaled.w - edgeSlop;
      maxX = centerX + edgeSlop;
    } else {
      minX = innerW - scaled.w - edgeSlop;
      maxX = 0 + edgeSlop;
    }
    // Vertical clamp against inner content area
    const minY = Math.min(0, innerH - scaled.h);
    const maxY = 0;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  };

  const ensureRectVisible = (el, margin = 24) => {
    if (!el || !el.getBoundingClientRect) return false;
    const vp = getViewportRect();
    const pad = getSurfacePadding();
    const leftBound = vp.left + pad.pl;
    const rightBound = vp.right - pad.pr;
    const topBound = vp.top + pad.pt;
    const bottomBound = vp.bottom - pad.pb;

    let changed = false;
    let adjustments = 0;
    // Iterate a few times to converge when zoom is high
    for (let i = 0; i < 5; i++) {
      const rect = el.getBoundingClientRect();
      const fullyInside =
        rect.left >= leftBound + margin &&
        rect.top >= topBound + margin &&
        rect.right <= rightBound - margin &&
        rect.bottom <= bottomBound - margin;
      if (fullyInside) break;

      let dx = 0;
      let dy = 0;
      // Horizontal
      const rectW = rect.width;
      const vpW = (rightBound - leftBound) - margin * 2;
      if (rectW > vpW) {
        // When wider than viewport, align left edge inside the viewport box
        dx = (leftBound + margin) - rect.left;
      } else {
        if (rect.left < leftBound + margin) dx = (leftBound + margin) - rect.left;
        else if (rect.right > rightBound - margin) dx = (rightBound - margin) - rect.right;
      }
      // Vertical
      const rectH = rect.height;
      const vpH = (bottomBound - topBound) - margin * 2;
      if (rectH > vpH) {
        // When taller than viewport, align top edge inside the viewport box
        dy = (topBound + margin) - rect.top;
      } else {
        if (rect.top < topBound + margin) dy = (topBound + margin) - rect.top;
        else if (rect.bottom > bottomBound - margin) dy = (bottomBound - margin) - rect.bottom;
      }

      if (dx || dy) {
        const z = store.z || 1;
        const panDx = dx / z;
        const panDy = dy / z;
        const next = clampPan(store.x + panDx, store.y + panDy);
        store.setPan(next.x, next.y);
        changed = true;
        adjustments++;
      } else {
        break;
      }
    }
    if (changed) {
      const r = el.getBoundingClientRect();
      debug('zoom:ensure-visible', {
        adjustments,
        elementTag: el.tagName?.toLowerCase?.() || null,
        elementId: el.id || null,
        rectX: Math.round(r.left), rectY: Math.round(r.top), rectW: Math.round(r.width), rectH: Math.round(r.height),
        x: store.x, y: store.y, z: store.z,
      });
    }
    return changed;
  };

  const focusElement = (el, { margin = 24 } = {}) => {
    if (!el || !el.getBoundingClientRect) return false;
    debug('zoom:focus-element', { elementTag: el.tagName?.toLowerCase?.() || null, elementId: el.id || null, margin });
    // Pan within the wrapper to ensure visibility; avoid native scroll jumps
    let changed = ensureRectVisible(el, margin);
    // Run two corrective passes on next frames to converge under high zoom/layout
    requestAnimationFrame(() => {
      changed = ensureRectVisible(el, margin) || changed;
      requestAnimationFrame(() => { ensureRectVisible(el, margin); });
    });
    return changed;
  };

  return {
    store,
    focusElement,
    ensureRectVisible,
    destroy,
  };
}

export default attachZoomPan;

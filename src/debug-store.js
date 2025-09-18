import { makeObservable } from "picosm";

// Centralized debug tracing with per-component capture flags
// Stores lightweight, in-memory trace events to help reconstruct user steps.
export class DebugStore {
  static observableActions = [
    "setCaptureFlags",
    "setCaptureFor",
    "addTrace",
    "clearTraces",
  ];

  constructor() {
    // All capture flags disabled by default
    this.capture = {
      treeNav: false,
      topBar: false,
      editor: false,
      comments: false,
      versions: false,
      zoom: false,
    };
    this.traces = [];
    this.startedAt = Date.now();
    this.maxTraces = 1000;
  }

  // Flags object: { treeNav, topBar, editor, comments, versions }
  setCaptureFlags(flags) {
    const next = { ...this.capture, ...(flags || {}) };
    this.capture = next;
  }

  // Update a single flag by component key
  setCaptureFor(componentKey, enabled) {
    const k = String(componentKey);
    const v = !!enabled;
    this.capture = { ...this.capture, [k]: v };
  }

  // Add a trace event if the component is enabled
  addTrace(component, type, meta = {}) {
    const key = String(component);
    if (!this.capture[key]) return;
    const entry = { at: Date.now(), component: key, type: String(type || ""), meta };
    this.traces.push(entry);
    const over = this.traces.length - this.maxTraces;
    if (over > 0) this.traces.splice(0, over);
  }

  clearTraces() {
    this.traces = [];
    this.startedAt = Date.now();
  }

  // Export a serializable snapshot of traces and flags
  exportTraces() {
    return {
      startedAt: this.startedAt,
      exportedAt: Date.now(),
      flags: { ...this.capture },
      count: this.traces.length,
      traces: this.traces.slice(),
    };
  }
}

makeObservable(DebugStore);

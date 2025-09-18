import { makeObservable } from "picosm";
import { getDefaultSchemaForTag } from "./defaults/index.js";
import { sanitizeTree } from "./utils/sanitize.js";

const TEXT_FORMAT_PRESETS = {
  none: {
    formats: [],
    tags: ["span"],
    allowLinks: false,
    inlineEditable: true,
  },
  default: {
    formats: [
      "bold",
      "italic",
      "underline",
      "strikethrough",
    ],
    tags: ["span", "strong", "em", "u", "s"],
    allowLinks: true,
    inlineEditable: true,
  },
};

// Desktop-only authoring - removed mobile/tablet surface types

/**
 * EditorStore manages UI state for the visual editor
 * Including selection, toolbar, and undo/redo
 */
export class EditorStore {
  // Currently edited document id (moved from App Store)
  currentElementId = null;
  // Debug logs buffer (captured via setLastAction)
  debugLogs = [];
  // Track last user-initiated action separately from programmatic actions
  lastUserAction = null;
  // Optional debug tracer (injected via App Store)
  debugStore = null;
  // Cache of introspected slot names per tag (remembered across instances)
  #slotsCacheByTag = new Map(); // tag -> Set<string>
  // Track last outlined <slot> element to clear styles when selection changes
  #lastOutlinedSlotEl = null;

  log() {}


  // Public helper: return cached or introspected slot names for an element
  getKnownSlots(el) {
    return this.#introspectAndRememberSlotsFor(el);
  }
  
  get isEditorOpen() {
    return !!this.currentElementId;
  }

  // Introspect open shadow DOM for slot names and remember them per-tag
  #introspectAndRememberSlotsFor(el) {
    try {
      if (!el || !el.tagName) return [];
      const tag = el.tagName.toLowerCase();
      const sr = el.shadowRoot;
      if (!sr) {
        // Return any cached data for this tag
        const cached = this.#slotsCacheByTag.get(tag);
        return cached ? Array.from(cached) : [];
      }
      const slotEls = Array.from(sr.querySelectorAll("slot"));
      if (!slotEls.length) {
        const cached = this.#slotsCacheByTag.get(tag);
        return cached ? Array.from(cached) : [];
      }
      const names = [];
      for (const s of slotEls) {
        try {
          const n = s.getAttribute("name");
          names.push(n && n.trim() ? n.trim() : "default");
        } catch (_) {
          names.push("default");
        }
      }
      // Preserve first-seen order and uniqueness
      const ordered = [];
      const seen = new Set();
      for (const n of names) {
        if (!seen.has(n)) {
          seen.add(n);
          ordered.push(n);
        }
      }
      // Merge with cached set and remember
      const existing = this.#slotsCacheByTag.get(tag) || new Set();
      for (const n of ordered) existing.add(n);
      this.#slotsCacheByTag.set(tag, existing);
      return Array.from(existing);
    } catch (_) {
      return [];
    }
  }

  // Merge provided slot names into the per-tag cache
  #rememberSlotsForTag(tag, slots) {
    try {
      if (!tag || !Array.isArray(slots) || !slots.length) return;
      const key = String(tag).toLowerCase();
      const set = this.#slotsCacheByTag.get(key) || new Set();
      for (const s of slots) {
        if (!s) continue;
        set.add(String(s));
      }
      this.#slotsCacheByTag.set(key, set);
    } catch (_) {}
  }

  #normalizeSlotConfig(cfg) {
    const base = cfg ? { ...cfg } : {};
    const presetKey = base?.textFormatting ? String(base.textFormatting).toLowerCase() : null;
    const preset = presetKey && TEXT_FORMAT_PRESETS[presetKey] ? TEXT_FORMAT_PRESETS[presetKey] : null;

    const tagSet = new Set();
    if (Array.isArray(base.allowedTags)) {
      for (const tag of base.allowedTags) {
        if (tag == null) continue;
        tagSet.add(String(tag));
      }
    }
    if (preset?.tags) {
      for (const tag of preset.tags) tagSet.add(tag);
    }

    if (base.inlineEditable === undefined && preset?.inlineEditable !== undefined) {
      base.inlineEditable = preset.inlineEditable;
    }
    if (base.inlineEditable === true) {
      tagSet.add("span");
    }

    let allowLinks = base.allowLinks;
    if (allowLinks === undefined && preset) allowLinks = preset.allowLinks;
    allowLinks = allowLinks === true;

    let formats = [];
    if (preset?.formats) formats = preset.formats.slice();
    if (Array.isArray(base.allowedFormats)) {
      for (const format of base.allowedFormats) {
        if (format == null) continue;
        if (!formats.includes(format)) formats.push(format);
      }
    }

    if (allowLinks) {
      tagSet.add("a");
      if (!formats.includes("link")) formats.push("link");
    } else {
      tagSet.delete("a");
      if (formats.includes("link")) {
        formats = formats.filter((f) => f !== "link");
      }
    }

    base.allowedTags = Array.from(tagSet);
    base.allowedFormats = formats;
    base.allowLinks = allowLinks;
    base.textFormattingPreset = presetKey;
    return base;
  }

  #configSupportsFormatting(cfg) {
    if (!cfg) return false;
    const formats = Array.isArray(cfg.allowedFormats) ? cfg.allowedFormats : [];
    return formats.length > 0;
  }

  getCurrentInlineConfig() {
    const schema = this.elementSchema;
    if (!schema) return null;
    if (schema.isSlotContent && schema.slotConfig) {
      return this.#normalizeSlotConfig(schema.slotConfig);
    }
    if (this.currentSlot && schema.getSlotConfig) {
      return this.#normalizeSlotConfig(
        schema.getSlotConfig(this.currentSlot) || {}
      );
    }
    if (schema.getSlotConfig) {
      return this.#normalizeSlotConfig(schema.getSlotConfig("default") || {});
    }
    return null;
  }

  sanitizeInlineHtml(html) {
    const cfg = this.getCurrentInlineConfig();
    if (!cfg) return String(html || "");
    const source = String(html || "");
    if (!this.#configSupportsFormatting(cfg)) {
      const tmp = document.createElement("div");
      tmp.innerHTML = source;
      return tmp.textContent || "";
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(source, "text/html");
      const allowed = new Set(
        Array.isArray(cfg.allowedTags)
          ? cfg.allowedTags.map((t) => String(t).toLowerCase())
          : []
      );
      if (cfg.multiline !== false) allowed.add("br");
      const allowLinks = cfg.allowLinks === true;
      const transformNode = (node) => {
        const children = Array.from(node.childNodes || []);
        for (let child of children) {
          if (!child) continue;
          if (child.nodeType === Node.ELEMENT_NODE) {
            let tag = child.tagName?.toLowerCase?.() || "";
            if (tag === "b") {
              const strong = doc.createElement("strong");
              while (child.firstChild) strong.appendChild(child.firstChild);
              child.replaceWith(strong);
              child = strong;
              tag = "strong";
            } else if (tag === "i") {
              const em = doc.createElement("em");
              while (child.firstChild) em.appendChild(child.firstChild);
              child.replaceWith(em);
              child = em;
              tag = "em";
            }
            if (!allowed.has(tag)) {
              if (tag === "br" && cfg.multiline !== false) continue;
              if (
                cfg.multiline === false &&
                (tag === "p" || tag === "div" || tag === "li")
              ) {
                const text = child.textContent || "";
                if (text) {
                  const textNode = doc.createTextNode(text);
                  child.parentNode?.insertBefore(textNode, child);
                }
              } else {
                while (child.firstChild) {
                  child.parentNode?.insertBefore(child.firstChild, child);
                }
              }
              child.parentNode?.removeChild(child);
              continue;
            }
            if (tag === "a") {
              if (!allowLinks) {
                while (child.firstChild) {
                  child.parentNode?.insertBefore(child.firstChild, child);
                }
                child.parentNode?.removeChild(child);
                continue;
              }
              const allowedAttrs = new Set([
                "href",
                "target",
                "rel",
                "title",
                "aria-label",
                "download",
              ]);
              Array.from(child.attributes || []).forEach(({ name }) => {
                const lower = name.toLowerCase();
                if (allowedAttrs.has(lower)) return;
                child.removeAttribute(name);
              });
            } else if (!tag.includes("-")) {
              Array.from(child.attributes || []).forEach(({ name }) => {
                const lower = name.toLowerCase();
                if (lower.startsWith("data-ee-")) return;
                child.removeAttribute(name);
              });
            }
            transformNode(child);
          }
        }
      };
      transformNode(doc.body);
      return doc.body.innerHTML;
    } catch (_) {
      return source;
    }
  }

  isPlainTextOnly() {
    const cfg = this.getCurrentInlineConfig();
    if (!cfg) return !this.hasTextFormatting;
    return !this.#configSupportsFormatting(cfg);
  }
  /**
   * Normalize an element's ee authoring API to a unified schema shape.
   * Supports both the new getSchema() format and the legacy per-method API.
   */
  _normalizeSchemaFromEE(ee) {
    try {
      if (ee?.getSchema) {
        const s = ee.getSchema();
        const order = Array.isArray(s?.slots?.order) ? s.slots.order : [];
        const configs = s?.slots?.configs || {};
        const getSlotConfig = (name) => (configs && name in configs ? configs[name] : undefined);
        const getSlotLabel = (name) => {
          const cfg = getSlotConfig(name);
          return cfg && cfg.label ? cfg.label : name;
        };
        return {
          attributes: s?.attributes || {},
          slots: order,
          elementLabel: s?.element?.label || "",
          elementDescription: s?.element?.description || "",
          supportsTextFormatting: s?.element?.supportsTextFormatting !== false,
          getSlotConfig,
          getSlotLabel,
        };
      }
    } catch (_) {}
    return {
      attributes: ee?.getAttributeSchema?.() || {},
      slots: ee?.getSlots?.() || [],
      elementLabel: ee?.getElementLabel?.() || "",
      elementDescription: ee?.getElementDescription?.() || "",
      supportsTextFormatting:
        ee && ee.supportsTextFormatting !== undefined
          ? ee.supportsTextFormatting
          : true,
      getSlotConfig: ee?.getSlotConfig,
      getSlotLabel: ee?.getSlotLabel,
    };
  }
  static observableActions = [
    // Routing / document identity
    "setCurrentElementId",
    "setEditingElement",
    "showEEToolbar",
    "hideEEToolbar",
    "updateEEToolbarPosition",
    "setEEToolbarPosition",
    "elementMoved",
    "moveElementBefore",
    "moveElementAfter",
    "duplicateElement",
    "deleteElement",
    "pushUndoState",
    "undo",
    "redo",
    "clearUndoRedo",
    // onRender hook helpers removed
    "setEditorElement",
    "scheduleSnapshot",
    "captureSnapshot",
    "selectElement",
    "selectSlot",
    "setCurrentSlot",
    "setToolbarActions",
    "setToolbarActionsData",
    "toggleContentEditable",
    "enableContentEditable",
    "disableContentEditable",
    "autoEnableContentEditableIfSupported",
    "cancelInlineEditing",
    "scheduleAutoSave",
    "performAutoSave",
    "markSaved",
    "setSidebarOpen",
    // Sidebar controls
    "markSidebarActive",
    "markEditorActive",
    "handleEscape",
    "clearSelection",
    // Last action tracking
    "setLastAction",
    // Inline link caret targeting
    "setInlineLinkEditingTarget",
    "setInlineLinkContextLock",
    // Navigation
    "selectParent",
    // Sharing dialog actions for editor
    "openShareDialog",
    "closeShareDialog",
    "loadShares",
    "addOrUpdateShare",
    "removeShare",
    "setShareError",
  ];

  static computedProperties = [
    "isEEToolbarVisible",
    "canUndo",
    "canRedo",
    "elementSchema",
    "hasTextFormatting",
    "canReorder",
    "toolbarConfig",
    "toolbarActions",
    "isContentEditable",
    "canSelectParent",
  ];

  // Set the active document id (URN)
  setCurrentElementId(id) {
    // Cancel any pending autosave tied to the previous document to avoid cross‑doc saves
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
    this.currentElementId = id || null;
  }

  // Sharing dialog state
  shareDialogOpen = false;
  currentShares = [];
  isLoadingShares = false;
  shareError = "";

  openShareDialog() {
    this.setShareDialogOpen(true);
    this.loadShares();
  }
  closeShareDialog() {
    this.setShareDialogOpen(false);
    this.setShareError("");
  }
  async loadShares() {
    const urn = this.currentElementId;
    if (!urn) return;
    this.setIsLoadingShares(true);
    const list = await this.documentStore.getShares(urn);
    this.setCurrentShares(Array.isArray(list) ? list : []);
    this.setIsLoadingShares(false);
  }
  async addOrUpdateShare(userId, perms) {
    const urn = this.currentElementId;
    if (!urn) return;
    await this.documentStore.upsertShare(urn, userId, perms);
    await this.loadShares();
  }
  async removeShare(userId) {
    const urn = this.currentElementId;
    if (!urn) return;
    await this.documentStore.deleteShare(urn, userId);
    await this.loadShares();
  }
  setShareError(msg) { this.shareError = String(msg || ""); }
  setShareDialogOpen(value) { this.shareDialogOpen = !!value; }
  setIsLoadingShares(value) { this.isLoadingShares = !!value; }
  setCurrentShares(list) { this.currentShares = Array.isArray(list) ? list : []; }

  /**
   * Debug snapshot of the store state for diagnostics
   * Does not mutate state and is safe to call anytime.
   */
  get debugState() {
    const describeElement = (el) => {
      if (!el || !el.tagName) return null;
      const tag = el.tagName.toLowerCase();
      const ctor = customElements.get(tag);
      return {
        tag,
        id: el.id || null,
        slot: el.getAttribute ? el.getAttribute("slot") : null,
        isCustom: tag.includes("-"),
        isAuthorable: !!ctor,
        hasEE: !!ctor?.ee,
        text: (el.textContent || "").trim().slice(0, 60),
      };
    };

    const schema = (() => {
      try {
        return this.elementSchema || null;
      } catch (_) {
        return null;
      }
    })();

    const toolbar = (() => {
      const actions = (() => {
        try {
          return this.toolbarActions || null;
        } catch (_) {
          return null;
        }
      })();
      // Determine attribute schema source for troubleshooting
      let attrSource = "none";
      let overlayTag = null;
      let overlayCount = 0;
      try {
        const t = this.inlineLinkEditingTarget;
        if (t && t.tagName) {
          const tag = String(t.tagName).toLowerCase();
          const overlay = getDefaultSchemaForTag(tag, t);
          if (overlay && overlay.attributes) {
            attrSource = `default:${tag}`;
            overlayTag = tag;
            overlayCount = Object.keys(overlay.attributes || {}).length;
          }
        }
      } catch (_) {}
      if (attrSource === "none") {
        try {
          const es = this.elementSchema;
          if (es && es.attributes && Object.keys(es.attributes).length > 0) {
            attrSource = "element";
          }
        } catch (_) {}
      }
      return {
        visible: !!this.eeToolbarVisible,
        position: { ...(this.eeToolbarPosition || { x: 0, y: 0 }) },
        overlayOpen: !!this.toolbarOverlayOpen,
        actions: actions
          ? {
              textFormatting: {
                enabled: !!actions.textFormatting?.enabled,
                allowedFormats: actions.textFormatting?.allowedFormats ?? null,
              },
              attributes: {
                enabled: !!actions.attributes?.enabled,
                count: Object.keys(actions.attributes?.schema || {}).length,
                source: attrSource,
                overlayTag,
                overlayCount,
              },
              slots: {
                enabled: !!actions.slots?.enabled,
                current: actions.slots?.current || null,
                available: Array.isArray(actions.slots?.available)
                  ? [...actions.slots.available]
                  : null,
              },
              reordering: {
                enabled: !!actions.reordering?.enabled,
                canMoveUp: !!actions.reordering?.canMoveUp,
                canMoveDown: !!actions.reordering?.canMoveDown,
              },
              duplicationAllowed: actions.duplicationAllowed !== false,
            }
          : null,
      };
    })();

    const bounds = (() => {
      try {
        return this.getSurfaceBounds ? this.getSurfaceBounds() : null;
      } catch (_) {
        return null;
      }
    })();

    // Determine current toolbar anchor (for troubleshooting positioning)
    const toolbarAnchor = (() => {
      try {
        // 1) Text selection
        const sel = window.getSelection?.();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const rect = sel.getRangeAt(0).getBoundingClientRect?.();
          if (rect && rect.width >= 1 && rect.height >= 1) {
            return {
              type: "text",
              rect: {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
              },
            };
          }
        }
        // 2) Slot rect (when currentSlot and open shadow root)
        const el = this.editingElement || null;
        const slotName = this.currentSlot || null;
        const sr = el && el.shadowRoot ? el.shadowRoot : null;
        if (el && slotName && sr) {
          const selector =
            slotName === "default"
              ? "slot:not([name])"
              : `slot[name="${slotName}"]`;
          const slotEl = sr.querySelector(selector);
          const rect = slotEl?.getBoundingClientRect?.();
          if (rect && rect.width >= 1 && rect.height >= 1) {
            return {
              type: "slot",
              rect: {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
              },
            };
          }
        }
        // 3) Element rect fallback
        if (this.editingElement) {
          const rect = this.editingElement.getBoundingClientRect?.();
          if (rect) {
            return {
              type: "element",
              rect: {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
              },
            };
          }
        }
      } catch (_) {}
      return null;
    })();

    // Minimal layout diagnostics for sidebars and pane
    const layout = (() => {
      try {
        const root = this.editorElement?.shadowRoot || null;
        const left = root?.querySelector?.("ee-tree-nav") || null;
        const pane = root?.getElementById?.("canvas-container") || null;
        const leftW = left?.getBoundingClientRect?.().width || 0;
        const paneW = pane?.getBoundingClientRect?.().width || 0;
        return {
          leftSidebarWidth: Math.round(leftW),
          editorPaneWidth: Math.round(paneW),
        };
      } catch (_) {
        return null;
      }
    })();

    // Viewport and key editor elements diagnostics
    const viewport = (() => {
      try {
        return {
          width: Math.round(window.innerWidth || 0),
          height: Math.round(window.innerHeight || 0),
          dpr: Number(window.devicePixelRatio || 1),
          scrollX: Math.round(window.scrollX || 0),
          scrollY: Math.round(window.scrollY || 0),
        };
      } catch (_) {
        return null;
      }
    })();

    const rectOf = (el) => {
      try {
        const r = el?.getBoundingClientRect?.();
        if (!r) return null;
        return {
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      } catch (_) {
        return null;
      }
    };
    const visibleOf = (el) => {
      try {
        const cs = el ? getComputedStyle(el) : null;
        const r = el?.getBoundingClientRect?.();
        if (!cs || !r) return null;
        const hasBox = (r.width || 0) > 0 && (r.height || 0) > 0;
        const shown =
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          cs.opacity !== "0";
        return !!(hasBox && shown);
      } catch (_) {
        return null;
      }
    };
    const elements = (() => {
      try {
        const root = this.editorElement?.shadowRoot || null;
        const toolbarEl = root?.getElementById?.("editor-toolbar") || null;
        const leftEl = root?.querySelector?.("ee-tree-nav") || null;
        const canvasEl = root?.getElementById?.("canvas-container") || null;
        const surfaceEl = root?.getElementById?.("surface-wrapper") || null;
        const rightEl = root?.getElementById?.("right-sidebar") || null;
        return {
          toolbar: { rect: rectOf(toolbarEl), visible: visibleOf(toolbarEl) },
          leftSidebar: {
            rect: rectOf(leftEl),
            visible: visibleOf(leftEl),
            open: !!(leftEl && !leftEl.hasAttribute('hidden')),
          },
          canvasContainer: {
            rect: rectOf(canvasEl),
            visible: visibleOf(canvasEl),
          },
          surfaceWrapper: {
            rect: rectOf(surfaceEl),
            visible: visibleOf(surfaceEl),
          },
          rightSidebar: {
            rect: rectOf(rightEl),
            visible: visibleOf(rightEl),
            open: !!(
              rightEl &&
              rightEl.classList &&
              rightEl.classList.contains("open")
            ),
          },
        };
      } catch (_) {
        return null;
      }
    })();

    // Slot outline/debug signal
    const slotOutline = (() => {
      try {
        const el = this.editingElement || null;
        const slotName = this.currentSlot || null;
        const sr = el && el.shadowRoot ? el.shadowRoot : null;
        let found = false;
        if (el && slotName && sr) {
          const selector =
            slotName === "default"
              ? "slot:not([name])"
              : `slot[name="${slotName}"]`;
          found = !!sr.querySelector(selector);
        }
        return {
          active: !!slotName,
          slotName: slotName || null,
          shadowOpen: !!sr,
          found,
          outlined: !!this.#lastOutlinedSlotEl,
        };
      } catch (_) {
        return null;
      }
    })();

    // Known slots for the current element tag (from schema/shadow introspection)
    const slotsKnown = (() => {
      try {
        const el = this.editingElement || null;
        if (!el || !el.tagName) return null;
        const names = this.getKnownSlots?.(el) || [];
        return {
          tag: el.tagName.toLowerCase(),
          names: Array.isArray(names) ? names.slice(0, 12) : [],
        };
      } catch (_) {
        return null;
      }
    })();

    const schemaSummary = (() => {
      if (!schema) return null;
      const normalizedSlot = schema.slotConfig
        ? this.#normalizeSlotConfig(schema.slotConfig)
        : null;
      return {
        isSlotContent: !!schema.isSlotContent,
        slotName: schema.slotName || null,
        elementLabel: schema.elementLabel || "",
        elementDescription: schema.elementDescription || "",
        supportsTextFormatting: schema.supportsTextFormatting !== false,
        slots: Array.isArray(schema.slots) ? [...schema.slots] : [],
        slotConfig: normalizedSlot
          ? {
              inlineEditable: !!normalizedSlot.inlineEditable,
              allowedFormats: normalizedSlot.allowedFormats || null,
              allowedTags: normalizedSlot.allowedTags || null,
              minLength:
                normalizedSlot.minLength === undefined
                  ? null
                  : normalizedSlot.minLength,
              maxLength:
                normalizedSlot.maxLength === undefined
                  ? null
                  : normalizedSlot.maxLength,
            }
          : null,
      };
    })();

    // Selection/caret diagnostic details
    const caret = (() => {
      try {
        const sel = window.getSelection();
        const collapsed = !!sel ? sel.isCollapsed : null;
        const anchorNode = sel && sel.anchorNode ? sel.anchorNode : null;
        const focusNode = sel && sel.focusNode ? sel.focusNode : null;
        const toTag = (n) => {
          if (!n) return null;
          if (n.nodeType === Node.ELEMENT_NODE)
            return n.tagName?.toLowerCase?.() || null;
          return n.parentElement
            ? n.parentElement.tagName?.toLowerCase?.() || null
            : null;
        };
        const inlineTarget = this.inlineLinkEditingTarget || null;
        const inlineTag = inlineTarget
          ? inlineTarget.tagName?.toLowerCase?.()
          : null;
        const editTarget = this.editingElement?._eeEditTarget || null;
        const editTargetTag = editTarget
          ? editTarget.tagName?.toLowerCase?.() || "#text"
          : null;
        return {
          isCollapsed: collapsed,
          anchorTag: toTag(anchorNode),
          focusTag: toTag(focusNode),
          insideDefaultTag: inlineTag,
          inlineTarget: inlineTarget
            ? {
                tag: inlineTag,
                hasHref:
                  !!inlineTarget.getAttribute &&
                  !!inlineTarget.getAttribute("href"),
              }
            : null,
          editTargetTag,
        };
      } catch (_) {
        return null;
      }
    })();

    return {
      themeColor: this.themeColor || "light",
      selection: {
        editingElement: describeElement(this.editingElement),
        currentSlot: this.currentSlot || null,
        isContentEditable: this.isContentEditable || false,
        canSelectParent: !!this.canSelectParent,
        caret,
      },
      toolbarAnchor,
      comments: (() => {
        try {
          const cs = this.store?.commentStore || null;
          if (!cs) return { available: false };
          const byStatus = (st) =>
            (cs.comments || []).filter((c) => c.status === st).length;
          const anchor = (() => {
            try {
              return (
                this.editingElement?.getAttribute?.("data-ee-comment-id") ||
                null
              );
            } catch (_) {
              return null;
            }
          })();
          return {
            available: true,
            panelOpen: !!cs.commentsPanelOpen,
            count: Array.isArray(cs.comments) ? cs.comments.length : 0,
            openCount: byStatus("open"),
            resolvedCount: byStatus("resolved"),
            hoveredCommentId: cs.hoveredCommentId || null,
            selectedCommentId: cs.selectedCommentId || null,
            canComment: !!cs.canComment,
            currentElementAnchor: anchor,
          };
        } catch (_) {
          return { available: false };
        }
      })(),
      toolbar,
      schema: schemaSummary,
      layout,
      viewport,
      elements,
      slotOutline,
      slotsKnown,
      // viewport details removed along with scroll preservation logic
      sidebar: {
        open: !!this.sidebarOpen,
      },
      history: {
        undoDepth: this.undoStack?.length || 0,
        redoDepth: this.redoStack?.length || 0,
        isUndoRedoInProgress: !!this.isUndoRedoInProgress,
      },
      save: {
        lastSavedAt: this.lastSavedAt || 0,
        saveIndicatorVisible: !!this.saveIndicatorVisible,
      },
    };
  }

  // Deprecated: activeElement (use editingElement instead)

  // Currently editing element (for toolbar display)
  editingElement = null;

  // Currently selected slot (for slot-specific actions)
  currentSlot = null;

  // EE Toolbar state
  eeToolbarVisible = false;
  eeToolbarElement = null;
  eeToolbarPosition = { x: 0, y: 0 };
  toolbarOverlayOpen = false;

  // Track anchor element under caret during inline editing
  inlineLinkEditingTarget = null;
  inlineLinkContextLocked = false;

  // Last user action metadata (extensible)
  // Example: { type: 'editor:click' | 'editor:dblclick' | 'tree:click' | 'comment:click', at: number, meta?: any }
  lastAction = null;

  // Sidebar (content tree) state - closed by default on page load
  sidebarOpen = true;

  // Toolbar actions data (for decoupling from DOM)
  toolbarActionsData = null;

  

  // Undo/Redo state
  undoStack = []; // Stack of previous states
  redoStack = []; // Stack of states for redo
  maxHistorySize = 50; // Maximum number of states to keep
  isUndoRedoInProgress = false; // Flag to prevent capturing during undo/redo
  // Debug counters (kept minimal)
  editorElement = null; // Reference to the editor element for capturing snapshots
  snapshotTimeout = null; // Timeout for debouncing snapshots
  snapshotDelay = 250; // faster debounce for snappier undo availability
  // Auto-save state
  autoSaveTimeout = null;
  autoSaveDelay = 1500;
  lastSavedAt = 0;
  saveIndicatorVisible = false;
  saveIndicatorHideTimeout = null;

  // Selection behavior flags
  suppressFocus = false; // when true, selection should not move browser focus

  // Theme state
  themeColor = "light"; // 'light' | 'dark'

  /**
   * Determine the smart parent selection target for the current selection.
   * Returns one of:
   * - { type: 'slot', parent: HTMLElement, slotName: string }
   * - { type: 'element', element: HTMLElement }
   * or null when there is no valid parent target.
   */
  _getParentSelectionTarget() {
    const el = this.editingElement;
    if (!el) return null;

    // If currently focused on a slot of `el`, first step up is the element `el` itself
    // (leave slot context, keep same element). Only after that, parent selection moves in the DOM.
    if (this.currentSlot) {
      return { type: "element", element: el };
    }

    // Direct relationship first: if the element is slotted into its immediate parent
    // (named or default), prefer selecting that slot.
    const parentImmediate = el.parentElement;
    if (
      parentImmediate &&
      parentImmediate !== this.editorElement &&
      parentImmediate?.tagName !== "EXPERIENCE-ELEMENTS-EDITOR"
    ) {
      const sr = parentImmediate.shadowRoot;
      // Named slot on the child (only if shadow root is open so we can outline)
      try {
        const name = el.getAttribute && el.getAttribute("slot");
        if (name && sr) {
          const exists = !!sr.querySelector(
            name === "default" ? "slot:not([name])" : `slot[name="${name}"]`
          );
          if (exists) {
            return {
              type: "slot",
              parent: parentImmediate,
              slotName: name || "default",
            };
          }
        }
      } catch (_) {}

      // Default slot assignment: only when shadow root is open and has an unnamed slot
      try {
        if (sr && parentImmediate.tagName?.includes?.("-")) {
          const slotEl = sr.querySelector("slot:not([name])");
          if (slotEl) {
            // Verify assignment
            const assigned = slotEl.assignedNodes?.() || [];
            if (
              assigned &&
              (assigned.includes
                ? assigned.includes(el)
                : assigned.indexOf(el) >= 0)
            ) {
              return {
                type: "slot",
                parent: parentImmediate,
                slotName: "default",
              };
            }
            // Even if not verifiable (empty slot), still prefer parent element
          }
        }
      } catch (_) {}

      // Not selecting slot (closed or no slot): select the parent element itself
      return { type: "element", element: parentImmediate };
    }

    // No valid immediate parent: detect a slotted ancestor across shadow/light DOM
    const getHost = (n) => {
      try {
        const root =
          n && typeof n.getRootNode === "function" ? n.getRootNode() : null;
        return root && root.host ? root.host : null;
      } catch (_) {
        return null;
      }
    };
    const findSlottedAncestor = () => {
      const visited = new Set();
      let node = el.parentElement;
      while (node && !visited.has(node)) {
        visited.add(node);
        // Check this ancestor's own slot (only when its parent has an open shadow root)
        try {
          const name = node.getAttribute && node.getAttribute("slot");
          if (name) {
            const parent = node.parentElement || null;
            if (
              parent &&
              parent !== this.editorElement &&
              parent?.tagName !== "EXPERIENCE-ELEMENTS-EDITOR" &&
              parent.shadowRoot
            ) {
              const exists = !!parent.shadowRoot.querySelector(
                name === "default" ? "slot:not([name])" : `slot[name="${name}"]`
              );
              if (!exists) return null;
              return { parent, slotName: name || "default" };
            }
          }
        } catch (_) {}

        // If the ancestor is inside shadow DOM, step to its host and continue
        const host = getHost(node);
        if (host) {
          try {
            const hostSlot = host.getAttribute && host.getAttribute("slot");
            if (hostSlot && host.parentElement?.shadowRoot) {
              const parent = host.parentElement || null;
              if (
                parent &&
                parent !== this.editorElement &&
                parent?.tagName !== "EXPERIENCE-ELEMENTS-EDITOR"
              ) {
                const exists = !!parent.shadowRoot.querySelector(
                  hostSlot === "default"
                    ? "slot:not([name])"
                    : `slot[name="${hostSlot}"]`
                );
                if (!exists) return null;
                return { parent, slotName: hostSlot || "default" };
              }
            }
          } catch (_) {}
          node = host.parentElement;
          continue;
        }

        node = node.parentElement;
      }
      return null;
    };
    const slotted = findSlottedAncestor();
    if (slotted)
      return {
        type: "slot",
        parent: slotted.parent,
        slotName: slotted.slotName,
      };

    // Default slot detection: prefer selecting that slot only when the nearest
    // custom element ancestor has an OPEN shadow root exposing an unnamed slot.
    try {
      // Find nearest custom element ancestor across shadow and light DOM
      const visited = new Set();
      let parentCE = el;
      while (parentCE && !visited.has(parentCE)) {
        visited.add(parentCE);
        const host = getHost(parentCE);
        if (host) {
          parentCE = host; // move to host first
        }
        const next = parentCE.parentElement || null;
        if (!next) break;
        const tag = next.tagName?.toLowerCase?.() || "";
        if (tag.includes("-")) {
          parentCE = next;
          break;
        }
        parentCE = next;
      }
      if (
        parentCE &&
        parentCE !== this.editorElement &&
        parentCE.tagName !== "EXPERIENCE-ELEMENTS-EDITOR" &&
        parentCE.shadowRoot
      ) {
        const hasDefault =
          !!parentCE.shadowRoot.querySelector("slot:not([name])");
        if (hasDefault)
          return { type: "slot", parent: parentCE, slotName: "default" };
      }
    } catch (_) {}

    // No valid slot context and no parent: nothing to select
    return null;
  }

  /**
   * Whether there is a valid parent selection target.
   */
  get canSelectParent() {
    return !!this._getParentSelectionTarget();
  }

  /**
   * Whether current selection supports comments (elements with schemas support only).
   */

  /**
   * Smartly select the parent context of the current selection.
   * - If the current element (or an ancestor) is slotted, selects that slot on its parent custom element.
   * - Otherwise selects the plain DOM parent element.
   */
  selectParent() {
    const target = this._getParentSelectionTarget();
    if (!target) return;
    if (target.type === "slot") {
      this.selectSlot(target.parent, target.slotName || "default");
      return;
    }
    if (target.type === "element") {
      this.selectElement(target.element);
      return;
    }
  }

  /**
   * Set the element being edited (for toolbar)
   */
  setEditingElement(element) {
    if (this.editingElement === element) {
      return; // Avoid duplicate updates
    }

    // Disable contenteditable on previous element if needed
    if (this.editingElement) {
      const prev = this.editingElement;
      if (this.#isEditable(prev) || this.#isEditable(prev?._eeEditTarget)) {
        this.disableContentEditable();
      }
    }

    this.editingElement = element;

    // Trace selection changes for debugging
    const tag = element && element.tagName ? element.tagName.toLowerCase() : null;
    const id = element && element.id ? element.id : null;
    this.setLastAction('editor:select', { tag, id, slot: this.currentSlot || null });

    // Selection outline is handled by the editor component.

    // Auto-enable contenteditable if element supports inline editing
    if (element) {
      this.autoEnableContentEditableIfSupported();
    } else {
      this.setToolbarActions(null);
    }
  }

  /**
   * Update current inline link target for toolbar attribute editing.
   * Only accepts <a> elements; any other value clears the target.
   */
  setInlineLinkEditingTarget(el) {
    try {
      if (!el || !el.tagName || el.tagName.toLowerCase() !== "a") {
        this.inlineLinkEditingTarget = null;
        return;
      }
    } catch (_) {
      this.inlineLinkEditingTarget = null;
      return;
    }
    this.inlineLinkEditingTarget = el;
  }

  /**
   * Prevent selectionchange from clearing inline link target while user edits fields in toolbar
   */
  setInlineLinkContextLock(locked) {
    this.inlineLinkContextLocked = !!locked;
  }

  /**
   * Set toolbar actions data directly
   * This allows decoupling the toolbar from DOM queries
   */
  setToolbarActions(actionsData) {
    this.toolbarActionsData = actionsData;
  }

  // Track outlined nodes so only one is visible at a time
  #outlinedNodes = new Set();

  // Apply blue outline to correct selection target
  #applySelectionOutline() {
    const host = this.editorElement;
    const el = this.editingElement;
    if (!host || !el) return;

    // Clear any nodes we outlined last time
    try {
      for (const n of this.#outlinedNodes) this.#clearSelectionMarker(n);
    } catch (_) {}
    this.#outlinedNodes.clear();

    // Clear any stray outlines within the editor (belt and suspenders)
    host.querySelectorAll("[data-ee-selected]").forEach((n) => this.#clearSelectionMarker(n));
    // Clear previous inline slot outline (if any)
    try {
      if (this.#lastOutlinedSlotEl) {
        this.#clearSelectionMarker(this.#lastOutlinedSlotEl);
        this.#lastOutlinedSlotEl = null;
      }
    } catch (_) {
      this.#lastOutlinedSlotEl = null;
    }

    const slotName = this.currentSlot || null;
    if (!slotName) {
      // No slot context: outline the element as usual using data attribute only
      this.#markSelectedElement(el);
      return;
    }
    // Slot context: try to outline the actual <slot> inside the element's open shadow root
    try {
      const sr = el.shadowRoot;
      if (sr) {
        const selector =
          slotName === "default"
            ? "slot:not([name])"
            : `slot[name="${slotName}"]`;
        const slotEl = sr.querySelector(selector);
        if (slotEl) {
          // Ensure a lightweight stylesheet exists in this shadow root to style selected slots
          this.#ensureSlotHighlightStyles(sr);
          // Mark slot as selected via attribute only
          this.#markSelectedSlot(slotEl);
          this.#lastOutlinedSlotEl = slotEl;
          this.#outlinedNodes.add(slotEl);
          return;
        }
      }
    } catch (_) {}
    // Fallback: if no shadowRoot or slot not found, outline the element (better than nothing)
    this.#markSelectedElement(el);
  }

  // Helpers
  #isEditable(node) {
    try {
      if (!node) return false;
      const attr = node.getAttribute?.("contenteditable");
      const prop = node.contentEditable;
      const a = (attr || "").toLowerCase();
      return a === "true" || a === "plaintext-only" || prop === "true" || prop === "plaintext-only";
    } catch (_) {
      return false;
    }
  }

  #clearSelectionMarker(node) {
    try {
      node.removeAttribute?.("data-ee-selected");
      // Best-effort cleanup for legacy inline styles that may exist
      if (node.style) {
        try { node.style.removeProperty?.('outline'); } catch (_) { node.style.outline = ""; }
        try { node.style.removeProperty?.('outline-offset'); } catch (_) { node.style.outlineOffset = ""; }
        try { node.style.removeProperty?.('border-radius'); } catch (_) { node.style.borderRadius = ""; }
      }
    } catch (_) {}
  }

  // Mark a regular element as selected (attribute only; styling via host CSS ::slotted rule)
  #markSelectedElement(node) {
    try {
      node.setAttribute("data-ee-selected", "");
      this.#outlinedNodes.add(node);
    } catch (_) {}
  }

  // Mark a <slot> element as selected (attribute only; styling via injected shadowRoot stylesheet)
  #markSelectedSlot(node) {
    try {
      node.setAttribute("data-ee-selected", "");
      this.#outlinedNodes.add(node);
    } catch (_) {}
  }

  // Ensure the selected slot can be styled without inline styles by injecting a one-time stylesheet
  #ensureSlotHighlightStyles(sr) {
    try {
      if (!sr) return;
      // Use an attribute marker to avoid duplicates per shadowRoot
      if (sr.querySelector('style[data-ee-slot-highlight]')) return;
      const style = document.createElement('style');
      style.setAttribute('data-ee-slot-highlight', '');
      style.textContent = `
        slot[data-ee-selected] {
          outline: 2px solid var(--spectrum-alias-focus-color);
          outline-offset: 2px;
          border-radius: var(--spectrum-global-dimension-size-50);
        }
      `;
      sr.appendChild(style);
    } catch (_) {}
  }

  /**
   * Alias for setToolbarActions to maintain backwards compatibility
   */
  setToolbarActionsData(actionsData) {
    this.setToolbarActions(actionsData);
  }

  // computeActionsForElement removed (deduplicated by toolbarActions getter)

  // getAttributeValues removed (not used by toolbar any longer)

  /**
   * Set the current slot being edited
   */
  setCurrentSlot(slotName) {
    if (this.currentSlot === slotName) {
      return;
    }
    this.currentSlot = slotName;
    // Selection outline is handled by the editor component.
  }

  /**
   * Unified selection method
   */
  selectElement(element, slotName = null, options = {}) {
    this.suppressFocus = options && options.suppressFocus === true;

    if (!element) {
      // Clear selection
      this.setEditingElement(null);
      this.setCurrentSlot(null);
      this.hideEEToolbar();
      return;
    }

    // Set the element as active and editing
    this.setEditingElement(element);
    this.setCurrentSlot(slotName);
    this.showEEToolbar(element);
    // Center the selection only when out of the visible viewport for tree/comment actions
    const t = this.lastAction?.type || "";
    if (t.startsWith("tree:") || t.startsWith("comment:")) {
      const host = this.editorElement;
      // Match the zoom viewport used by focusElement()
      const viewport = host?.shadowRoot?.querySelector?.("#surface-wrapper");
      const vr = viewport?.getBoundingClientRect?.();
      // Prefer slot rect as anchor when a slot is active and present
      let ar = null;
      try {
        if (this.currentSlot && element && element.shadowRoot) {
          const selector = this.currentSlot === "default" ? "slot:not([name])" : `slot[name="${this.currentSlot}"]`;
          const slotEl = element.shadowRoot.querySelector(selector);
          ar = slotEl?.getBoundingClientRect?.() || null;
        }
      } catch (_) {}
      if (!ar) ar = element?.getBoundingClientRect?.() || null;
      const outOfViewport = !!(
        vr &&
        ar &&
        (ar.right < vr.left || ar.left > vr.right || ar.bottom < vr.top || ar.top > vr.bottom)
      );
      // Debug: record the check and whether we will center the element
      try {
        this.setLastAction(
          t.startsWith("tree:") ? "tree:center-on-check" : "comment:center-on-check",
          {
            outOfViewport,
            viewport: vr ? { x: Math.round(vr.left), y: Math.round(vr.top), w: Math.round(vr.width), h: Math.round(vr.height) } : null,
            anchor: ar ? { x: Math.round(ar.left), y: Math.round(ar.top), w: Math.round(ar.width), h: Math.round(ar.height) } : null,
            tag: element?.tagName?.toLowerCase?.() || null,
            id: element?.id || null,
          }
        );
      } catch (_) {}
      if (outOfViewport && host?.centerOnElement) {
        try { this.setLastAction(t.startsWith("tree:") ? "tree:center-on-exec" : "comment:center-on-exec", { tag: element?.tagName?.toLowerCase?.() || null, id: element?.id || null }); } catch (_) {}
        // Use element anchoring; zoom controller will ensure visibility with minimal pan
        host.centerOnElement(element);
      } else {
        // Helpful debug when skipping re-center
        try {
          this.setLastAction(
            t.startsWith("tree:") ? "tree:center-on-skip" : "comment:center-on-skip",
            {
              reason: outOfViewport ? "no-host-center" : "visible",
            }
          );
        } catch (_) {}
      }
    }
    if (this.suppressFocus) {
      setTimeout(() => {
        this.suppressFocus = false;
      }, 0);
    }
    

    // Ensure we have a baseline snapshot before the first change
    if (this.editorElement && this.undoStack.length === 0) {
      this.captureSnapshot();
    }
  }

  /**
   * Select a slot: behave exactly like selecting the parent element,
   * while setting the current slot context.
   */
  selectSlot(parentElement, slotName) {
    if (!parentElement || !slotName) return;
    // If shadow root is closed or slot element not present, ignore slot
    const sr = parentElement.shadowRoot;
    if (!sr) return this.selectElement(parentElement, null);
    const selector = slotName === "default" ? "slot:not([name])" : `slot[name="${slotName}"]`;
    const slotEl = sr.querySelector(selector);
    if (!slotEl) return this.selectElement(parentElement, null);
    // Delegate to unified element selection with slot context
    this.selectElement(parentElement, slotName);
  }

  // Computed properties

  /**
   * Check if EE toolbar is currently visible
   */
  get isEEToolbarVisible() {
    return this.eeToolbarVisible;
  }

  /**
   * Get element schema from the current editing element
   */
  get elementSchema() {
    if (!this.editingElement) return null;

    // Check if this is a slotted element (has slot attribute)
    const slotName = this.editingElement.getAttribute("slot");
    if (slotName) {
      // Check if the slotted element itself is a custom element with .ee metadata
      const tagName = this.editingElement.tagName.toLowerCase();
      const elementConstructor = customElements.get(tagName);

      if (elementConstructor?.ee) {
        // Custom element in a slot - normalize its own schema (not the parent's)
        // and prefer the element's default slot config for inline editing.
        const normalized = this._normalizeSchemaFromEE(elementConstructor.ee);
        try {
          this.#rememberSlotsForTag(tagName, normalized?.slots || []);
        } catch (_) {}
        let defaultSlotCfg = null;
        try {
          defaultSlotCfg = normalized.getSlotConfig?.("default") || null;
        } catch (_) {}
        return {
          ...normalized,
          isSlotContent: true,
          slotName: slotName,
          // Critical: expose the element's internal default slot config so
          // inline editing can be enabled even when the parent slot name differs.
          slotConfig: defaultSlotCfg,
        };
      }

      // For non-custom slotted elements (div, span, a, etc.),
      // merge default vanilla schema (if any) with the parent's slot config
      const parent = this.editingElement.parentElement;
      if (parent && parent.tagName.includes("-")) {
        const parentTagName = parent.tagName.toLowerCase();
        const parentConstructor = customElements.get(parentTagName);
        if (parentConstructor?.ee) {
          // Get the slot configuration from parent (normalized)
          const parentNorm = this._normalizeSchemaFromEE(parentConstructor.ee);
          try {
            this.#rememberSlotsForTag(parentTagName, parentNorm?.slots || []);
          } catch (_) {}
          const slotConfig = parentNorm.getSlotConfig?.(slotName);
          const slotLabel = parentNorm.getSlotLabel?.(slotName) || slotName;

          // Fetch a default schema for the slotted vanilla element (if available)
          const vanilla =
            getDefaultSchemaForTag(tagName, this.editingElement) || {};

          // Return schema that shows element attributes (from vanilla) and slot management (from parent)
          return {
            attributes: vanilla.attributes || {},
            slots: vanilla.slots || [],
            elementLabel: vanilla.elementLabel || slotLabel,
            elementDescription: vanilla.elementDescription || "",
            supportsTextFormatting:
              vanilla.supportsTextFormatting !== undefined
                ? vanilla.supportsTextFormatting
                : true,
            // Provide the element's own slot helpers if present; otherwise fall back to parent helpers
            getSlotConfig:
              vanilla.getSlotConfig || ((s) => parentNorm.getSlotConfig?.(s)),
            getSlotLabel:
              vanilla.getSlotLabel || ((s) => parentNorm.getSlotLabel?.(s)),
            isSlotContent: true,
            parentElement: parent,
            slotName: slotName,
            // Prefer the element's own inline text config for formatting; fallback to parent's slot config
            slotConfig:
              (vanilla.getSlotConfig && vanilla.getSlotConfig("default")) ||
              slotConfig,
          };
        }
      }
    }

    // If the selected element itself is not slotted, check if it's inside a slotted container
    // Example: <div slot="body-xs"><a>Link</a></div> and the <a> is selected
    {
      // Only use ancestor slot schema if the element itself doesn't expose ee metadata
      const selfTag = this.editingElement.tagName?.toLowerCase?.();
      const selfCtor = selfTag ? customElements.get(selfTag) : null;
      const hasOwnEE = !!selfCtor?.ee;
      if (!hasOwnEE) {
        let ancestor = this.editingElement.parentElement;
        let ancestorWithSlot = null;
        while (ancestor && ancestor !== document.body && !ancestorWithSlot) {
          if (ancestor.hasAttribute && ancestor.hasAttribute("slot")) {
            ancestorWithSlot = ancestor;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        if (ancestorWithSlot) {
          const parent = ancestorWithSlot.parentElement;
          const parentTagName = parent?.tagName?.toLowerCase?.();
          const parentConstructor = parentTagName
            ? customElements.get(parentTagName)
            : null;
          const sName = ancestorWithSlot.getAttribute("slot");
          if (parentConstructor?.ee && sName) {
            const parentNorm = this._normalizeSchemaFromEE(
              parentConstructor.ee
            );
            const slotConfig = parentNorm.getSlotConfig?.(sName);
            const slotLabel = parentNorm.getSlotLabel?.(sName) || sName;
            // Provide default vanilla schema (if any) for the selected element
            const vanilla =
              getDefaultSchemaForTag(selfTag, this.editingElement) || {};
            return {
              attributes: vanilla.attributes || {},
              slots: vanilla.slots || [],
              elementLabel: vanilla.elementLabel || slotLabel,
              elementDescription: vanilla.elementDescription || "",
              supportsTextFormatting:
                vanilla.supportsTextFormatting !== undefined
                  ? vanilla.supportsTextFormatting
                  : true,
              getSlotConfig:
                vanilla.getSlotConfig || ((s) => parentNorm.getSlotConfig?.(s)),
              getSlotLabel:
                vanilla.getSlotLabel || ((s) => parentNorm.getSlotLabel?.(s)),
              isSlotContent: true,
              parentElement: parent,
              slotName: sName,
              // Prefer the element's own inline text config for formatting; fallback to parent's slot config
              slotConfig:
                (vanilla.getSlotConfig && vanilla.getSlotConfig("default")) ||
                slotConfig,
            };
          }
        }
      }
    }

    // Regular element with .ee metadata
    const tagName = this.editingElement.tagName.toLowerCase();
    const constructor = customElements.get(tagName);
    if (!constructor?.ee) {
      // Fallback 1: provide default schemas for vanilla HTML elements (e.g., <a>)
      const vanilla = getDefaultSchemaForTag(tagName, this.editingElement);
      if (vanilla) {
        return { ...vanilla, isSlotContent: false };
      }
      // Fallback 2: if shadowRoot is open, read slots and remember per tag
      const slots = this.#introspectAndRememberSlotsFor(this.editingElement);
      if (Array.isArray(slots) && slots.length > 0) {
        return {
          attributes: {},
          slots,
          elementLabel: tagName,
          elementDescription: "",
          supportsTextFormatting: true,
          getSlotConfig: (name) => ({}),
          getSlotLabel: (name) => name,
          isSlotContent: false,
        };
      }
      return null;
    }

    return {
      ...(() => {
        const n = this._normalizeSchemaFromEE(constructor.ee);
        try {
          this.#rememberSlotsForTag(tagName, n?.slots || []);
        } catch (_) {}
        return n;
      })(),
      isSlotContent: false,
    };
  }

  /**
   * Check if current element has text formatting capabilities
   */
  get hasTextFormatting() {
    if (!this.editingElement) return false;

    const schema = this.elementSchema;
    if (!schema) return true; // Default to true for backward compatibility

    // Slot-aware: if a slot is explicitly selected, prefer its capabilities
    if (this.currentSlot && schema.getSlotConfig) {
      const cfg = this.#normalizeSlotConfig(
        schema.getSlotConfig(this.currentSlot) || {}
      );
      if (cfg.inlineEditable === true) return true;
      if (this.#configSupportsFormatting(cfg)) return true;
    }

    // If the selected node itself is slot content with a slotConfig
    if (schema.isSlotContent && schema.slotConfig) {
      const cfg = this.#normalizeSlotConfig(schema.slotConfig);
      if (cfg.inlineEditable === true) return true;
      if (this.#configSupportsFormatting(cfg)) return true;
    }

    // If the schema exposes slots, check if any slot can format or is inline editable
    if (
      Array.isArray(schema.slots) &&
      schema.slots.length > 0 &&
      schema.getSlotConfig
    ) {
      const hasFormattableSlots = schema.slots.some((slotName) => {
        const config = this.#normalizeSlotConfig(
          schema.getSlotConfig(slotName) || {}
        );
        if (config.inlineEditable === true) return true;
        return this.#configSupportsFormatting(config);
      });

      if (!hasFormattableSlots) {
        return false;
      }
      return true;
    }

    // Element-level override
    if (schema.supportsTextFormatting === false) {
      return false;
    }

    // Default to true
    return true;
  }

  // Form mode removed

  /**
   * Check if current element can be reordered
   */
  get canReorder() {
    if (!this.editingElement) return false;

    // Element needs siblings to be reorderable
    const parent = this.editingElement.parentElement;
    if (!parent) return false;

    // Check if element has siblings with the same slot attribute
    const slot = this.editingElement.getAttribute("slot");

    // Use the existing helper methods
    const hasPrevious = !!this.getPreviousSlotSibling(this.editingElement);
    const hasNext = !!this.getNextSlotSibling(this.editingElement);

    return hasPrevious || hasNext;
  }

  /**
   * Get toolbar configuration for current element
   */
  get toolbarConfig() {
    const schema = this.elementSchema;
    const hasSchema = !!schema;

    return {
      visible: this.eeToolbarVisible,
      position: this.eeToolbarPosition,
      element: this.editingElement,
      schema: schema,
      hasSchema: hasSchema,
      showAttributeControls:
        hasSchema &&
        schema?.attributes &&
        Object.keys(schema.attributes).length > 0,
      showSlots: hasSchema && schema?.slots && schema.slots.length > 0,
      showTextFormatting: this.hasTextFormatting,
      showReordering: this.canReorder,
      currentSlot: this.currentSlot,
    };
  }

  /**
   * Comprehensive toolbar actions computed property
   * Provides all necessary data for toolbar to render without DOM queries
   */
  get toolbarActions() {
    if (this.toolbarActionsData) return this.toolbarActionsData;
    const element = this.editingElement;
    if (!element) return null;
    const schema = this.elementSchema;

    const getConfig = (name) => {
      const raw = schema?.getSlotConfig ? schema.getSlotConfig(name) || {} : {};
      const normalized = this.#normalizeSlotConfig(raw);
      const tags = Array.isArray(normalized.allowedTags)
        ? normalized.allowedTags.slice()
        : [];
      if (!tags.includes("ee-reference")) tags.push("ee-reference");
      return { ...normalized, allowedTags: tags };
    };

    const ensureLink = (cfg, list) => {
      const allowed = Array.isArray(list) ? list.slice() : [];
      const canLink = cfg?.allowLinks === true || (Array.isArray(cfg?.allowedTags) && cfg.allowedTags.includes("a"));
      if (canLink && !allowed.includes("link")) allowed.push("link");
      return allowed;
    };

    const resolveFormats = () => {
      if (!schema) return null;
      if (schema.isSlotContent) {
        const normalizedSlot = this.#normalizeSlotConfig(schema.slotConfig || {});
        return ensureLink(normalizedSlot, normalizedSlot.allowedFormats);
      }
      if (schema.slots && schema.getSlotConfig) {
        if (this.currentSlot) {
          const cfg = getConfig(this.currentSlot);
          if (Array.isArray(cfg?.allowedFormats)) return ensureLink(cfg, cfg.allowedFormats);
        }
        const union = new Set();
        for (const s of schema.slots) {
          const cfg = getConfig(s);
          if (Array.isArray(cfg?.allowedFormats)) ensureLink(cfg, cfg.allowedFormats).forEach((f) => union.add(f));
        }
        return union.size ? Array.from(union) : [];
      }
      return null;
    };

    const slotInfo = {};
    if (schema?.slots && schema.getSlotConfig) {
      for (const slotName of schema.slots) {
        let nodes = [];
        if (element.shadowRoot) {
          const slot = element.shadowRoot.querySelector(slotName === "default" ? "slot:not([name])" : `slot[name="${slotName}"]`);
          nodes = slot ? slot.assignedNodes() : [];
        } else {
          nodes = Array.from(element.children).filter((c) => (slotName === "default" ? !c.hasAttribute("slot") : c.getAttribute("slot") === slotName));
        }
        const cfg = getConfig(slotName);
        slotInfo[slotName] = {
          hasContent: nodes.some((n) => n.nodeType === Node.ELEMENT_NODE),
          count: nodes.filter((n) => n.nodeType === Node.ELEMENT_NODE).length,
          label: schema.getSlotLabel?.(slotName) || slotName,
          allowedTags: cfg.allowedTags || ["div"],
          minLength: cfg.minLength || 0,
          maxLength: cfg.maxLength == null ? Infinity : cfg.maxLength,
          allowedFormats: cfg.allowedFormats || [],
        };
      }
    }

    const duplicationAllowed = (() => {
      const parent = element.parentElement;
      if (!parent) return false;
      const parentTag = parent.tagName?.toLowerCase?.() || "";
      // If parent is not a custom element or has no slot constraints, allow duplication
      if (!parent.tagName?.includes?.("-")) return true;
      const parentCtor = customElements.get(parentTag);
      const slotName = element.getAttribute("slot") || "default";
      const schema = parentCtor?.ee?.getSchema?.();
      const cfg = schema?.slots?.configs?.[slotName] || parentCtor?.ee?.getSlotConfig?.(slotName);
      if (!cfg) return true;
      const maxLen = cfg.maxLength == null ? Infinity : cfg.maxLength;
      const count = Array.from(parent.children).filter((c) => (slotName === "default" ? !c.hasAttribute("slot") : c.getAttribute("slot") === slotName)).length;
      return count < maxLen;
    })();

    let attributesSchema = schema?.attributes || {};
    const t = this.inlineLinkEditingTarget;
    if (t?.tagName) {
      const overlay = getDefaultSchemaForTag(String(t.tagName).toLowerCase(), t);
      if (overlay?.attributes) attributesSchema = overlay.attributes;
    }

    let customActions = [];
    try {
      const ctor = customElements.get(element.tagName.toLowerCase());
      const getActions = ctor?.ee?.getToolbarActions;
      if (getActions) {
        const helpers = {
          showToast: (msg) => this.editorElement?.showToast?.(msg),
          // Open target URN in the same window when running inside the app
          // Falls back to full navigation when store is not available (e.g., standalone preview)
          openInEditor: (id) => {
            // Hard-navigate within the same tab for URN changes, preserving current base path
            const url = new URL(window.location.href);
            url.searchParams.set('id', String(id || ''));
            // Clear creation-related params when entering editor directly
            url.searchParams.delete('new');
            url.searchParams.delete('category');
            window.location.href = url.toString();
          },
        };
        const res = getActions(element, helpers);
        if (Array.isArray(res)) customActions = res;
      }
    } catch (_) {}

    return {
      element,
      elementLabel: schema?.elementLabel || "",
      elementDescription: schema?.elementDescription || "",
      isSlotContent: !!schema?.isSlotContent,
      slotName: schema?.slotName || null,
      parentElement: schema?.parentElement || null,
      textFormatting: {
        enabled: !!this.hasTextFormatting,
        supportsFormatting: !!this.hasTextFormatting,
        allowedFormats: resolveFormats(),
      },
      attributes: {
        enabled: Object.keys(attributesSchema || {}).length > 0,
        schema: attributesSchema || {},
      },
      slots: {
        enabled: !!(schema?.slots && schema.slots.length > 0),
        available: schema?.slots || [],
        current: this.currentSlot,
        getConfig,
        getLabel: schema?.getSlotLabel,
        slotInfo,
      },
      reordering: {
        enabled: !!this.canReorder,
        canMoveUp: !!this.getPreviousSlotSibling?.(element),
        canMoveDown: !!this.getNextSlotSibling?.(element),
        canMoveFirst: !!this.getPreviousSlotSibling?.(element),
        canMoveLast: !!this.getNextSlotSibling?.(element),
      },
      duplicationAllowed,
      customActions,
    };
  }

  /**
   * Move element before its previous sibling
   */
  moveElementBefore(element) {
    if (!element) {
      return;
    }

    const previousSibling = this.getPreviousSlotSibling(element);
    if (!previousSibling) return;

    const parent = element.parentElement;

    

    parent.insertBefore(element, previousSibling);

    this.elementMoved(element);

    // Schedule snapshot for undo/redo
    this.scheduleSnapshot();
  }

  /**
   * Move element after its next sibling
   */
  moveElementAfter(element) {
    if (!element) {
      return;
    }

    const nextSibling = this.getNextSlotSibling(element);
    if (!nextSibling) return;

    const parent = element.parentElement;

    

    // Insert after next sibling (which means before the sibling after that)
    if (nextSibling.nextElementSibling) {
      parent.insertBefore(element, nextSibling.nextElementSibling);
    } else {
      parent.appendChild(element);
    }

    this.elementMoved(element);

    // Schedule snapshot for undo/redo
    this.scheduleSnapshot();
  }

  /**
   * Duplicate an element
   */
  duplicateElement(element) {
    if (!element) {
      return;
    }
    

    // Respect slot cardinality if element is in a slot and parent defines a maxLength
    const slotName = element.getAttribute("slot");
    const parent = element.parentElement;
    // Parent may be the editor host or another custom element; both allowed
    if (parent && (slotName || slotName === "")) {
      const parentCtor = customElements.get(parent.tagName?.toLowerCase?.());
      let cfg = null;
      try {
        if (parentCtor?.ee?.getSchema) {
          const s = parentCtor.ee.getSchema();
          const name = slotName || "default";
          cfg = s?.slots?.configs?.[name] || null;
        }
      } catch (_) {}
      if (!cfg) {
        cfg = parentCtor?.ee?.getSlotConfig?.(slotName || "default");
      }
      if (cfg) {
        const maxLen =
          cfg.maxLength === null || cfg.maxLength === undefined
            ? Infinity
            : cfg.maxLength;
        let currentCount = 0;
        if (slotName) {
          currentCount = Array.from(parent.children).filter(
            (c) => c.getAttribute("slot") === slotName
          ).length;
        } else {
          currentCount = Array.from(parent.children).filter(
            (c) => !c.hasAttribute("slot")
          ).length;
        }
        if (currentCount >= maxLen) return;
      }
    }

    const clone = element.cloneNode(true);
    try {
      const cs = this.store?.commentStore;
      cs?.regenerateAnchors?.(clone);
    } catch (_) {}

    // Update ID if it exists to avoid duplicates
    if (clone.id) {
      const baseId = clone.id.replace(/-\d+$/, "");
      let counter = 1;
      while (document.getElementById(`${baseId}-${counter}`)) {
        counter++;
      }
      clone.id = `${baseId}-${counter}`;
    }

    // Insert clone after original element
    if (element.nextSibling) {
      element.parentNode.insertBefore(clone, element.nextSibling);
    } else {
      element.parentNode.appendChild(clone);
    }

    // Set the duplicated element as active
    this.setEditingElement(clone);
    this.showEEToolbar(clone);

    // Schedule snapshot for undo/redo
    this.scheduleSnapshot();
    // Ensure autosave runs promptly for duplication actions
    this.scheduleAutoSave();
    // Trace action for reactions/telemetry
    try { this.setLastAction && this.setLastAction('editor:duplicate', { tag: clone.tagName?.toLowerCase?.() }); } catch (_) {}
  }

  /**
   * Delete an element
   */
  deleteElement(element) {
    if (!element) {
      return;
    }
    

    // Determine the next selection target before removal
    const wasSelected = this.editingElement === element;
    const parent = element.parentElement || null;
    const slotName = element.getAttribute ? element.getAttribute("slot") : null;
    let prev = this.getPreviousSlotSibling?.(element) || null;
    if (prev == null) {
      // Fallback without slot awareness
      let sib = element.previousElementSibling;
      if (slotName) {
        while (sib && sib.getAttribute("slot") !== slotName) sib = sib.previousElementSibling;
      } else {
        while (sib && sib.hasAttribute && sib.hasAttribute("slot")) sib = sib.previousElementSibling;
      }
      prev = sib || null;
    }

    // Remove element from DOM
    element.remove();

    // If the deleted element was selected, move selection
    if (wasSelected) {
      if (prev) {
        this.selectElement(prev);
      } else if (
        parent &&
        parent !== this.editorElement &&
        parent?.tagName !== "EXPERIENCE-ELEMENTS-EDITOR"
      ) {
        // No previous sibling in the same slot; try to select the last element
        // from the closest previous slot that has content, based on the parent's schema order.
        let selectedFromPrevSlot = false;
        try {
          if (slotName && parent.tagName && parent.tagName.includes("-")) {
            const parentCtor = customElements.get(parent.tagName.toLowerCase());
            let order = [];
            try {
              if (parentCtor?.ee?.getSchema) {
                const s = parentCtor.ee.getSchema();
                order = Array.isArray(s?.slots?.order) ? s.slots.order : [];
              }
            } catch (_) {}
            if (
              !order.length &&
              typeof parentCtor?.ee?.getSlots === "function"
            ) {
              try {
                order = parentCtor.ee.getSlots() || [];
              } catch (_) {}
            }
            if (Array.isArray(order) && order.length) {
              const idx = order.indexOf(slotName);
              if (idx > 0) {
                for (let i = idx - 1; i >= 0; i--) {
                  const prevSlot = order[i];
                  // Collect elements assigned to prevSlot
                  const candidates = Array.from(parent.children).filter(
                    (c) => c.getAttribute && c.getAttribute("slot") === prevSlot
                  );
                  if (candidates.length) {
                    const target = candidates[candidates.length - 1];
                    if (target) {
                      this.selectElement(target);
                      selectedFromPrevSlot = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}

        if (!selectedFromPrevSlot) {
          // Fallback: select the parent slot or parent itself
          if (slotName) this.selectSlot(parent, slotName || "default");
          else this.selectElement(parent);
        }
      } else {
        // Clear selection if no valid target
        this.selectElement(null);
      }
    }

    // Schedule snapshot for undo/redo
    this.scheduleSnapshot();
  }

  /**
   * Show EE Toolbar
   */
  showEEToolbar(element, position) {
    this.eeToolbarElement = element;
    let calculatedPosition = null;
    calculatedPosition = this.calculateEEToolbarPosition(element);
    this.eeToolbarPosition = position || calculatedPosition;
    this.eeToolbarVisible = true;

    // Trace toolbar visibility for debugging
    const tag2 = element && element.tagName ? element.tagName.toLowerCase() : null;
    const id2 = element && element.id ? element.id : null;
    this.setLastAction('editor:toolbar:show', { tag: tag2, id: id2 });

    // After the toolbar renders, update position using actual dimensions
    setTimeout(() => {
      this.updateEEToolbarPosition();
    }, 0);
  }

  /**
   * Hide EE Toolbar
   */
  hideEEToolbar() {
    this.eeToolbarVisible = false;
    this.eeToolbarElement = null;
    // Ensure any open overlay state is cleared so gestures aren’t blocked
    this.toolbarOverlayOpen = false;
    // Trace toolbar hide for debugging
    this.setLastAction('editor:toolbar:hide');
  }

  // Sidebar controls
  setSidebarOpen(open) {
    this.sidebarOpen = !!open;
    // Optionally hide toolbar when sidebar is closed
    if (!this.sidebarOpen) {
      this.hideEEToolbar();
    }
  }
  // Removed: closeSidebar convenience wrapper; use setSidebarOpen(false)

  // Removed: isSidebarActive and related setters; not needed

  /**
   * Clear current selection and hide toolbar
   */
  clearSelection() {
    this.setCurrentSlot(null);
    this.setEditingElement(null);
    this.hideEEToolbar();
  }

  /**
   * Centralized ESC handler based on current UI context
   * Returns true if handled, false otherwise.
   */
  handleEscape() {
    
    // If inline editing, cancel and clear selection
    if (this.isContentEditable) {
      try {
        this.cancelInlineEditing?.();
      } catch (_) {}
      this.clearSelection();
      return true;
    }
    // If last interaction was with the toolbar, dismiss the toolbar only
    try {
      const last = this.lastAction?.type || '';
      if (this.isEEToolbarVisible && last.startsWith('toolbar:')) {
        this.hideEEToolbar();
        return true;
      }
    } catch (_) {}
    // Keep tree-nav open: do not auto-close sidebar on Escape
    // Editor is active: clear selection
    this.clearSelection();
    return true;
  }

  // setEEToolbarElement removed (unused)

  /**
   * Update EE Toolbar position
   */
  updateEEToolbarPosition() {
    if (this.eeToolbarElement) {
      const pos = this.calculateEEToolbarPosition(this.eeToolbarElement);
      this.eeToolbarPosition = pos;
      
    }
  }

  /**
   * Allow external components (toolbar) to set an explicit position
   */
  setEEToolbarPosition(x, y) {
    this.eeToolbarPosition = { x, y };
  }

  /**
   * Calculate EE Toolbar position for an element
   */
  calculateEEToolbarPosition(element) {
    if (!element) return { x: 0, y: 0 };
    const selection = window.getSelection?.();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      return this._calculatePositionFromRect(selection.getRangeAt(0).getBoundingClientRect());
    }
    const slotName = this.currentSlot;
    const sr = element.shadowRoot;
    if (slotName && sr) {
      const selector = slotName === "default" ? "slot:not([name])" : `slot[name="${slotName}"]`;
      const slotEl = sr.querySelector(selector);
      const rect = slotEl?.getBoundingClientRect?.();
      if (rect && rect.width >= 1 && rect.height >= 1) return this._calculatePositionFromRect(rect);
    }
    return this._calculatePositionFromRect(element.getBoundingClientRect());
  }

  /**
   * Internal helper to compute a viewport-aware toolbar position from a DOMRect.
   * Default: place toolbar below the rect; if element is near the bottom (>80% of viewport), place above.
   * Falls back to opposite side when chosen position would be off-screen, then clamps.
   */
  _calculatePositionFromRect(rect) {
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const margin = 8; // viewport margin
    const gap = 62; // gap between element/selection and toolbar

    // Use actual toolbar dimensions when available; fall back to estimates.
    const dims = this._getToolbarDims();
    const toolbarWidth = dims.width;
    const toolbarHeight = dims.height;

    // Center horizontally on the rect
    let x = rect.left + rect.width / 2 - toolbarWidth / 2;

    // Prefer below unless the element is near the bottom of the viewport
    const nearBottom = rect.bottom >= viewportHeight * 0.8;
    const yBelow = rect.bottom + gap;
    const yAbove = rect.top - toolbarHeight - gap;
    let y = nearBottom ? yAbove : yBelow;

    // If chosen side is off-screen, try the other side before clamping
    const maxX = Math.max(margin, viewportWidth - toolbarWidth - margin);
    const maxY = Math.max(margin, viewportHeight - toolbarHeight - margin);
    if (y < margin) y = nearBottom ? yBelow : yAbove; // try opposite side
    if (y > maxY) y = nearBottom ? yAbove : yBelow;   // try opposite side

    x = Math.min(Math.max(margin, x), maxX);
    y = Math.min(Math.max(margin, y), maxY);

    return { x, y };
  }

  /**
   * Measure current toolbar dimensions if available.
   * Falls back to conservative defaults when not rendered yet.
   */
  _getToolbarDims() {
    const inner = this.editorElement?.shadowRoot?.querySelector("ee-toolbar")?.shadowRoot?.getElementById("ee-toolbar");
    if (inner) {
      const rect = inner.getBoundingClientRect();
      return { width: Math.max(1, Math.round(rect.width || 520)), height: Math.max(1, Math.round(rect.height || 40)) };
    }
    return { width: 520, height: 40 };
  }

  /**
   * Notify that an element was moved
   */
  elementMoved(element) {
    // Update EE toolbar position if needed
    if (this.eeToolbarElement === element) {
      this.updateEEToolbarPosition();
    }
  }

  /**
   * Get previous sibling considering slot attribute
   */
  getPreviousSlotSibling(element) {
    const slot = element.getAttribute("slot");

    // If element has a slot, find previous sibling with same slot
    if (slot) {
      let sibling = element.previousElementSibling;
      while (sibling) {
        if (sibling.getAttribute("slot") === slot) {
          return sibling;
        }
        sibling = sibling.previousElementSibling;
      }
      return null;
    }

    // If no slot, find previous sibling without slot
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (!sibling.hasAttribute("slot")) {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }
    return null;
  }

  /**
   * Get next sibling considering slot attribute
   */
  getNextSlotSibling(element) {
    const slot = element.getAttribute("slot");

    // If element has a slot, find next sibling with same slot
    if (slot) {
      let sibling = element.nextElementSibling;
      while (sibling) {
        if (sibling.getAttribute("slot") === slot) {
          return sibling;
        }
        sibling = sibling.nextElementSibling;
      }
      return null;
    }

    // If no slot, find next sibling without slot
    let sibling = element.nextElementSibling;
    while (sibling) {
      if (!sibling.hasAttribute("slot")) {
        return sibling;
      }
      sibling = sibling.nextElementSibling;
    }
    return null;
  }

  

  /**
   * Get the bounds of the editing surface and container
   * @returns {Object|null} Object with surface and container rects
   */
  getSurfaceBounds() {
    if (!this.editorElement) return null;

    const surface =
      this.editorElement.shadowRoot?.querySelector("#surface-wrapper");
    const container =
      this.editorElement.shadowRoot?.querySelector("#canvas-container");

    if (!surface || !container) return null;

    // Get the transformed bounds of the surface
    const surfaceRect = surface.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return {
      surface: surfaceRect,
      container: containerRect,
    };
  }

  

  /**
   * Set pan position
   */
  setPan(x, y) {
    // removed
    return;
  }

  /**
   * Update pan position (relative) with viewport constraints
   */
  updatePan(
    deltaX,
    deltaY,
    viewportWidth,
    viewportHeight,
    elementWidth,
    elementHeight
  ) {
    // removed
    return;
  }

  

  /**
   * Animate pan to a target position (pre-scale) over a short duration.
   */
  animatePanTo(targetX, targetY, duration = 160) {
    // removed
    return;
  }

  

  /**
   * Undo/Redo Operations
   */

  /**
   * Set the editor element reference for undo/redo
   */
  setEditorElement(element) {
    this.editorElement = element;
    // Ensure a global stylesheet exists to style selected nodes in the editor's light DOM without inline styles
    try { this.#ensureGlobalSelectionStyles(); } catch (_) {}
    // Viewport/scroll listeners are managed in the editor component.
  }

  // Inject a one-time global stylesheet to style selected elements within the editor subtree (no inline styles)
  #ensureGlobalSelectionStyles() {
    try {
      const doc = this.editorElement?.ownerDocument || document;
      if (!doc || !doc.head) return;
      if (doc.head.querySelector('style[data-ee-selection-style]')) return;
      const style = doc.createElement('style');
      style.setAttribute('data-ee-selection-style', '');
      style.textContent = `
        experience-elements-editor *[data-ee-selected] {
          outline: 2px solid var(--spectrum-alias-focus-color);
          outline-offset: 2px;
        }
      `;
      doc.head.appendChild(style);
    } catch (_) {}
  }

  /**
   * Schedule a snapshot after changes
   */
  scheduleSnapshot() {
    // Skip if undo/redo is in progress
    if (this.isUndoRedoInProgress) {
      return;
    }

    // Clear existing timeout
    if (this.snapshotTimeout) {
      clearTimeout(this.snapshotTimeout);
    }

    // Schedule new snapshot after delay
    this.snapshotTimeout = setTimeout(() => {
      this.captureSnapshot();
    }, this.snapshotDelay);

    // Also (re)schedule auto-save on user activity
    this.scheduleAutoSave();
  }

  /**
   * Capture current state as a snapshot
   */
  captureSnapshot() {
    if (!this.editorElement) return;

    const htmlContent = this.editorElement.innerHTML;
    

    // If this is the first snapshot (empty undo stack), capture current state as base
    if (this.undoStack.length === 0) {
      // Push the current state as the first undo state
      this.undoStack.push(htmlContent);
      return;
    }

    this.pushUndoState(htmlContent);
  }

  /**
   * Return a JSON snapshot of the current editing element using schema-aware toJson
   * Falls back to a robust generic serializer for unknown elements and plain DOM.
   */
  getJsonSnapshot() {
    const host = this.editorElement;
    if (!host) return [];

    // Helper: collect attributes to a map
    const getAttributes = (el) => {
      const attrs = {};
      for (const name of el.getAttributeNames()) {
        attrs[name] = el.getAttribute(name);
      }
      return attrs;
    };

    // Generic element serializer
    const serializeElement = (el) => ({ content: el.outerHTML });

    // Node serializer passed down into all toJson calls
    const serializeNode = (node) => {
      if (!node) return null;
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent?.trim();
        return t ? { text: t } : null;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const Ctor = customElements.get(tag);
        if (Ctor?.ee?.toJson) {
          try {
            return Ctor.ee.toJson(node, serializeNode);
          } catch (_) {}
        }
        // Check defaults for vanilla elements (registered via window.eeDefaults)
        try {
          const def =
            typeof window !== "undefined" && window.eeDefaults
              ? window.eeDefaults[tag]
              : null;
          if (def?.toJson) {
            return def.toJson(node, serializeNode);
          }
        } catch (_) {}
        return serializeElement(node);
      }
      return null;
    };

    // Serialize each top-level element in the editor host
    const out = [];
    for (const el of Array.from(host.children)) {
      if (!(el && el.nodeType === Node.ELEMENT_NODE)) continue;
      const tag = el.tagName?.toLowerCase?.();
      const Ctor = tag ? customElements.get(tag) : null;
      if (Ctor?.ee?.toJson) {
        out.push(Ctor.ee.toJson(el, serializeNode));
      } else {
        const def = typeof window !== "undefined" && window.eeDefaults ? window.eeDefaults[tag] : null;
        if (def?.toJson) out.push(def.toJson(el, serializeNode));
        else out.push(serializeElement(el));
      }
    }
    return out;
  }

  // Collect quick debug telemetry for ee-reference triggers
  #collectEeReferenceDebug() {
    const host = this.editorElement;
    if (!host) return { count: 0, triggerTags: {} };
    const refs = Array.from(host.querySelectorAll("ee-reference"));
    const tally = {};
    for (const ref of refs) {
      const t = ref.querySelector(':scope > [slot="trigger"]');
      const tag = (t?.tagName || "").toLowerCase();
      tally[tag || "none"] = (tally[tag || "none"] || 0) + 1;
    }
    return { count: refs.length, triggerTags: tally };
  }

  /**
   * Schedule an auto-save after a period of inactivity
   */
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSaveTimeout = null;
      this.performAutoSave();
    }, this.autoSaveDelay);
  }

  /**
   * Perform auto-save via the host store and show a quiet indicator
   */
  async performAutoSave() {
    const host = this.editorElement;
    if (!host) return;
    const appStore = host?.store;
    const doc = appStore?.currentElement;
    const urn = this.currentElementId || appStore?.editorStore?.currentElementId;
    if (!doc || !urn) return;

    if (!host.firstElementChild) return;

    // Build sanitized HTML snapshot for all top-level children
    const nextHtml = this.#buildSanitizedHtmlFromHost(host, urn);

    // Build normalized comments snapshot
    const normalizeComments = (list) =>
      Array.isArray(list)
        ? list.map((c) => ({
            id: String(c.id || ""),
            targetId: String(c.targetId || ""),
            text: String(c.text || ""),
            status: c.status === "resolved" ? "resolved" : "open",
            createdAt: c.createdAt || new Date().toISOString(),
            updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
            ...(c.author ? { author: String(c.author) } : {}),
            ...(c.authorEmail ? { authorEmail: String(c.authorEmail) } : {}),
          }))
        : [];

    const nextComments = normalizeComments(appStore?.commentStore?.comments || []);
    const prevComments = normalizeComments(doc.comments || []);

    const sameHtml = String(doc.html || "") === String(nextHtml || "");
    const sameComments = (() => {
      if (prevComments.length !== nextComments.length) return false;
      for (let i = 0; i < nextComments.length; i++) {
        const a = nextComments[i];
        const b = prevComments[i];
        if (!b) return false;
        if (
          a.id !== b.id ||
          a.targetId !== b.targetId ||
          a.text !== b.text ||
          a.status !== b.status ||
          a.author !== b.author ||
          a.authorEmail !== b.authorEmail
        )
          return false;
      }
      return true;
    })();

    // If neither HTML nor comments changed, skip save
    if (sameHtml && sameComments) return;

    // Persist when either HTML or comments changed; include current comments/model in payload
    doc.html = nextHtml;
    doc.comments = nextComments;
    // Provide editorStore context so saveDocument can include model snapshot
    doc.editorStore = this;
    await appStore.documentStore.saveDocument(doc);
    this.markSaved();
  }

  /**
   * Mark save complete and briefly show indicator in toolbar
   */
  markSaved() {
    this.lastSavedAt = Date.now();
    this.saveIndicatorVisible = true;
    if (this.saveIndicatorHideTimeout) {
      clearTimeout(this.saveIndicatorHideTimeout);
    }
    this.saveIndicatorHideTimeout = setTimeout(() => {
      this.saveIndicatorVisible = false;
    }, 1500);
    // Update baseline after a successful save
    try { this.setBaselineFromCurrent(); } catch (_) {}
  }

  /**
   * Check if there are unsaved changes compared to the last persisted HTML.
   * Returns true when current canvas HTML differs from appStore.currentElement.html
   */
  hasUnsavedChanges() {
    try {
      const host = this.editorElement;
      if (!host) return false;
      const appStore = host?.store;
      const doc = appStore?.currentElement;
      const urn = this.currentElementId || appStore?.editorStore?.currentElementId;
      if (!doc || !urn) return false;
      if (!host.firstElementChild) return false;
      // Sanitize current DOM snapshot (all top-level children)
      const currentSanitized = this.#buildSanitizedHtmlFromHost(host, urn);
      // Prefer comparing against a baseline captured at load/save
      if (this.baselineHtmlNormalized != null) {
        return String(this.baselineHtmlNormalized) !== String(currentSanitized || "");
      }
      // Fallback: sanitize the last persisted HTML as well to avoid false positives
      const last = String(doc.html || "");
      // Normalize saved HTML by sanitizing each top-level element as well
      const parser = new DOMParser();
      const docParsed = parser.parseFromString(last, 'text/html');
      const savedParts = [];
      for (const child of Array.from(docParsed.body.children || [])) {
        try {
          // Import into current document for consistent sanitization
          const imported = document.importNode(child, true);
          sanitizeTree(imported, { currentDocumentId: urn, beforeSave: true, showToast: () => {} });
          savedParts.push(imported.outerHTML);
        } catch (_) {}
      }
      const lastSanitized = savedParts.join('\n');
      return String(lastSanitized || "") !== String(currentSanitized || "");
    } catch (_) {
      return false;
    }
  }

  /**
   * Capture the current sanitized canvas HTML as the baseline (no unsaved changes beyond this point)
   */
  setBaselineFromCurrent() {
    try {
      const host = this.editorElement;
      if (!host) return;
      const appStore = host?.store;
      const urn = this.currentElementId || appStore?.editorStore?.currentElementId;
      if (!host.firstElementChild) return;
      this.baselineHtmlNormalized = this.#buildSanitizedHtmlFromHost(host, urn);
    } catch (_) {}
  }

  // Save the current document using sanitized HTML from the editor DOM
  async saveCurrentElement() {
    const host = this.editorElement;
    if (!host) return;
    const appStore = host?.store;
    const doc = appStore?.currentElement;
    const urn = this.currentElementId || appStore?.editorStore?.currentElementId;
    if (!doc || !urn) return;

    if (!host.firstElementChild) return;
    const html = this.#buildSanitizedHtmlFromHost(host, urn);
    // Persist comments
    const comments = appStore?.commentStore?.comments || [];
    doc.comments = Array.isArray(comments)
      ? comments.map((c) => ({
          id: String(c.id || ""),
          targetId: String(c.targetId || ""),
          text: String(c.text || ""),
          status: c.status === "resolved" ? "resolved" : "open",
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
          ...(c.author ? { author: String(c.author) } : {}),
          ...(c.authorEmail ? { authorEmail: String(c.authorEmail) } : {}),
        }))
      : [];

    // Update in-memory and persist
    doc.html = html;
    await appStore.documentStore.saveDocument(doc);
  }

  // Build a normalized sanitized HTML string from all top-level children in the editor host
  #buildSanitizedHtmlFromHost(host, urn) {
    try {
      const parts = [];
      const children = Array.from(host.children || []).filter((n) => n && n.nodeType === Node.ELEMENT_NODE);
      for (const el of children) {
        const clone = el.cloneNode(true);
        sanitizeTree(clone, {
          currentDocumentId: urn,
          showToast: (msg) => host?.showToast?.(msg),
          beforeSave: true,
        });
        parts.push(clone.outerHTML);
      }
      return parts.join('\n');
    } catch (_) {
      return '';
    }
  }

  /**
   * Push a new state to the undo stack
   */
  pushUndoState(htmlContent) {
    // Skip if undo/redo is in progress
    if (this.isUndoRedoInProgress) {
      return;
    }

    // Skip if the content is identical to the last state in undo stack
    const lastUndoState =
      this.undoStack.length > 0
        ? this.undoStack[this.undoStack.length - 1]
        : null;
    if (htmlContent === lastUndoState) return;

    // Add to undo stack
    this.undoStack.push(htmlContent);

    // Clear redo stack when new action is performed
    this.redoStack = [];

    // Limit stack size to prevent memory issues
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift(); // Remove oldest state
    }
  }

  /**
   * Perform undo operation
   */
  undo() {
    if (!this.canUndo || !this.editorElement) {
      return false;
    }


    // If we only have one state, we can't undo
    if (this.undoStack.length <= 1) return false;

    // Pop the current state from undo stack and push to redo
    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);

    // Get the previous state (now the last item in the stack)
    const previousState = this.undoStack[this.undoStack.length - 1];

    // Set flag to prevent capturing this change
    this.isUndoRedoInProgress = true;

    // Apply the previous state
    this.editorElement.innerHTML = previousState;

    // Clear selected element and hide toolbar
    this.setEditingElement(null);
    this.hideEEToolbar();

    // Reset flag after a brief delay
    setTimeout(() => {
      this.isUndoRedoInProgress = false;
    }, 100);

    // Post-apply hook removed

    return true;
  }

  /**
   * Perform redo operation
   */
  redo() {
    if (!this.canRedo || !this.editorElement) {
      return false;
    }


    // Pop from redo stack
    const nextState = this.redoStack.pop();

    // Push to undo stack
    this.undoStack.push(nextState);

    // Set flag to prevent capturing this change
    this.isUndoRedoInProgress = true;

    // Apply the next state
    this.editorElement.innerHTML = nextState;

    // Clear selected element and hide toolbar
    this.setEditingElement(null);
    this.hideEEToolbar();

    // Reset flag after a brief delay
    setTimeout(() => {
      this.isUndoRedoInProgress = false;
    }, 100);

    // Post-apply hook removed

    return true;
  }

  /**
   * Clear undo/redo history
   */
  clearUndoRedo() {
    this.undoStack = [];
    this.redoStack = [];
  }

  

  // onRender hook logic removed

  /**
   * Check if undo is available
   */
  get canUndo() {
    // Need at least 2 states to undo (current + previous)
    return this.undoStack.length > 1;
  }

  /**
   * Check if redo is available
   */
  get canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Toggle contenteditable on the editing element for inline text editing
   */
  toggleContentEditable() {
    this.editorElement?.toggleContentEditable?.();
  }

  /**
   * Enable contenteditable on the editing element
   */
  enableContentEditable() {
    // Delegated to the editor component (DOM logic)
    if (this.editorElement?.enableContentEditable) {
      this.editorElement.enableContentEditable();
      return;
    }

    // Store original contentEditable state
    if (element._eeOriginalContentEditable === undefined) {
      element._eeOriginalContentEditable = element.contentEditable || "inherit";
    }
    // Store original HTML to allow cancel via Escape (memory only)
    if (element._eeOriginalHTML === undefined) {
      element._eeOriginalHTML = element.innerHTML;
    }

    // Decide whether we should allow formatting or plain text only
    // Plain text mode when no formatting is allowed in schema
    const plainTextOnly = !this.hasTextFormatting;
    // Apply contenteditable mode via attribute for broader browser support
    element.setAttribute("contenteditable", plainTextOnly ? "plaintext-only" : "true");

    // Ensure host allows text selection even if component CSS disables it (e.g., buttons)
    // Store original user-select so we can restore later
    if (element._eeOriginalUserSelect === undefined) {
      const current = element.style.userSelect || "";
      element._eeOriginalUserSelect = current;
    }
    element.style.userSelect = "text";
    // Safari/old webkit prefix just in case
    try {
      element.style.webkitUserSelect = "text";
    } catch (_) {}

    // Check if the element should only allow single-line editing
    const schema = this.elementSchema;
    const isMultiline = this.getMultilineSupport(schema);

    // Add spacebar fix for all contenteditable elements
    // If editing a custom element's default slot, prefer a dedicated child node as the edit target
    let editTarget = element;
    try {
      const tag = element.tagName?.toLowerCase?.() || "";
      const isCustom = tag.includes("-");
      if (isCustom) {
        const hasText = !!(
          element.textContent && element.textContent.length > 0
        );
        const firstElChild =
          Array.from(element.children || []).find(
            (c) => !c.hasAttribute("slot")
          ) || null;
        // Prefer an existing simple inline child (e.g., span) as the edit target
        if (
          firstElChild &&
          !firstElChild.tagName?.toLowerCase?.().includes("-")
        ) {
          // Ensure it contains at least one text node to allow caret placement
          try {
            if (
              !firstElChild.childNodes ||
              firstElChild.childNodes.length === 0
            ) {
              firstElChild.appendChild(document.createTextNode(" "));
            }
          } catch (_) {}
          editTarget = firstElChild;
        } else {
          const hasElChild = !!firstElChild;
          if (!hasElChild && !hasText) {
            const span = document.createElement("span");
            // Seed with a single space so caret has a target; sanitized away if unchanged
            try {
              span.appendChild(document.createTextNode(" "));
            } catch (_) {}
            // Prefer property marker rather than attribute
            try {
              element.eeEditNode = span;
            } catch (_) {}
            element.appendChild(span);
            editTarget = span;
          }
        }
      }
    } catch (_) {}

    const handleKeydown = (e) => {
      // Prevent default scroll on spacebar and insert proper space
      if (e.code === "Space") {
        e.preventDefault();
        document.execCommand("insertText", false, " ");
      }

      // For single-line elements, also prevent Enter
      if (!isMultiline && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
      }
      // Escape: cancel editing (revert content, no snapshot)
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        try {
          const original = element._eeOriginalHTML;
          if (original != null) element.innerHTML = original;
          if (this.snapshotTimeout) {
            clearTimeout(this.snapshotTimeout);
            this.snapshotTimeout = null;
          }
          element._eeCancelEdit = true;
        } catch (_) {}
        this.disableContentEditable();
        try {
          delete element._eeOriginalHTML;
        } catch (_) {}
        return;
      }
    };
    // Debounced history capture on content changes
    const handleInput = () => {
      this.scheduleSnapshot();
    };
    const handleBlur = () => {
      // If this was an auto-inserted placeholder and it now has content, remove the marker
      try {
        const hasText = !!(
          editTarget.textContent && editTarget.textContent.trim().length > 0
        );
        // If this was an auto-inserted placeholder and it now has content, remove the marker
        if (hasText && editTarget) {
          if (
            editTarget.hasAttribute &&
            editTarget.hasAttribute("data-ee-placeholder")
          ) {
            editTarget.removeAttribute("data-ee-placeholder");
          }
          if (editTarget.eePlaceholder) {
            try {
              delete editTarget.eePlaceholder;
            } catch (_) {}
          }
        }
      } catch (_) {}
      // Do not snapshot when canceled (via Escape)
      if (element._eeCancelEdit) {
        try {
          delete element._eeCancelEdit;
        } catch (_) {}
        return;
      }
      this.scheduleSnapshot();
    };

    // Detect when the caret moves inside/outside an <a> element within the edit target
    const updateInlineLinkTargetFromSelection = () => {
      try {
        // Do not change target while toolbar interaction is active
        if (this.inlineLinkContextLocked) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
          this.setInlineLinkEditingTarget(null);
          return;
        }
        const focusNode = sel.focusNode || sel.anchorNode;
        if (!focusNode) {
          this.setInlineLinkEditingTarget(null);
          return;
        }
        // Only react when selection is within the current edit target
        const container = editTarget || element;
        const rootEl =
          focusNode.nodeType === Node.ELEMENT_NODE
            ? focusNode
            : focusNode.parentElement;
        if (!rootEl || !container || !container.contains(rootEl)) {
          this.setInlineLinkEditingTarget(null);
          return;
        }
        let cur = rootEl;
        let found = null;
        // If the edit container is an anchor and selection is inside it, prefer it
        try {
          const ctag = container?.tagName?.toLowerCase?.();
          if (ctag === "a" && container.contains(rootEl)) {
            found = container;
          }
        } catch (_) {}
        // Walk up towards the container/element boundary
        while (cur && cur !== container && cur !== element) {
          if (cur.tagName && cur.tagName.toLowerCase() === "a") {
            found = cur;
            break;
          }
          cur = cur.parentElement;
        }
        this.setInlineLinkEditingTarget(found || null);
      } catch (_) {
        this.setInlineLinkEditingTarget(null);
      }
    };

    // Attach listeners to keep caret context in sync
    element._caretContextListener = updateInlineLinkTargetFromSelection;
    element._selectionChangeListener = updateInlineLinkTargetFromSelection;
    editTarget.addEventListener("mouseup", updateInlineLinkTargetFromSelection);
    editTarget.addEventListener("keyup", updateInlineLinkTargetFromSelection);
    document.addEventListener(
      "selectionchange",
      updateInlineLinkTargetFromSelection
    );

    // If we created/identified a separate edit target, ensure it is also editable and selectable
    if (editTarget && editTarget !== element) {
      try {
        editTarget.setAttribute(
          "contenteditable",
          plainTextOnly ? "plaintext-only" : "true"
        );
      } catch (_) {
        try {
          editTarget.contentEditable = plainTextOnly
            ? "plaintext-only"
            : "true";
        } catch (_) {}
      }
      try {
        if (!editTarget.hasAttribute("tabindex"))
          editTarget.setAttribute("tabindex", "0");
      } catch (_) {}
      if (editTarget._eeOriginalUserSelect === undefined) {
        const cur = editTarget.style?.userSelect || "";
        editTarget._eeOriginalUserSelect = cur;
      }
      try {
        editTarget.style.userSelect = "text";
      } catch (_) {}
      try {
        editTarget.style.webkitUserSelect = "text";
      } catch (_) {}
    }

    // Try to place caret based on last click position (if any)
    let _eePlacedFromPoint = false;
    try {
      _eePlacedFromPoint = !!this._placeCaretFromPendingPoint(
        editTarget || element
      );
    } catch (_) {}

    // Store the listener function on the element for later removal
    element._eeEditTarget = editTarget;
    element._keydownListener = handleKeydown;
    element._inputListener = handleInput;
    element._blurListener = handleBlur;
    // Attach to the actual edit target to ensure focus/blur/input are captured
    editTarget.addEventListener("keydown", handleKeydown);
    editTarget.addEventListener("input", handleInput);
    editTarget.addEventListener("blur", handleBlur);

    // For single-line elements, prevent Enter key but do not force
    // white-space: nowrap; which can break layout widths.

    

    // Place caret when no explicit click point was used
    if (!_eePlacedFromPoint) {
      try {
        // Ensure there is at least one editable text node
        if (editTarget.childNodes && editTarget.childNodes.length === 0) {
          editTarget.appendChild(document.createTextNode(" "));
        }
        const selection = window.getSelection();
        const range = document.createRange();
        let targetNode = null;
        // Prefer the last text node for caret placement
        for (let i = editTarget.childNodes.length - 1; i >= 0; i--) {
          const node = editTarget.childNodes[i];
          if (node.nodeType === Node.TEXT_NODE) {
            targetNode = node;
            break;
          }
        }
        if (targetNode) {
          range.setStart(targetNode, targetNode.textContent.length);
          range.collapse(true);
        } else {
          // Fallback: place at end of element contents
          range.selectNodeContents(editTarget);
          range.collapse(false);
        }
        // Focus the edit target to make caret visible and ready for typing
        try {
          editTarget.focus({ preventScroll: true });
        } catch (_) {
          try {
            editTarget.focus();
          } catch (_) {}
        }
        selection.removeAllRanges();
        selection.addRange(range);
        // Initialize caret-context detection once caret is placed
        try {
          updateInlineLinkTargetFromSelection();
        } catch (_) {}
      } catch (_) {
        // Non-fatal; caret placement may not be possible in some contexts
      }
    }
  }

  /**
   * Disable contenteditable on the editing element
   */
  disableContentEditable() {
    // Delegated to the editor component (DOM logic)
    if (this.editorElement?.disableContentEditable) {
      this.editorElement.disableContentEditable();
      return;
    }

    // Fallback: no-op if editor does not support it
  }

  /**
   * Cancel inline editing via store API: revert content and exit without snapshot
   */
  cancelInlineEditing() {
    if (this.editorElement?.cancelInlineEditing) {
      this.editorElement.cancelInlineEditing();
      return;
    }
  }

  /**
   * Check if the editing element is currently contenteditable
   */
  get isContentEditable() {
    const element = this.editingElement;
    if (!element) return false;
    const attr = element.getAttribute && element.getAttribute("contenteditable");
    if (attr) return attr === "true" || attr === "plaintext-only";
    const state = element.contentEditable;
    return state === "true" || state === "plaintext-only";
  }

  /**
   * Record the last user action. Extensible string type + metadata.
   */
  setLastAction(type, meta = {}, opts = {}) {
    const user = !!(opts && opts.user);
    const entry = { type: String(type || ""), at: Date.now(), meta, user };
    this.lastAction = entry;
    if (user) this.lastUserAction = entry;
    // Append to in-memory debug log (cap at 500 entries)
    this.debugLogs.push(entry);
    if (this.debugLogs.length > 500) this.debugLogs.splice(0, this.debugLogs.length - 500);
    // Forward to centralized debug store with component classification by prefix
    const t = String(type || "");
    const prefix = t.includes(":") ? t.split(":", 1)[0] : "editor";
    // Map prefixes to capture keys
    const map = new Map([
      ["tree", "treeNav"],
      ["topbar", "topBar"],
      ["editor", "editor"],
      ["comment", "comments"],
      ["version", "versions"],
    ]);
    const component = map.get(prefix) || "editor";
    if (this.debugStore && typeof this.debugStore.addTrace === "function") {
      const m = meta && typeof meta === 'object' ? { ...meta, user } : { user };
      this.debugStore.addTrace(component, t, m);
    }
  }

  // Explicit user-triggered last action helper
  setUserAction(type, meta = {}) {
    return this.setLastAction(type, meta, { user: true });
  }

  /**
   * Return a shallow copy of the debug logs for export.
   */
  getDebugLogs() {
    try {
      return this.debugLogs.slice();
    } catch (_) {
      return [];
    }
  }

  /**
   * Record last click viewport coordinates so we can position the caret
   * at that point when entering inline editing.
   */
  setPendingCaretFromClick(x, y) {
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      this._pendingCaretPoint = { x: nx, y: ny, t: Date.now() };
    }
  }

  /**
   * Auto-enable contenteditable if the current element supports inline editing
   */
  autoEnableContentEditableIfSupported() {
    const element = this.editingElement;
    if (!element) return;

    const schema = this.elementSchema;
    if (!schema) return;

    const supportsInlineEditing = this.shouldEnableInlineEditing(schema);
    if (!supportsInlineEditing) return;

    // Only auto-enable when inline editing is the sole available action.
    // If there are other meaningful toolbar actions (attributes, slots, reordering),
    // prefer showing the pen button and let the user opt-in.
    const actions = this.toolbarActions || null;
    const hasOtherOptions = !!(
      actions &&
      ((actions.attributes && actions.attributes.enabled) ||
        (actions.slots && actions.slots.enabled) ||
        (actions.reordering && actions.reordering.enabled))
    );
    if (hasOtherOptions) return;

    this.enableContentEditable();
  }

  /**
   * Determine if multiline editing is supported for the current element
   */
  getMultilineSupport(schema) {
    if (!schema) return true; // Default to multiline if no schema

    // For slot content, check the slot configuration
    if (schema.isSlotContent && schema.slotConfig) {
      return schema.slotConfig.multiline !== false;
    }

    // Check if element has slots that support multiline editing
    if (schema.slots && schema.getSlotConfig) {
      // If current slot is specified, check its config
      if (this.currentSlot) {
        const config = schema.getSlotConfig(this.currentSlot);
        return config?.multiline !== false;
      }

      // Otherwise check if any slots support multiline (default to true)
      const hasMultilineSlots = schema.slots.some((slotName) => {
        const config = schema.getSlotConfig(slotName);
        return config?.multiline !== false;
      });

      return hasMultilineSlots;
    }

    return true; // Default to multiline
  }

  /**
   * Determine if inline editing should be enabled for the current element
   */
  shouldEnableInlineEditing(schema) {
    if (!schema) return false;

    // For slot content, allow inline editing if slot config allows it or formatting is supported
    if (schema.isSlotContent) {
      const cfg = this.#normalizeSlotConfig(
        schema.slotConfig ||
          (schema.slotName && schema.getSlotConfig
            ? schema.getSlotConfig(schema.slotName)
            : {})
      );
      if (cfg?.inlineEditable === true) return true;
      if (schema.supportsTextFormatting === true) return true;
      if (this.#configSupportsFormatting(cfg)) return true;
      return false;
    }

    // If a specific slot is current on the element, respect that slot's config
    if (this.currentSlot && schema.getSlotConfig) {
      const cfg = this.#normalizeSlotConfig(
        schema.getSlotConfig(this.currentSlot) || {}
      );
      if (cfg?.inlineEditable === true) return true;
      if (this.#configSupportsFormatting(cfg)) return true;
      return false;
    }

    // Non-slotted custom element: consider its own default slot config
    if (!schema.isSlotContent && schema.getSlotConfig) {
      const cfg = this.#normalizeSlotConfig(
        schema.getSlotConfig("default") || {}
      );
      if (cfg?.inlineEditable === true) return true;
      if (this.#configSupportsFormatting(cfg)) return true;
    }

    // Otherwise do not auto-enable on container elements
    return false;
  }

  applyThemeColor() {
    try {
      const themeEl = document.querySelector("sp-theme");
      if (themeEl) {
        themeEl.setAttribute(
          "color",
          this.themeColor === "dark" ? "dark" : "light"
        );
      }
    } catch (_) {}
  }

  /**
   * Internal: place caret from a pending viewport point into the given container.
   */
  _placeCaretFromPendingPoint(container) {
    const pt = this._pendingCaretPoint;
    // Always clear the pending point to avoid reusing stale coordinates
    this._pendingCaretPoint = null;
    if (!container || !pt) return false;
    const doc = container.ownerDocument || document;

    const setSelection = (node, offset, fallbackToEnd = true) => {
      try {
        const range = doc.createRange();
        range.setStart(
          node,
          Math.max(0, Math.min(offset, node.length || offset || 0))
        );
        range.collapse(true);
        const sel = doc.getSelection
          ? doc.getSelection()
          : window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        if (container.focus) container.focus();
        return true;
      } catch (_) {
        if (fallbackToEnd) {
          return this._placeCaretAtBoundary(container, /*end*/ true);
        }
        return false;
      }
    };

    // 1) Try native caret position APIs at the viewport point
    try {
      if (doc.caretRangeFromPoint) {
        const r = doc.caretRangeFromPoint(pt.x, pt.y);
        if (r && r.startContainer) {
          const node = r.startContainer;
          const offset = r.startOffset || 0;
          if (container.contains(node) || node === container) {
            return setSelection(node, offset);
          }
        }
      } else if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(pt.x, pt.y);
        if (pos && pos.offsetNode) {
          const node = pos.offsetNode;
          const offset = pos.offset || 0;
          if (container.contains(node) || node === container) {
            return setSelection(node, offset);
          }
        }
      }
    } catch (_) {}

    // 2) Use elementFromPoint to decide start vs end
    try {
      const el = doc.elementFromPoint(pt.x, pt.y);
      if (el && (container.contains(el) || el === container)) {
        const rect =
          (el.getBoundingClientRect && el.getBoundingClientRect()) ||
          container.getBoundingClientRect();
        const preferEnd = rect && pt.x > rect.left + rect.width / 2;
        return this._placeCaretAtBoundary(container, /*end*/ !!preferEnd);
      }
    } catch (_) {}

    // 3) Fallback to end of container
    return this._placeCaretAtBoundary(container, /*end*/ true);
  }

  _placeCaretAtBoundary(container, end = true) {
    const doc = container.ownerDocument || document;
    const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let target = null;
    let offset = 0;
    if (end) {
      // Find last non-empty text node
      let last = null;
      while (walker.nextNode()) {
        last = walker.currentNode;
      }
      if (last) {
        target = last;
        offset = last.textContent ? last.textContent.length : 0;
      }
    } else {
      // First text node
      target = walker.nextNode();
      offset = 0;
    }
    if (!target) {
      // No text nodes; place before/after the first/last child element
      try {
        const range = doc.createRange();
        if (end) {
          if (container.lastChild) range.setStartAfter(container.lastChild);
          else range.setStart(container, 0);
        } else {
          if (container.firstChild) range.setStartBefore(container.firstChild);
          else range.setStart(container, 0);
        }
        range.collapse(true);
        const sel = doc.getSelection
          ? doc.getSelection()
          : window.getSelection();
  // Baseline of sanitized HTML last known-good (on load/save), to avoid false positives
  baselineHtmlNormalized = null;
        sel.removeAllRanges();
        sel.addRange(range);
        if (container.focus) container.focus();
        return true;
      } catch (_) {
        return false;
      }
    }
    try {
      const range = doc.createRange();
      range.setStart(target, offset);
      range.collapse(true);
      const sel = doc.getSelection ? doc.getSelection() : window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      if (container.focus) container.focus();
      return true;
    } catch (_) {
      return false;
    }
  }
}
makeObservable(EditorStore);

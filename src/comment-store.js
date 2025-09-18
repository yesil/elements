import { makeObservable } from "picosm";

export class CommentStore {
  // Attach to EditorStore for element selection, autosave, etc.
  editorStore = null;

  static observableActions = [
    "openCommentsPanel",
    "closeCommentsPanel",
    "toggleCommentsPanel",
    "setComments",
    "addCommentForEditingElement",
    "updateComment",
    "removeComment",
    "setHoveredComment",
    "setSelectedComment",
    "ensureCommentAnchor",
    "regenerateAnchors",
  ];

  static computedProperties = ["canComment"];

  constructor(editorStore) {
    this.editorStore = editorStore || null;
  }

  // State
  comments = [];
  commentsPanelOpen = false;
  hoveredCommentId = null;
  selectedCommentId = null;

  // Whether current selection supports comments.
  // Comments are allowed on any selected element within the editor canvas.
  get canComment() {
    try {
      const el = this.editorStore?.editingElement;
      // Must have an element selected
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
      // Do not allow comments when a slot is selected (slot context)
      if (this.editorStore?.currentSlot) return false;
      // Disallow commenting on the editor host itself; ensure element is within editor subtree
      const host = this.editorStore?.editorElement || null;
      if (!host) return !!el;
      return host.contains(el);
    } catch (_) {
      return false;
    }
  }

  openCommentsPanel() {
    this.commentsPanelOpen = true;
  }
  closeCommentsPanel() {
    this.commentsPanelOpen = false;
  }
  toggleCommentsPanel() {
    this.commentsPanelOpen = !this.commentsPanelOpen;
  }

  setComments(list, options = {}) {
    try {
      const normalize = (c) => {
        if (!c) return null;
        const id = String(c.id || "");
        const targetId = String(c.targetId || "");
        const text = String(c.text || "");
        const status = c.status === "resolved" ? "resolved" : "open";
        const createdAt = c.createdAt ? String(c.createdAt) : new Date().toISOString();
        const updatedAt = c.updatedAt ? String(c.updatedAt) : createdAt;
        const author = c.author ? String(c.author) : null;
        const authorEmail = c.authorEmail ? String(c.authorEmail) : null;
        return { id, targetId, text, status, createdAt, updatedAt, ...(author ? { author } : {}), ...(authorEmail ? { authorEmail } : {}) };
      };
      const arr = Array.isArray(list) ? list.map(normalize).filter(Boolean) : [];
      const prev = Array.isArray(this.comments) ? this.comments : [];
      this.comments = arr;
      // Schedule autosave on meaningful comment changes unless explicitly silenced
      if (!options.silent) {
        const changed = (() => {
          if (prev.length !== arr.length) return true;
          // Shallow compare by stable keys; order changes count as a change
          for (let i = 0; i < arr.length; i++) {
            const a = arr[i];
            const b = prev[i];
            if (!b) return true;
            if (
              a.id !== b.id ||
              a.targetId !== b.targetId ||
              a.text !== b.text ||
              a.status !== b.status ||
              a.author !== b.author ||
              a.authorEmail !== b.authorEmail
            ) return true;
          }
          return false;
        })();
        if (changed) this.editorStore?.scheduleAutoSave?.();
      }
    } catch (_) {
      this.comments = [];
    }
  }

  // Ensure the element has an anchor and return it
  ensureCommentAnchor(element) {
    if (!element || !element.setAttribute) return null;
    let id = element.getAttribute("data-ee-comment-id");
    if (!id) {
      const gen = () => {
        try { return crypto.randomUUID(); } catch (_) {}
        return `cmt-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      };
      id = gen();
      element.setAttribute("data-ee-comment-id", id);
      this.editorStore?.scheduleAutoSave?.();
    }
    return id;
  }

  addCommentForEditingElement(text) {
    const el = this.editorStore?.editingElement;
    const message = (text || "").toString().trim();
    if (!el || !message) return;
    // Evaluate permission directly to avoid relying on cross-store computed state
    const slotSelected = !!this.editorStore?.currentSlot;
    const host = this.editorStore?.editorElement || null;
    const allowed = !!el && !slotSelected && (!!host ? host.contains(el) : true);
    if (!allowed) return;
    const targetId = this.ensureCommentAnchor(el);
    if (!targetId) return;
    const id = (() => { try { return crypto.randomUUID(); } catch (_) { return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; } })();
    const now = new Date().toISOString();
    // Derive author from editor's userStore if available
    let author = null;
    let authorEmail = null;
    try {
      const host = this.editorStore?.editorElement;
      const usr = host?.userStore?.currentUser || null;
      author = usr?.displayName || usr?.email || null;
      authorEmail = usr?.email || null;
    } catch (_) {}
    const comment = { id, targetId, text: message, status: "open", createdAt: now, updatedAt: now, ...(author ? { author } : {}), ...(authorEmail ? { authorEmail } : {}) };
    this.comments = [...this.comments, comment];
    this.selectedCommentId = id;
    this.openCommentsPanel();
    this.editorStore?.scheduleAutoSave?.();
  }

  updateComment(id, patch) {
    if (!id) return;
    const idx = this.comments.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const prev = this.comments[idx];
    const next = {
      ...prev,
      ...(patch || {}),
      status: (patch && patch.status === "resolved") ? "resolved" : (patch && patch.status === "open") ? "open" : prev.status,
      text: (patch && typeof patch.text === "string") ? patch.text : prev.text,
      updatedAt: new Date().toISOString(),
    };
    const copy = this.comments.slice();
    copy[idx] = next;
    this.comments = copy;
    this.editorStore?.scheduleAutoSave?.();
  }

  removeComment(id) {
    if (!id) return;
    this.comments = this.comments.filter((c) => c.id !== id);
    if (this.hoveredCommentId === id) this.hoveredCommentId = null;
    if (this.selectedCommentId === id) this.selectedCommentId = null;
    this.editorStore?.scheduleAutoSave?.();
  }

  setHoveredComment(id) {
    this.hoveredCommentId = id || null;
  }
  setSelectedComment(id) {
    this.selectedCommentId = id || null;
  }

  // Regenerate anchors in a cloned subtree
  regenerateAnchors(node) {
    try {
      const walk = (n) => {
        if (!n || n.nodeType !== Node.ELEMENT_NODE) return;
        if (n.hasAttribute && n.hasAttribute("data-ee-comment-id")) {
          const newId = (() => { try { return crypto.randomUUID(); } catch (_) { return `cmt-${Math.random().toString(36).slice(2, 10)}`; } })();
          n.setAttribute("data-ee-comment-id", newId);
        }
        Array.from(n.children || []).forEach(walk);
      };
      walk(node);
    } catch (_) {}
  }
}

makeObservable(CommentStore);

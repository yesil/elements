import { makeObservable } from "picosm";
import { DocumentStore } from "./document-store.js";
import { EditorStore } from "./editor-store.js";
import { TemplateStore } from "./template-store.js";
import { CommentStore } from "./comment-store.js";
import { VersionStore } from "./version-store.js";
import { UserStore } from "./user-store.js";
import { DebugStore } from "./debug-store.js";
import { UsedInStore } from "./used-in-store.js";

// Gallery View Enumerations
export const GalleryViews = {
  ALL: "all",
  RECENT: "recent",
  MY_FILES: "files",
  SHARED: "shared",
  TEMPLATES: "templates",
};

export class Store {
  static observableActions = [
    "openElement",
    "closeElement",
    "deleteElement",
    "setGalleryView",
    "setSearchQuery",
    "setShowCreationDialog",
    "setCreationDialogCategory",
    "setCurrentElement",
    "setIsReady",
    "updateElementName",
    "setThemeColor",
    // Navigation state
    "setIsNavigating",
    // Saved elements list
    "setSavedElements",
    // Folder navigation
    "setCurrentFolder",
    "enterFolder",
    "goUpOne",
    "navigateToCrumb",
    // Selection mode in Home
    "setSelectionMode",
    "toggleSelect",
    "clearSelection",
    "selectAllVisible",
  ];
  static computedProperties = ["isEditingElement", "filteredElements"];

  documentStore = new DocumentStore();
  editorStore = new EditorStore();
  commentStore = new CommentStore();
  versionStore = new VersionStore();
  usedInStore = new UsedInStore();
  templateStore = new TemplateStore();
  userStore = new UserStore();
  debugStore = new DebugStore();
  savedElements = [];
  // Selection state for bulk actions in Home
  selectionMode = false;
  selectedUrns = new Set();

  currentElement = null;
  // currentElementId now lives in EditorStore

  // Gallery view state
  galleryView = GalleryViews.ALL;
  searchQuery = "";
  // Folder navigation state (Home only)
  currentFolderUrn = null; // null = root
  folderCrumbs = []; // [{ urn, name }]

  // Creation dialog state
  showCreationDialog = false;
  creationDialogCategory = "templates";
  themeColor = localStorage.getItem("theme") || "dark";

  // Ready state
  isReady = false;
  // Navigation state
  isNavigating = false;
  

  async init() {
    // Initialize all stores with proper interconnections
    
    // Bridge store so DocumentStore can reflect saving state back
    this.documentStore.appStore = this;
    await this.documentStore.init();
    
    // Connect EditorStore to other stores
    this.editorStore.documentStore = this.documentStore;
    // Provide debug tracing to editor store
    this.editorStore.debugStore = this.debugStore;
    
    // Connect CommentStore to EditorStore for autosave functionality
    this.commentStore.editorStore = this.editorStore;
    // Wire Versions to Editor and Document stores; coordinate with comments
    this.versionStore.editorStore = this.editorStore;
    this.versionStore.documentStore = this.documentStore;
    this.versionStore.commentStore = this.commentStore;
    // "Used In" panel wiring
    this.usedInStore.editorStore = this.editorStore;
    this.usedInStore.documentStore = this.documentStore;
    this.usedInStore.commentStore = this.commentStore;
    this.usedInStore.versionStore = this.versionStore;
    // Version/Comment stores may also reference debug via editorStore if they emit actions

    // Give DocumentStore access to CommentStore for comment collection
    this.documentStore.commentStore = this.commentStore;
    
    // Ensure user store is initialized so Home can render immediately
    try { this.userStore.ensureInitialized?.(); } catch (_) {}

    // Initialize TemplateStore
    await this.templateStore.init();

    // Mark store as ready
    this.setIsReady(true);

    // On sign-in, persist user profile (email/name) to the API once
    // This is best-effort and non-blocking
    this.#updateUserOnSignIn().catch(() => {});

    // Optional: enable DebugStore capture flags via URL param `debug`
    const params = new URLSearchParams(window.location.search);
    const dbg = params.get('debug');
    if (dbg) {
      const keys = dbg.split(',').map((s) => s.trim()).filter(Boolean);
      if (keys.includes('all')) {
        for (const k of Object.keys(this.debugStore.capture || {})) this.debugStore.setCaptureFor(k, true);
      } else {
        for (const k of keys) this.debugStore.setCaptureFor(k, true);
      }
    }
  }

  async #updateUserOnSignIn() {
    // Ensure API endpoint and token are available
    await this.documentStore.init?.();
    const apiBase = this.documentStore.apiBaseUrl || (await this.documentStore.loadApiEndpoint());
    const token = await this.documentStore.getAccessToken();
    const email = this.userStore?.currentUser?.email || '';
    const name = this.userStore?.currentUser?.displayName || '';
    if (!apiBase || !token || !email) return; // require email and token

    // Session-scoped cache: ensure we POST /users/me only once per session
    // Keyed by API base + email to avoid cross‑environment collisions
    let cacheKey = '';
    try {
      cacheKey = `ee:usersMe:${apiBase}:${email}`;
      const done = sessionStorage.getItem(cacheKey);
      if (false && done) return;
    } catch (_) {}
    try {
      await fetch(`${apiBase}/users/me`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email, name }),
      });
      try { if (cacheKey) sessionStorage.setItem(cacheKey, '1'); } catch (_) {}
    } catch (_) {}
  }

  get isEditingElement() {
    return this.currentElement !== null;
  }

  async openElement(elementId) {
    const elementConfig = await this.documentStore.getDocument(elementId);
    if (elementConfig) {
      this.setCurrentElement(elementConfig);
      // Track active document id in EditorStore
      this.editorStore.setCurrentElementId(elementId);
      // Require `.html` only
      const html = elementConfig.html ?? null;
      return html ? this.documentStore.deserializeElement(html) : null;
    }
    return null;
  }

  async closeElement() {
    // Switch UI back to gallery immediately
    this.setCurrentElement(null);
    this.editorStore.setCurrentElementId(null);
    // Do not trigger save here; the editor calls performAutoSave() before closing
  }

  async updateElementName(newName) {
    if (!this.currentElement || !this.editorStore?.currentElementId) return;
    this.currentElement.name = newName;
    await this.documentStore.updateDocumentName(
      this.editorStore.currentElementId,
      newName,
      this.currentElement.html
    );
    // Gallery will refresh via reaction when DocumentStore.isSaving transitions true -> false
  }

  async deleteElement(elementId) {
    await this.documentStore.deleteDocument(elementId);

    if (this.editorStore?.currentElementId === elementId) {
      this.setCurrentElement(null);
      this.editorStore.setCurrentElementId(null);
    }
  }

  // Folder navigation actions
  setCurrentFolder(urn, name = null) {
    // Normalize URN (null for root)
    const normalized = urn || null;
    this.currentFolderUrn = normalized;
    // Leaving/entering a folder cancels any bulk selection state
    this.setSelectionMode(false);
    this.clearSelection();
    if (normalized === null) {
      this.folderCrumbs = [];
      return;
    }
    // Maintain simple breadcrumb trail; dedupe consecutive same URN
    const crumbs = Array.isArray(this.folderCrumbs) ? [...this.folderCrumbs] : [];
    const last = crumbs[crumbs.length - 1];
    if (!last || last.urn !== normalized) {
      crumbs.push({ urn: normalized, name: name || 'Folder' });
    }
    this.folderCrumbs = crumbs;
  }

  enterFolder(doc) {
    if (!doc || !doc.urn) return;
    this.setCurrentFolder(doc.urn, doc.name || 'Folder');
    // Preserve current gallery view (supports Shared view folder navigation)
    this.setGalleryView(this.galleryView);
  }

  goUpOne() {
    if (!this.folderCrumbs.length) {
      this.setCurrentFolder(null);
      return;
    }
    const crumbs = [...this.folderCrumbs];
    crumbs.pop();
    this.folderCrumbs = crumbs;
    const parent = crumbs[crumbs.length - 1] || null;
    this.currentFolderUrn = parent ? parent.urn : null;
  }

  navigateToCrumb(index) {
    const crumbs = Array.isArray(this.folderCrumbs) ? [...this.folderCrumbs] : [];
    if (index < 0 || index >= crumbs.length) {
      this.setCurrentFolder(null);
      return;
    }
    const next = crumbs.slice(0, index + 1);
    this.folderCrumbs = next;
    const current = next[next.length - 1] || null;
    this.currentFolderUrn = current ? current.urn : null;
  }

  // Gallery view actions
  setGalleryView(view) {
    this.galleryView = view;
    // Changing gallery view cancels any bulk selection state
    this.setSelectionMode(false);
    this.clearSelection();
  }

  setSearchQuery(query) {
    this.searchQuery = query;
    // Maintain selection for items still visible under the new filter
    try {
      const visible = new Set((this.filteredElements || []).map((d) => d.urn));
      const next = new Set();
      for (const u of this.selectedUrns || []) if (visible.has(u)) next.add(u);
      this.selectedUrns = next;
      if (!next.size) this.setSelectionMode(false);
    } catch (_) {}
  }

  // setCurrentElementId moved to EditorStore

  setShowCreationDialog(show) {
    this.showCreationDialog = show;
  }

  setCreationDialogCategory(category) {
    this.creationDialogCategory = category;
  }

  setCurrentElement(element) {
    this.currentElement = element;
  }

  setIsReady(ready) {
    this.isReady = ready;
  }

  // Navigation indicator actions
  setIsNavigating(value) {
    this.isNavigating = !!value;
  }

  // Elements loading indicator actions
  setSavedElements(list) {
    this.savedElements = Array.isArray(list) ? list : [];
    // Maintain selection intersection with current list
    const keep = new Set((this.savedElements || []).map((d) => d.urn));
    const next = new Set();
    for (const u of this.selectedUrns || []) if (keep.has(u)) next.add(u);
    this.selectedUrns = next;
    if (!next.size) this.setSelectionMode(false);
  }

  

  // Computed properties
  get filteredElements() {
    // Ensure savedElements is always an array
    let elements = this.savedElements || [];

    // Hide folders in All and Recent views
    if (this.galleryView === GalleryViews.ALL || this.galleryView === GalleryViews.RECENT) {
      elements = elements.filter((el) => !el.isFolder);
    }

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      const getRootTag = (doc) => {
        const root = doc?.html;
        if (!root) return "";
        if (typeof root === "string") {
          const m = root.match(/<\s*([a-zA-Z0-9-]+)/);
          return m && m[1] ? m[1].toLowerCase() : "";
        }
        return root.tagName ? String(root.tagName).toLowerCase() : "";
      };
      elements = elements.filter((el) => {
        const byName = el.name?.toLowerCase?.().includes(query);
        const byTag = getRootTag(el).includes(query);
        return byName || byTag;
      });
    }

    // Filter by category/view
    if (this.galleryView === GalleryViews.RECENT) {
      // Get elements modified in the last 7 days, sorted by most recent
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      return elements
        .filter((el) => new Date(el.lastModified) > sevenDaysAgo)
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
        .slice(0, 8); // Limit to 8 most recent
    } else if (this.galleryView === GalleryViews.TEMPLATES) {
      // Return template elements only
      return elements.filter((el) => el.isTemplate);
    } else if (this.galleryView === GalleryViews.MY_FILES) {
      // In My Files, always return the scoped folder contents (both folders and documents).
      // Grouping and visual ordering (folders first) are handled in the view layer.
      return elements;
    } else if (this.galleryView === GalleryViews.SHARED) {
      // In Shared view, list both folders and documents shared to the user
      return elements;
    }

    return elements;
  }

  setThemeColor(color) {
    this.themeColor = color;
    localStorage.setItem("theme", color);
  }

  // Selection helpers
  setSelectionMode(on) {
    this.selectionMode = !!on;
    if (!this.selectionMode) this.selectedUrns = new Set();
  }
  toggleSelect(urn) {
    if (!urn) return;
    const next = new Set(this.selectedUrns || []);
    if (next.has(urn)) next.delete(urn);
    else next.add(urn);
    this.selectedUrns = next;
  }
  clearSelection() {
    this.selectedUrns = new Set();
  }
  selectAllVisible() {
    const all = new Set((this.filteredElements || []).map((d) => d.urn));
    this.selectedUrns = all;
  }
}

makeObservable(Store);

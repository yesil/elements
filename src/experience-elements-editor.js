import { html, LitElement, nothing } from 'lit';
import { makeLitObserver, reaction } from 'picosm';
import { Store } from './store.js';
import './components/ee-toolbar.js';
import { experienceElementsEditorStyles } from './experience-elements-editor.css.js';

// Import required Spectrum components

// Removed sp-split-view; using custom layout

// Custom animated tree nav replaces sp-sidenav
import './components/ee-tree-nav.js';

// Import required Spectrum icons

import { sanitizeTree } from './utils/sanitize.js';
import './components/ee-comments-panel.js';
import './components/ee-versions-panel.js';
import './components/ee-used-in-panel.js';
import attachZoomPan from './zoom.js';
import { EditorStore } from './editor-store.js';

// Breadcrumbs removed in favor of left sidebar

class ExperienceElementsEditor extends LitElement {
  // Private debug click trace
  #lastClickInfo = null;

  #zoomController = null;

  #lastOutlinedSlotEl = null;

  static get styles() {
    return experienceElementsEditorStyles;
  }

  // Zoom controls
  get zoomPercentage() {
    const z = this.zoomStore?.z || 1;
    return Math.round(z * 100);
  }

  zoomInSmooth() {
    const store = this.zoomStore;
    if (!store) return;
    const container = this.shadowRoot?.querySelector('#canvas-container');
    const rect = container?.getBoundingClientRect();
    const anchor = rect
      ? {
        x: rect.width / 2 + container.scrollLeft,
        y: rect.height / 2 + container.scrollTop,
      }
      : undefined;
    store.zoomIn(undefined, anchor);
  }

  zoomOutSmooth() {
    const store = this.zoomStore;
    if (!store) return;
    const container = this.shadowRoot?.querySelector('#canvas-container');
    const rect = container?.getBoundingClientRect();
    const anchor = rect
      ? {
        x: rect.width / 2 + container.scrollLeft,
        y: rect.height / 2 + container.scrollTop,
      }
      : undefined;
    store.zoomOut(undefined, anchor);
  }

  resetZoomSmooth() {
    const store = this.zoomStore;
    if (!store) return;
    store.reset();
  }

  static get properties() {
    return {
      store: { type: Store, observe: true },
      editorStore: { type: EditorStore, observe: true },
      commentStore: { type: Object, observe: true },
      versionStore: { type: Object, observe: true },
      usedInStore: { type: Object, observe: true },
      zoomStore: { type: Object, state: true, observe: true },
      sidebarSearchQuery: { type: String, state: true },
      confirmDeleteOpen: { type: Boolean, state: true },
      confirmUnpublishOpen: { type: Boolean, state: true },
      confirmLeaveOpen: { type: Boolean, state: true },
      renameDialogOpen: { type: Boolean, state: true },
      renameValue: { type: String, state: true },
      unpublishRefs: { type: Array, state: true },
      isLoadingUnpublishRefs: { type: Boolean, state: true },
      open: { type: Boolean, reflect: true },
    };
  }

  constructor() {
    super();
    this.initEditorStore();
    this.sidebarSearchQuery = '';
    // Sidebar element key mapping
    this._elKeyMap = new WeakMap();
    this._elKeySeq = 1;
    this.confirmDeleteOpen = false;
    this.confirmUnpublishOpen = false;
    this.confirmLeaveOpen = false;
    this.renameDialogOpen = false;
    this.renameValue = '';
    this.unpublishRefs = [];
    this.isLoadingUnpublishRefs = false;
    this.open = false;
    // Capture custom 'fire' events from content (e.g., ee-reference triggers)
    // Prevent them from triggering while in the editor.
    this.addEventListener(
      'fire',
      (e) => {
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );
  }

  // Friendly date formatter for status indicators
  formatFriendlyTime(dateInput) {
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return '';
      const now = Date.now();
      const diff = now - date.getTime();
      if (diff < 60_000) return 'just now';
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
      if (diff < 172_800_000) return 'yesterday';
      if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} days ago`;
      return date.toLocaleDateString();
    } catch (_) { return ''; }
  }

  // Sidebar toggling is managed by EditorStore; no local wrappers needed

  // Resizing removed: sidebar has a fixed width when open

  // Lightweight debug logger
  dlog() {}

  async connectedCallback() {
    super.connectedCallback();

    // Add click listener with capture to intercept early
    this._onClickCapture = (e) => this.handleElementClick(e);
    this.addEventListener('click', this._onClickCapture, true);
    // Also capture clicks on the surface wrapper inside shadow DOM to be extra robust
    try {
      const sr = this.shadowRoot;
      const surface = sr?.getElementById?.('surface-wrapper');
      if (surface && !this._onSurfaceClickCapture) {
        this._onSurfaceClickCapture = (e) => this.handleElementClick(e);
        surface.addEventListener('click', this._onSurfaceClickCapture, true);
      }
      const content = sr?.getElementById?.('surface-content');
      if (content && !this._onContentClickCapture) {
        this._onContentClickCapture = (e) => this.handleElementClick(e);
        content.addEventListener('click', this._onContentClickCapture, true);
      }
    } catch (_) {}
    // Track double-clicks distinctly for lastAction
    this.addEventListener(
      'dblclick',
      (e) => this.editorStore?.setUserAction?.('editor:dblclick', {
        x: e.clientX,
        y: e.clientY,
      }),
      true,
    );

    // Warn on browser refresh/close when there are unsaved changes
    this._onBeforeUnload = (e) => {
      try {
        const dirty = this.store?.editorStore?.hasUnsavedChanges?.();
        if (dirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      } catch (_) {}
    };
    window.addEventListener('beforeunload', this._onBeforeUnload);

    // Initial content mount from current store state (route may already be set)
    this.#loadCurrentStoreElement();
    try { this.editorStore?.setBaselineFromCurrent?.(); } catch (_) {}

    // Reactions are initialized globally by the App and access the editor lazily.

    // Expose a global helper for quick debugging
    if (!window.dumpEEState) {
      window.dumpEEState = (opts = {}) => {
        const editor = document.querySelector('experience-elements-editor') || this;
        return editor && editor.dumpState(opts);
      };
    }

    // Zoom/Pan is initialized in updated() after render.

    // Setup toolbar position sync on selection/slot changes
    this._setupToolbarSync();
    // Setup selection outline sync
    this._setupSelectionOutlineSync();

    // Attach viewport listeners for toolbar repositioning
    this._onViewportChange = () => {
      if (this.editorStore?.isEEToolbarVisible) this._updateToolbarPosition();
    };
    window.addEventListener('resize', this._onViewportChange);
    window.addEventListener('orientationchange', this._onViewportChange);
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    // Ensure editorStore can access the app store when it becomes available
    if (changedProperties.has('store') && this.store && this.editorStore) {
      try {
        // Always use the app's EditorStore instance to avoid desync
        if (this.store?.editorStore) {
          this.editorStore = this.store.editorStore;
          this.editorStore.setEditorElement(this);
        }
        this.editorStore.store = this.store;
      } catch (_) {}
      try { this.commentStore = this.store?.commentStore; } catch (_) {}
      try { this.versionStore = this.store?.versionStore; } catch (_) {}
      try { this.usedInStore = this.store?.usedInStore; } catch (_) {}
      try {
        if (this.commentStore) this.commentStore.editorStore = this.editorStore;
      } catch (_) {}
      try {
        if (this.versionStore) {
          this.versionStore.editorStore = this.editorStore;
          this.versionStore.documentStore = this.store?.documentStore;
          this.versionStore.commentStore = this.commentStore;
        }
      } catch (_) {}
    }

    // Initialize sidebar behavior and zoom order deterministically
    // 1) Zoom/Pan controller
    this._initZoomPan();
    // 2) Wheel guards (they use stopPropagation only; do not block zoom)
    this._attachSidebarWheelGuard();
    this._attachCanvasWheelGuard();
    // 3) Rest of UI wiring
    this._initSidebarExpansion();
    this._setupToolbarSync();
    this._setupSelectionOutlineSync();
  }

  // Generate a stable key for an element for sidebar mapping
  getElementKey(el) {
    if (!el || typeof el !== 'object') return null;
    let key = this._elKeyMap.get(el);
    if (!key) {
      key = this._elKeySeq++;
      this._elKeyMap.set(el, key);
    }
    return key;
  }

  setupSelectionSync() {
    if (!this.editorStore) return;
    if (this.cleanupSelectionReaction) return; // already set
    this.cleanupSelectionReaction = reaction(
      this.editorStore,
      (s) => [s.editingElement, s.currentSlot],
      () => {
        this.scrollSideNavToSelection();
      },
    );
  }

  async scrollSideNavToSelection() {
    await this.updateComplete;
    const host = this.shadowRoot;
    if (!host) return;
    const nav = host.querySelector('ee-tree-nav');
    nav?.scrollSelectionIntoView?.();
  }

  // Public API for centralized reactions to mount/update content
  loadEditorContent() {
    this.#loadCurrentStoreElement();
  }

  #loadCurrentStoreElement() {
    const ce = this.store?.currentElement;
    if (!ce) return;
    // Require `.html` only
    const { html } = ce;
    if (!html) return;

    const element = this.store.documentStore.deserializeElement(html);
    if (!element) return;

    // Clear any existing selection/toolbar state before swapping content
    this.editorStore?.clearSelection?.();

    // Also clear comment hover/selection to avoid orphaned outlines
    this.commentStore?.setHoveredComment?.(null);
    this.commentStore?.setSelectedComment?.(null);

    // Clear any existing elements first
    Array.from(this.children).forEach((el) => el.remove());
    // Add the new element
    this.appendChild(element);
    try { this.editorStore?.setBaselineFromCurrent?.(); } catch (_) {}

    // Expose current document id to authoring elements (loop prevention, etc.)
    const id = this.store?.editorStore?.currentElementId;
    if (id) this.setAttribute('data-ee-current-id', id);
    else this.removeAttribute('data-ee-current-id');

    // Capture initial state and load comments
    if (this.editorStore) {
      setTimeout(() => this.editorStore.captureSnapshot(), 100);
      const comments = this.store?.currentElement?.comments || [];
      // Initialize from document without triggering autosave
      this.commentStore?.setComments(Array.isArray(comments) ? comments : [], { silent: true });
    }
  }

  // No normalization of ee-reference triggers; preserve as-authored

  hasChildElements() {
    // Check if we already have elements in the canvas
    return Array.from(this.children).some((child) => child.tagName.includes('-'));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.cleanupSelectionReaction) this.cleanupSelectionReaction();
    this.cleanupSelectionReaction = null;
    if (this.cleanupCommentsReaction) this.cleanupCommentsReaction();
    this.cleanupCommentsReaction = null;
    if (this.cleanupCommentsReaction2) this.cleanupCommentsReaction2();
    this.cleanupCommentsReaction2 = null;
    window.removeEventListener('resize', this.updateCommentsOverlay);
    try { if (this._onBeforeUnload) window.removeEventListener('beforeunload', this._onBeforeUnload); } catch (_) {}
    this._onBeforeUnload = null;
    const container = this.shadowRoot?.querySelector('#canvas-container');
    if (container) container.removeEventListener('scroll', this.updateCommentsOverlay);
    try {
      this.#zoomController?.destroy?.();
    } catch (_) {}
    this.#zoomController = null;

    // Cleanup toolbar/selection sync
    if (this._cleanupToolbarReaction) this._cleanupToolbarReaction();
    this._cleanupToolbarReaction = null;
    if (this._cleanupSelectionReaction) { this._cleanupSelectionReaction(); this._cleanupSelectionReaction = null; }
    if (this._cleanupZoomReaction) {
      this._cleanupZoomReaction();
      this._cleanupZoomReaction = null;
    }
    if (this._onViewportChange) {
      window.removeEventListener('resize', this._onViewportChange);
      window.removeEventListener('orientationchange', this._onViewportChange);
      this._onViewportChange = null;
    }
    // Remove click capture listeners
    try { if (this._onClickCapture) this.removeEventListener('click', this._onClickCapture, true); } catch (_) {}
    try {
      const surface = this.shadowRoot?.getElementById?.('surface-wrapper');
      if (surface && this._onSurfaceClickCapture) surface.removeEventListener('click', this._onSurfaceClickCapture, true);
      const content = this.shadowRoot?.getElementById?.('surface-content');
      if (content && this._onContentClickCapture) content.removeEventListener('click', this._onContentClickCapture, true);
    } catch (_) {}
    this._onClickCapture = null;
    this._onSurfaceClickCapture = null;
    this._onContentClickCapture = null;
  }

  render() {
    // Render nothing until the app is initialized or the editor is active
    if (!this.open) return nothing;

    const loadingSurface = !!this.store?.editorStore?.currentElementId && !this.firstElementChild;

    // While the document is loading, show only a centered spinner
    if (loadingSurface) {
      return html`
        <sp-progress-circle class="loading-spinner" indeterminate size="l"></sp-progress-circle>
      `;
    }

    // Editor view - canvas behind, elements in front
    return html`
      <div id="editor-toolbar">
        <div id="toolbar-left">
          <sp-action-button
            id="toggle-content-tree"
            quiet
            size="m"
            toggles
            ?selected=${this.editorStore?.sidebarOpen}
            @click=${() => this.editorStore?.setSidebarOpen?.(
    !this.editorStore?.sidebarOpen,
  )}
            title=${this.editorStore?.sidebarOpen
    ? 'Hide Content Tree'
    : 'Show Content Tree'}
          >
            <sp-icon-view-list slot="icon"></sp-icon-view-list>
            Content Tree
          </sp-action-button>
        </div>

        <div id="toolbar-center">
          <sp-action-button id="back-to-gallery" quiet size="m" title="Back to Gallery" @click=${() => this.onBackToGalleryClick()}>
            <sp-icon-home slot="icon"></sp-icon-home>
          </sp-action-button>
          <div id="name-actions">
            <sp-action-button
              id="open-preview"
              quiet
              size="m"
              title="Preview"
              ?disabled=${!this.store?.editorStore?.currentElementId}
              @click=${() => this.openPreview()}
            >
              <sp-icon-preview slot="icon"></sp-icon-preview>
            </sp-action-button>
            <span id="fragment-name" title="Click to rename" @click=${() => this.openRenameDialog()}>
              ${this.store.currentElement?.name || 'Untitled Fragment'}
            </span>
          </div>

          <sp-action-button
            id="undo"
            quiet
            size="m"
            ?disabled=${!this.editorStore?.canUndo}
            @click=${() => this.performUndo()}
            title="Undo (Cmd/Ctrl + Z)"
          >
            <sp-icon-undo slot="icon"></sp-icon-undo>
          </sp-action-button>

          <sp-action-button
            id="redo"
            quiet
            size="m"
            ?disabled=${!this.editorStore?.canRedo}
            @click=${() => this.performRedo()}
            title="Redo (Cmd/Ctrl + Shift + Z)"
          >
            <sp-icon-redo slot="icon"></sp-icon-redo>
          </sp-action-button>

          <!-- Zoom controls moved next to Undo/Redo -->
          <sp-action-group>
            <overlay-trigger placement="bottom" type="hover">
              <sp-action-button slot="trigger" id="zoom-out" quiet size="m"
                ?disabled=${!this.zoomStore?.canZoomOut}
                @click=${() => this.zoomOutSmooth()}
              >
                <sp-icon-zoom-out slot="icon"></sp-icon-zoom-out>
                Zoom out
              </sp-action-button>
              <sp-tooltip slot="tooltip">Zoom Out (Cmd/Ctrl + -)</sp-tooltip>
            </overlay-trigger>

            <overlay-trigger placement="bottom" type="hover">
              <sp-action-button slot="trigger" quiet id="reset-zoom" size="m"
                @click=${() => this.resetZoomSmooth()}
              >
                ${this.zoomPercentage}%
              </sp-action-button>
              <sp-tooltip slot="tooltip">Reset Zoom (Cmd/Ctrl + 0)</sp-tooltip>
            </overlay-trigger>

            <overlay-trigger placement="bottom" type="hover">
              <sp-action-button slot="trigger" id="zoom-in" quiet size="m"
                ?disabled=${!this.zoomStore?.canZoomIn}
                @click=${() => this.zoomInSmooth()}
              >
                <sp-icon-zoom-in slot="icon"></sp-icon-zoom-in>
                Zoom in
              </sp-action-button>
              <sp-tooltip slot="tooltip">Zoom In (Cmd/Ctrl + +)</sp-tooltip>
            </overlay-trigger>
          </sp-action-group>
        </div>

        <div id="toolbar-right">
          <sp-status-light id="save-indicator" variant="positive" size="m" style=${this.editorStore?.saveIndicatorVisible ? '' : 'visibility: hidden;'}>Saved</sp-status-light>

          <!-- Collaboration: Comments | Versions | References -->
          <sp-action-group compact>
            <overlay-trigger placement="bottom" type="hover">
              <sp-action-button slot="trigger" id="open-comments" quiet size="m"
                @click=${() => {
    const willOpen = !this.commentStore?.commentsPanelOpen;
    this.editorStore?.setUserAction?.('topbar:commentsToggle', { open: willOpen });
    this.commentStore?.toggleCommentsPanel?.();
    if (willOpen) this.versionStore?.closeVersionsPanel?.();
    if (willOpen) this.store?.usedInStore?.closeUsedInPanel?.();
  }}
              >
                <sp-icon-comment slot="icon"></sp-icon-comment>
                ${Array.isArray(this.commentStore?.comments)
    ? `Comments (${this.commentStore.comments.length})`
    : 'Comments'}
              </sp-action-button>
              <sp-tooltip slot="tooltip">Comments</sp-tooltip>
            </overlay-trigger>

            <overlay-trigger placement="bottom" type="hover">
              <sp-action-button slot="trigger" id="open-versions" quiet size="m"
                @click=${() => {
    const willOpen = !this.versionStore?.versionsPanelOpen;
    this.editorStore?.setUserAction?.('topbar:versionsToggle', { open: willOpen });
    this.versionStore?.toggleVersionsPanel?.();
    if (willOpen) this.store?.usedInStore?.closeUsedInPanel?.();
  }}
              >
                <sp-icon-history slot="icon"></sp-icon-history>
                ${Array.isArray(this.versionStore?.versions)
    ? `Versions (${this.versionStore.versions.length})`
    : 'Versions'}
              </sp-action-button>
              <sp-tooltip slot="tooltip">Version history</sp-tooltip>
            </overlay-trigger>

            <overlay-trigger placement="bottom" type="hover">
              <sp-action-button slot="trigger" id="open-used-in" quiet size="m"
                @click=${() => {
    const willOpen = !this.store?.usedInStore?.panelOpen;
    this.editorStore?.setUserAction?.('topbar:usedInToggle', { open: willOpen });
    this.store?.usedInStore?.toggleUsedInPanel?.();
  }}
              >
                <sp-icon-target slot="icon"></sp-icon-target>
                ${Array.isArray(this.store?.usedInStore?.items)
    ? `Used In (${this.store.usedInStore.items.length})`
    : 'Used In'}
              </sp-action-button>
              <sp-tooltip slot="tooltip">Where this fragment is used</sp-tooltip>
            </overlay-trigger>
          </sp-action-group>

          <!-- Use (copy reference snippet) -->
          <sp-action-menu
            id="copy-menu"
            quiet
            size="m"
            selects="single"
            ?disabled=${!this.store?.editorStore?.currentElementId}
            @change=${(e) => this.onCopyReferenceMenu(e)}
          >
            <sp-icon-review-link slot="icon"></sp-icon-review-link>
            <span slot="label">Use</span>
            <sp-menu-item value="inline">As Inline Content</sp-menu-item>
            <sp-menu-item value="button">As Spectrum Button</sp-menu-item>
            <sp-menu-item value="spectrum-link">As Spectrum Link</sp-menu-item>
            <sp-menu-item value="a">As Regular Link (a)</sp-menu-item>
          </sp-action-menu>

          <!-- Publish / Unpublish primary actions + options -->
          <overlay-trigger placement="bottom" type="hover">
            <sp-button id="publish" slot="trigger" variant="primary" size="m"
              ?disabled=${!this.store?.editorStore?.currentElementId}
              @click=${() => this.publishCurrent()}
            >
              <sp-icon-publish slot="icon" style=${this.publishIconStyle}></sp-icon-publish>
              Publish
            </sp-button>
            <sp-tooltip slot="tooltip">Publish current document</sp-tooltip>
          </overlay-trigger>

          <overlay-trigger placement="bottom" type="hover">
            <sp-button id="unpublish" slot="trigger" variant="secondary" size="m"
              ?disabled=${!this.store?.editorStore?.currentElementId}
              @click=${() => this.openUnpublishDialog()}
            >
              <sp-icon-revert slot="icon"></sp-icon-revert>
              Unpublish
            </sp-button>
            <sp-tooltip slot="tooltip">Unpublish current document</sp-tooltip>
          </overlay-trigger>

          

          <!-- Export menu: HTML | JSON | Debug -->
          <sp-action-menu
            id="export-menu"
            quiet
            size="m"
            selects="single"
            ?disabled=${!this.firstElementChild}
            @change=${(e) => this.onExportMenuChange(e)}
          >
            <sp-icon-more slot="icon"></sp-icon-more>
            <sp-menu-item value="html">Sanitized HTML</sp-menu-item>
            <sp-menu-item value="json">Data Model (JSON)</sp-menu-item>
            <sp-menu-item value="debug">Debug State</sp-menu-item>
          </sp-action-menu>

          
        </div>
      </div>

      <div id="editor-main">
        ${this.structureTree}
        <div id="canvas-container">
          <div id="surface-wrapper">
            ${nothing}
            <div id="surface-content">
              <slot @slotchange=${this.handleSlotChange}></slot>
            </div>
          </div>
        </div>

        <div
          id="right-sidebar"
          class=${(this.commentStore?.commentsPanelOpen || this.versionStore?.versionsPanelOpen || this.store?.usedInStore?.panelOpen) ? 'open' : 'closed'}
          style=${`transform: translateX(${(this.commentStore?.commentsPanelOpen || this.versionStore?.versionsPanelOpen || this.store?.usedInStore?.panelOpen) ? '0' : 'calc(100% + 8px)'});`}
        >
          ${this.versionStore?.versionsPanelOpen
    ? html`<ee-versions-panel id="ee-versions-panel" .versionStore=${this.versionStore} .store=${this.editorStore}></ee-versions-panel>`
    : this.store?.usedInStore?.panelOpen
      ? html`<ee-used-in-panel id="ee-used-in-panel" .usedInStore=${this.store?.usedInStore} .store=${this.store}></ee-used-in-panel>`
      : html`<ee-comments-panel id="ee-comments-panel" .store=${this.editorStore} .commentStore=${this.commentStore}></ee-comments-panel>`}
        </div>
      </div>

      <ee-toolbar
        .store=${this.editorStore}
        .commentStore=${this.commentStore}
      ></ee-toolbar>

      ${this.deleteDialogUI}
      ${this.leaveDialogUI}
      ${this.unpublishDialogUI}
      ${this.renameDialogUI}

      <canvas id="comments-overlay"></canvas>
    `;
  }

  // Confirm Delete Dialog UI
  _initZoomPan() {
    if (this.#zoomController) return;
    const sr = this.shadowRoot;
    if (!sr) return;
    const container = sr.querySelector('#canvas-container');
    const surface = sr.querySelector('#surface-wrapper');
    const target = sr.querySelector('#surface-content');
    if (!container || !surface) return;
    try {
      this.#zoomController = attachZoomPan({
        container, surface, target, debugStore: this.store?.debugStore,
      });
      this.zoomStore = this.#zoomController.store;
      // Reposition toolbar when zoom/pan changes
      if (this._cleanupZoomReaction) this._cleanupZoomReaction();
      this._cleanupZoomReaction = reaction(
        this.zoomStore,
        (s) => [s.x, s.y, s.z],
        () => {
          if (this.editorStore?.isEEToolbarVisible) this._updateToolbarPosition();
        },
      );
    } catch (_) {
      this.#zoomController = null;
    }
  }

  // Confirm Delete Dialog UI
  get deleteDialogUI() {
    if (!this.confirmDeleteOpen) return nothing;
    const name = this.store?.currentElement?.name || 'this fragment';
    return html`
      <sp-dialog-wrapper
        open
        underlay
        dismissable
        headline="Delete fragment?"
        mode="modal"
        confirm-label="Delete"
        cancel-label="Cancel"
        @close=${() => (this.confirmDeleteOpen = false)}
        @cancel=${(e) => this.onDialogCancel(e)}
        @confirm=${(e) => this.onDialogConfirm(e)}
      >
        This action will permanently delete “${name}”.
      </sp-dialog-wrapper>
    `;
  }

  async confirmDelete() {
    try {
      const id = this.store?.editorStore?.currentElementId;
      if (!id) {
        this.confirmDeleteOpen = false;
        return;
      }
      await this.store.deleteElement(id);
      this.confirmDeleteOpen = false;
      // After deletion, router/store will switch back to home automatically
    } catch (_) {
      this.confirmDeleteOpen = false;
    }
  }

  onBackToGalleryClick() {
    try {
      const dirty = this.editorStore?.hasUnsavedChanges?.();
      if (dirty) {
        this.confirmLeaveOpen = true;
        return;
      }
    } catch (_) {}
    this.closeElement();
  }

  get leaveDialogUI() {
    if (!this.confirmLeaveOpen) return nothing;
    return html`
      <sp-dialog-wrapper
        open
        underlay
        dismissable
        headline="Unsaved changes"
        mode="modal"
        secondary-label="Discard"
        confirm-label="Save and Leave"
        cancel-label="Cancel"
        @close=${() => (this.confirmLeaveOpen = false)}
        @secondary=${() => { this.confirmLeaveOpen = false; this.closeElement(); }}
        @cancel=${() => (this.confirmLeaveOpen = false)}
        @confirm=${() => this.saveAndLeave()}
      >
        You have unsaved changes. What would you like to do?
      </sp-dialog-wrapper>
    `;
  }

  async saveAndLeave() {
    await this.editorStore?.saveCurrentElement?.();
    this.confirmLeaveOpen = false;
    this.closeElement();
  }

  onDialogConfirm(e) {
    // Perform deletion and re-emit a composed event for external listeners
    this.confirmDelete();
    this.dispatchEvent(
      new CustomEvent('confirm', { bubbles: true, composed: true }),
    );
  }

  onDialogCancel(e) {
    this.confirmDeleteOpen = false;
    this.dispatchEvent(
      new CustomEvent('cancel', { bubbles: true, composed: true }),
    );
  }

  // Confirm Unpublish Dialog UI
  get unpublishDialogUI() {
    if (!this.confirmUnpublishOpen) return nothing;
    const name = this.store?.currentElement?.name || 'this fragment';
    return html`
      <sp-dialog-wrapper
        open
        underlay
        dismissable
        headline="Unpublish fragment?"
        mode="modal"
        confirm-label="Unpublish"
        cancel-label="Cancel"
        @close=${() => (this.confirmUnpublishOpen = false)}
        @cancel=${() => (this.confirmUnpublishOpen = false)}
        @confirm=${() => this.confirmUnpublish()}
      >
        <div class="leave-dialog-body">
          <div class="leave-dialog-text">
            Unpublishing “${name}” makes its published version unavailable. Your draft stays intact for further edits.
          </div>
          ${this.isLoadingUnpublishRefs
    ? html`<div style="display:grid;place-items:center;min-height:80px;"><sp-progress-circle indeterminate size="m"></sp-progress-circle></div>`
    : this.unpublishRefs?.length
      ? html`
                  <div class="leave-dialog-text">Published references affected:</div>
                  <div style="max-height:200px;overflow:auto;border:1px solid var(--spectrum-alias-border-color);border-radius:6px;padding: var(--spectrum-global-dimension-size-75);">
                    <sp-sidenav>
                      ${this.unpublishRefs.map((r) => html`
                        <sp-sidenav-item label=${r.name || r.urn} value=${r.urn}></sp-sidenav-item>
                      `)}
                    </sp-sidenav>
                  </div>
                `
      : html`<div class="leave-dialog-text">No published references are currently affected.</div>`}
        </div>
      </sp-dialog-wrapper>
    `;
  }

  async confirmUnpublish() {
    this.confirmUnpublishOpen = false;
    await this.unpublishCurrent();
  }

  openUnpublishDialog() {
    this.confirmUnpublishOpen = true;
    this.loadUnpublishRefs();
  }

  async loadUnpublishRefs() {
    const urn = this.store?.editorStore?.currentElementId;
    if (!urn || !this.store?.documentStore?.getDocumentReferrers) {
      this.unpublishRefs = [];
      return;
    }
    this.isLoadingUnpublishRefs = true;
    const list = await this.store.documentStore.getDocumentReferrers(urn, true, null);
    const items = Array.isArray(list) ? list : [];
    const seen = new Map();
    for (const d of items) {
      const targetUrn = String(d.urn || d.id || d.target || d.target_urn || d.source || d.source_urn || '');
      if (!targetUrn) continue;
      if (d.is_folder || d.isFolder) continue;
      // Consider published if backend returns a timestamp/flag
      const isPublished = !!(d.published || d.published_at || d.publishedAt);
      if (!isPublished) continue;
      const name = d.name != null ? String(d.name) : 'Untitled';
      if (!seen.has(targetUrn)) seen.set(targetUrn, { urn: targetUrn, name });
    }
    this.unpublishRefs = Array.from(seen.values());
    this.isLoadingUnpublishRefs = false;
  }

  // Sidebar: Structure tree rendering
  get structureTree() {
    const tree = this.getAuthorableTree();
    // Always render tree-nav to reserve space, even if tree is empty/null
    return html` <ee-tree-nav
      ?open=${!!this.editorStore?.sidebarOpen}
      id="ee-tree-nav"
      .store=${this.editorStore}
      .tree=${tree}
      .searchQuery=${this.sidebarSearchQuery}
      .centerOn=${this.centerOnElement.bind(this)}
      .hideSidebar=${() => this.editorStore?.setSidebarOpen?.(false)}
    ></ee-tree-nav>`;
  }

  // Sidebar item: single-click selects without toggling expand/collapse
  onSideNavItemClick(e, node) {
    e.stopPropagation();
    e.preventDefault();
    const item = e.currentTarget;
    const wasExpanded = !!item.expanded;
    // If click is on caret zone (left 20px) and has children, toggle expansion only
    // Single-click selects only; expansion handled by double-click

    if (node && node.kind === 'slot') {
      if (node.parentElement) {
        this.editorStore?.selectSlot(node.parentElement, node.slotName);
        // Focus on the parent element's position for context
        this.centerOnElement(node.parentElement);
      }
    } else if (node.element) {
      this.selectElement(node.element);
      this.centerOnElement(node.element);
    }
    // Preserve expansion state on click to avoid accidental toggling
    requestAnimationFrame(() => {
      try {
        item.expanded = wasExpanded;
        if (wasExpanded) item.setAttribute('data-expanded', 'true');
        else item.removeAttribute('data-expanded');
      } catch (_) {}
    });
  }

  // Sidebar item: double-click toggles expand/collapse explicitly
  onSideNavItemDblClick(e) {
    e.stopPropagation();
    e.preventDefault();
    const item = e.currentTarget;
    const newExpanded = !item.expanded;
    item.expanded = newExpanded;
    if (newExpanded) item.setAttribute('data-expanded', 'true');
    else item.removeAttribute('data-expanded');
  }

  // Removed caret button; expansion via double-click or keyboard only

  // Keyboard navigation for sidebar tree
  onSideNavItemKeyDown(e, node) {
    const item = e.currentTarget;
    const hasChildren = !!(node.children && node.children.length);
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        e.stopPropagation();
        if (hasChildren && !item.expanded) {
          item.expanded = true;
          item.setAttribute('data-expanded', 'true');
        } else if (hasChildren && item.expanded) {
          const firstChild = item.querySelector('sp-sidenav-item');
          if (firstChild) this.focusSideNavItem(firstChild);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        e.stopPropagation();
        if (hasChildren && item.expanded) {
          item.expanded = false;
          item.removeAttribute('data-expanded');
        } else {
          const parent = item.parentElement?.closest?.('sp-sidenav-item');
          if (parent) this.focusSideNavItem(parent);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        e.stopPropagation();
        const list = this.getVisibleSideNavItems();
        const i = list.indexOf(item);
        const next = i >= 0 ? list[i + 1] : null;
        if (next) this.focusSideNavItem(next);
        break;
      }
      case 'Home': {
        e.preventDefault();
        e.stopPropagation();
        const list = this.getVisibleSideNavItems();
        if (list.length) this.focusSideNavItem(list[0]);
        break;
      }
      case 'End': {
        e.preventDefault();
        e.stopPropagation();
        const list = this.getVisibleSideNavItems();
        if (list.length) this.focusSideNavItem(list[list.length - 1]);
        break;
      }
      case 'PageDown': {
        e.preventDefault();
        e.stopPropagation();
        const container = this.shadowRoot?.querySelector('ee-tree-nav');
        if (!container) return;
        const list = this.getVisibleSideNavItems();
        if (!list.length) return;
        const currentTop = this.getItemTopRelativeTo(container, item);
        const targetTop = currentTop + container.clientHeight;
        let candidate = null;
        for (const it of list) {
          const y = this.getItemTopRelativeTo(container, it);
          if (
            y >= targetTop
            && (!candidate || y < this.getItemTopRelativeTo(container, candidate))
          ) {
            candidate = it;
          }
        }
        if (!candidate) candidate = list[list.length - 1];
        // Scroll and focus
        candidate.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        this.focusSideNavItem(candidate);
        break;
      }
      case 'PageUp': {
        e.preventDefault();
        e.stopPropagation();
        const container = this.shadowRoot?.querySelector('ee-tree-nav');
        if (!container) return;
        const list = this.getVisibleSideNavItems();
        if (!list.length) return;
        const currentTop = this.getItemTopRelativeTo(container, item);
        const targetTop = currentTop - container.clientHeight;
        let candidate = null;
        for (const it of list) {
          const y = this.getItemTopRelativeTo(container, it);
          if (
            y <= targetTop
            && (!candidate || y > this.getItemTopRelativeTo(container, candidate))
          ) {
            candidate = it;
          }
        }
        if (!candidate) candidate = list[0];
        candidate.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        this.focusSideNavItem(candidate);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        e.stopPropagation();
        const list = this.getVisibleSideNavItems();
        const i = list.indexOf(item);
        const prev = i > 0 ? list[i - 1] : null;
        if (prev) this.focusSideNavItem(prev);
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        e.stopPropagation();
        if (node && node.kind === 'slot') {
          if (node.parentElement) {
            this.editorStore?.selectSlot(node.parentElement, node.slotName);
            this.centerOnElement(node.parentElement);
          }
        } else if (node.element) {
          this.selectElement(node.element);
          this.centerOnElement(node.element);
        }
        break;
      }
      default:
        break;
    }
  }

  getVisibleSideNavItems() {
    const items = [];
    return items.filter((it) => this.isSideNavItemVisible(it));
  }

  isSideNavItemVisible(item) {
    // Visible when all ancestor sidenav-items are expanded
    let parent = item.parentElement;
    while (parent) {
      if (parent.tagName === 'SP-SIDENAV-ITEM') {
        const expanded = parent.hasAttribute('expanded')
          || parent.getAttribute('data-expanded') === 'true'
          || parent.expanded;
        if (!expanded) return false;
      }
      parent = parent.parentElement;
    }
    return true;
  }

  focusSideNavItem(item) {
    item.focus();
    // Ensure visibility within the sidebar viewport
    item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  getItemTopRelativeTo(container, item) {
    const rItem = item.getBoundingClientRect();
    const rCont = container.getBoundingClientRect();
    return rItem.top - rCont.top + container.scrollTop;
  }

  centerOnElement(el) {
    if (!el) return;
    // Use zoom controller to pan content into view within the wrapper
    try {
      if (this.#zoomController?.focusElement) {
        this.#zoomController.focusElement(el, { margin: 24 });
        return;
      }
    } catch (_) {}
    // Fallback to scrollIntoView
    try {
      const container = this.shadowRoot?.querySelector('#canvas-container');
      if (!container) return;
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    } catch (_) {}
  }

  // Helpers to compute the authorable tree from current DOM
  getAuthorableTree() {
    const roots = Array.from(this.children).filter((c) => this.isAuthorableElement(c));
    if (!roots.length) return null;

    const build = (el) => {
      const label = this.getElementLabel(el);
      const tag = el.tagName?.toLowerCase?.();
      const ctor = tag ? customElements.get(tag) : null;
      // Pass the instance to allow element-conditional schemas (e.g., inline hides slots)
      const rawSchema = ctor?.ee?.getSchema ? ctor.ee.getSchema(el) : null;
      const getLabel = (s) => rawSchema?.slots?.configs?.[s]?.label || s;

      // Collect authorable direct children
      const directChildren = Array.from(el.children).filter((c) => this.isAuthorableElement(c));

      // Determine declared slots strictly from authoring schema (no introspection)
      const declaredSlots = Array.isArray(rawSchema?.slots?.order)
        ? rawSchema.slots.order
        : [];
      const declaredNamed = new Set(
        (declaredSlots || []).filter((s) => s && s !== 'default'),
      );

      // Build named slot nodes only for declared slots
      const slotNodeMap = {};
      for (const slotName of declaredNamed) {
        const childEls = directChildren.filter(
          (c) => c.getAttribute('slot') === slotName,
        );
        slotNodeMap[slotName] = {
          kind: 'slot',
          slotName,
          parentElement: el,
          label: getLabel(slotName) || slotName,
          children: childEls.map((c) => build(c)),
        };
      }

      // Default slot: if it's a text/formatting slot, hide; if it's a container (allowedTags present), show element children inline
      let defaultChildren = [];
      try {
        const defaultCfg = rawSchema?.slots?.configs?.default || null;
        const defaultIsTextWithFormatting = !!defaultCfg
          && (defaultCfg.inlineEditable === true
            || (Array.isArray(defaultCfg.allowedFormats)
              && defaultCfg.allowedFormats.length > 0));
        // For container-like defaults, render children without a separate default slot node
        if (!defaultIsTextWithFormatting) {
          defaultChildren = directChildren
            .filter((c) => !c.hasAttribute('slot'))
            .map((c) => build(c));
        }
      } catch (_) {
        // If any error occurs reading schema, fall back to listing default children
        defaultChildren = directChildren
          .filter((c) => !c.hasAttribute('slot'))
          .map((c) => build(c));
      }

      // Additionally include children assigned to non-declared slots as direct children.
      // Slots not listed in *.author.js do not appear as slot groups in the tree.
      const orphanChildren = directChildren
        .filter((c) => {
          const name = c.getAttribute && c.getAttribute('slot');
          return !!name && name !== 'default' && !declaredNamed.has(name);
        })
        .map((c) => build(c));

      // Combine respecting schema order: for each declared slot name in order,
      // append either the default children (for 'default') or the named slot group.
      const children = [];
      for (const s of declaredSlots) {
        if (s === 'default') {
          children.push(...defaultChildren);
        } else if (slotNodeMap[s]) {
          children.push(slotNodeMap[s]);
        }
      }
      // Finally, append any orphans
      children.push(...orphanChildren);
      // If nothing computed (no schema and no children), return as-is
      return { element: el, label, children };
    };

    // Return a forest (array) of top-level nodes
    return roots.map((r) => build(r));
  }

  getElementLabel(el) {
    const tag = el.tagName?.toLowerCase?.() || 'element';
    const ctor = customElements.get(tag);
    try {
      // Pass the instance for dynamic labels when needed
      const schema = ctor?.ee?.getSchema ? ctor.ee.getSchema(el) : null;
      const lbl = schema?.element?.label;
      if (lbl) return lbl;
    } catch (_) {}
    return tag;
  }

  // Try to render an icon provided by element's ee.getElementIcon()
  renderItemIcon(el) {
    const tpl = this.getElementIconTemplate(el);
    if (tpl === undefined) return nothing;
    // Undefined => no icon provided; null => provided but invalid, show broken
    if (tpl === null) {
      return html`<span slot="icon" class="node-icon" title="Icon error"
        ><sp-icon-alert-circle></sp-icon-alert-circle
      ></span>`;
    }
    return html`<span slot="icon" class="node-icon">${tpl}</span>`;
  }

  getElementIconTemplate(el) {
    try {
      const tag = el?.tagName?.toLowerCase?.();
      if (!tag) return undefined;
      const ctor = customElements.get(tag);
      const result = ctor?.ee?.getElementIcon?.(html);
      if (result === undefined) return undefined;
      // If result is a string, treat it as a tag name and verify it's defined
      if (typeof result === 'string') {
        const iconTag = result.trim();
        if (!iconTag) return null;
        const defined = !!customElements.get(iconTag);
        if (!defined) return null;
        // Render the custom element tag
        return html`<${iconTag}></${iconTag}>`;
      }
      // Otherwise assume it's a Lit template
      return result;
    } catch (_) {
      return null;
    }
  }

  containsSelected(node, selectedEl) {
    if (!selectedEl) return false;
    if (node.element === selectedEl) return true;
    return (node.children || []).some((c) => this.containsSelected(c, selectedEl));
  }

  // Ensure sidebar is expanded by default while allowing user collapse
  firstUpdatedDone = false;

  lastSidebarRoot = null;

  // Merge sidebar init logic into the primary updated() below

  _getCanvasRoot() {
    const roots = Array.from(this.children).filter((c) => this.isAuthorableElement(c));
    return roots.length ? roots[0] : null;
  }

  _initSidebarExpansion() {
    const root = this._getCanvasRoot();
    if (!root) return;
    const rootChanged = this.lastSidebarRoot !== root;
    if (!this.firstUpdatedDone || rootChanged) {
      // Defer until DOM is painted
      setTimeout(() => this._expandAllSidebarItems(), 0);
      this.firstUpdatedDone = true;
      this.lastSidebarRoot = root;
    }
  }

  // _ensureSidebarVisible removed; not required with inline layout

  _expandAllSidebarItems() {
    const host = this.shadowRoot;
    if (!host) return;
    const nav = host.querySelector('ee-tree-nav');
    nav?.expandAll?.(true);
  }

  expandAllSlots(expanded) {
    const host = this.shadowRoot;
    if (!host) return;
    const nav = host.querySelector('ee-tree-nav');
    nav?.expandAll?.(!!expanded);
  }

  onSidebarSearch(e) {
    const val = (e.target.value || '').toString();
    this.sidebarSearchQuery = val;
  }

  onSidebarSearchKey(e) {
    if (e.key === 'Escape') {
      this.sidebarSearchQuery = '';
      e.target.value = '';
    }
  }

  filterTree(node, query) {
    if (!node) return null;
    const matches = (node.label || '').toLowerCase().includes(query);
    const filteredChildren = (node.children || [])
      .map((c) => this.filterTree(c, query))
      .filter(Boolean);
    if (matches || filteredChildren.length) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }

  _attachSidebarWheelGuard() {
    const host = this.shadowRoot;
    if (!host) return;
    const el = host.querySelector('ee-tree-nav');
    if (!el) return;
    if (el._eeWheelGuarded) return;
    const stop = (e) => {
      // Allow native scroll in sidebar, but do not propagate to editor canvas
      e.stopPropagation();
    };
    el.addEventListener('wheel', stop, { passive: true, capture: true });
    el._eeWheelGuarded = true;
  }

  _attachCanvasWheelGuard() {
    const host = this.shadowRoot;
    if (!host) return;
    const el = host.querySelector('#canvas-container');
    if (!el) return;
    if (el._eeWheelGuarded) return;
    const stop = (e) => {
      // Keep scroll contained within the canvas container
      e.stopPropagation();
    };
    el.addEventListener('wheel', stop, { passive: true, capture: true });
    el._eeWheelGuarded = true;
  }

  // Fragment Name Management

  handleFragmentNameChange(e) {
    const newName = e.target.value.trim();
    if (newName && this.store.currentElement) {
      this.store.updateElementName(newName);
    }
  }

  handleFragmentNameKeypress(e) {
    // Save on Enter key
    if (e.key === 'Enter') {
      e.target.blur();
      this.handleFragmentNameChange(e);
    }
  }

  // Rename dialog
  openRenameDialog() {
    const current = this.store?.currentElement?.name || 'Untitled Fragment';
    this.renameValue = current;
    this.renameDialogOpen = true;
  }

  onRenameInput(e) {
    this.renameValue = e?.target?.value ?? this.renameValue;
  }

  confirmRename() {
    const name = (this.renameValue || '').trim();
    if (name) this.store.updateElementName(name);
    this.renameDialogOpen = false;
  }

  get renameDialogUI() {
    if (!this.renameDialogOpen) return nothing;
    return html`
      <sp-dialog-wrapper
        open
        underlay
        dismissable
        mode="modal"
        headline="Rename fragment"
        confirm-label="Rename"
        cancel-label="Cancel"
        @close=${() => (this.renameDialogOpen = false)}
        @cancel=${() => (this.renameDialogOpen = false)}
        @confirm=${() => this.confirmRename()}
      >
        <sp-field-group>
          <sp-field-label for="rename-fragment-input">Name</sp-field-label>
          <sp-textfield id="rename-fragment-input" autofocus .value=${this.renameValue}
            @input=${(e) => this.onRenameInput(e)}
            @keydown=${(e) => { if (e.key === 'Enter') this.confirmRename(); }}
          ></sp-textfield>
        </sp-field-group>
      </sp-dialog-wrapper>
    `;
  }

  // Element Management

  async closeElement() {
    await this.editorStore?.performAutoSave?.();
    await this.store.closeElement();
    this.selectElement(null);

    // Remove all canvas elements (direct children)
    const elements = Array.from(this.children);
    elements.forEach((el) => el.remove());
  }

  selectElement(element) {
    if (this.editorStore) {
      this.editorStore.selectElement(element);
    }
  }

  // ContentEditable lifecycle delegated from EditorStore
  toggleContentEditable() {
    const element = this.editorStore?.editingElement;
    if (!element) return;
    const isEditable = element.getAttribute?.('contenteditable') === 'true' || element.contentEditable === 'true';
    if (isEditable) this.disableContentEditable();
    else this.enableContentEditable();
  }

  enableContentEditable() {
    const element = this.editorStore?.editingElement;
    if (!element) return;

    // Preserve original states
    if (element._eeOriginalContentEditable === undefined) {
      element._eeOriginalContentEditable = element.contentEditable || 'inherit';
    }
    if (element._eeOriginalHTML === undefined) {
      element._eeOriginalHTML = element.innerHTML;
    }

    const plainTextOnly = !this.editorStore?.hasTextFormatting;
    element.setAttribute('contenteditable', plainTextOnly ? 'plaintext-only' : 'true');
    if (element._eeOriginalUserSelect === undefined) {
      element._eeOriginalUserSelect = element.style.userSelect || '';
    }
    element.style.userSelect = 'text';
    try { element.style.webkitUserSelect = 'text'; } catch (_) {}

    const schema = this.editorStore?.elementSchema;
    const isMultiline = this.editorStore?.getMultilineSupport?.(schema) !== false;

    let editTarget = element;
    try {
      const tag = element.tagName?.toLowerCase?.() || '';
      const isCustom = tag.includes('-');
      if (isCustom) {
        const hasText = !!(element.textContent && element.textContent.length > 0);
        const firstElChild = Array.from(element.children || []).find((c) => !c.hasAttribute('slot')) || null;
        if (firstElChild && !firstElChild.tagName?.toLowerCase?.().includes('-')) {
          if (!firstElChild.childNodes || firstElChild.childNodes.length === 0) {
            firstElChild.appendChild(document.createTextNode(' '));
          }
          editTarget = firstElChild;
        } else if (!firstElChild && !hasText) {
          const span = document.createElement('span');
          span.appendChild(document.createTextNode(' '));
          try { element.eeEditNode = span; } catch (_) {}
          element.appendChild(span);
          editTarget = span;
        }
      }
    } catch (_) {}

    const handleKeydown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        document.execCommand('insertText', false, ' ');
      }
      if (!isMultiline && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        try {
          const original = element._eeOriginalHTML;
          if (original != null) element.innerHTML = original;
          if (this.editorStore?.snapshotTimeout) {
            clearTimeout(this.editorStore.snapshotTimeout);
            this.editorStore.snapshotTimeout = null;
          }
          element._eeCancelEdit = true;
        } catch (_) {}
        this.disableContentEditable();
        try { delete element._eeOriginalHTML; } catch (_) {}
      }
    };
    const handleInput = () => {
      this.editorStore?.scheduleSnapshot?.();
    };
    const handleBlur = () => {
      try {
        const hasText = !!(editTarget.textContent && editTarget.textContent.trim().length > 0);
        if (hasText && editTarget) {
          if (editTarget.hasAttribute?.('data-ee-placeholder')) editTarget.removeAttribute('data-ee-placeholder');
          if (editTarget.eePlaceholder) { try { delete editTarget.eePlaceholder; } catch (_) {} }
        }
      } catch (_) {}
      if (element._eeCancelEdit) {
        try { delete element._eeCancelEdit; } catch (_) {}
        return;
      }
      this.editorStore?.scheduleSnapshot?.();
    };

    const updateInlineLinkTargetFromSelection = () => {
      try {
        if (this.editorStore?.inlineLinkContextLocked) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) { this.editorStore?.setInlineLinkEditingTarget?.(null); return; }
        const focusNode = sel.focusNode || sel.anchorNode;
        if (!focusNode) { this.editorStore?.setInlineLinkEditingTarget?.(null); return; }
        const container = editTarget || element;
        const rootEl = focusNode.nodeType === Node.ELEMENT_NODE ? focusNode : focusNode.parentElement;
        if (!rootEl || !container || !container.contains(rootEl)) { this.editorStore?.setInlineLinkEditingTarget?.(null); return; }
        let cur = rootEl; let found = null;
        try { const ctag = container?.tagName?.toLowerCase?.(); if (ctag === 'a' && container.contains(rootEl)) found = container; } catch (_) {}
        while (cur && cur !== container && cur !== element) {
          if (cur.tagName && cur.tagName.toLowerCase() === 'a') { found = cur; break; }
          cur = cur.parentElement;
        }
        this.editorStore?.setInlineLinkEditingTarget?.(found || null);
      } catch (_) {
        this.editorStore?.setInlineLinkEditingTarget?.(null);
      }
    };

    element._caretContextListener = updateInlineLinkTargetFromSelection;
    element._selectionChangeListener = updateInlineLinkTargetFromSelection;
    editTarget.addEventListener('mouseup', updateInlineLinkTargetFromSelection);
    editTarget.addEventListener('keyup', updateInlineLinkTargetFromSelection);
    document.addEventListener('selectionchange', updateInlineLinkTargetFromSelection);

    if (editTarget && editTarget !== element) {
      try { editTarget.setAttribute('contenteditable', plainTextOnly ? 'plaintext-only' : 'true'); } catch (_) {
        try { editTarget.contentEditable = plainTextOnly ? 'plaintext-only' : 'true'; } catch (_) {}
      }
      try { if (!editTarget.hasAttribute('tabindex')) editTarget.setAttribute('tabindex', '0'); } catch (_) {}
      if (editTarget._eeOriginalUserSelect === undefined) {
        editTarget._eeOriginalUserSelect = editTarget.style?.userSelect || '';
      }
      try { editTarget.style.userSelect = 'text'; } catch (_) {}
      try { editTarget.style.webkitUserSelect = 'text'; } catch (_) {}
    }

    try {
      const preferEnd = true;
      let placed = false;
      const container = editTarget || element;
      if (container?.focus) container.focus();
      placed = !!this._placeCaretFromPendingPoint(container, preferEnd);
      if (!placed) {
        const tag = element.tagName?.toLowerCase?.();
        const end = tag === 'a';
        const node = container || element;
        this._placeCaretAtBoundary(node, end);
      }
    } catch (_) {}

    element._keydownListener = handleKeydown;
    element._inputListener = handleInput;
    element._blurListener = handleBlur;
    editTarget.addEventListener('keydown', element._keydownListener);
    editTarget.addEventListener('input', element._inputListener);
    editTarget.addEventListener('blur', element._blurListener, { once: true });

    element._eeEditTarget = editTarget;
  }

  disableContentEditable() {
    const element = this.editorStore?.editingElement;
    if (!element) return;
    const editTarget = element._eeEditTarget || element;
    if (element._keydownListener) { try { editTarget.removeEventListener('keydown', element._keydownListener); } catch (_) {} delete element._keydownListener; }
    if (element._inputListener) { try { editTarget.removeEventListener('input', element._inputListener); } catch (_) {} delete element._inputListener; }
    if (element._blurListener) { try { editTarget.removeEventListener('blur', element._blurListener); } catch (_) {} delete element._blurListener; }
    if (element._caretContextListener) {
      try { editTarget.removeEventListener('mouseup', element._caretContextListener); } catch (_) {}
      try { editTarget.removeEventListener('keyup', element._caretContextListener); } catch (_) {}
      delete element._caretContextListener;
    }
    if (element._selectionChangeListener) {
      try { document.removeEventListener('selectionchange', element._selectionChangeListener); } catch (_) {}
      delete element._selectionChangeListener;
    }
    this.editorStore?.setInlineLinkEditingTarget?.(null);
    delete element._eeEditTarget;

    const originalUserSelect = element._eeOriginalUserSelect;
    if (originalUserSelect !== undefined) {
      if (originalUserSelect) {
        element.style.userSelect = originalUserSelect; try { element.style.webkitUserSelect = originalUserSelect; } catch (_) {}
      } else {
        element.style.removeProperty('user-select'); try { element.style.removeProperty('-webkit-user-select'); } catch (_) {}
      }
      try { delete element._eeOriginalUserSelect; } catch (_) {}
    }

    if (editTarget && editTarget !== element) {
      const orig = editTarget._eeOriginalUserSelect;
      if (orig !== undefined) {
        if (orig) {
          editTarget.style.userSelect = orig; try { editTarget.style.webkitUserSelect = orig; } catch (_) {}
        } else {
          editTarget.style.removeProperty('user-select'); try { editTarget.style.removeProperty('-webkit-user-select'); } catch (_) {}
        }
        try { delete editTarget._eeOriginalUserSelect; } catch (_) {}
      }
      try { editTarget.removeAttribute('contenteditable'); } catch (_) {}
    }

    const originalState = element._eeOriginalContentEditable;
    if (originalState && originalState !== 'inherit') element.contentEditable = originalState;
    else element.removeAttribute('contenteditable');
    delete element._eeOriginalContentEditable;
    element.blur?.();
  }

  cancelInlineEditing() {
    const element = this.editorStore?.editingElement;
    if (!element) return;
    const original = element._eeOriginalHTML;
    if (original != null) element.innerHTML = original;
    if (this.editorStore?.snapshotTimeout) {
      clearTimeout(this.editorStore.snapshotTimeout);
      this.editorStore.snapshotTimeout = null;
    }
    element._eeCancelEdit = true;
    this.disableContentEditable();
    try { delete element._eeOriginalHTML; } catch (_) {}
  }

  _placeCaretFromPendingPoint(container, preferEnd = true) {
    const store = this.editorStore;
    const pt = store?._pendingCaretPoint;
    if (store) store._pendingCaretPoint = null;
    if (!container || !pt) return false;
    const doc = container.ownerDocument || document;
    const setSelection = (node, offset, fallbackToEnd = true) => {
      try {
        const range = doc.createRange();
        range.setStart(node, Math.max(0, Math.min(offset, node.length || offset || 0)));
        range.collapse(true);
        const sel = doc.getSelection ? doc.getSelection() : window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        container.focus?.();
        return true;
      } catch (_) { return false; }
    };
    const nodeFromPoint = (x, y) => {
      const n = doc.elementFromPoint(x, y);
      if (!n) return null;
      if (n.nodeType === Node.TEXT_NODE) return n;
      const walker = doc.createTreeWalker(n, NodeFilter.SHOW_TEXT, null);
      let last = null; let cur = walker.nextNode();
      while (cur) { last = cur; cur = walker.nextNode(); }
      return last || n;
    };
    const { x, y } = pt;
    const n = nodeFromPoint(x, y);
    if (!n) return this._placeCaretAtBoundary(container, /* end */ !!preferEnd);
    if (n.nodeType === Node.TEXT_NODE) return setSelection(n, n.length || 0, true);
    return this._placeCaretAtBoundary(container, /* end */ !!preferEnd);
  }

  _placeCaretAtBoundary(container, end = true) {
    try {
      const doc = container.ownerDocument || document;
      const sel = doc.getSelection ? doc.getSelection() : window.getSelection();
      const range = doc.createRange();
      const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node = null; let last = null;
      while ((node = walker.nextNode())) { last = node; if (!end) break; }
      const target = end ? (last || container) : (container.firstChild || container);
      if (target.nodeType === Node.TEXT_NODE) {
        range.selectNodeContents(target);
        range.collapse(end);
      } else {
        range.selectNodeContents(container);
        range.collapse(end);
      }
      sel.removeAllRanges(); sel.addRange(range);
      container.focus?.();
      return true;
    } catch (_) { return false; }
  }

  handleSlotChange() {
    this.requestUpdate();
    setTimeout(() => this.scrollSideNavToSelection(), 0);
  }

  initEditorStore() {
    if (!this.editorStore) return;
    // Set the editor element reference for undo/redo
    this.editorStore.setEditorElement(this);
    // Comment store is provided by the App Store and wired in updated() when `store` arrives
    // No global window.* exposure; rely on component context
  }

  // Compute ee-toolbar dimensions from its shadow DOM or fall back
  _getToolbarDims() {
    const inner = this.shadowRoot
      ?.querySelector('ee-toolbar')
      ?.shadowRoot?.getElementById('ee-toolbar');
    if (inner) {
      const rect = inner.getBoundingClientRect();
      return {
        width: Math.max(1, Math.round(rect.width || 520)),
        height: Math.max(1, Math.round(rect.height || 40)),
      };
    }
    return { width: 520, height: 40 };
  }

  // Calculate toolbar position around current selection/slot/element
  _calculateToolbarPosition(element) {
    if (!element) return { x: 0, y: 0 };

    const selection = window.getSelection?.();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const rect = selection.getRangeAt(0).getBoundingClientRect?.();
      if (rect && rect.width >= 1 && rect.height >= 1) {
        return this._calculateToolbarPositionFromRect(rect);
      }
    }

    const slotName = this.editorStore?.currentSlot;
    const sr = element.shadowRoot;
    if (slotName && sr) {
      const selector = slotName === 'default' ? 'slot:not([name])' : `slot[name="${slotName}"]`;
      const slotEl = sr.querySelector(selector);
      const rect = slotEl?.getBoundingClientRect?.();
      if (rect && rect.width >= 1 && rect.height >= 1) {
        return this._calculateToolbarPositionFromRect(rect);
      }
    }

    const rect = element.getBoundingClientRect?.();
    if (rect) return this._calculateToolbarPositionFromRect(rect);
    return { x: 0, y: 0 };
  }

  _calculateToolbarPositionFromRect(rect) {
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const margin = 8;
    const gap = 62; // element/selection to toolbar gap

    const dims = this._getToolbarDims();
    const toolbarWidth = dims.width;
    const toolbarHeight = dims.height;

    // Center horizontally over the target rect
    let x = rect.left + rect.width / 2 - toolbarWidth / 2;

    // Default placement: below the element; if element is near bottom (>80% of viewport), place above.
    const nearBottom = rect.bottom >= viewportHeight * 0.8;
    const yBelow = rect.bottom + gap;
    const yAbove = rect.top - toolbarHeight - gap;
    let y = nearBottom ? yAbove : yBelow;

    // Fallbacks: if chosen position is off-screen, try the alternative; then clamp.
    const maxX = Math.max(margin, viewportWidth - toolbarWidth - margin);
    const maxY = Math.max(margin, viewportHeight - toolbarHeight - margin);
    if (y < margin) y = nearBottom ? yBelow : yAbove; // try the other side
    if (y > maxY) y = nearBottom ? yAbove : yBelow; // try the other side

    x = Math.min(Math.max(margin, x), maxX);
    y = Math.min(Math.max(margin, y), maxY);
    return { x, y };
  }

  _updateToolbarPosition() {
    const el = this.editorStore?.editingElement;
    if (!el) return;
    const pos = this._calculateToolbarPosition(el);
    this.editorStore?.setEEToolbarPosition?.(pos.x, pos.y);
  }

  _setupToolbarSync() {
    if (!this.editorStore || this._cleanupToolbarReaction) return;
    this._cleanupToolbarReaction = reaction(
      this.editorStore,
      (s) => [s.eeToolbarVisible, s.editingElement, s.currentSlot],
      () => {
        if (!this.editorStore?.isEEToolbarVisible) return;
        this._updateToolbarPosition();
      },
    );

    // Also respond to canvas scroll
    const container = this.shadowRoot?.querySelector('#canvas-container');
    if (container) {
      container.addEventListener(
        'scroll',
        () => {
          if (this.editorStore?.isEEToolbarVisible) this._updateToolbarPosition();
        },
        { passive: true },
      );
    }
  }

  // Selection outline: mark the selected element or its slot
  _setupSelectionOutlineSync() {
    if (!this.editorStore || this._cleanupSelectionReaction) return;
    this._cleanupSelectionReaction = reaction(
      this.editorStore,
      (s) => [s.editingElement, s.currentSlot],
      () => this._applySelectionOutline(),
    );
  }

  _applySelectionOutline() {
    const host = this;
    // Clear previous markers within editor subtree
    try {
      host.querySelectorAll('[data-ee-selected]').forEach((n) => {
        try { n.removeAttribute('data-ee-selected'); } catch (_) {}
      });
    } catch (_) {}
    // Clear previous outlined slot (if any)
    try {
      if (this.#lastOutlinedSlotEl) {
        this.#lastOutlinedSlotEl.removeAttribute?.('data-ee-selected');
        this.#lastOutlinedSlotEl = null;
      }
    } catch (_) { this.#lastOutlinedSlotEl = null; }

    const el = this.editorStore?.editingElement || null;
    if (!el) return;

    const slotName = this.editorStore?.currentSlot || null;
    if (!slotName) {
      // Outline element via attribute; styling comes from ::slotted rule
      try { el.setAttribute('data-ee-selected', ''); } catch (_) {}
      return;
    }
    // Slot context: outline the <slot> inside element's open shadow root
    try {
      const sr = el.shadowRoot || null;
      if (sr) {
        const selector = slotName === 'default' ? 'slot:not([name])' : `slot[name="${slotName}"]`;
        const slotEl = sr.querySelector(selector);
        if (slotEl) {
          this._ensureSlotHighlightStyles(sr);
          slotEl.setAttribute('data-ee-selected', '');
          this.#lastOutlinedSlotEl = slotEl;
          return;
        }
      }
    } catch (_) {}
    // Fallback: outline element
    try { el.setAttribute('data-ee-selected', ''); } catch (_) {}
  }

  _ensureSlotHighlightStyles(sr) {
    try {
      if (!sr) return;
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

  // Comments overlay setup and drawing
  setupCommentsOverlay() {
    if (!this.editorStore || this.cleanupCommentsReaction) return;
    this.cleanupCommentsReaction2 = reaction(
      this.commentStore,
      (cs) => [cs.hoveredCommentId, cs.commentsPanelOpen],
      () => {
        this.syncCommentsPanelView();
        this.updateCommentsOverlay();
      },
    );
    window.addEventListener('resize', this.updateCommentsOverlay);
    const container = this.shadowRoot?.querySelector('#canvas-container');
    if (container) {
      container.addEventListener('scroll', this.updateCommentsOverlay, {
        passive: true,
      });
    }
    this.syncCommentsPanelView();
  }

  // Ensure the right sidebar panel visually reflects commentStore state immediately
  syncCommentsPanelView() {}

  updateCommentsOverlay = () => {
    const canvas = this.shadowRoot?.getElementById('comments-overlay');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (canvas.width !== vw * dpr || canvas.height !== vh * dpr) {
      canvas.width = vw * dpr;
      canvas.height = vh * dpr;
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    // 1) Draw comment connector overlay when panel open and hovering an item
    const open = !!this.commentStore?.commentsPanelOpen;
    const commentId = this.commentStore?.hoveredCommentId || null;
    if (!open || !commentId) return;

    const panel = this.shadowRoot?.getElementById('ee-comments-panel');
    const el = this.getElementForComment(commentId);
    if (!panel || !el) return;
    const card = panel.getCommentItemRect?.(commentId);
    const rect = el.getBoundingClientRect();
    if (!card || !rect || rect.width === 0 || rect.height === 0) return;

    // Compute a route that always exits the panel to the left first and never crosses the element box.
    const rightSidebar = this.shadowRoot?.getElementById('right-sidebar');
    const panelRect = rightSidebar?.getBoundingClientRect?.() || card;

    // Start at the left end of the comment item's bbox
    const startX = Math.min(window.innerWidth - 12, Math.max(12, card.left));
    const startY = Math.min(
      window.innerHeight - 12,
      Math.max(12, card.top + card.height * 0.5),
    );

    // Arrow sizing and anchor computations
    const arrowLen = 10;
    const arrowHalf = 5;
    // Anchor Y vertically centers on the target element's bounding box (kept inside)
    const elCenterY = rect.top + rect.height / 2;
    const yAnchor = Math.min(
      rect.bottom - 4,
      Math.max(rect.top + 4, elCenterY),
    );
    // The polyline will end just outside the element on the right
    const lineEndX = Math.max(12, rect.right + arrowLen);
    const tipX = rect.right;
    const tipY = yAnchor;
    // Hub X is a leftwards detour (beyond panel boundary) to ensure we always go left first, away from the panel
    const hubX = Math.max(12, (panelRect.left || startX) - 24);

    ctx.save();
    // Use a bright, theme-friendly Spectrum focus color for visibility
    let color = getComputedStyle(this)
      .getPropertyValue('--spectrum-alias-focus-color')
      .trim();
    if (!color) {
      color = getComputedStyle(this)
        .getPropertyValue('--spectrum-global-color-blue-500')
        .trim();
    }
    ctx.strokeStyle = color || 'currentColor';
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.lineCap = 'round';
    // Draw square connector: left first -> vertical -> horizontal towards element
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(hubX, startY);
    ctx.lineTo(hubX, yAnchor);
    ctx.lineTo(lineEndX, yAnchor);
    ctx.stroke();

    // Draw arrow head at the element boundary (pointing left)
    ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + arrowLen, tipY - arrowHalf);
    ctx.lineTo(tipX + arrowLen, tipY + arrowHalf);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Keep updating while hovered to track scrolls/transforms
    requestAnimationFrame(this.updateCommentsOverlay);
  };

  getElementForComment(commentId) {
    if (!commentId) return null;
    const c = (this.commentStore?.comments || []).find(
      (x) => x.id === commentId,
    );
    if (!c || !c.targetId) return null;
    const candidates = Array.from(
      this.querySelectorAll('*[data-ee-comment-id]'),
    );
    return (
      candidates.find(
        (n) => n.getAttribute('data-ee-comment-id') === c.targetId,
      ) || null
    );
  }

  showToast(message) {
    // Use Spectrum toast pattern
    const toast = document.createElement('sp-toast');
    toast.timeout = 3000;
    toast.variant = 'info';
    toast.open = true;
    toast.textContent = message;
    // Ensure visibility above fixed toolbars and panels
    toast.style.position = 'fixed';
    toast.style.bottom = '16px';
    toast.style.right = '16px';
    toast.style.zIndex = '3000';
    this.shadowRoot.appendChild(toast);
  }

  async publishCurrent() {
    const urn = this.store?.editorStore?.currentElementId;
    if (!urn) return;
    this.showToast('Publishing started…');
    try {
      await this.store?.documentStore?.publishDocument?.(urn);
    } catch (e) {
      this.showToast('Failed to start publish');
    }
  }

  async unpublishCurrent() {
    const urn = this.store?.editorStore?.currentElementId;
    if (!urn) return;
    this.showToast('Unpublishing started…');
    try {
      await this.store?.documentStore?.unpublishDocument?.(urn);
    } catch (e) {
      this.showToast('Failed to start unpublish');
    }
  }

  async copySanitizedHTML() {
    const root = this.firstElementChild;
    if (!root) return;
    const clone = root.cloneNode(true);
    sanitizeTree(clone, {
      currentDocumentId: this.store?.editorStore?.currentElementId || null,
      showToast: (msg) => this.showToast(msg),
    });
    const html = this.formatHTMLTree(clone);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(html);
    } else {
      const ta = document.createElement('textarea');
      ta.value = html;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
      ta.remove();
    }
    this.showToast('HTML copied to clipboard');
  }

  async copyDebugState() {
    this.editorStore?.setUserAction?.('topbar:copy-debug-state');
    // Export trace events and include editor debug logs to trace toolbar show/hide
    const traces = this.store?.debugStore?.exportTraces?.() || { traces: [] };
    const editorLogs = (this.editorStore?.getDebugLogs && this.editorStore.getDebugLogs()) || [];
    const toolbarEvents = editorLogs.filter((e) => {
      const t = e && e.type ? String(e.type) : '';
      return (
        t.startsWith('editor:toolbar:')
        || t === 'editor:click'
        || t === 'editor:click:empty'
        || t === 'editor:select'
      );
    });
    const describeEl = (el) => {
      if (!el || !el.tagName) return null;
      const tag = el.tagName.toLowerCase();
      return { tag, id: el.id || null, slot: el.getAttribute ? el.getAttribute('slot') : null };
    };
    const state = {
      toolbarVisible: !!this.editorStore?.eeToolbarVisible,
      toolbarPosition: this.editorStore?.eeToolbarPosition || null,
      selected: describeEl(this.editorStore?.editingElement),
      currentSlot: this.editorStore?.currentSlot || null,
    };
    const payload = {
      at: Date.now(), traces, editorLogs, toolbarEvents, state,
    };
    const text = JSON.stringify(payload);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      this.showToast('Debug snapshot copied to clipboard');
    } catch (_) {
      // Attempt fallback copy if writeText throws
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        this.showToast('Debug snapshot copied to clipboard');
      } catch (_) {
        this.showToast('Failed to copy debug logs');
      }
    }
  }

  // Pretty-print a DOM subtree into indented HTML
  formatHTMLTree(node, indent = '  ', level = 0) {
    const voidTags = new Set([
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'keygen',
      'link',
      'meta',
      'param',
      'source',
      'track',
      'wbr',
    ]);

    const repeat = (s, n) => Array(n + 1).join(s);

    const formatNode = (n, depth) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = (n.textContent || '').trim();
        return t ? `${repeat(indent, depth)}${t}\n` : '';
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = n.tagName.toLowerCase();
      const openEl = n.cloneNode(false);
      // Remove empty class/style attributes from the open tag only
      const cls = openEl.getAttribute && openEl.getAttribute('class');
      if (cls != null && cls.trim() === '') openEl.removeAttribute('class');
      const sty = openEl.getAttribute && openEl.getAttribute('style');
      if (sty != null && sty.trim() === '') openEl.removeAttribute('style');
      const openOuter = openEl.outerHTML;
      const endOfOpen = openOuter.indexOf('>');
      const openTag = endOfOpen >= 0 ? openOuter.slice(0, endOfOpen + 1) : openOuter;

      // If void tag, just write single line
      if (voidTags.has(tag)) {
        return `${repeat(indent, depth)}${openTag}\n`;
      }

      // Children
      let out = `${repeat(indent, depth)}${openTag}\n`;
      const kids = Array.from(n.childNodes);
      for (const c of kids) out += formatNode(c, depth + 1);
      out += `${repeat(indent, depth)}</${tag}>\n`;
      return out;
    };

    return formatNode(node, level).replace(/\n+$/, '');
  }

  async copyDataModel() {
    const snapshot = this.editorStore?.getJsonSnapshot?.();
    const text = JSON.stringify(snapshot, null, 2);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
      ta.remove();
    }
    this.showToast('JSON copied to clipboard');
  }

  async copyReferenceSnippet() {
    return this.copyReferenceSnippetAs('button');
  }

  async copyReferenceSnippetAs(type) {
    const id = this.store?.editorStore?.currentElementId;
    const name = this.store?.currentElement?.name || 'Untitled Fragment';
    if (!id) return;
    const escape = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    let snippet = '';
    if (type === 'inline') {
      snippet = snippet = `<ee-reference urn="${id}" inline><ee-reference>`;
    } else if (type === 'spectrum-link') {
      snippet = `<ee-reference urn="${id}"><sp-link slot=\"trigger\">${escape(
        name,
      )}</sp-link></ee-reference>`;
    } else if (type === 'a') {
      snippet = `<ee-reference urn="${id}"><a slot=\"trigger\" href=\"#\">${escape(
        name,
      )}</a></ee-reference>`;
    } else {
      // default to Spectrum button trigger
      snippet = `<ee-reference urn="${id}"><sp-button slot=\"trigger\">${escape(
        name,
      )}</sp-button></ee-reference>`;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(snippet);
    } else {
      const ta = document.createElement('textarea');
      ta.value = snippet;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (_) {}
      ta.remove();
    }
    this.showToast('Copied to clipboard');
  }

  onCopyReferenceMenu(e) {
    // Try to resolve the chosen value from ActionMenu or the clicked menu item
    let value = e?.target?.value;
    if (!value) {
      const item = (e.composedPath && e.composedPath()).find(
        (n) => n && n.tagName === 'SP-MENU-ITEM',
      );
      if (item && item.value) value = item.value;
    }
    value = value || 'inline';
    this.copyReferenceSnippetAs(value);
    // Clear selection so no checkmark persists next time
    const menu = e?.target;
    if (menu && 'value' in menu) {
      menu.value = undefined;
    }
    if (menu && 'open' in menu) {
      menu.open = false;
    }
  }

  onExportMenuChange(e) {
    let value = e?.target?.value || e?.detail?.value || '';
    if (!value) {
      const item = (e.composedPath && e.composedPath()).find((n) => n && n.tagName === 'SP-MENU-ITEM');
      if (item && item.value) value = item.value;
    }
    if (value === 'html') this.copySanitizedHTML();
    else if (value === 'json') this.copyDataModel();
    else if (value === 'debug') this.copyDebugState();
    const menu = e?.target;
    if (menu && 'value' in menu) menu.value = undefined;
    if (menu && 'open' in menu) menu.open = false;
  }

  undefined;

  openPreview() {
    const id = this.store?.editorStore?.currentElementId;
    if (!id) return;
    const url = new URL('preview.html', window.location.href);
    url.searchParams.set('id', id);
    const color = this.store?.themeColor;
    if (color === 'light' || color === 'dark') {
      url.searchParams.set('color', color);
    }
    window.open(url.toString(), '_blank', 'noopener');
  }

  onPublishMenuChange(e) {
    const menu = e?.target;
    const value = (menu && 'value' in menu) ? menu.value : (e?.detail?.value || '');
    if (value === 'publish') {
      this.publishCurrent();
    } else if (value === 'unpublish') {
      this.openUnpublishDialog();
    }
    // reset menu selection and close after action
    if (menu && 'value' in menu) menu.value = undefined;
    if (menu && 'open' in menu) menu.open = false;
  }

  // Style the Publish icon with Spectrum token when there are unpublished changes
  get publishIconStyle() {
    const ce = this.store?.currentElement;
    const id = this.store?.editorStore?.currentElementId;
    if (!id || !ce) return nothing;

    // 1) Live dirty state (unsaved edits in the canvas)
    const hasUnsaved = !!this.editorStore?.hasUnsavedChanges?.();
    if (hasUnsaved) return 'color: var(--spectrum-global-color-orange-600);';

    // 2) Persisted changes since last publish
    const pubTime = (ce.published && ce.publishedBy)
      ? new Date(ce.published).getTime()
      : NaN;
    if (!Number.isFinite(pubTime)) return nothing;

    // Prefer server-provided updated/lastModified; fall back to lastSavedAt when autosave has occurred
    const serverUpdated = new Date(
      ce.updated || ce.lastModified || ce.created || ce.published,
    ).getTime();
    const lastSaved = Number.isFinite(this.editorStore?.lastSavedAt)
      ? this.editorStore.lastSavedAt
      : NaN;
    const effectiveUpdated = Math.max(
      Number.isFinite(serverUpdated) ? serverUpdated : 0,
      Number.isFinite(lastSaved) ? lastSaved : 0,
    );

    if (Number.isFinite(effectiveUpdated) && effectiveUpdated > pubTime) {
      return 'color: var(--spectrum-global-color-orange-600);';
    }
    return nothing;
  }

  // Helper to check if element is authorable (custom element or slot element)
  isAuthorableElement(element) {
    if (!element || !element.tagName) return false;

    // Never treat the editor host itself as authorable
    if (element === this || String(element.tagName).toLowerCase() === 'experience-elements-editor') return false;

    // Ignore any content under <ee-reference>, except the ee-reference element itself
    const host = element.closest && element.closest('ee-reference');
    if (host && host !== element) {
      // Allow trigger slot content to remain authorable
      let n = element;
      let withinTrigger = false;
      while (n && n !== host) {
        if (n.getAttribute && n.getAttribute('slot') === 'trigger') {
          withinTrigger = true;
          break;
        }
        n = n.parentElement;
      }
      if (!withinTrigger) return false;
    }

    // Check if it's a custom element (has hyphen in tag name)
    if (element.tagName.includes('-')) {
      // This is a custom element - check if it's truly authorable
      const constructor = customElements.get(element.tagName.toLowerCase());
      if (constructor?.ee) {
        // This is an authorable custom element with ee configuration
        return true;
      }
      // It's a custom element but not authorable (no ee configuration)
      // Still return true to allow selection, but it won't have schema
      return true;
    }

    // For non-custom elements, check if element has a slot attribute
    // This makes regular HTML elements with slot attribute authorable as slot content
    if (element.hasAttribute('slot')) {
      // Verify the parent is a custom element that likely accepts this slot
      const parent = element.parentElement;
      if (parent && parent.tagName.includes('-')) {
        // Parent is a custom element that likely accepts this slot
        return true;
      }
    }

    return false;
  }

  // Simplified click handler for element selection
  handleElementClick(e) {
    const clickedTarget = e.target;
    const path = e.composedPath();
    const describeEl = (el) => {
      if (!el || !el.tagName) return null;
      const tag = el.tagName.toLowerCase();
      return { tag, id: el.id || null, slot: el.getAttribute ? el.getAttribute('slot') : null };
    };
    {
      const t = clickedTarget && clickedTarget.tagName ? clickedTarget.tagName.toLowerCase() : null;
      this.editorStore?.setUserAction?.('editor:click:capture', { tag: t, x: e.clientX, y: e.clientY });
    }

    // Ignore clicks originating from Spectrum dialogs/underlays so their
    // internal handlers (confirm/cancel) work without interference.
    const isFromSpectrumDialog = path.some((el) => {
      const tag = el && el.tagName;
      return (
        tag === 'SP-DIALOG-WRAPPER'
        || tag === 'SP-DIALOG'
        || tag === 'SP-UNDERLAY'
      );
    });
    if (isFromSpectrumDialog) return;

    const isToolbar = path.some(({ tagName }) => tagName === 'EE-TOOLBAR');
    if (isToolbar) {
      return;
    }

    // Check if click is within the toolbar or other UI elements
    const toolbar = this.shadowRoot?.querySelector('#editor-toolbar');
    const eeToolbar = this.shadowRoot?.querySelector('ee-toolbar');
    const leftSidebar = this.shadowRoot?.querySelector('ee-tree-nav');
    const rightSidebar = this.shadowRoot?.querySelector('#right-sidebar');

    // Check if the click originated from within ee-toolbar (including its shadow DOM)
    const clickFromEEToolbar = path.some((el) => (
      el.tagName === 'EE-TOOLBAR'
        || (el.host && el.host.tagName === 'EE-TOOLBAR')
    ), // Check shadow root host
    );

    if (clickFromEEToolbar) return; // let toolbar events bubble

    // Check if clicking on toolbar/left sidebar elements - ignore selection here
    if (
      toolbar?.contains(clickedTarget)
      || eeToolbar?.contains(clickedTarget)
      || leftSidebar?.contains(clickedTarget)
      || rightSidebar?.contains(clickedTarget)
    ) {
      return;
    }

    // Additionally guard clicks that fall within the right sidebar region
    // using simple geometry so we don't misclassify canvas clicks due to
    // composedPath shadow host artifacts.
    const rightOpen = !!(this.commentStore?.commentsPanelOpen || this.versionStore?.versionsPanelOpen);
    if (rightOpen && rightSidebar) {
      const r = rightSidebar.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return;
    }

    // Check if clicking within shadow root UI elements (not slot content)
    const isInShadowUI = path.some((el) => (
      el === toolbar
        || el === eeToolbar
        || el === leftSidebar
        || el === rightSidebar
        || (el.id
          && (el.id === 'editor-toolbar'
            || el.id === 'toolbar-left'
            || el.id === 'toolbar-center'
            || el.id === 'toolbar-right'))
        || el.tagName === 'SP-SIDENAV'
        || el.tagName === 'SP-SIDENAV-ITEM'
        || el.tagName === 'SP-TEXTFIELD'
        || el.tagName === 'SP-DIALOG-WRAPPER'
        || el.tagName === 'SP-DIALOG'
        || el.tagName === 'SP-UNDERLAY'
    ), // Check for textfield (fragment name)
    );

    if (isInShadowUI) return;

    // If clicking an interactive control in content, prevent its action but allow selection
    const isInteractiveContent = this.isInteractiveContentClick(path);
    if (isInteractiveContent) {
      e.stopPropagation();
      e.preventDefault();
    }

    // For all other clicks (element selection), stop propagation in capture phase
    e.stopPropagation();
    e.preventDefault();

    // Handle element selection logic here instead of delegating to store
    const selectedElement = this.findSelectableElement(clickedTarget, path, e.clientX, e.clientY);

    if (selectedElement) {
      this.editorStore?.setPendingCaretFromClick(e.clientX, e.clientY);
      this.editorStore?.setUserAction?.('editor:click', {
        x: e.clientX,
        y: e.clientY,
        target: describeEl(clickedTarget),
        selected: describeEl(selectedElement),
      });
      // Select the element (no auto-centering here)
      this.selectElement(selectedElement);

      // Record click trace for later debugging
      this.#lastClickInfo = {
        at: new Date().toISOString(),
        target: describeEl(clickedTarget),
        selected: describeEl(selectedElement),
        fromToolbar: !!clickFromEEToolbar,
        inShadowUI: !!isInShadowUI,
      };
      return false;
    }
    // No selectable element found - unselect current element
    // This happens when clicking outside surface wrapper or on non-authorable content
    this.selectElement(null);
    this.editorStore?.setUserAction?.('editor:click:empty', { x: e.clientX, y: e.clientY });

    // Record click trace for later debugging
    this.#lastClickInfo = {
      at: new Date().toISOString(),
      target: describeEl(clickedTarget),
      selected: null,
      fromToolbar: !!clickFromEEToolbar,
      inShadowUI: !!isInShadowUI,
    };
    return false;
  }

  // Treat clicks on common interactive controls in the authored content
  // as non-selecting and non-triggering within the editor.
  isInteractiveContentClick(path) {
    const interactiveTags = new Set([
      'A',
      'BUTTON',
      'INPUT',
      'SELECT',
      'TEXTAREA',
      'SP-BUTTON',
      'SP-ACTION-BUTTON',
      'SP-LINK',
      'CHECKOUT-BUTTON',
      'CHECKOUT-LINK',
    ]);

    const elems = Array.isArray(path) ? path : [];

    // 1) Generic interactive elements (anchors require href)
    for (const el of elems) {
      if (!el || !el.tagName) continue;
      const tn = el.tagName.toUpperCase();
      if (interactiveTags.has(tn)) {
        if (tn === 'A' && !el.getAttribute?.('href')) continue;
        return true;
      }
    }

    // 2) ee-reference trigger detection (robust across shadow boundaries)
    for (let i = 0; i < elems.length; i++) {
      const el = elems[i];
      if (!el || !el.tagName) continue;
      const slotName = el.getAttribute && el.getAttribute('slot');
      if (slotName === 'trigger') {
        // Ensure an ee-reference exists later in the path (ancestor)
        const hasEeRefAncestor = elems
          .slice(i + 1)
          .some((ancestor) => ancestor?.tagName === 'EE-REFERENCE');
        if (hasEeRefAncestor) return true;
      }
    }

    return false;
  }

  // Find the element that should be selected based on the click composed path
  findSelectableElement(clickedTarget, composedPath, clientX, clientY) {
    // Resolve composed path once for robust shadow/light DOM traversal
    const path = Array.isArray(composedPath)
      ? composedPath
      : (typeof clickedTarget?.getRootNode === 'function'
          && typeof clickedTarget?.composedPath === 'function')
        ? clickedTarget.composedPath()
        : [];

    // Canvas elements are assigned to the <slot> in #surface-content; selection should
    // work both when clicking on slotted light DOM or inside nested shadow DOM. We rely
    // on earlier UI guards (toolbar/sidebars) to scope clicks, so no hard surface gate here.
    const sr = this.shadowRoot;
    const surfaceWrapper = sr?.querySelector('#surface-wrapper');
    const surfaceContent = sr?.querySelector('#surface-content');
    const surfaceSlot = surfaceContent ? surfaceContent.querySelector('slot') : null;

    // Only consider nodes whose top-level light-DOM ancestor is slotted into #surface-content
    const isInSurface = (n) => {
      if (!n || !n.tagName) return false;
      if (!this.contains(n)) return false;
      let cur = n;
      while (cur && cur.parentElement && cur.parentElement !== this) cur = cur.parentElement;
      if (!(cur && cur.parentElement === this)) return false;
      return !!(surfaceSlot && cur.assignedSlot === surfaceSlot);
    };

    // Walk the path from the innermost target outwards and pick the first
    // authorable element that belongs to this editor subtree.
    for (const node of path) {
      if (!node || !node.tagName) continue;
      // Skip editor shadow UI elements (toolbar/sidebars handled earlier)
      if (node === surfaceWrapper || node === surfaceContent) continue;
      // Only consider nodes that are in, or slotted into, this editor
      if (!isInSurface(node)) continue;
      if (this.isAuthorableElement(node)) return node;
    }

    // Fallback: hit-test at the click point and select only if the element under the point is authorable
    const hit = (() => {
      const x = Number(clientX);
      const y = Number(clientY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const under = (document.elementsFromPoint?.(x, y) || []).filter(Boolean);
      if (!under.length) return null;
      const sr = this.shadowRoot;
      const surfaceWrapper = sr?.querySelector('#surface-wrapper');
      const surfaceContent = sr?.querySelector('#surface-content');
      for (const n of under) {
        if (!isInSurface(n)) continue;
        // Only select if the element under the point itself is authorable
        if (this.isAuthorableElement(n) && (this.contains(n) || !!n.assignedSlot)) return n;
      }
      return null;
    })();
    if (hit) return hit;

    return null;
  }

  // Helper to get parent chain for regular DOM elements
  getParentChain(element) {
    const chain = [];
    let current = element;
    while (current) {
      chain.push(current);
      current = current.parentElement;
    }
    return chain;
  }

  // Helper to get host chain for shadow DOM elements
  getHostChain(element) {
    const chain = [];
    let current = element.getRootNode().host;
    while (current) {
      chain.push(current);
      const root = current.getRootNode();
      current = root.host || null;
    }
    return chain;
  }

  // Minimal diagnostic snapshot of the editor, store, and toolbar
  get debugState() {
    const store = this.editorStore?.debugState || null;
    const toolbarEl = this.shadowRoot?.querySelector('ee-toolbar');
    const toolbar = toolbarEl?.debugState || null;
    const treeEl = this.shadowRoot?.querySelector('ee-tree-nav');
    const tree = treeEl?.debugState || null;
    // Canvas & surface diagnostics
    const sr = this.shadowRoot;
    const canvas = sr?.getElementById('canvas-container') || null;
    const surface = sr?.getElementById('surface-wrapper') || null;
    const canvasScroll = (() => {
      try {
        if (!canvas) return null;
        return {
          left: canvas.scrollLeft || 0,
          top: canvas.scrollTop || 0,
          width: canvas.scrollWidth || 0,
          height: canvas.scrollHeight || 0,
        };
      } catch (_) {
        return null;
      }
    })();
    const surfaceTransform = (() => {
      try {
        if (!surface) return null;
        const cs = getComputedStyle(surface);
        const t = cs.transform || 'none';
        if (!t || t === 'none') {
          return {
            scale: 1, translateX: 0, translateY: 0, matrix: 'none',
          };
        }
        const m = new DOMMatrixReadOnly(t);
        return {
          scale: Number.isFinite(m.a) ? m.a : 1,
          translateX: Number.isFinite(m.e) ? Math.round(m.e) : 0,
          translateY: Number.isFinite(m.f) ? Math.round(m.f) : 0,
          matrix: t,
        };
      } catch (_) {
        return null;
      }
    })();
    const controls = (() => {
      try {
        const h = store?.history || null;
        const undoDepth = h?.undoDepth || 0;
        const redoDepth = h?.redoDepth || 0;
        return {
          canUndo: undoDepth > 0,
          canRedo: redoDepth > 0,
          sidebarOpen: !!this.editorStore?.sidebarOpen,
          commentsOpen: !!this.commentStore?.commentsPanelOpen,
          themeColor: this.store?.themeColor || null,
          zoom: surfaceTransform?.scale ?? 1,
        };
      } catch (_) {
        return null;
      }
    })();
    const doc = (() => {
      try {
        return {
          id: this.store?.editorStore?.currentElementId || null,
          name: this.store?.currentElement?.name || null,
          childCount: this.children ? this.children.length : 0,
        };
      } catch (_) {
        return null;
      }
    })();
    return {
      when: new Date().toISOString(),
      document: doc,
      editor: {
        hasChildElements: this.hasChildElements(),
        canvasScroll,
        surfaceTransform,
      },
      lastClick: this.#lastClickInfo || null,
      controls,
      store,
      tree,
      toolbar,
    };
  }

  // Dump the diagnostic snapshot to console, clipboard, or return it
  dumpState(options = {}) {
    const {
      to = 'console',
      includeToolbar = true,
      copyPretty = true,
    } = options || {};
    const snapshot = this.debugState;
    if (!includeToolbar && snapshot && snapshot.toolbar) {
      delete snapshot.toolbar;
    }
    if (to === 'return') return snapshot;
    const text = copyPretty
      ? JSON.stringify(snapshot, null, 2)
      : JSON.stringify(snapshot);
    if (to === 'clipboard') {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      return snapshot;
    }
    // Default to console
    console.log('[EE-Editor] Debug State:', snapshot);
    return snapshot;
  }

  onThemeSwitch(e) {
    const checked = !!e?.target?.checked;
    this.store?.setThemeColor(checked ? 'dark' : 'light');
  }

  // (removed) trigger/schedule water drop animation

  handleKeyDown(e) {
    // Fast-path Esc: delegate to store and stop
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      this.editorStore?.handleEscape?.();
      return;
    }
    // Ignore shortcuts while typing in any text-entry control (inputs, textareas, shadow inputs, or contenteditable)
    const path = e.composedPath?.() ?? [];
    const isTyping = () => {
      try {
        if (!path || !Array.isArray(path)) {
          const t = e.target;
          return (
            t
            && (t.tagName === 'INPUT'
              || t.tagName === 'TEXTAREA'
              || t.isContentEditable === true
              || (t.getAttribute && t.getAttribute('role') === 'textbox'))
          );
        }
        for (const n of path) {
          // Check actual native text controls
          if (
            n
            && (n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement)
          ) return true;
          // Any contenteditable container
          if (n && n.isContentEditable === true) return true;
          // ARIA textbox roles (e.g., spectrum components)
          if (n && n.getAttribute && n.getAttribute('role') === 'textbox') return true;
        }
        return false;
      } catch (_) {
        // Fallback to simple target checks
        const t = e.target;
        return (
          t
          && (t.tagName === 'INPUT'
            || t.tagName === 'TEXTAREA'
            || t.isContentEditable === true)
        );
      }
    };
    if (isTyping()) return;
    // Cmd/Ctrl + Z: Undo
    if (
      (e.metaKey || e.ctrlKey)
      && !e.shiftKey
      && e.key.toLowerCase() === 'z'
    ) {
      e.preventDefault();
      this.performUndo();
    }
    // Cmd/Ctrl + Shift + Z: Redo
    else if (
      (e.metaKey || e.ctrlKey)
      && e.shiftKey
      && e.key.toLowerCase() === 'z'
    ) {
      e.preventDefault();
      this.performRedo();
    }
    // Arrow keys: no panning; surface is not draggable
    // Cmd/Ctrl + Shift + D: Dump debug state
    else if (
      (e.metaKey || e.ctrlKey)
      && e.shiftKey
      && (e.key === 'D' || e.key === 'd')
    ) {
      e.preventDefault();
      try {
        this.dumpState({ to: 'console', includeToolbar: true });
      } catch (_) {}
    }
  }

  handleKeyUp(e) {
    // Space-to-pan disabled
  }

  /**
   * Undo/Redo Methods
   */

  performUndo() {
    if (this.editorStore) {
      this.editorStore.undo();
    }
  }

  performRedo() {
    if (this.editorStore) {
      this.editorStore.redo();
    }
  }
}

customElements.define(
  'experience-elements-editor',
  makeLitObserver(ExperienceElementsEditor),
);

export { ExperienceElementsEditor };

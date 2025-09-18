import { LitElement, html, nothing } from "lit";
import { eeVersionsPanelStyles } from "./ee-versions-panel.css.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { makeLitObserver } from "picosm";
import { sanitizeTree } from "../utils/sanitize.js";











export class EEVersionsPanel extends LitElement {
  static get styles() { return eeVersionsPanelStyles; }
  static get properties() {
    return {
      versionStore: { type: Object, observe: true },
      store: { type: Object, observe: true },
      createOpen: { type: Boolean, state: true },
      createName: { type: String, state: true },
      confirmOpen: { type: Boolean, state: true },
      confirmTarget: { type: Object, state: true },
      comparePos: { type: Number, state: true },
      revealSide: { type: String, state: true },
      renamingId: { type: String, state: true },
      renameValue: { type: String, state: true },
    };
  }
  constructor() {
    super();
    this.createOpen = false;
    this.createName = "";
    this.confirmOpen = false;
    this.confirmTarget = null;
    this.leftDiffHTML = "";
    this.rightDiffHTML = "";
    this.comparePos = 0.5;
    this.revealSide = 'right';
    this.renamingId = null;
    this.renameValue = "";
  }
  sanitizeNode(node) {
    if (!node) return;
    // Remove script/style and event handlers
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'script') { el.remove(); return; }
      // Remove inline event handlers
      for (const name of Array.from(el.getAttributeNames())) {
        if (name.toLowerCase().startsWith('on')) el.removeAttribute(name);
      }
      // Recurse children
      for (const child of Array.from(el.childNodes)) this.sanitizeNode(child);
    }
  }

  parseHTMLToContainer(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ''), 'text/html');
    const wrapper = document.createElement('div');
    for (const child of Array.from(doc.body.childNodes)) {
      const clone = child.cloneNode(true);
      wrapper.appendChild(clone);
    }
    this.sanitizeNode(wrapper);
    return wrapper;
  }

  onRequestRestore(v) {
    this.store?.setUserAction?.("version:requestRestore", { id: v?.id, name: v?.name });
    this.confirmTarget = { ...v, _loading: true, _snapshot: null };
    this.confirmOpen = true;
    this.comparePos = 0.5;
    this.leftDiffHTML = "";
    this.rightDiffHTML = "";
    // Load snapshot for diff preview
    (async () => {
      try {
        const host = this.getRootNode()?.host;
        const urn = host?.store?.editorStore?.currentElementId;
        const details = await this.versionStore?.documentStore?.getVersionDetails?.(urn, v.id);
        this.confirmTarget = { ...v, _loading: false, _snapshot: details?.snapshot_html || '' };
        // Build visual DOM diff
        // IMPORTANT: Use sanitized current editor DOM (like editor-store) for the "Current" side
        let currentHtml = '';
        try {
          const appStore = host?.store;
          const root = host?.firstElementChild;
          if (root && appStore?.documentStore?.serializeElement) {
            const clone = root.cloneNode(true);
            sanitizeTree(clone, { currentDocumentId: urn, beforeSave: true, showToast: () => {} });
            currentHtml = appStore.documentStore.serializeElement(clone);
          } else {
            currentHtml = host?.store?.currentElement?.html || '';
          }
        } catch (_) {
          currentHtml = host?.store?.currentElement?.html || '';
        }

        const leftRoot = this.parseHTMLToContainer(currentHtml);
        const rightRoot = this.parseHTMLToContainer(this.confirmTarget._snapshot || '');
        // Ensure both sides are sanitized consistently to avoid false positives
        try { sanitizeTree(leftRoot, { currentDocumentId: urn, beforeSave: true, showToast: () => {} }); } catch (_) {}
        try { sanitizeTree(rightRoot, { currentDocumentId: urn, beforeSave: true, showToast: () => {} }); } catch (_) {}
        this.leftDiffHTML = leftRoot.innerHTML;
        this.rightDiffHTML = rightRoot.innerHTML;
      } catch (e) {
        this.confirmTarget = { ...v, _loading: false, _snapshot: null };
        try { this.getRootNode()?.host?.showToast?.('Failed to load version details'); } catch (_) {}
      }
    })();
  }

  get versions() { return Array.isArray(this.versionStore?.versions) ? this.versionStore.versions : []; }

  connectedCallback() {
    super.connectedCallback();
    // Refresh when panel mounts
    (async () => {
      try {
        await this.versionStore?.refreshVersions?.();
      } catch (e) {
        try { this.getRootNode()?.host?.showToast?.('Failed to load versions'); } catch (_) {}
      }
    })();
  }

  formatFriendlyTime(dateInput) {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "";
      const now = Date.now();
      const diff = now - d.getTime();
      if (diff < 60_000) return "Just now";
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
      if (diff < 172_800_000) return "Yesterday";
      if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} days ago`;
      return d.toLocaleDateString();
    } catch (_) {
      return "";
    }
  }

  async onCreateVersion() {
    const name = (this.createName || "").trim();
    if (!name) {
      try { this.getRootNode()?.host?.showToast?.('Please enter a version name'); } catch (_) {}
      return;
    }
    // Client-side cap
    const capped = name.length > 256 ? name.slice(0, 256) : name;
    try {
      this.store?.setUserAction?.("version:create", { name: capped });
      await this.versionStore?.createVersion?.(capped);
      this.createOpen = false;
      this.createName = "";
      try { this.getRootNode()?.host?.showToast?.('Version created'); } catch (_) {}
    } catch (e) {
      try { this.getRootNode()?.host?.showToast?.('Failed to create version'); } catch (_) {}
    }
  }

  

  async onConfirmRestore() {
    const v = this.confirmTarget;
    this.confirmOpen = false;
    if (!v) return;
    try {
      this.store?.setUserAction?.("version:restore", { id: v.id, name: v.name });
      const host = this.getRootNode()?.host;
      const urn = host?.store?.editorStore?.currentElementId;
      const restored = await this.versionStore?.documentStore?.restoreVersion?.(urn, v.id);
      try { host?.showToast?.(`Restored version \"${v.name}\"`); } catch (_) {}
      // Update the current element in-place using the server response to avoid stale content
      try {
        if (restored && typeof restored === 'object' && restored.html) {
          const prev = host?.store?.currentElement || {};
          host?.store?.setCurrentElement?.({ ...prev, ...restored });
          // Proactively refresh the canvas to avoid stale DOM
          try { host?.loadEditorContent?.(); } catch (_) {}
          // Also refresh comments silently from the restored snapshot
          const comments = Array.isArray(restored.comments) ? restored.comments : [];
          host?.commentStore?.setComments?.(comments, { silent: true });
        } else {
          // Fallback: reload via openElement if response missing
          await host?.store?.openElement?.(urn);
        }
      } catch (_) {}
      // Wait for the editor to finish rendering restored content, then schedule autosave
      try { await host?.updateComplete; } catch (_) {}
      host?.store?.editorStore?.scheduleAutoSave?.();
    } catch (e) {
      try { this.getRootNode()?.host?.showToast?.('Failed to restore version'); } catch (_) {}
    }
  }

  renderHeader() {
    const count = this.versions.length;
    return html`
      <div id="header">
        <h3>Versions (${count})</h3>
        <sp-action-button quiet title="Close" @click=${() => { this.store?.setUserAction?.("version:closePanel", {}); this.versionStore?.closeVersionsPanel?.(); }}>
          <sp-icon-close slot="icon"></sp-icon-close>
        </sp-action-button>
        <span class="spacer"></span>
      </div>
    `;
  }

  renderComposer() {
    if (!this.createOpen) return nothing;
    return html`
      <div id="composer">
        <sp-textfield
          id="version-name"
          placeholder="Version name"
          value=${this.createName}
          @input=${(e) => (this.createName = e.target.value)}
          @keydown=${(e) => {
            if (e.key === 'Enter') this.onCreateVersion();
            if (e.key === 'Escape') { this.createOpen = false; this.createName = ''; }
          }}
        ></sp-textfield>
        <sp-button variant="primary" @click=${() => this.onCreateVersion()}>Create</sp-button>
      </div>
    `;
  }

  renderList() {
    if (!this.versions.length) return html`<div class="muted" style="padding: 8px;">No versions yet.</div>`;
    return html`
      <div id="list">
        ${this.versions.map((v) => html`
          <div class="item">
            <div class="row">
              ${this.renamingId === v.id
                ? html`
                    <sp-textfield
                      id="rename-version-${v.id}"
                      value=${this.renameValue}
                      @input=${(e) => (this.renameValue = e.target.value)}
                      @keydown=${(e) => { if (e.key === 'Enter') this.onConfirmRename(v); if (e.key === 'Escape') this.onCancelRename(); }}
                      placeholder="Version name"
                      size="m"
                    ></sp-textfield>
                  `
                : html`<span
                    class="name"
                    role="button"
                    tabindex="0"
                    title="Rename version"
                    @click=${() => this.onStartRename(v)}
                    @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onStartRename(v); } }}
                  >${v.name}</span>`}
              <span class="muted">${this.formatFriendlyTime(v.created)}</span>
              ${this.renderAuthor(v)}
              <span class="spacer"></span>
              ${this.renamingId === v.id
                ? html`
                    <sp-action-button quiet size="s" title="Save" @click=${() => this.onConfirmRename(v)}>
                      <sp-icon-checkmark-circle slot="icon"></sp-icon-checkmark-circle>
                    </sp-action-button>
                    <sp-action-button quiet size="s" title="Cancel" @click=${() => this.onCancelRename()}>
                      <sp-icon-close slot="icon"></sp-icon-close>
                    </sp-action-button>
                  `
                : nothing}
              ${this.renamingId === v.id
                ? nothing
                : html`<sp-action-button quiet size="s" title="Restore" @click=${() => this.onRequestRestore(v)}>
                    <sp-icon-revert slot="icon"></sp-icon-revert>
                  </sp-action-button>`}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  onStartRename(v) {
    this.renamingId = v?.id || null;
    this.renameValue = v?.name || '';
    this.updateComplete.then(() => {
      const input = this.renderRoot?.querySelector?.(`#rename-version-${v.id}`);
      if (input) input.focus();
    });
  }
  async onConfirmRename(v) {
    const name = (this.renameValue || '').trim();
    if (!name) return;
    await this.versionStore?.renameVersion?.(v.id, name);
    this.renamingId = null;
    this.renameValue = '';
  }
  onCancelRename() {
    this.renamingId = null;
    this.renameValue = '';
  }

  renderAuthor(v) {
    try {
      const email = (this.getRootNode()?.host?.userStore?.currentUser?.email || '').toLowerCase();
      const vEmail = (v.author_email || '').toLowerCase();
      const name = v.author_name || v.author_email || '';
      const label = email && vEmail && email === vEmail ? 'You' : name;
      return label ? html`<span class="muted">by ${label}</span>` : nothing;
    } catch (_) { return nothing; }
  }

  render() {
    return html`
      <div id="panel-root">
        ${this.renderHeader()}
        ${this.createOpen
          ? nothing
          : html`<sp-button variant="primary" size="m" @click=${() => (this.createOpen = true)}>
              <sp-icon-add slot="icon"></sp-icon-add>
              New version
            </sp-button>`}
        ${this.renderComposer()}
        ${this.renderList()}
        ${this.confirmDialogUI}
      </div>
    `;
  }

  get confirmDialogUI() {
    if (!this.confirmOpen) return nothing;
    const loading = !!this.confirmTarget?._loading;
    return html`
      <overlay-trigger
        id="restore-overlay"
        type="modal"
        triggered-by="click"
        receives-focus="auto"
        .open=${'click'}
        @sp-closed=${() => (this.confirmOpen = false)}
      >
        <span slot="trigger" id="compare-trigger-anchor" style="position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0"></span>
        <sp-dialog-wrapper
          id="compare-dialog"
          slot="click-content"
          dismissable
          dismiss-label="Close"
          underlay
          mode="fullscreen"
          headline="Restore version?"
          confirm-label="Restore"
          cancel-label="Cancel"
          @confirm=${() => this.onConfirmRestore()}
          @cancel=${() => (this.confirmOpen = false)}
          @close=${() => (this.confirmOpen = false)}
        >
          ${loading
            ? html`<div class="muted">Loading diff...</div>`
            : html`${this.compareUI}`}
        </sp-dialog-wrapper>
      </overlay-trigger>
    `;
  }

  get comparePercent() {
    const x = Number.isFinite(this.comparePos) ? this.comparePos : 0.5;
    return Math.min(100, Math.max(0, Math.round(x * 100)));
  }

  get compareUI() {
    const pct = this.comparePercent;
    const dividerLeft = `${pct}%`;
    const revealClass = this.revealSide === 'left' ? 'reveal-left' : 'reveal-right';
    const revealFromRight = this.revealSide !== 'left';
    const leftLegend = revealFromRight ? 'Selected' : 'Current';
    const rightLegend = revealFromRight ? 'Current' : 'Selected';
    return html`
      <div
        id="compare-viewport"
      >
        <div
          id="compare-scene"
          style=${`--divider-percent: ${dividerLeft};`}
          @pointerdown=${this.onComparePointerDown}
          @keydown=${this.onCompareKeyDown}
          role="slider"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${pct}
          aria-label="Version compare divider"
          tabindex="0"
        >
          <div id="compare-legend" aria-hidden="true">
            <span class="legend-left">${leftLegend}</span>
            <span class="legend-right">${rightLegend}</span>
          </div>
          <div id="compare-divider" aria-hidden="true"></div>
          <div id="compare-before" class="compare-layer">
            <div class="compare-content">${unsafeHTML(this.leftDiffHTML || '')}</div>
          </div>
          <div id="compare-after" class=${`compare-layer compare-after-clip ${revealClass}`}>
            <div class="compare-content">${unsafeHTML(this.rightDiffHTML || '')}</div>
          </div>
          <canvas id="compare-canvas" aria-hidden="true"></canvas>
        </div>
      </div>
    `;
  }

  onCompareKeyDown = (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.comparePos = Math.max(0, (this.comparePos || 0.5) - step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.comparePos = Math.min(1, (this.comparePos || 0.5) + step);
    }
  };

  onComparePointerDown = (e) => {
    this.#isDraggingCompare = true;
    const move = (ev) => this.#updateCompareFromPointer(ev);
    const up = () => {
      this.#isDraggingCompare = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.#updateCompareFromPointer(e);
  };

  #isDraggingCompare = false;
  #updateCompareFromPointer(e) {
    const scene = this.#qs('#compare-scene');
    if (!scene) return;
    const rect = scene.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = x / Math.max(1, rect.width);
    this.comparePos = Math.min(1, Math.max(0, pos));
  }

  updated(changed) {
    if (changed.has('leftDiffHTML') || changed.has('rightDiffHTML') || changed.has('confirmOpen')) {
      // Ensure the scene has enough height to contain the tallest layer
      const scene = this.#qs('#compare-scene');
      const before = this.#qs('#compare-before .compare-content');
      const after = this.#qs('#compare-after .compare-content');
      const viewport = this.#qs('#compare-viewport');
      if (!scene || !before || !after) return;
      // Measure after render
      requestAnimationFrame(() => {
        const h = Math.max(
          before.scrollHeight || 0,
          after.scrollHeight || 0,
          viewport ? viewport.clientHeight : 0
        );
        scene.style.height = h ? `${h}px` : '';
        // After height settles, refresh canvas overlay sizing/paint
        this.#renderCanvasOverlay();
      });
    }
    if (changed.has('confirmOpen')) {
      if (this.confirmOpen) {
        this.#onWindowResize = this.#onWindowResize || (() => { this.#recomputeCompareHeight(); this.#renderCanvasOverlay(); });
        window.addEventListener('resize', this.#onWindowResize);
        // Observe dynamic content size changes (images, fonts, async DOM)
        this.#ensureContentResizeObserver();
        // Initial ensure
        this.#recomputeCompareHeight();
        this.#renderCanvasOverlay();
        // Open overlay explicitly and then focus scene for keyboard control
        requestAnimationFrame(() => {
          const ot = this.shadowRoot && this.shadowRoot.getElementById('restore-overlay');
          if (ot) {
            try { ot.open = 'click'; } catch (_) {}
          }
          const scene = this.#qs('#compare-scene');
          if (scene && typeof scene.focus === 'function') scene.focus();
        });
      } else {
        if (this.#onWindowResize) {
          window.removeEventListener('resize', this.#onWindowResize);
        }
        this.#teardownContentResizeObserver();
      }
    }
    if (changed.has('comparePos')) {
      this.#renderCanvasOverlay();
    }
  }

  #onWindowResize;
  #resizeObserver;
  #observedNodes = [];
  #ensureContentResizeObserver() {
    if (!this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(() => {
        this.#recomputeCompareHeight();
        this.#renderCanvasOverlay();
      });
    }
    const before = this.#qs('#compare-before .compare-content');
    const after = this.#qs('#compare-after .compare-content');
    const viewport = this.#qs('#compare-viewport');
    const targets = [before, after, viewport].filter(Boolean);
    // Avoid duplicate observes
    for (const el of targets) {
      if (!this.#observedNodes.includes(el)) {
        this.#resizeObserver.observe(el);
        this.#observedNodes.push(el);
      }
    }
  }
  #teardownContentResizeObserver() {
    if (this.#resizeObserver) {
      for (const el of this.#observedNodes) {
        try { this.#resizeObserver.unobserve(el); } catch (_) {}
      }
    }
    this.#observedNodes = [];
  }
  #recomputeCompareHeight() {
    const scene = this.#qs('#compare-scene');
    const before = this.#qs('#compare-before .compare-content');
    const after = this.#qs('#compare-after .compare-content');
    const viewport = this.#qs('#compare-viewport');
    if (!scene || !before || !after) return;
    const vpH = viewport ? viewport.clientHeight : 0;
    const h = Math.max(before.scrollHeight || 0, after.scrollHeight || 0, vpH);
    scene.style.height = h ? `${h}px` : '';
    // Also update canvas overlay sizing when heights change
    this.#renderCanvasOverlay();
  }

  #renderCanvasOverlay() {
    const scene = this.#qs('#compare-scene');
    const canvas = this.#qs('#compare-canvas');
    if (!scene || !canvas) return;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(scene.clientWidth));
    // Use full scrollHeight to ensure the divider spans full content height
    const h = Math.max(1, Math.floor(scene.scrollHeight));
    // Set canvas CSS size
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    // Set backing store size
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw a subtle gradient around the divider for depth
    const x = Math.round((this.comparePos || 0.5) * canvas.width);
    const band = Math.max(32 * dpr, 1);
    const left = Math.max(0, x - band);
    const right = Math.min(canvas.width, x + band);
    const borderColor = this.#getCssVarColor('--spectrum-alias-border-color') || this.#getCssVarColor('--spectrum-global-color-gray-700') || 'rgb(0,0,0)';
    const grad = ctx.createLinearGradient(left, 0, right, 0);
    grad.addColorStop(0, this.#colorWithAlpha(borderColor, 0.0));
    grad.addColorStop(0.5, this.#colorWithAlpha(borderColor, 0.25));
    grad.addColorStop(1, this.#colorWithAlpha(borderColor, 0.0));
    ctx.fillStyle = grad;
    ctx.fillRect(left, 0, right - left, canvas.height);
  }

  #getCssVarColor(name) {
    const scene = this.#qs('#compare-scene');
    if (!scene) return '';
    const v = getComputedStyle(scene).getPropertyValue(name);
    return (v || '').trim();
  }
  #colorWithAlpha(color, alpha) {
    // Supports 'rgb(r,g,b)', 'rgba(r,g,b,a)', or '#rrggbb'
    const c = (color || '').trim();
    if (!c) return `rgba(0,0,0,${alpha})`;
    if (c.startsWith('rgba')) {
      // replace alpha
      const parts = c
        .slice(c.indexOf('(') + 1, c.lastIndexOf(')'))
        .split(',')
        .map((p) => p.trim());
      if (parts.length >= 3) {
        const [r,g,b] = parts;
        return `rgba(${parseInt(r,10)||0}, ${parseInt(g,10)||0}, ${parseInt(b,10)||0}, ${alpha})`;
      }
    }
    if (c.startsWith('rgb')) {
      const parts = c
        .slice(c.indexOf('(') + 1, c.lastIndexOf(')'))
        .split(',')
        .map((p) => p.trim());
      if (parts.length >= 3) {
        const [r,g,b] = parts;
        return `rgba(${parseInt(r,10)||0}, ${parseInt(g,10)||0}, ${parseInt(b,10)||0}, ${alpha})`;
      }
    }
    if (c[0] === '#' && (c.length === 7)) {
      const r = parseInt(c.slice(1,3), 16) || 0;
      const g = parseInt(c.slice(3,5), 16) || 0;
      const b = parseInt(c.slice(5,7), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // Fallback: as-is, relying on browser parsing with globalAlpha if needed
    return `rgba(0,0,0,${alpha})`;
  }

  #qs(selector) {
    // When using overlay-trigger, the dialog is teleported to overlay root.
    // Prefer querying within the dialog; fallback to shadowRoot for SSR/tests.
    const dialog = document.getElementById('compare-dialog');
    if (dialog) return dialog.querySelector(selector);
    return this.shadowRoot ? this.shadowRoot.querySelector(selector) : null;
  }
}

customElements.define("ee-versions-panel", makeLitObserver(EEVersionsPanel));

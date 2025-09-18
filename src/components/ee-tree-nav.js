import { LitElement, html, nothing } from "lit";
import { eeTreeNavStyles } from "./ee-tree-nav.css.js";
import { reaction } from "picosm";

// Spectrum bits used for controls and icons











import { html as staticHtml, unsafeStatic } from "lit/static-html.js";

export class EETreeNav extends LitElement {
  static get styles() {
    return eeTreeNavStyles;
  }

  static get properties() {
    return {
      store: { type: Object },
      tree: { type: Object },
      searchQuery: { type: String },
      selectedElement: { type: Object },
      selectedSlot: { type: String },
      centerOn: { type: Object },
      hideSidebar: { type: Object },
      focusedKey: { type: String },
      // Toggle detailed debug output included via debugState
      debugEnabled: { type: Boolean, reflect: true, attribute: 'debug' },
    };
  }

  constructor() {
    super();
    this.store = null;
    this.tree = null;
    this.searchQuery = "";
    this.selectedElement = null;
    this.selectedSlot = null;

    this._expanded = new Set();
    this._elKeyMap = new WeakMap();
    this._elKeySeq = 1;
    this.focusedKey = null;
    this._typeahead = "";
    this._typeaheadTimer = null;
    // Keep keyboard navigation active for a short time after interacting with the tree
    this.#navActive = false;
    this.#navActiveTimer = null;
    this.debugEnabled = false;
    this._dropIndicator = null; // { key, pos: 'before'|'after' }
    this._expandHoverTimer = null;
    this._expandHoverKey = null;
    this._autoScrollRAF = null;
    this._autoScrollVelocity = 0; // px per frame (sign indicates direction)
  }

  // Private state
  #navActive;
  #navActiveTimer;
  #onDocKeyDown;

  connectedCallback() {
    super.connectedCallback();
    // Attach selection reaction if store is already present
    this.#attachStoreReaction();
    // Listen for Escape anywhere within the tree component (use capture to avoid being blocked)
    this.addEventListener('keydown', this.onHostKeyDown, true);
    // When clicking whitespace in the tree, ensure a row receives focus so ESC works
    this.addEventListener('click', this.onHostClick, true);
    // Global capture for arrow navigation when the tree is the last active navigator
    this.#onDocKeyDown = (e) => this.onDocumentKeyDown(e);
    document.addEventListener('keydown', this.#onDocKeyDown, true);
  }

  // Debug snapshot of tree state and nodes
  get debugState() {
    try {
      const root = this.filteredTree || this.tree || null;
      const selectionKey = this.selectionKey;
      const focusedKey = this.focusedKey || null;
      const expandedKeys = Array.from(this._expanded || []);
      // Summaries
      let total = 0;
      const countAll = (n) => { if (!n) return; total += 1; (n.children||[]).forEach(countAll); };
      if (root) countAll(root);
      // Visible list (depth-first order)
      const visible = [];
      const walkVisible = (n, depth = 0) => {
        if (!n) return;
        visible.push({ key: this.getKeyFor(n), depth });
        const hasChildren = Array.isArray(n.children) && n.children.length > 0;
        if (hasChildren && this.isExpanded(n)) {
          n.children.forEach((c) => walkVisible(c, depth + 1));
        }
      };
      if (root) walkVisible(root, 0);
      const keyMap = this.getKeyNodeMap();
      const summarizeNode = (n) => {
        const isSlot = n && n.kind === 'slot';
        const el = isSlot ? n.parentElement : n.element;
        const tag = el?.tagName?.toLowerCase?.() || null;
        const id = el?.id || null;
        const slotName = isSlot ? n.slotName : null;
        return { kind: isSlot ? 'slot' : 'element', label: n?.label || '', tag, id, slotName, childCount: Array.isArray(n?.children) ? n.children.length : 0 };
      };
      const visibleNodes = this.debugEnabled
        ? visible.map(({ key, depth }) => ({ key, depth, ...summarizeNode(keyMap.get(key)) }))
        : null;
      return {
        debugEnabled: !!this.debugEnabled,
        totals: { totalNodes: total, visibleNodes: visible.length, expanded: expandedKeys.length },
        selectionKey,
        focusedKey,
        expandedKeys,
        // Only include full per-node details when debug is enabled
        nodes: visibleNodes,
      };
    } catch (_) {
      return { debugEnabled: !!this.debugEnabled };
    }
  }

  clearTreeFocus() {
    try {
      this.focusedKey = null;
      this.#navActive = false;
      try { this.removeAttribute('data-nav-active'); } catch (_) {}
      // Remove DOM focus from any focused row inside the tree
      const active = this.shadowRoot?.activeElement;
      if (active && active.classList && active.classList.contains('node-row')) {
        try { active.blur(); } catch (_) {}
      }
      // Also remove any transient [focused] attributes by re-rendering
      this.requestUpdate();
    } catch (_) {}
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
    this.removeEventListener('keydown', this.onHostKeyDown, true);
    this.removeEventListener('click', this.onHostClick, true);
    try { document.removeEventListener('keydown', this.#onDocKeyDown, true); } catch (_) {}
    this.#onDocKeyDown = null;
    this.clearExpandHoverTimer();
    this._dropIndicator = null;
    this.stopAutoScroll();
  }

  updated(changed) {
    super.updated?.(changed);
    // If store was assigned after connect, attach reaction now
    if (changed.has('store')) this.#attachStoreReaction();
    // Ensure there is always a tabbable row
    const visible = this.getVisibleKeys();
    if (!visible.length) return;
    if (!this.focusedKey || !visible.includes(this.focusedKey)) {
      this.focusedKey = visible[0];
      // do not force focus here; allow natural tab to first item
    }
  }

  // Ensure we react to selection changes even if store is provided post-connect
  #attachStoreReaction() {
    if (!this.store) return;
    if (this._cleanup) return; // already attached
    this._cleanup = reaction(
      this.store,
      (s) => [s.editingElement, s.currentSlot],
      () => {
        if (!this.store?.editingElement && !this.store?.currentSlot) {
          this.clearTreeFocus();
        } else {
          this.scrollSelectionIntoView();
        }
      }
    );
  }

  // Compute a unique selection key so exactly one row is selected at a time
  get selectionKey() {
    try {
      const el = this.store?.editingElement || null;
      const slot = this.store?.currentSlot || null;
      if (el && slot) {
        const key = this.getElementKey(el);
        return key ? `slot:${key}:${slot}` : null;
      }
      if (el) {
        const key = this.getElementKey(el);
        return key ? `el:${key}` : null;
      }
    } catch (_) {}
    return null;
  }

  // Compute the filtered tree (based on query)
  get filteredTree() {
    return this.filterTree(this.tree, this.searchQuery);
  }

  // Flatten visible nodes according to current expansion state
  getVisibleKeys() {
    const out = [];
    const walk = (n) => {
      if (!n) return;
      const key = this.getKeyFor(n);
      out.push(key);
      const hasChildren = n.children && n.children.length > 0;
      if (hasChildren && this._expanded.has(key)) {
        n.children.forEach(walk);
      }
    };
    const root = this.filteredTree;
    if (Array.isArray(root)) root.forEach((r) => walk(r));
    else if (root) walk(root);
    return out;
  }

  getParentMap() {
    const map = new Map();
    const walk = (n, parentKey = null) => {
      if (!n) return;
      const key = this.getKeyFor(n);
      if (parentKey) map.set(key, parentKey);
      (n.children || []).forEach((c) => walk(c, key));
    };
    const root = this.filteredTree;
    if (Array.isArray(root)) root.forEach((r) => walk(r, null));
    else if (root) walk(root, null);
    return map;
  }

  getKeyNodeMap() {
    const map = new Map();
    const walk = (n) => {
      if (!n) return;
      const key = this.getKeyFor(n);
      map.set(key, n);
      (n.children || []).forEach(walk);
    };
    const root = this.filteredTree;
    if (Array.isArray(root)) root.forEach((r) => walk(r));
    else if (root) walk(root);
    return map;
  }

  focusRowByKey(key, { focus = true, scroll = true } = {}) {
    if (!key) return;
    this.focusedKey = key;
    const tryFocus = () => {
      const row = this.renderRoot?.querySelector?.(
        `[data-node-key="${key}"] > .node-row`
      );
      if (!row) return false;
      if (focus) row.focus();
      if (scroll) row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return true;
    };
    if (!tryFocus()) {
      this.updateComplete.then(() => {
        tryFocus();
      });
    }
  }

  getKeyFor(node) {
    if (!node) return null;
    if (node.kind === "slot") {
      const pKey = this.getElementKey(node.parentElement);
      return `slot:${pKey}:${node.slotName}`;
    }
    return `el:${this.getElementKey(node.element)}`;
  }

  getElementKey(el) {
    if (!el || typeof el !== "object") return null;
    let key = this._elKeyMap.get(el);
    if (!key) {
      key = this._elKeySeq++;
      this._elKeyMap.set(el, key);
    }
    return key;
  }

  isExpanded(node) {
    return this._expanded.has(this.getKeyFor(node));
  }

  setExpanded(node, expanded) {
    const key = this.getKeyFor(node);
    if (!key) return;
    const was = this._expanded.has(key);
    if (expanded && !was) this._expanded.add(key);
    if (!expanded && was) this._expanded.delete(key);
    // Animate children container
    this.animateNodeChildren(node, !!expanded);
    this.requestUpdate();
  }

  toggleExpanded(node) {
    this.setExpanded(node, !this.isExpanded(node));
  }

  animateNodeChildren(node, expanded) {
    try {
      const key = this.getKeyFor(node);
      const el = this.renderRoot?.querySelector?.(
        `[data-node-key="${key}"] > .children`
      );
      if (!el) return;

      // Clean up any previous handler for stability on rapid toggles
      if (el._eeOnHeightEnd) {
        try { el.removeEventListener('transitionend', el._eeOnHeightEnd); } catch (_) {}
        el._eeOnHeightEnd = null;
      }

      const endHandler = (ev) => {
        if (!ev || ev.propertyName === 'height') {
          if (expanded) {
            // Allow natural layout when expanded
            el.style.height = 'auto';
          }
          try { el.removeEventListener('transitionend', endHandler); } catch (_) {}
          el._eeOnHeightEnd = null;
        }
      };

      if (expanded) {
        // Expand: animate from 0 -> scrollHeight
        // Ensure starting height is 0 without relying on [collapsed] overriding inline styles
        el.style.height = '0px';
        // Remove collapsed to restore visibility and transitions
        el.removeAttribute('collapsed');
        // Next frame, set to the measured content height to trigger the animation
        requestAnimationFrame(() => {
          try {
            el.style.height = `${el.scrollHeight}px`;
          } catch (_) {}
        });
        el.addEventListener('transitionend', endHandler);
        el._eeOnHeightEnd = endHandler;
      } else {
        // Collapse: animate from current height -> 0
        const currentH = el.scrollHeight || el.getBoundingClientRect().height || 0;
        el.style.height = `${currentH}px`;
        // Force reflow to ensure the starting height is applied
        // eslint-disable-next-line no-unused-expressions
        el.offsetHeight;
        // Now animate to 0
        el.style.height = '0px';
        // Also mark as collapsed for opacity/transform styles
        el.setAttribute('collapsed', '');
        el.addEventListener('transitionend', endHandler);
        el._eeOnHeightEnd = endHandler;
      }
    } catch (_) {}
  }

  expandAll(expanded, anchorNode = null) {
    // Expand/collapse relative to the selected node (slot or element). Defaults to selection.
    const anchor = anchorNode || this.findSelectedNode() || this.findNodeForElement(this.store?.editingElement) || this.tree;
    const keys = [];
    const walk = (n) => {
      if (!n) return;
      keys.push(this.getKeyFor(n));
      (n.children || []).forEach(walk);
    };
    if (Array.isArray(anchor)) anchor.forEach((r) => walk(r)); else walk(anchor);
    if (expanded) keys.forEach((k) => this._expanded.add(k));
    else keys.forEach((k) => this._expanded.delete(k));
    this.updateComplete.then(() => {
      keys.forEach((k) => {
        const host = this.renderRoot?.querySelector?.(
          `[data-node-key="${k}"] > .children`
        );
        if (host) {
          if (expanded) {
            host.style.height = "auto";
            host.removeAttribute("collapsed");
          } else {
            host.style.height = "0px";
            host.setAttribute("collapsed", "");
          }
        }
      });
    });
    this.requestUpdate();
  }

  // Determine if an anchor subtree is fully expanded
  isSubtreeFullyExpanded(anchorNode = null) {
    const anchor = anchorNode || this.findSelectedNode() || this.findNodeForElement(this.store?.editingElement) || this.tree;
    const allExpanded = (n) => {
      if (!n) return true;
      const key = this.getKeyFor(n);
      const hasChildren = n.children && n.children.length > 0;
      if (hasChildren && !this._expanded.has(key)) return false;
      for (const c of n.children || []) {
        if (!allExpanded(c)) return false;
      }
      return true;
    };
    if (Array.isArray(anchor)) return anchor.every((r) => allExpanded(r));
    return allExpanded(anchor);
  }

  toggleExpandSelected() {
    const node = this.findSelectedNode() || this.findNodeForElement(this.store?.editingElement) || this.tree;
    const fullyExpanded = this.isSubtreeFullyExpanded(node);
    // If fully expanded, collapse subtree; otherwise expand subtree
    this.expandAll(!fullyExpanded, node);
  }

  onItemClick(e, node) {
    e.stopPropagation();
    this.markNavActive();
    const isSlot = node && node.kind === "slot";
      if (isSlot) {
      if (node.parentElement && this.store) {
        try {
          const p = node.parentElement;
          this.store.setUserAction && this.store.setUserAction('tree:slot-click', {
            slot: node.slotName,
            parentTag: p?.tagName?.toLowerCase?.() || null,
            parentId: p?.id || null,
          });
        } catch (_) {}
        this.store.selectSlot(node.parentElement, node.slotName);
      }
      } else if (node.element && this.store) {
      try {
        const el = node.element;
        this.store.setUserAction && this.store.setUserAction('tree:element-click', {
          tag: el?.tagName?.toLowerCase?.() || null,
          id: el?.id || null,
        });
      } catch (_) {}
      this.store.selectElement(node.element);
      }
    // Set roving focus to the clicked row
    const k = this.getKeyFor(node);
    if (k) this.focusedKey = k;
    // Ensure the clicked row gains focus so ESC works immediately
    if (k) this.focusRowByKey(k, { focus: true, scroll: false });
    // Do not toggle expansion on single click
  }

  onItemDblClick(e, node) {
    e.stopPropagation();
    try { this.store.setUserAction && this.store.setUserAction('tree:dblclick', { key: this.getKeyFor(node) }); } catch (_) {}
    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren) this.toggleExpanded(node);
  }

  onKeyDown(e, node) {
    const key = e.key;
    const item = e.currentTarget?.closest?.(".node-row");
    if (!item) return;
    const currentKey = this.getKeyFor(node);
    const visible = this.getVisibleKeys();
    const idx = visible.indexOf(currentKey);
    const parentMap = this.getParentMap();

    const moveIndex = (nextIndex) => {
      const safeIndex = Math.max(0, Math.min(visible.length - 1, nextIndex));
      const keyToFocus = visible[safeIndex];
      if (keyToFocus) {
        e.preventDefault();
        this.focusRowByKey(keyToFocus);
      }
    };

    if (key === "Escape") {
      e.preventDefault();
      if (typeof this.hideSidebar === 'function') {
        this.hideSidebar();
      }
      return;
    }

    if (key === "ArrowDown") {
      moveIndex(idx + 1);
      return;
    }
    if (key === "ArrowUp") {
      moveIndex(idx - 1);
      return;
    }
    if (key === "Home") {
      moveIndex(0);
      return;
    }
    if (key === "End") {
      moveIndex(visible.length - 1);
      return;
    }
    if (key === "ArrowRight") {
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      if (!hasChildren) return;
      e.preventDefault();
      // ARIA tree pattern: first Right expands, second Right moves to first child
      if (!this.isExpanded(node)) {
        this.setExpanded(node, true);
        return;
      }
      const firstChild = node.children[0];
      if (firstChild) {
        const childKey = this.getKeyFor(firstChild);
        this.focusRowByKey(childKey);
      }
      return;
    }
    if (key === "ArrowLeft") {
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren && this.isExpanded(node)) {
        e.preventDefault();
        this.setExpanded(node, false);
        return;
      }
      // Move to parent
      const parentKey = parentMap.get(currentKey);
      if (parentKey) {
        e.preventDefault();
        this.focusRowByKey(parentKey);
      }
      return;
    }
    if (key === "Enter" || key === " ") {
      e.preventDefault();
      this.onItemClick(e, node);
      return;
    }

    // Typeahead: jump to next label starting with prefix
    if (key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      if (!this._typeaheadTimer) {
        this._typeahead = "";
      }
      this._typeahead += key.toLowerCase();
      clearTimeout(this._typeaheadTimer);
      this._typeaheadTimer = setTimeout(() => {
        this._typeahead = "";
        this._typeaheadTimer = null;
      }, 600);
      const keyMap = this.getKeyNodeMap();
      const start = Math.max(0, idx + 1);
      const keys = visible;
      const matchIndex = (() => {
        const hay = [...keys.slice(start), ...keys.slice(0, start)];
        let offset = 0;
        for (const k of hay) {
          const n = keyMap.get(k);
          const label = (n?.label || "").toLowerCase();
          if (label.startsWith(this._typeahead)) {
            return (start + offset) % keys.length;
          }
          offset += 1;
        }
        return -1;
      })();
      if (matchIndex >= 0) {
        moveIndex(matchIndex);
      }
      return;
    }
  }

  onHostKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof this.hideSidebar === 'function') {
        this.hideSidebar();
      }
    }
  }

  onHostClick(e) {
    try {
      const tree = this.renderRoot?.querySelector?.('.tree');
      if (!tree) return;
      const target = e.composedPath ? e.composedPath()[0] : e.target;
      if (!tree.contains(target)) return;
      this.markNavActive();
      // If the click wasn't on a focusable row, move focus to a visible row
      const row = target?.closest?.('.node-row');
      if (row) return;
      const visible = this.getVisibleKeys();
      const keyToFocus = (this.focusedKey && visible.includes(this.focusedKey))
        ? this.focusedKey
        : (visible[0] || null);
      if (keyToFocus) {
        this.focusRowByKey(keyToFocus);
      }
    } catch (_) {}
  }

  markNavActive() {
    this.#navActive = true;
    if (this.#navActiveTimer) clearTimeout(this.#navActiveTimer);
    // Keep nav active for 3s after last interaction
    try { this.setAttribute('data-nav-active', ''); } catch (_) {}
    this.#navActiveTimer = setTimeout(() => {
      this.#navActive = false;
      try { this.removeAttribute('data-nav-active'); } catch (_) {}
    }, 3000);
  }

  onDocumentKeyDown(e) {
    try {
      // Only handle when tree nav is active recently; ignore modified keys
      if (!this.#navActive) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const managed = [
        'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '
      ];
      if (!managed.includes(k)) return;

      const visible = this.getVisibleKeys();
      if (!visible.length) return;
      // Current node by focusedKey or from selectionKey
      let current = this.focusedKey;
      if (!current || !visible.includes(current)) {
        const selected = this.selectionKey;
        current = (selected && visible.includes(selected)) ? selected : visible[0];
        this.focusedKey = current;
      }
      const keyMap = this.getKeyNodeMap();
      const node = keyMap.get(current);
      if (!node) return;

      // Mirror onKeyDown logic using internal helpers, then prevent default
      const idx = visible.indexOf(current);
      const parentMap = this.getParentMap();
      const moveIndex = (nextIndex) => {
        const safeIndex = Math.max(0, Math.min(visible.length - 1, nextIndex));
        const keyToFocus = visible[safeIndex];
        if (keyToFocus) this.focusRowByKey(keyToFocus);
      };

      if (k === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); this.markNavActive(); moveIndex(idx + 1); return; }
      if (k === 'ArrowUp')   { e.preventDefault(); e.stopPropagation(); this.markNavActive(); moveIndex(idx - 1); return; }
      if (k === 'Home')      { e.preventDefault(); e.stopPropagation(); this.markNavActive(); moveIndex(0); return; }
      if (k === 'End')       { e.preventDefault(); e.stopPropagation(); this.markNavActive(); moveIndex(visible.length - 1); return; }

      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      if (k === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation(); this.markNavActive();
        if (hasChildren && !this.isExpanded(node)) { this.setExpanded(node, true); return; }
        const firstChild = hasChildren ? node.children[0] : null;
        if (firstChild) {
          const childKey = this.getKeyFor(firstChild);
          this.focusRowByKey(childKey);
        }
        return;
      }
      if (k === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation(); this.markNavActive();
        if (hasChildren && this.isExpanded(node)) { this.setExpanded(node, false); return; }
        const parentKey = parentMap.get(current);
        if (parentKey) this.focusRowByKey(parentKey);
        return;
      }
      if (k === 'Enter' || k === ' ') {
        e.preventDefault(); e.stopPropagation(); this.markNavActive();
        this.onItemClick(e, node);
        return;
      }
    } catch (_) {}
  }

  isSelected(node) {
    const isSlot = node && node.kind === "slot";
    if (isSlot) {
      // In slot context, only the matching slot row is selected
      return (
        this.store?.editingElement === node.parentElement &&
        this.store?.currentSlot === node.slotName
      );
    }
    // When a slot is active, do not also select the parent element row
    if (this.store?.currentSlot) return false;
    return this.store?.editingElement === node.element;
  }

  scrollSelectionIntoView() {
    try {
      const el = this.store?.editingElement || null;
      const slotName = this.store?.currentSlot || null;
      let selector = null;
      if (el && slotName) {
        const pKey = this.getElementKey(el);
        selector = `.node-row[data-slot-parent-key="${pKey}"][data-slot-name="${slotName}"]`;
      } else if (el) {
        const key = this.getElementKey(el);
        selector = `.node-row[data-el-key="${key}"]`;
      }
      if (!selector) return;
      const item = this.renderRoot.querySelector(selector);
      if (!item) return;
      // Expand ancestors (but not the selected node itself)
      let container = item.closest(".node");
      let skipSelf = true;
      while (container) {
        if (!skipSelf) {
          const key = container.getAttribute("data-node-key");
          if (key) this._expanded.add(key);
        }
        skipSelf = false;
        container = container.parentElement?.closest?.(".node");
      }
      // Set roving focus key but do not steal focus from editor unless nav currently owns focus
      const key = item.parentElement?.getAttribute?.("data-node-key");
      if (key) {
        const navHasFocus = this.shadowRoot && this.shadowRoot.contains(document.activeElement);
        // quiet debug; no console spam in production
        this.focusRowByKey(key, { focus: !!navHasFocus, scroll: true });
      }
    } catch (_) {}
  }

  onSearch(e) {
    this.searchQuery = e.target?.value || "";
    this.requestUpdate();
  }

  onSearchKeydown(e) {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  filterTree(node, query) {
    if (!query) return node;
    const q = query.toLowerCase();
    const contains = (n) => (n.label || "").toLowerCase().includes(q);
    const dive = (n) => {
      const kids = (n.children || []).map((c) => dive(c)).filter(Boolean);
      if (contains(n) || kids.length) {
        return { ...n, children: kids };
      }
      return null;
    };
    if (Array.isArray(node)) return node.map((n) => dive(n)).filter(Boolean);
    return dive(node);
  }

  renderControls() {
    const selected = this.findSelectedNode() || this.findNodeForElement(this.store?.editingElement) || this.tree;
    const willExpand = !this.isSubtreeFullyExpanded(selected);
    return html`
      <div class="controls">
        <sp-action-group quiet selects="none">
          <sp-action-button
            quiet
            size="l"
            title=${willExpand ? "Expand subtree" : "Collapse subtree"}
            @click=${() => this.toggleExpandSelected()}
          >
            ${willExpand
              ? html`<sp-icon-chevron-double-right slot="icon"></sp-icon-chevron-double-right>`
              : html`<sp-icon-chevron-double-right slot="icon" style="transform: rotate(90deg);"></sp-icon-chevron-double-right>`}
          </sp-action-button>
          
          <overlay-trigger placement="bottom-start" offset="6">
            <sp-action-button slot="trigger" quiet size="l" title="Search tree">
              <sp-icon-search slot="icon"></sp-icon-search>
            </sp-action-button>
            <sp-popover slot="click-content" open>
              <div style="width: 300px; padding: 8px;">
                <sp-search
                  quiet
                  placeholder="Filter elements..."
                  .value=${this.searchQuery}
                  @input=${(e) => this.onSearch(e)}
                  @keydown=${(e) => this.onSearchKeydown(e)}
                ></sp-search>
              </div>
            </sp-popover>
          </overlay-trigger>
        </sp-action-group>
      </div>
    `;
  }

  // Find the tree node corresponding to a given element
  findNodeForElement(el) {
    if (!el || !this.tree) return null;
    const walk = (n) => {
      if (!n) return null;
      if (n.element === el) return n;
      for (const c of n.children || []) {
        const r = walk(c);
        if (r) return r;
      }
      return null;
    };
    return walk(this.tree);
  }

  // Find currently selected node (slot node if a slot is active, otherwise the element node)
  findSelectedNode() {
    if (!this.tree) return null;
    const el = this.store?.editingElement || null;
    const slotName = this.store?.currentSlot || null;
    const elementNode = this.findNodeForElement(el);
    if (elementNode && slotName) {
      const findSlot = (node) => {
        if (!node) return null;
        for (const c of node.children || []) {
          if (c.kind === 'slot' && c.slotName === slotName && c.parentElement === el) return c;
        }
        for (const c of node.children || []) {
          const r = findSlot(c);
          if (r) return r;
        }
        return null;
      };
      const slotNode = findSlot(elementNode);
      return slotNode || elementNode;
    }
    if (elementNode) return elementNode;
    if (Array.isArray(this.tree)) return this.tree[0] || null;
    return this.tree;
  }

  renderTree(node, depth = 0, pos = 1, setsize = 1) {
    if (!node) return nothing;
    const isSlotNode = node.kind === "slot";
    const key = this.getKeyFor(node);
    const selectionKey = this.selectionKey;
    const isSelected = key && selectionKey ? key === selectionKey : false;
    // Highlight the element currently being edited only when no slot is active
    const isEditingElementRow = !isSlotNode && !this.store?.currentSlot && this.store?.editingElement === node.element;
    const hasChildren = node.children && node.children.length > 0;
    const elKey = !isSlotNode && node.element ? this.getElementKey(node.element) : null;
    const parentKey = isSlotNode && node.parentElement ? this.getElementKey(node.parentElement) : null;
    const expanded = this.isExpanded(node);

    const caretTagName = this.getCaretIconTag(depth);
    const CaretTag = unsafeStatic(caretTagName);
    const showBefore = !!(this._dropIndicator && this._dropIndicator.key === key && this._dropIndicator.pos === 'before');
    const showAfter = !!(this._dropIndicator && this._dropIndicator.key === key && this._dropIndicator.pos === 'after');
    return html`
      <div class="node" data-node-key=${key} style=${`--indent: ${depth * 16}px`}>
        ${showBefore ? html`<div class="drop-placeholder" data-pos="before" aria-hidden="true"></div>` : nothing}
        <div
          class="node-row"
          role="treeitem"
          aria-level=${depth + 1}
          aria-posinset=${pos}
          aria-setsize=${setsize}
          aria-selected=${String(!!isSelected)}
          aria-expanded=${hasChildren ? String(expanded) : nothing}
          tabindex=${this.focusedKey === key ? 0 : -1}
          ?selected=${isSelected}
          ?focused=${this.focusedKey === key}
          ?editing=${isEditingElementRow}
          data-el-key=${elKey !== null ? String(elKey) : nothing}
          data-slot-parent-key=${isSlotNode && parentKey !== null ? String(parentKey) : nothing}
          data-slot-name=${isSlotNode ? node.slotName : nothing}
          draggable=${!isSlotNode}
          @dragstart=${!isSlotNode ? (e) => this.onDragStart(e, node) : nothing}
          @dragend=${!isSlotNode ? (e) => this.onDragEnd(e, node) : nothing}
          @dragover=${isSlotNode ? (e) => this.onDragOverSlot(e, node) : (e) => this.onDragOverElement(e, node)}
          @dragenter=${isSlotNode ? (e) => this.onDragOverSlot(e, node) : (e) => this.onDragOverElement(e, node)}
          @dragleave=${isSlotNode ? (e) => this.onDragLeaveSlot(e, node) : (e) => this.onDragLeaveElement(e, node)}
          @drop=${isSlotNode ? (e) => this.onDropOnSlot(e, node) : (e) => this.onDropOnElement(e, node)}
          @click=${(e) => this.onItemClick(e, node)}
          @dblclick=${(e) => this.onItemDblClick(e, node)}
          @keydown=${(e) => this.onKeyDown(e, node)}
        >
          ${hasChildren
            ? html`<span class="caret" ?expanded=${expanded} @click=${(e) => { e.stopPropagation(); this.toggleExpanded(node); }}>
                ${staticHtml`<${CaretTag}></${CaretTag}>`}
              </span>`
            : html`<span class="caret" style="opacity: 0;"></span>`}
          ${isSlotNode
            ? html`<span class="icon-slot" title="Slot"><sp-icon-layout></sp-icon-layout></span>`
            : html`<span class="icon-slot">${this.renderElementIcon(node.element)}</span>`}
          <span class="label">${node.label}</span>
        </div>
        ${showAfter ? html`<div class="drop-placeholder" data-pos="after" aria-hidden="true"></div>` : nothing}
        ${hasChildren
          ? html`<div class="children" role="group" ?collapsed=${!expanded} aria-hidden=${String(!expanded)} ?inert=${!expanded}>
              ${node.children.map((c, i, arr) => this.renderTree(c, depth + 1, i + 1, arr.length))}
            </div>`
          : nothing}
      </div>
    `;
  }

  // ----- Drag & Drop -----
  onDragStart(e, node) {
    try {
      this._dragElement = node?.element || null;
      if (e?.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', 'ee/element'); } catch (_) {}
      }
      // Slight visual cue on source
      e.currentTarget?.setAttribute?.('drag-source', '');
    } catch (_) {}
  }

  onDragEnd(e, node) {
    try { e.currentTarget?.removeAttribute?.('drag-source'); } catch (_) {}
    this._dragElement = null;
    // Clear any lingering drop highlights
    try {
      this.renderRoot?.querySelectorAll?.('.node-row[data-drop-allowed]')
        .forEach((el) => el.removeAttribute('data-drop-allowed'));
    } catch (_) {}
    this._dropIndicator = null;
    this.requestUpdate();
    this.clearExpandHoverTimer();
  }

  onDragOverSlot(e, slotNode) {
    const row = e.currentTarget;
    const dragged = this._dragElement;
    if (!dragged || !slotNode || slotNode.kind !== 'slot') return;
    const allowed = this.canAcceptDrop(dragged, slotNode);
    if (allowed) {
      this.ensureExpandOnHover(slotNode);
      this.ensureAutoScrollFromEvent(e);
      try { row.setAttribute('data-drop-allowed', ''); } catch (_) {}
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      try { row.removeAttribute('data-drop-denied'); row.removeAttribute('title'); } catch (_) {}
    } else {
      try { row.removeAttribute('data-drop-allowed'); } catch (_) {}
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      // Provide reason via tooltip/cursor
      const reason = this.getSlotDropDenyReason(this._dragElement, slotNode) || 'Drop not allowed';
      try { row.setAttribute('data-drop-denied', ''); row.setAttribute('title', reason); } catch (_) {}
      this.ensureAutoScrollFromEvent(e);
    }
  }

  onDragLeaveSlot(e, slotNode) {
    try { e.currentTarget?.removeAttribute?.('data-drop-allowed'); } catch (_) {}
    try { e.currentTarget?.removeAttribute?.('data-drop-denied'); e.currentTarget?.removeAttribute?.('title'); } catch (_) {}
  }

  onDropOnSlot(e, slotNode) {
    e.preventDefault();
    const row = e.currentTarget;
    try { row.removeAttribute('data-drop-allowed'); } catch (_) {}
    const el = this._dragElement;
    this._dragElement = null;
    this._dropIndicator = null;
    this.clearExpandHoverTimer();
    this.stopAutoScroll();
    if (!el || !slotNode || slotNode.kind !== 'slot') return;
    if (!this.canAcceptDrop(el, slotNode)) return;
    const parent = slotNode.parentElement;
    const slotName = slotNode.slotName || 'default';

    // Disallow cycles: cannot move into own descendant
    try { if (el.contains(parent)) return; } catch (_) {}

    // Update slot attribute
    try {
      if (slotName === 'default') el.removeAttribute('slot');
      else el.setAttribute('slot', slotName);
    } catch (_) {}

    // Append to end of the slot group in the new parent
    try { parent.appendChild(el); } catch (_) {}

    // Notify store and snapshot
    try { this.store?.elementMoved?.(el); } catch (_) {}
    try { this.store?.scheduleSnapshot?.(); } catch (_) {}
    try { this.store?.setLastAction?.('tree:drop', { slot: slotName, tag: el.tagName?.toLowerCase?.() }); } catch (_) {}

    // Select moved element and keep nav active
    try { this.store?.selectElement?.(el); } catch (_) {}
    this.markNavActive();
  }

  // Dragging over an element row: allow reorder within same slot, or drop into default slot of this element when allowed
  onDragOverElement(e, elementNode) {
    const row = e.currentTarget;
    const dragged = this._dragElement;
    const targetEl = elementNode?.element;
    if (!dragged || !targetEl) return;
    // Reorder case
    const canReorder = this.canReorderWithinSlot(dragged, targetEl);
    const canIntoDefault = this.canAcceptDropIntoDefault(dragged, targetEl);
    if (!canReorder && !canIntoDefault) {
      try { row.removeAttribute('data-drop-allowed'); row.removeAttribute('data-drop-pos'); } catch (_) {}
      this._dropIndicator = null;
      this.requestUpdate();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      // Deny with reason
      const reason = this.getElementDropDenyReason(dragged, elementNode) || 'Drop not allowed';
      try { row.setAttribute('data-drop-denied', ''); row.setAttribute('title', reason); } catch (_) {}
      this.ensureAutoScrollFromEvent(e);
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    row.setAttribute('data-drop-allowed', '');
    try { row.removeAttribute('data-drop-denied'); row.removeAttribute('title'); } catch (_) {}
    if (canReorder) {
      // Indicate before/after based on pointer
      try {
        const rect = row.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        row.setAttribute('data-drop-pos', before ? 'before' : 'after');
        this._dropIndicator = { key: this.getKeyFor(elementNode), pos: before ? 'before' : 'after' };
        this.requestUpdate();
      } catch (_) {}
    } else {
      row.removeAttribute('data-drop-pos');
      this._dropIndicator = null;
      this.requestUpdate();
      // Hover expand to allow drop into default container
      this.ensureExpandOnHover(elementNode);
    }
    this.ensureAutoScrollFromEvent(e);
  }

  onDragLeaveElement(e, elementNode) {
    try { e.currentTarget?.removeAttribute('data-drop-allowed'); e.currentTarget?.removeAttribute('data-drop-pos'); } catch (_) {}
    this._dropIndicator = null;
    this.requestUpdate();
    try { e.currentTarget?.removeAttribute('data-drop-denied'); e.currentTarget?.removeAttribute('title'); } catch (_) {}
  }

  onDropOnElement(e, elementNode) {
    e.preventDefault();
    const row = e.currentTarget;
    try { row.removeAttribute('data-drop-allowed'); row.removeAttribute('data-drop-pos'); } catch (_) {}
    const dragged = this._dragElement; this._dragElement = null;
    const targetEl = elementNode?.element;
    if (!dragged || !targetEl) return;
    // Prioritize reorder when applicable
    if (this.canReorderWithinSlot(dragged, targetEl)) {
      const parent = targetEl.parentElement;
      if (!parent) return;
      const rect = row.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) parent.insertBefore(dragged, targetEl);
      else if (targetEl.nextElementSibling) parent.insertBefore(dragged, targetEl.nextElementSibling);
      else parent.appendChild(dragged);
      try { this.store?.elementMoved?.(dragged); } catch (_) {}
      try { this.store?.scheduleSnapshot?.(); } catch (_) {}
      try { this.store?.setLastAction?.('tree:reorder-drop', { tag: dragged.tagName?.toLowerCase?.() }); } catch (_) {}
      try { this.store?.selectElement?.(dragged); } catch (_) {}
      this.markNavActive();
      return;
    }
    // Otherwise, try to drop into default slot of this element
    if (this.canAcceptDropIntoDefault(dragged, targetEl)) {
      // Prevent cycles
      try { if (dragged.contains(targetEl)) return; } catch (_) {}
      // Update slot and append under targetEl
      try { dragged.removeAttribute('slot'); } catch (_) {}
      try { targetEl.appendChild(dragged); } catch (_) {}
      try { this.store?.elementMoved?.(dragged); } catch (_) {}
      try { this.store?.scheduleSnapshot?.(); } catch (_) {}
      try { this.store?.setLastAction?.('tree:drop-default', { parent: targetEl.tagName?.toLowerCase?.(), tag: dragged.tagName?.toLowerCase?.() }); } catch (_) {}
      try { this.store?.selectElement?.(dragged); } catch (_) {}
      this.markNavActive();
    }
    this._dropIndicator = null;
    this.requestUpdate();
    this.clearExpandHoverTimer();
    this.stopAutoScroll();
  }

  canReorderWithinSlot(dragged, target) {
    try {
      if (!dragged || !target) return false;
      if (dragged === target) return false;
      const p1 = dragged.parentElement; const p2 = target.parentElement;
      if (!p1 || !p2 || p1 !== p2) return false;
      const s1 = dragged.getAttribute('slot') || 'default';
      const s2 = target.getAttribute('slot') || 'default';
      return s1 === s2;
    } catch (_) { return false; }
  }

  ensureExpandOnHover(node) {
    try {
      const key = this.getKeyFor(node);
      if (!key) return;
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      if (!hasChildren) return;
      if (this.isExpanded(node)) return;
      if (this._expandHoverKey === key && this._expandHoverTimer) return;
      this.clearExpandHoverTimer();
      this._expandHoverKey = key;
      this._expandHoverTimer = setTimeout(() => {
        try { this.setExpanded(node, true); } catch (_) {}
        this.clearExpandHoverTimer();
      }, 600);
    } catch (_) {}
  }

  clearExpandHoverTimer() {
    if (this._expandHoverTimer) {
      try { clearTimeout(this._expandHoverTimer); } catch (_) {}
    }
    this._expandHoverTimer = null;
    this._expandHoverKey = null;
  }

  // ----- Auto-scroll support while dragging -----
  ensureAutoScrollFromEvent(e) {
    try {
      const tree = this.renderRoot?.querySelector?.('.tree');
      if (!tree) return this.stopAutoScroll();
      const rect = tree.getBoundingClientRect();
      const y = e.clientY;
      const threshold = Math.max(24, rect.height * 0.08);
      let v = 0;
      if (y < rect.top + threshold) {
        const d = Math.max(1, (rect.top + threshold) - y);
        v = -Math.min(16, Math.ceil(d / 4));
      } else if (y > rect.bottom - threshold) {
        const d = Math.max(1, y - (rect.bottom - threshold));
        v = Math.min(16, Math.ceil(d / 4));
      }
      this._autoScrollVelocity = v;
      if (!this._autoScrollRAF) this._autoScrollRAF = requestAnimationFrame(() => this.autoScrollStep());
    } catch (_) {}
  }

  autoScrollStep() {
    this._autoScrollRAF = null;
    try {
      const tree = this.renderRoot?.querySelector?.('.tree');
      if (!tree) return;
      if (this._autoScrollVelocity) {
        tree.scrollTop = Math.max(0, Math.min(tree.scrollHeight, tree.scrollTop + this._autoScrollVelocity));
      }
      if (this._autoScrollVelocity) this._autoScrollRAF = requestAnimationFrame(() => this.autoScrollStep());
    } catch (_) {}
  }

  stopAutoScroll() {
    try { if (this._autoScrollRAF) cancelAnimationFrame(this._autoScrollRAF); } catch (_) {}
    this._autoScrollRAF = null;
    this._autoScrollVelocity = 0;
  }

  // ----- Deny reason helpers -----
  getSlotDropDenyReason(dragged, slotNode) {
    try {
      if (!dragged || !slotNode || slotNode.kind !== 'slot') return 'Invalid target';
      const parent = slotNode.parentElement;
      if (!parent) return 'No parent element';
      // Cycle
      try { if (dragged.contains(parent)) return 'Cannot move into its own descendant'; } catch (_) {}
      const tag = dragged.tagName?.toLowerCase?.();
      const parentCtor = customElements.get(parent.tagName.toLowerCase());
      let cfg = null; const slotName = slotNode.slotName || 'default';
      try { if (parentCtor?.ee?.getSchema) { const s = parentCtor.ee.getSchema(); cfg = s?.slots?.configs?.[slotName] || null; } } catch (_) {}
      if (!cfg && parentCtor?.ee?.getSlotConfig) { try { cfg = parentCtor.ee.getSlotConfig(slotName); } catch (_) {} }
      if (!cfg) return 'Slot not available';
      const allowed = Array.isArray(cfg.allowedTags) ? cfg.allowedTags.map((t) => String(t).toLowerCase()) : [];
      if (!allowed.length) return 'Slot does not accept elements';
      if (!allowed.includes(tag)) return `Tag <${tag}> not allowed in slot`;
      const currentParent = dragged.parentElement; const currentSlot = dragged.getAttribute('slot') || 'default';
      if (currentParent !== parent || currentSlot !== slotName) {
        const maxLen = cfg.maxLength == null ? Infinity : Number(cfg.maxLength);
        let count = 0; for (const c of Array.from(parent.children || [])) { const s = c.getAttribute && (c.getAttribute('slot') || 'default'); if (s === slotName) count += 1; }
        if (!(count < maxLen)) return 'Slot is full';
      }
      return '';
    } catch (_) { return 'Drop not allowed'; }
  }

  getElementDropDenyReason(dragged, elementNode) {
    try {
      const targetEl = elementNode?.element; const tag = dragged?.tagName?.toLowerCase?.();
      if (!dragged || !targetEl) return 'Invalid target';
      // Reorder?
      if (!(this.canReorderWithinSlot(dragged, targetEl))) {
        // Default container?
        const okDefault = this.canAcceptDropIntoDefault(dragged, targetEl);
        if (!okDefault) {
          // derive reason from default validator
          const ctor = customElements.get(targetEl.tagName?.toLowerCase?.());
          let cfg = null; try { if (ctor?.ee?.getSchema) { const s = ctor.ee.getSchema(); cfg = s?.slots?.configs?.['default'] || null; } } catch (_) {}
          if (!cfg && ctor?.ee?.getSlotConfig) { try { cfg = ctor.ee.getSlotConfig('default'); } catch (_) {} }
          if (!cfg) return 'Default slot not available';
          const allowed = Array.isArray(cfg.allowedTags) ? cfg.allowedTags.map((t) => String(t).toLowerCase()) : [];
          if (!allowed.length) return 'Default slot does not accept elements';
          if (!allowed.includes(tag)) return `Tag <${tag}> not allowed in default slot`;
          const currentParent = dragged.parentElement; const currentSlot = dragged.getAttribute('slot') || 'default';
          if (currentParent !== targetEl || currentSlot !== 'default') {
            const maxLen = cfg.maxLength == null ? Infinity : Number(cfg.maxLength);
            let count = 0; for (const c of Array.from(targetEl.children || [])) { const s = c.getAttribute && (c.getAttribute('slot') || 'default'); if (s === 'default') count += 1; }
            if (!(count < maxLen)) return 'Default slot is full';
          }
          return 'Drop not allowed here';
        }
      }
      return '';
    } catch (_) { return 'Drop not allowed'; }
  }

  canAcceptDropIntoDefault(draggedElement, targetElement) {
    try {
      if (!draggedElement || !targetElement) return false;
      const parent = targetElement; // default slot of targetElement
      const tag = draggedElement.tagName?.toLowerCase?.();
      const ctor = customElements.get(parent.tagName?.toLowerCase?.());
      let cfg = null;
      try { if (ctor?.ee?.getSchema) { const s = ctor.ee.getSchema(); cfg = s?.slots?.configs?.['default'] || null; } } catch (_) {}
      if (!cfg && ctor?.ee?.getSlotConfig) { try { cfg = ctor.ee.getSlotConfig('default'); } catch (_) {} }
      if (!cfg) return false;
      const allowedTags = Array.isArray(cfg.allowedTags) ? cfg.allowedTags.map((t) => String(t).toLowerCase()) : [];
      if (!allowedTags.length) return false;
      if (!allowedTags.includes(tag)) return false;
      // Enforce maxLength if moving to a new parent/slot
      const currentParent = draggedElement.parentElement;
      const currentSlot = draggedElement.getAttribute('slot') || 'default';
      if (currentParent !== parent || currentSlot !== 'default') {
        const maxLen = cfg.maxLength == null ? Infinity : Number(cfg.maxLength);
        let count = 0;
        const kids = Array.from(parent.children || []);
        for (const c of kids) {
          if (!(c && c.nodeType === Node.ELEMENT_NODE)) continue;
          const s = c.getAttribute && (c.getAttribute('slot') || 'default');
          if (s === 'default') count += 1;
        }
        if (!(count < maxLen)) return false;
      }
      return true;
    } catch (_) { return false; }
  }

  canAcceptDrop(draggedElement, slotNode) {
    try {
      if (!draggedElement || !slotNode || slotNode.kind !== 'slot') return false;
      const parent = slotNode.parentElement;
      if (!parent || !parent.tagName?.includes?.('-')) return false;
      // Prevent cycles
      try { if (draggedElement.contains(parent)) return false; } catch (_) {}

      const tag = draggedElement.tagName?.toLowerCase?.();
      const parentCtor = customElements.get(parent.tagName.toLowerCase());
      let cfg = null;
      const slotName = slotNode.slotName || 'default';
      try {
        if (parentCtor?.ee?.getSchema) {
          const s = parentCtor.ee.getSchema();
          cfg = s?.slots?.configs?.[slotName] || null;
        }
      } catch (_) {}
      if (!cfg && parentCtor?.ee?.getSlotConfig) {
        try { cfg = parentCtor.ee.getSlotConfig(slotName); } catch (_) {}
      }
      if (!cfg) return false; // no config -> do not accept

      const allowedTags = Array.isArray(cfg.allowedTags) ? cfg.allowedTags.map((t) => String(t).toLowerCase()) : [];
      if (!allowedTags.length) return false; // not a container slot
      if (!allowedTags.includes(tag)) return false;

      // Enforce maxLength if defined (ignore when reassigning within same parent/slot)
      const currentParent = draggedElement.parentElement;
      const currentSlot = draggedElement.getAttribute('slot') || 'default';
      if (currentParent !== parent || currentSlot !== slotName) {
        const maxLen = cfg.maxLength == null ? Infinity : Number(cfg.maxLength);
        let count = 0;
        const kids = Array.from(parent.children || []);
        for (const c of kids) {
          if (!(c && c.nodeType === Node.ELEMENT_NODE)) continue;
          const s = c.getAttribute && (c.getAttribute('slot') || 'default');
          if (s === slotName) count += 1;
        }
        if (!(count < maxLen)) return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // Render an element-provided icon if available via ee.getElementIcon()
  renderElementIcon(el) {
    try {
      const tpl = this.getElementIconTemplate(el);
      if (tpl === undefined) return html``; // no provider
      if (tpl === null) return html``; // invalid provider
      return tpl;
    } catch (_) {
      return html``;
    }
  }

  getElementIconTemplate(el) {
    try {
      const tag = el?.tagName?.toLowerCase?.();
      if (!tag) return undefined;
      const ctor = customElements.get(tag);
      const iconProvider = ctor?.ee?.getElementIcon;
      if (iconProvider) {
        const result = iconProvider(html);
        if (typeof result === "string") {
          const iconTag = result.trim();
          if (!iconTag) return null;
          const defined = !!customElements.get(iconTag);
          if (!defined) return null;
          return staticHtml`<${unsafeStatic(iconTag)}></${unsafeStatic(iconTag)}>`;
        }
        return result; // assume TemplateResult
      }
      return undefined;
    } catch (_) {
      return null;
    }
  }

  getCaretIconTag(_depth) {
    // Unified caret: chevron pointing right; CSS rotates 90deg when expanded
    return 'sp-icon-chevron-double-right';
  }

  render() {
    const filtered = this.filterTree(this.tree, this.searchQuery);
    const hasAny = Array.isArray(filtered) ? filtered.length > 0 : !!filtered;
    return html`
      <div class="nav-root">
        ${this.renderControls()}
        <div
          class="tree"
          role="tree"
          aria-multiselectable="false"
          tabindex="0"
          @focus=${this.onTreeFocus}
        >
          ${hasAny
            ? Array.isArray(filtered)
              ? filtered.map((n, i, arr) => this.renderTree(n, 0, i + 1, arr.length))
              : this.renderTree(filtered, 0)
            : html`
                <sp-illustrated-message heading="No results">
                  <div slot="description">Try a different search term.</div>
                </sp-illustrated-message>
              `}
        </div>
      </div>
    `;
  }

  onTreeFocus = (e) => {
    // When the tree container receives focus (e.g., via Tab), redirect focus to the current row
    try {
      this.markNavActive();
      const visible = this.getVisibleKeys();
      if (!visible.length) return;
      const targetKey = (this.focusedKey && visible.includes(this.focusedKey))
        ? this.focusedKey
        : visible[0];
      if (targetKey) this.focusRowByKey(targetKey, { focus: true, scroll: false });
    } catch (_) {}
  };
}

customElements.define("ee-tree-nav", EETreeNav);

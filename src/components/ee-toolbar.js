import { LitElement, html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { makeLitObserver } from "picosm";
import { eeToolbarStyles } from "./ee-toolbar.css.js";

// Spectrum components




















































const BASE_TEXT_TAGS = new Set([
  'span',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'a',
  'sub',
  'sup',
  'code',
  'mark',
  'small',
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

class EEToolbar extends LitElement {
  #checkingClipboard;
  #logEnabled = false;
  static get styles() {
    return eeToolbarStyles;
  }

  static get properties() {
    return {
      store: { type: Object, observe: true },
      commentStore: { type: Object, observe: true },
      visible: { type: Boolean },
      static: { type: Boolean, reflect: true, attribute: "static" },
      selectedElement: { type: Object },
      showAllOpen: { type: Boolean, attribute: false },
      // Whether the clipboard currently contains text or HTML
      clipboardHasTextOrHtml: { state: true },
    };
  }

  constructor() {
    super();
    this.store = null;
    this.visible = false;
    this.static = false;
    this.selectedElement = null;
    this._dragging = false;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._lastEditingElement = null;
    this._lastEditingTagName = null;
    this._compactSlotsIncluded = 0;
    this.showAllOpen = false;
    this._inlineAttrNames = [];
    this._shouldReopenPopover = false;
    this.clipboardHasTextOrHtml = false;
    this.#checkingClipboard = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.handleOverlayOpen = this.handleOverlayOpen.bind(this);
    this.handleOverlayClose = this.handleOverlayClose.bind(this);
    this.addEventListener("sp-opened", this.handleOverlayOpen);
    this.addEventListener("sp-closed", this.handleOverlayClose);
    // Lock inline-link context while interacting with toolbar inputs
    this._onFocusIn = () => {
      try {
        this.store?.setInlineLinkContextLock(true);
        // Mark last action as toolbar focus to aid Escape handling
        this.store?.setLastAction?.('toolbar:focus');
      } catch (_) {}
    };
    this._onFocusOut = () => {
      try {
        // Defer to allow focus to move within toolbar
        setTimeout(() => {
          const stillFocused = !!this.shadowRoot?.activeElement;
          if (!stillFocused) this.store?.setInlineLinkContextLock(false);
        }, 0);
      } catch (_) {}
    };
    this.addEventListener("focusin", this._onFocusIn);
    this.addEventListener("focusout", this._onFocusOut);
    // Mark toolbar as last interacted on pointerdown within toolbar
    this._onPointerDown = () => {
      try { this.store?.setLastAction?.('toolbar:interact'); } catch (_) {}
    };
    this.addEventListener('pointerdown', this._onPointerDown, true);
    // Opportunistically check clipboard on hover/focus
    this.addEventListener('mouseenter', () => this.checkClipboardForPaste());
    this.addEventListener('focusin', () => this.checkClipboardForPaste());
    // Observe toolbar size changes and update position via the store
    try {
      const el = this.updateComplete.then(() =>
        this.shadowRoot?.getElementById("ee-toolbar")
      );
      Promise.resolve(el).then((node) => {
        if (!node || this._resizeObserver) return;
        this._resizeObserver = new ResizeObserver(() => {
          // Skip position updates when actions group is interacting
          if (this._freezePosition) return;
          try {
            this.store?.updateEEToolbarPosition();
          } catch (_) {}
        });
        this._resizeObserver.observe(node);
      });
    } catch (_) {}
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("sp-opened", this.handleOverlayOpen);
    this.removeEventListener("sp-closed", this.handleOverlayClose);
    try {
      this.removeEventListener("focusin", this._onFocusIn);
    } catch (_) {}
    try {
      this.removeEventListener("focusout", this._onFocusOut);
    } catch (_) {}
    try {
      this.removeEventListener('pointerdown', this._onPointerDown, true);
    } catch (_) {}
    try {
      this._resizeObserver?.disconnect();
    } catch (_) {}
    this._resizeObserver = null;
  }

  log(level, message, data = {}) {
    if (!this.#logEnabled) return;
    const prefix = "[EEToolbar]";
    // eslint-disable-next-line no-console
    (console[level] || console.log)(`${prefix} ${message}`, data);
      // eslint-disable-next-line no-console
      console.log(`${prefix} ${message}`, data);
  }

  handleOverlayOpen(e) {
    this.store.toolbarOverlayOpen = true;
    try { this.store?.setLastAction?.('toolbar:overlay'); } catch (_) {}
    this.log("debug", "overlay opened", {
      showAllOpen: this.showAllOpen,
      target: e?.target?.tagName,
    });
    // Clear reopen intent once opened
    this._shouldReopenPopover = false;
    // Keep position fixed during interactions on open
  }

  handleOverlayClose(e) {
    this.store.toolbarOverlayOpen = false;
    this.log("debug", "overlay closed", {
      showAllOpen: this.showAllOpen,
      target: e?.target?.tagName,
    });
    this.showAllOpen = false;
    if (this._shouldReopenPopover) {
      this.log("debug", "overlay closed; attempting reopen");
      setTimeout(() => this._openPopoverProgrammatically(), 50);
    }
    // Keep position fixed on close as well
  }

  // Keep toolbar position fixed while executing an action
  _freezeToolbarPositionDuring(fn) {
    const pos = this.store?.eeToolbarPosition
      ? { x: this.store.eeToolbarPosition.x, y: this.store.eeToolbarPosition.y }
      : null;
    this._freezePosition = true;
    try {
      fn?.();
    } catch (_) {
      // ensure we always unfreeze
    } finally {
      // Restore position on next tick so any internal repositioning is overridden
      setTimeout(() => {
        try {
          if (pos && this.store) this.store.setEEToolbarPosition(pos.x, pos.y);
        } catch (_) {}
        this._freezePosition = false;
      }, 0);
    }
  }

  get toolbarVisible() {
    return this.static ? !!this.visible : !!this.store?.isEEToolbarVisible;
  }

  get positionStyle() {
    if (!this.store) return "";
    const pos = this.store.eeToolbarPosition || { x: 0, y: 0 };
    const x = Math.round(pos.x);
    const y = Math.round(pos.y);
    return `transform: translate(${x}px, ${y}px);`;
  }

  updated(changed) {
    super.updated(changed);
    // Sync internal state when editing element changes (close popovers)
    if (this.store) {
      const currentEditing = this.store.editingElement;
      if (currentEditing !== this._lastEditingElement) {
        const currentTag = currentEditing?.tagName?.toLowerCase?.() || null;
        const prevTag = this._lastEditingTagName;
        const wasOpen = this.showAllOpen;
        this._lastEditingElement = currentEditing;
        this._lastEditingTagName = currentTag;
        // Previously: only reopen when same type. Now: if popover was open, schedule a reopen even across types.
        if (currentTag !== prevTag) {
          const willReopen = !!wasOpen;
          this.showAllOpen = false;
          this._shouldReopenPopover = willReopen;
          this.log(
            "debug",
            willReopen
              ? "element type changed; scheduling reopen"
              : "element type changed, closing popover",
            { prevTag, currentTag }
          );
        } else if (wasOpen) {
          // Same type and popover was open: schedule reopen
          this._shouldReopenPopover = true;
          this.log("debug", "same type selection; scheduling reopen", {
            tag: currentTag,
          });
        }
      }
      // Keep toolbar's selectedElement pointing at inline link target (if any)
      try {
        const target = this.store.inlineLinkEditingTarget || null;
        if (this.selectedElement !== target) {
          this.selectedElement = target;
        }
      } catch (_) {}
    }
  }

  get actions() {
    const live = this.store?.toolbarActions || null;
    const data =
      this.store?.toolbarActionsData !== undefined &&
      this.store?.toolbarActionsData !== null
        ? this.store.toolbarActionsData
        : null;
    if (data && live) {
      // Merge to ensure dynamic fields (e.g., duplicationAllowed) are up-to-date
      return { ...data, ...live };
    }
    return data || live;
  }

  render() {
    if (!this.store || !this.toolbarVisible) {
      return nothing;
    }

    const actions = this.actions;
    if (!actions) return nothing;

    const inInlineEdit = !!this.store?.isContentEditable;
    const el = actions.element;
    const isLocked = this.hasAuthoringSchema(el) && this.isAuthoringLocked(el);

    // Determine modes (compact: prioritize text + key controls)
    const showText = actions.textFormatting?.enabled;
    const showAttrs = actions.attributes?.enabled;
    // Slot-specific UI is removed from toolbar
    const showReorder = actions.reordering?.enabled;
    // Ignore slot selection for toolbar rendering

    // When a slot is selected, show slot-specific controls instead
    const slotSelected = !!actions.slots?.current;
    return html`
      <div
        id="ee-toolbar"
        style="${this.positionStyle}"
        @mousedown=${this.onDragStart}
      >
        <div class="toolbar-header">
          <div class="title">
            <div class="label">${actions.elementLabel || "Element"}</div>
            ${actions.elementDescription
              ? html`<div class="description">
                  ${actions.elementDescription}
                </div>`
              : nothing}
          </div>
          <div class="actions">
            ${inInlineEdit ? nothing : this.renderSelectParentButton()}
            ${inInlineEdit || !this.store?.saveIndicatorVisible
              ? nothing
              : html`<sp-status-light
                  variant="positive"
                  size="m"
                  style="margin-right: 8px;"
                  >Saved</sp-status-light
                >`}
            ${inInlineEdit || !showReorder || isLocked
              ? nothing
              : this.renderReorderGroup(actions)}
            ${inInlineEdit ? nothing : this.renderDuplicateDelete(actions)}
          </div>
        </div>

        ${inInlineEdit && !isLocked
          ? this.renderInlineEditingControls(actions)
          : slotSelected && !isLocked
          ? this.renderSlotControls(actions)
          : this.renderCompactControls(actions, {
              showAttrs,
              includeText: showText,
            })}
      </div>
    `;
  }

  isAuthoringLocked(element) {
    return !!(element && element.hasAttribute && element.hasAttribute("data-ee-locked"));
  }

  hasAuthoringSchema(element) {
    if (!element || !element.tagName) return false;
    const tag = element.tagName.toLowerCase();
    const ctor = customElements.get(tag);
    const getSchema = ctor?.ee?.getSchema;
    if (typeof getSchema !== "function") return false;
    return !!getSchema();
  }

  renderLockButton(actions) {
    const element = actions?.element;
    if (!element) return nothing;
    if (!this.hasAuthoringSchema(element)) return nothing;
    const locked = this.isAuthoringLocked(element);
    const title = locked ? "Unlock element" : "Lock element";
    return html`<sp-action-button
      quiet
      title="${title}"
      @click=${() =>
        this._freezeToolbarPositionDuring(() => this.toggleAuthoringLock(element))}
    >
      ${locked
        ? html`<sp-icon-lock-open slot="icon"></sp-icon-lock-open>`
        : html`<sp-icon-lock-closed slot="icon"></sp-icon-lock-closed>`}
    </sp-action-button>`;
  }

  toggleAuthoringLock(element) {
    if (!element) return;
    const willLock = !this.isAuthoringLocked(element);
    if (willLock) {
      element.setAttribute("data-ee-locked", "");
      // Exit inline editing if active when locking
      if (this.store?.isContentEditable) this.store.cancelInlineEditing?.();
    } else {
      element.removeAttribute("data-ee-locked");
    }
    this.store?.scheduleSnapshot?.();
    this.store?.scheduleAutoSave?.();
  }

  // Inline edit mode: show only formatting capabilities allowed by schema
  renderInlineEditingControls(actions) {
    const formattingParts = [];
    const tf = this.renderTextFormatting(actions);
    if (tf !== nothing) formattingParts.push(tf);
    const al = this.renderAlignmentAndList();
    if (al !== nothing) formattingParts.push(al);

    const insideLink = !!this.store?.inlineLinkEditingTarget;
    const linkEditor = insideLink ? this.renderLinkEditor(actions) : nothing;
    const pasteBtn = this.renderPasteButton(actions, { context: 'inline' });
    const cancelBtn = html`<sp-action-button
      quiet
      title="Cancel inline editing"
      @click=${() =>
        this._freezeToolbarPositionDuring(() =>
          this.store?.cancelInlineEditing()
        )}
    >
      <sp-icon-cancel slot="icon"></sp-icon-cancel>
    </sp-action-button>`;

    if (!formattingParts.length && linkEditor === nothing)
      return html`<div class="row">
        <span class="group" aria-label="Editing Actions">${cancelBtn}</span>
      </div>`;
    return html`
      <div class="row">
        ${formattingParts.length
          ? html`<span class="group" aria-label="Formatting"
              >${formattingParts}</span
            >`
          : nothing}
        ${linkEditor !== nothing
          ? html`<span class="group" aria-label="Link">${linkEditor}</span>`
          : nothing}
        <span class="group" aria-label="Editing Actions">${pasteBtn}${cancelBtn}</span>
      </div>
    `;
  }

  // Render link attributes (e.g., href, target, rel) when caret is inside an <a>
  renderLinkEditor(actions) {
    try {
      const el = this.store?.inlineLinkEditingTarget;
      if (!el || el.tagName?.toLowerCase?.() !== "a") return nothing;
      const schema = actions?.attributes?.schema || {};
      const entries = Object.entries(schema || {});
      if (!entries.length) return nothing;
      // Show a compact subset inline (e.g., first 2 fields), rest in a popover
      const inline = entries.slice(0, 2);
      const rest = entries.slice(2);
      const inlineFields = inline.map(([name, def]) =>
        this.renderAttributeField(name, def)
      );
      const more = rest.length
        ? html`${this.renderLinkFieldsPopover(rest)}`
        : nothing;
      return html`${inlineFields}${more}`;
    } catch (_) {
      return nothing;
    }
  }

  renderLinkFieldsPopover(restEntries) {
    return html`
      <overlay-trigger triggered-by="click hover" placement="bottom-start" offset="6">
        <sp-action-button
          slot="trigger"
          quiet
          title="More link options"
          @click=${() => {
            this._freezeToolbarPositionDuring(() => {
              this.showAllOpen = true;
            });
          }}
        >
          <sp-icon-table slot="icon"></sp-icon-table>
        </sp-action-button>
        <sp-popover slot="click-content" .open=${this.showAllOpen}>
          <div class="popover-content">
            <div class="attributes">
              ${restEntries.map(([name, def]) =>
                this.renderAttributeField(name, def)
              )}
            </div>
          </div>
        </sp-popover>
      </overlay-trigger>
    `;
  }

  /**
   * Debug snapshot of toolbar UI state
   */
  get debugState() {
    const describeElement = (el) => {
      try {
        if (!el || !el.tagName) return null;
        const tag = el.tagName.toLowerCase();
        const ctor = customElements.get(tag);
        return {
          tag,
          id: el.id || null,
          slot: el.getAttribute ? el.getAttribute("slot") : null,
          isCustom: tag.includes("-"),
          hasEE: !!ctor?.ee,
          text: (el.textContent || "").trim().slice(0, 60),
        };
      } catch (_) {
        return null;
      }
    };

    const actions = this.store?.toolbarActions || null;
    const pos = this.store?.eeToolbarPosition || { x: 0, y: 0 };
    return {
      toolbarVisible: this.toolbarVisible,
      static: !!this.static,
      position: { x: Math.round(pos.x || 0), y: Math.round(pos.y || 0) },
      dragging: !!this._dragging,
      showAllOpen: !!this.showAllOpen,
      shouldReopenPopover: !!this._shouldReopenPopover,
      lastEditingTagName: this._lastEditingTagName || null,
      actions: actions
        ? {
            element: describeElement(actions.element),
            isSlotContent: !!actions.isSlotContent,
            slotName: actions.slotName || null,
            textFormatting: {
              enabled: !!actions.textFormatting?.enabled,
              allowedFormats: actions.textFormatting?.allowedFormats ?? null,
            },
            attributes: {
              enabled: !!actions.attributes?.enabled,
              count: Object.keys(actions.attributes?.schema || {}).length,
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
      storeIsContentEditable: !!this.store?.isContentEditable,
    };
  }

  onDragStart = (e) => {
    // Only allow dragging with primary button
    if (e.button !== 0) return;
    this._dragging = true;
    const hostRect = this.getBoundingClientRect();
    const toolbarRect = this.shadowRoot
      .getElementById("ee-toolbar")
      .getBoundingClientRect();
    // Calculate offset from cursor to top-left of the toolbar
    this._dragOffsetX = e.clientX - toolbarRect.left;
    this._dragOffsetY = e.clientY - toolbarRect.top;
    document.addEventListener("mousemove", this.onDragMove);
    document.addEventListener("mouseup", this.onDragEnd, { once: true });
  };

  onDragMove = (e) => {
    if (!this._dragging) return;
    // Compute new position and push to store
    const viewportW = window.innerWidth || 1024;
    const viewportH = window.innerHeight || 768;
    const toolbar = this.shadowRoot.getElementById("ee-toolbar");
    const width = toolbar.offsetWidth || 560;
    const height = toolbar.offsetHeight || 40;
    let x = e.clientX - this._dragOffsetX;
    let y = e.clientY - this._dragOffsetY;
    const margin = 4;
    x = Math.min(
      Math.max(margin, x),
      Math.max(margin, viewportW - width - margin)
    );
    y = Math.min(
      Math.max(margin, y),
      Math.max(margin, viewportH - height - margin)
    );
    this.store?.setEEToolbarPosition(x, y);
    this.requestUpdate();
  };

  onDragEnd = () => {
    this._dragging = false;
    document.removeEventListener("mousemove", this.onDragMove);
  };

  renderCompactControls(actions, flags) {
    const { showAttrs, includeText } = flags;
    const inInlineEdit = !!this.store?.isContentEditable;
    const isLocked = this.hasAuthoringSchema(actions.element) && this.isAuthoringLocked(actions.element);
    if (isLocked) {
      return html`
        <div class="row">
          ${this.renderSelectParentButton()}
          <span class="group" aria-label="Actions">${this.renderDuplicateDelete(actions)}</span>
        </div>
      `;
    }
    const attrEntries = Object.entries(actions.attributes?.schema || {});
    const fieldCount = attrEntries.filter(([, def]) => def?.type !== 'popover').length;
    // Render primary fields and track which attributes are shown inline
    this._inlineAttrNames = [];
    const fieldsTemplate = this.renderPrimaryFields(actions, {
      includeAttrs: showAttrs,
    });
    // Build groups only when they have content
    const formattingParts = [];
    const editBtn = this.renderEditButton(actions);
    if (editBtn !== nothing) formattingParts.push(editBtn);
    // Only show actual formatting controls during inline edit
    if (includeText) {
      const tf = this.renderTextFormatting(actions);
      if (tf !== nothing) formattingParts.push(tf);
      if (inInlineEdit) {
        const al = this.renderAlignmentAndList();
        if (al !== nothing) formattingParts.push(al);
      }
    }

    const fieldsParts = [];
    if (fieldsTemplate !== nothing) fieldsParts.push(fieldsTemplate);
    const fieldsFormButton = fieldCount > 2 ? this.renderFieldsPopover(actions) : nothing;

    const defaultSlotAdders = this.renderDefaultSlotAdders(actions);
    const pasteBtn = this.renderPasteButton(actions, { context: "default" });
    const popoverControls = this.renderPopoverAttributes(actions);
    const elementControlsParts = [];
    if (fieldsParts.length)
      elementControlsParts.push(html`<span class="group" aria-label="Fields">${fieldsParts}</span>`);
    if (popoverControls !== nothing)
      elementControlsParts.push(html`<span class="group" aria-label="Popover Controls">${popoverControls}</span>`);
    if (fieldsFormButton !== nothing)
      elementControlsParts.push(html`<span class="group" aria-label="More Fields">${fieldsFormButton}</span>`);
    if (defaultSlotAdders !== nothing)
      elementControlsParts.push(html`<span class="group" aria-label="Add Elements">${defaultSlotAdders}</span>`);
    return html`
      <div class="row">
        ${this.renderSelectParentButton()}
        ${formattingParts.length
          ? html`<span class="group" aria-label="Formatting"
              >${formattingParts}</span
            >`
          : nothing}
        ${elementControlsParts.length
          ? html`
              <sp-divider class="author-controls-divider" size="m" vertical></sp-divider>
              <span class="group" aria-label="Element Controls">${elementControlsParts}</span>
              <sp-divider class="author-controls-divider" size="m" vertical></sp-divider>
            `
          : nothing}
        ${pasteBtn !== nothing
          ? html`<span class="group" aria-label="Clipboard">${pasteBtn}</span>`
          : nothing}
        <span class="group" aria-label="Actions">
          ${actions.reordering?.enabled
            ? this.renderReorderGroup(actions)
            : nothing}
          ${this.renderDuplicateDelete(actions)}
          ${this.renderCustomActions(actions)}
        </span>
      </div>
    `;
  }

  // When element selected (no slot), show Add button(s) for default slot if it's a container
  renderDefaultSlotAdders(actions) {
    try {
      if (!actions || !actions.slots || !actions.slots.getConfig)
        return nothing;
      if (actions.slots.current) return nothing; // only when no slot is selected
      const cfg = actions.slots.getConfig("default");
      if (!cfg) return nothing;
      const inlineText =
        cfg.inlineEditable === true ||
        (Array.isArray(cfg.allowedFormats) && cfg.allowedFormats.length > 0);
      if (inlineText) return nothing; // default slot is text; do not show adders
      let allowed = Array.isArray(cfg.allowedTags) ? cfg.allowedTags : [];
      // Hide ee-reference from Add menus; use copy/paste to insert references
      allowed = allowed.filter((t) => String(t).toLowerCase() !== 'ee-reference');
      if (!allowed.length) return nothing;

      const renderLabelForTag = (tag) => {
        let label = tag;
        try {
          const ctor = typeof tag === "string" ? customElements.get(tag) : null;
          const getLabel = ctor?.ee?.getSchema
            ? () => ctor.ee.getSchema()?.element?.label
            : ctor?.ee?.getElementLabel;
          const l = getLabel?.();
          if (l && typeof l === "string") label = l;
        } catch (_) {}
        return label;
      };

      if (allowed.length === 1) {
        const tag = allowed[0];
        const label = renderLabelForTag(tag);
        return html`<sp-action-button
          quiet
          size="m"
          title=${`Add ${label}`}
          @click=${() =>
            this._freezeToolbarPositionDuring(() =>
              this.addElementToSlot(tag, "default")
            )}
        >
          <sp-icon-add slot="icon"></sp-icon-add>
          ${label}
        </sp-action-button>`;
      }

      const onChange = (e) => {
        const value = e.target?.value;
        if (value) this.addElementToSlot(value, "default");
      };
      return html`<sp-action-menu
        quiet
        size="m"
        label="Add"
        @change=${(e) => this._freezeToolbarPositionDuring(() => onChange(e))}
      >
        ${allowed.map(
          (tag) =>
            html`<sp-menu-item value=${tag}
              >${renderLabelForTag(tag)}</sp-menu-item
            >`
        )}
      </sp-action-menu>`;
    } catch (_) {
      return nothing;
    }
  }

  // Form mode removed; replaced with popovers

  renderCustomActions(actions) {
    const items = Array.isArray(actions.customActions)
      ? actions.customActions
      : [];
    if (!items.length) return nothing;
    const renderIcon = (icon) => {
      switch (icon) {
        case 'edit':
          return html`<sp-icon-edit slot="icon"></sp-icon-edit>`;
        case 'gears-edit':
          return html`<sp-icon-gears-edit slot="icon"></sp-icon-gears-edit>`;
        default:
          return html`<sp-icon-edit slot="icon"></sp-icon-edit>`;
      }
    };
    return html`${items.map(
      (action) => html`<sp-action-button
        quiet
        size="m"
        title=${action.label || action.id}
        @click=${() =>
          this._freezeToolbarPositionDuring(() => {
            try {
              action.run?.();
            } catch (e) {
              console.error('[toolbar] custom action error', e);
            }
          })}
      >
        ${renderIcon(action.icon)}
      </sp-action-button>`
    )}`;
  }

  // Slot editing UI removed from toolbar

  // Popover that shows all fields (attributes + slot selectors)
  renderFieldsPopover(actions) {
    return html`
      <overlay-trigger triggered-by="click hover" placement="bottom-start" offset="6">
        <sp-action-button
          slot="trigger"
          quiet
          title="Show all fields"
          @click=${() => {
            this._freezeToolbarPositionDuring(() => {
              this.log("debug", "popover trigger clicked");
              this.showAllOpen = true;
            });
          }}
        >
          <sp-icon-table slot="icon"></sp-icon-table>
        </sp-action-button>
        <sp-popover slot="click-content" .open=${this.showAllOpen}>
          <div class="popover-content">
            ${this.renderRemainingFormPanel(actions)}
          </div>
        </sp-popover>
      </overlay-trigger>
    `;
  }

  // renderActionsPopover removed

  // Slot controls: add allowed elements, type text (inline), clear content if any
  renderSlotControls(actions) {
    const current = actions.slots?.current;
    if (!current) return nothing;
    const cfg = actions.slots?.getConfig?.(current) || {};
    const info = actions.slots?.slotInfo?.[current] || {};
    const maxLen =
      cfg.maxLength === null || cfg.maxLength === undefined
        ? Infinity
        : cfg.maxLength;
    const count = info.count ?? 0;
    const canAdd = count < maxLen;
    // Hide ee-reference from Add menus; use copy/paste to insert references
    const allowedTags = (Array.isArray(cfg.allowedTags) ? cfg.allowedTags : [])
      .map((t) => String(t))
      .filter((tag) => {
        const lower = tag.toLowerCase();
        if (lower === 'ee-reference') return false;
        if (BASE_TEXT_TAGS.has(lower)) return false;
        return true;
      });
    const inlineEditable = cfg.inlineEditable === true;
    const parent = actions.parentElement || this.store?.editingElement;

    const addButtons =
      canAdd && allowedTags.length
        ? html`<sp-action-group quiet selects="none">
            ${allowedTags.map((tag) => {
              let label = tag;
              try {
                const ctor =
                  typeof tag === "string" ? customElements.get(tag) : null;
                const getLabel = ctor?.ee?.getElementLabel;
                const l = getLabel?.();
                if (l && typeof l === "string") label = l;
              } catch (_) {}
              return html`<sp-action-button
                quiet
                title=${`Add ${label}`}
                @click=${() =>
                  this._freezeToolbarPositionDuring(() =>
                    this.addElementToSlot(tag, current)
                  )}
              >
                <sp-icon-add slot="icon"></sp-icon-add>
                ${label}
              </sp-action-button>`;
            })}
          </sp-action-group>`
        : nothing;

    const typeTextButton = inlineEditable
      ? html`<sp-action-button
          quiet
          title="Type text"
          @click=${() =>
            this._freezeToolbarPositionDuring(() =>
              this.typeTextInSlot(parent, current)
            )}
        >
          <sp-icon-text-size slot="icon"></sp-icon-text-size>
        </sp-action-button>`
      : nothing;

    const hasAnyContent = this._slotHasAnyContent(
      parent,
      current,
      !!parent?.shadowRoot
    );
    const clearButton = hasAnyContent
      ? html`<sp-action-button
          quiet
          title="Clear content"
          @click=${() =>
            this._freezeToolbarPositionDuring(() => this.clearSlot(current))}
        >
          <sp-icon-delete slot="icon"></sp-icon-delete>
        </sp-action-button>`
      : nothing;

    const pasteBtn = this.renderPasteButton(actions, { context: "slot" });

    // Build formatting group using slot-allowed formats (only when enabled)
    const formattingParts = [];
    if (actions?.textFormatting?.enabled) {
      const editBtn = this.renderEditButton(actions);
      if (editBtn !== nothing) formattingParts.push(editBtn);
      // Only show formatting controls in inline edit mode
      if (this.store?.isContentEditable) {
        const tf = this.renderTextFormatting(actions);
        if (tf !== nothing) formattingParts.push(tf);
        const al = this.renderAlignmentAndList();
        if (al !== nothing) formattingParts.push(al);
      }
    }

    // Build slot action buttons group
    const slotActionParts = [];
    if (addButtons !== nothing) slotActionParts.push(addButtons);
    if (typeTextButton !== nothing) slotActionParts.push(typeTextButton);
    if (pasteBtn !== nothing) slotActionParts.push(pasteBtn);
    if (clearButton !== nothing) slotActionParts.push(clearButton);

    // If neither group has content, render nothing
    if (!formattingParts.length && !slotActionParts.length) return nothing;

    return html`
      <div class="row">
        ${this.renderSelectParentButton()}
        ${formattingParts.length
          ? html`<span class="group" aria-label="Formatting"
              >${formattingParts}</span
            >`
          : nothing}
        ${slotActionParts.length
          ? html`<span class="group" aria-label="Slot Actions"
              >${slotActionParts}</span
            >`
          : nothing}
      </div>
    `;
  }

  canPasteContext(actions, opts = {}) {
    try {
      const inInlineEdit = !!this.store?.isContentEditable;
      if (inInlineEdit) return { text: true, elements: false };
      const context = opts.context || (actions.slots?.current ? "slot" : "default");
      const slotName = context === "slot" ? actions.slots?.current : "default";
      if (!actions?.slots?.getConfig || !slotName) return { text: false, elements: false };
      const cfg = actions.slots.getConfig(slotName) || {};
      const info = actions.slots?.slotInfo?.[slotName] || {};
      const maxLen = cfg.maxLength == null ? Infinity : cfg.maxLength;
      const count = info.count ?? 0;
      const canAdd = count < maxLen;
      const allowed = Array.isArray(cfg.allowedTags) ? cfg.allowedTags : [];
      const inlineEditable = cfg.inlineEditable === true || (Array.isArray(cfg.allowedFormats) && cfg.allowedFormats.length > 0);
      return {
        text: inlineEditable && false, // only paste text when in inline edit to ensure caret/selection exists
        elements: canAdd,
      };
    } catch (_) {
      return { text: false, elements: false };
    }
  }

  renderPasteButton(actions, opts = {}) {
    const can = this.canPasteContext(actions, opts);
    const contextEnabled = !!this.store?.isContentEditable || can.elements;
    if (!contextEnabled) return nothing;
    // If we haven't checked yet, default to disabled and kick off a check
    if (this.clipboardHasTextOrHtml == null) {
      this.clipboardHasTextOrHtml = false;
      this.checkClipboardForPaste();
    }
    const enabled = contextEnabled && !!this.clipboardHasTextOrHtml;
    return html`<sp-action-button
      quiet
      title="Paste"
      ?disabled=${!enabled}
      @mouseenter=${() => this.checkClipboardForPaste()}
      @focus=${() => this.checkClipboardForPaste()}
      @click=${() => this._freezeToolbarPositionDuring(() => this.pasteFromClipboard(actions, opts))}
    >
      <sp-icon-paste slot="icon"></sp-icon-paste>
    </sp-action-button>`;
  }

  async checkClipboardForPaste() {
    try {
      if (this.#checkingClipboard) return;
      this.#checkingClipboard = true;
      let hasTextOrHtml = false;
      try {
        if (navigator.clipboard?.read) {
          const items = await navigator.clipboard.read();
          for (const item of items || []) {
            const types = Array.isArray(item.types) ? item.types : [];
            if (types.includes('text/html') || types.includes('text/plain')) {
              hasTextOrHtml = true;
              break;
            }
          }
        }
      } catch (_) {
        // ignore and fall back to readText
      }
      if (!hasTextOrHtml) {
        try {
          const text = await navigator.clipboard.readText?.();
          if (text && String(text).trim()) hasTextOrHtml = true;
        } catch (_) {}
      }
      this.clipboardHasTextOrHtml = !!hasTextOrHtml;
    } catch (_) {
      this.clipboardHasTextOrHtml = false;
    } finally {
      this.#checkingClipboard = false;
    }
  }

  async pasteFromClipboard(actions, opts = {}) {
    try {
      if (this.store?.isContentEditable) {
        // Paste HTML if available; otherwise fall back to plain text
        if (!this.store?.isContentEditable) this.store?.enableContentEditable();
        let inserted = false;
        const sanitizeSelfReference = (html) => {
          try {
            const currentId =
              this.store?.currentElementId || this.store?.store?.editorStore?.currentElementId || this.store?.editorStore?.currentElementId;
            if (!currentId) return html;
            const parser = new DOMParser();
            const doc = parser.parseFromString(String(html || ''), 'text/html');
            const refs = doc.body.querySelectorAll('ee-reference');
            refs.forEach((refEl) => {
              try {
                // Prefer modern 'urn' attribute; fallback to legacy 'ref' if present
                const r = refEl.getAttribute('urn') || refEl.getAttribute('ref');
                if (r && r === currentId) {
                  refEl.remove();
                }
              } catch (_) {}
            });
            return doc.body.innerHTML;
          } catch (_) {
            return html;
          }
        };
        const insertHTMLAtCaret = (html) => {
          try {
            const sanitized = this.store?.sanitizeInlineHtml
              ? this.store.sanitizeInlineHtml(html)
              : html;
            if (sanitized == null) return false;
            const plainOnly = this.store?.isPlainTextOnly?.() === true;
            const sel = window.getSelection();
            if (!sel) return false;
            if (sel.rangeCount === 0) return false;
            const range = sel.getRangeAt(0);
            if (plainOnly) {
              document.execCommand('insertText', false, sanitized);
              return true;
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(String(sanitized || ''), 'text/html');
            const frag = document.createDocumentFragment();
            Array.from(doc.body.childNodes).forEach((n) => frag.appendChild(n));
            range.deleteContents();
            range.insertNode(frag);
            try {
              const node = this.store?.editingElement || range.endContainer;
              const r = document.createRange();
              const container = node && node.lastChild ? node : range.endContainer;
              if (container && container.nodeType === Node.ELEMENT_NODE) {
                r.selectNodeContents(container);
                r.collapse(false);
                sel.removeAllRanges();
                sel.addRange(r);
              }
            } catch (_) {}
            return true;
          } catch (_) {
            return false;
          }
        };
        try {
          if (navigator.clipboard?.read) {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              if (item.types?.includes && item.types.includes('text/html')) {
                const blob = await item.getType('text/html');
                const html = await blob.text();
                if (html) {
                  const cleaned = sanitizeSelfReference(html);
                  if (cleaned && cleaned.trim()) {
                    inserted = insertHTMLAtCaret(cleaned);
                  }
                  if (inserted) break;
                }
              }
            }
            if (!inserted) {
              // Try plain text via ClipboardItem
              for (const item of items) {
                if (item.types?.includes && item.types.includes('text/plain')) {
                  const blob = await item.getType('text/plain');
                  const text = await blob.text();
                  if (text) {
                    // If it looks like HTML, insert as HTML; else as text
                    if (text.includes('<')) {
                      const cleaned = sanitizeSelfReference(text);
                      if (cleaned && cleaned.trim()) {
                        inserted = insertHTMLAtCaret(cleaned);
                      }
                    }
                    if (!inserted) {
                      inserted = insertHTMLAtCaret(text);
                    }
                    if (inserted) break;
                  }
                }
              }
            }
          }
        } catch (_) {
          // ignore and fall back to readText
        }
        if (!inserted) {
          const text = (await navigator.clipboard.readText?.()) || "";
          if (!text) return;
          if (text.includes('<')) {
            const cleaned = sanitizeSelfReference(text);
            if (cleaned && cleaned.trim()) {
              inserted = insertHTMLAtCaret(cleaned);
            }
          }
          if (!inserted) {
            inserted = insertHTMLAtCaret(text);
          }
        }
        if (inserted) this.store?.scheduleSnapshot();
        return;
      }

      // Element paste into a slot
      const context = opts.context || (actions.slots?.current ? "slot" : "default");
      const slotName = context === "slot" ? actions.slots?.current : "default";
      if (!slotName || !actions?.slots?.getConfig) return;
      const cfg = actions.slots.getConfig(slotName) || {};
      const info = actions.slots?.slotInfo?.[slotName] || {};
      const maxLen = cfg.maxLength == null ? Infinity : cfg.maxLength;
      const count = info.count ?? 0;
      const remaining = Math.max(0, maxLen - count);
      const allowed = Array.isArray(cfg.allowedTags) ? cfg.allowedTags.map((t) => String(t).toLowerCase()) : [];
      if (!remaining) return;

      const text = (await navigator.clipboard.readText?.()) || "";
      if (!text || !text.includes("<")) return; // basic HTML gate
      let doc = null;
      try {
        const parser = new DOMParser();
        doc = parser.parseFromString(text, "text/html");
      } catch (_) {}
      if (!doc) return;
      const toInsert = [];
      const children = Array.from(doc.body?.children || []);
      for (const el of children) {
        const tag = el.tagName?.toLowerCase?.();
        if (!tag) continue;
        if (!allowed.includes(tag)) continue;
        toInsert.push(el);
        if (toInsert.length >= remaining) break;
      }
      if (!toInsert.length) {
        // Allow pasting an ee-reference snippet regardless of allowedTags
        const refEl = doc.body.querySelector('ee-reference');
        if (refEl) {
          // Prevent pasting a reference to the currently edited element
          const currentId = this.store?.currentElementId || this.store?.store?.editorStore?.currentElementId || this.store?.editorStore?.currentElementId;
          // Prefer modern 'urn' attribute; fallback to legacy 'ref'
          const urn = refEl.getAttribute('urn') || refEl.getAttribute('ref');
          if (urn && currentId && urn === currentId) {
            // Explicitly keep the current selection stable
            try { this.store?.selectElement(this.store?.editingElement); } catch (_) {}
            return;
          }
          const el = document.createElement('ee-reference');
          if (urn) el.setAttribute('urn', urn);
          const trigger = refEl.querySelector('[slot="trigger"]');
          if (trigger) el.appendChild(trigger.cloneNode(true));
          toInsert.push(el);
        }
        if (!toInsert.length) return;
      }

      const parent = actions.parentElement || this.store?.editingElement;
      if (!parent) return;
      const isSameSlot = (child) => {
        if (!(child && child.nodeType === Node.ELEMENT_NODE)) return false;
        if (slotName === "default") return !child.hasAttribute("slot");
        return child.getAttribute("slot") === slotName;
      };
      const childrenEls = Array.from(parent.children);
      let lastSame = null;
      for (let i = childrenEls.length - 1; i >= 0; i--) {
        if (isSameSlot(childrenEls[i])) { lastSame = childrenEls[i]; break; }
      }
      let firstAdded = null;
      for (const node of toInsert) {
        const el = node.cloneNode(true);
        if (slotName !== "default") try { el.setAttribute("slot", slotName); } catch (_) {}
        if (lastSame && lastSame.parentNode === parent) {
          const ref = lastSame.nextSibling;
          parent.insertBefore(el, ref);
        } else {
          parent.appendChild(el);
        }
        lastSame = el;
        if (!firstAdded) firstAdded = el;
      }
      if (firstAdded) this.store?.selectElement(firstAdded);
      this.store?.scheduleSnapshot();
    } catch (_) {}
  }

  renderPrimaryAttributes(actions) {
    // Heuristically pick first 1-3 attrs for compact row
    const schema = actions.attributes?.schema || {};
    const entries = Object.entries(schema).slice(0, 3);
    if (!entries.length) return nothing;
    return html`${entries.map(([name, def]) =>
      this.renderAttributeField(name, def)
    )}`;
  }

  _openPopoverProgrammatically() {
    try {
      const trigger = this.shadowRoot?.querySelector(
        'overlay-trigger > [slot="trigger"]'
      );
      if (trigger) {
        this.showAllOpen = true;
        trigger.click();
        this.log("debug", "programmatic trigger click for reopen");
      } else {
        const pop = this.shadowRoot?.querySelector(
          'sp-popover[slot="click-content"]'
        );
        if (pop) {
          this.showAllOpen = true;
          pop.open = true;
          this.log("debug", "fallback popover.open=true for reopen");
        }
      }
    } catch (err) {
      this.log("error", "failed to programmatically reopen popover", { err });
    } finally {
      this._shouldReopenPopover = false;
    }
  }

  // Only attributes are included in the compact "Fields" group
  renderPrimaryFields(actions, options) {
    const includeAttrs = options?.includeAttrs;
    const renders = [];
    this._compactSlotsIncluded = 0;
    if (includeAttrs) {
      const schema = actions.attributes?.schema || {};
      for (const [name, def] of Object.entries(schema)) {
        if (def?.type === 'popover') continue;
        renders.push(this.renderAttributeField(name, def));
        this._inlineAttrNames.push(name);
        if (renders.length >= 2) break;
      }
    }
    if (!renders.length) return nothing;
    return html`${renders}`;
  }

  // Render popover-type attributes (e.g., icon, color, size) in their own group
  renderPopoverAttributes(actions) {
    try {
      const schema = actions.attributes?.schema || {};
      const entries = Object.entries(schema).filter(([, def]) => def?.type === 'popover');
      if (!entries.length) return nothing;
      const controls = entries.map(([name, def]) => this.renderAttributeField(name, def));
      return html`${controls}`;
    } catch (_) {
      return nothing;
    }
  }

  // Slot field renderer removed

  renderAlignmentAndList() {
    const actions = this.actions;
    const allowed = actions?.textFormatting?.allowedFormats;
    const isSlotContent = !!actions?.isSlotContent;
    const isAlignKey = (k) =>
      k === "align-left" || k === "align-center" || k === "align-right";
    const isListKey = (k) => k === "unordered-list" || k === "ordered-list";
    const show = (key) => {
      // For elements inside a slot, alignment must be explicitly authorized
      if (isSlotContent && (isAlignKey(key) || isListKey(key))) {
        return Array.isArray(allowed) && allowed.includes(key);
      }
      return !Array.isArray(allowed) || allowed.includes(key);
    };
    const alignButtons = [
      show("align-left")
        ? html`<sp-action-button
            quiet
            title="Align left"
            @click=${() => this.execCommand("justifyLeft")}
          >
            <sp-icon-text-align-left slot="icon"></sp-icon-text-align-left>
          </sp-action-button>`
        : nothing,
      show("align-center")
        ? html`<sp-action-button
            quiet
            title="Align center"
            @click=${() => this.execCommand("justifyCenter")}
          >
            <sp-icon-text-align-center slot="icon"></sp-icon-text-align-center>
          </sp-action-button>`
        : nothing,
      show("align-right")
        ? html`<sp-action-button
            quiet
            title="Align right"
            @click=${() => this.execCommand("justifyRight")}
          >
            <sp-icon-text-align-right slot="icon"></sp-icon-text-align-right>
          </sp-action-button>`
        : nothing,
    ].filter((x) => x !== nothing);

    const listButtons = [
      show("unordered-list")
        ? html`<sp-action-button
            quiet
            title="Bulleted list"
            @click=${() => this.execCommand("insertUnorderedList")}
          >
            <sp-icon-list-bulleted slot="icon"></sp-icon-list-bulleted>
          </sp-action-button>`
        : nothing,
      show("ordered-list")
        ? html`<sp-action-button
            quiet
            title="Numbered list"
            @click=${() => this.execCommand("insertOrderedList")}
          >
            <sp-icon-list-numbered slot="icon"></sp-icon-list-numbered>
          </sp-action-button>`
        : nothing,
    ].filter((x) => x !== nothing);

    if (!alignButtons.length && !listButtons.length) {
      return nothing;
    }
    return html`
      ${alignButtons.length
        ? html`<sp-action-group quiet selects="none"
            >${alignButtons}</sp-action-group
          >`
        : nothing}
      ${listButtons.length
        ? html`<sp-action-group quiet selects="none"
            >${listButtons}</sp-action-group
          >`
        : nothing}
    `;
  }

  // Quick slot actions removed

  // Text formatting (inline editing helpers)
  renderTextFormatting(actions) {
    const allowed = actions.textFormatting?.allowedFormats;
    const show = (key) => {
      // When allowed is undefined/null -> show all. Empty array -> show none.
      if (allowed == null) return true;
      if (Array.isArray(allowed)) return allowed.includes(key);
      return true;
    };
    const insideLink = !!this.store?.inlineLinkEditingTarget;
    const hasSelection = this.hasTextSelection();
    const validLinkSelection = hasSelection && this.isValidLinkSelection();
    const buttons = [
      show("bold")
        ? html`<sp-action-button
            quiet
            title="Bold"
            @click=${() => this.execCommand("bold")}
          >
            <sp-icon-text-bold slot="icon"></sp-icon-text-bold>
          </sp-action-button>`
        : nothing,
      show("italic")
        ? html`<sp-action-button
            quiet
            title="Italic"
            @click=${() => this.execCommand("italic")}
          >
            <sp-icon-text-italic slot="icon"></sp-icon-text-italic>
          </sp-action-button>`
        : nothing,
      show("underline")
        ? html`<sp-action-button
            quiet
            title="Underline"
            @click=${() => this.execCommand("underline")}
          >
            <sp-icon-text-underline slot="icon"></sp-icon-text-underline>
          </sp-action-button>`
        : nothing,
      show("strikethrough")
        ? html`<sp-action-button
            quiet
            title="Strikethrough"
            @click=${() => this.execCommand("strikeThrough")}
          >
            <sp-icon-text-strikethrough
              slot="icon"
            ></sp-icon-text-strikethrough>
          </sp-action-button>`
        : nothing,
      show("superscript")
        ? html`<sp-action-button
            quiet
            title="Superscript"
            @click=${() => this.execCommand("superscript")}
          >
            <sp-icon-text-superscript
              slot="icon"
            ></sp-icon-text-superscript>
          </sp-action-button>`
        : nothing,
      show("subscript")
        ? html`<sp-action-button
            quiet
            title="Subscript"
            @click=${() => this.execCommand("subscript")}
          >
            <sp-icon-text-subscript
              slot="icon"
            ></sp-icon-text-subscript>
          </sp-action-button>`
        : nothing,
      show("code")
        ? html`<sp-action-button
            quiet
            title="Inline code"
            @click=${() => this.toggleInlineTag("code")}
          >
            <sp-icon-code slot="icon"></sp-icon-code>
          </sp-action-button>`
        : nothing,
      show("mark")
        ? html`<sp-action-button
            quiet
            title="Highlight"
            @click=${() => this.toggleInlineTag("mark")}
          >
            <sp-icon-brush slot="icon"></sp-icon-brush>
          </sp-action-button>`
        : nothing,
      // Link controls: only show when applicable
      // - Show Remove when caret/selection is inside a link
      // - Show Create only when selection is valid AND linking is allowed
      (insideLink &&
        html`<sp-action-button
          quiet
          title="Remove link"
          @click=${() => this.unlinkSelection()}
        >
          <sp-icon-link slot="icon"></sp-icon-link>
        </sp-action-button>`) ||
        (show("link") && validLinkSelection
          ? html`<sp-action-button
              quiet
              title="Convert selection to link"
              @click=${() => this.createLink()}
            >
              <sp-icon-link slot="icon"></sp-icon-link>
            </sp-action-button>`
          : nothing),
    ].filter((x) => x !== nothing);
    if (!buttons.length) return nothing;
    return html`<sp-action-group quiet selects="none"
      >${buttons}</sp-action-group
    >`;
  }

  hasTextSelection() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
      const range = sel.getRangeAt(0);
      const host = this.store?.editingElement || null;
      if (!host) return false;
      const startEl = this._nearestElement(range.startContainer);
      const endEl = this._nearestElement(range.endContainer);
      return (
        !!startEl && !!endEl && host.contains(startEl) && host.contains(endEl)
      );
    } catch (_) {
      return false;
    }
  }

  // Guard: only allow creating links when selection stays within a single block container
  isValidLinkSelection() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
      const range = sel.getRangeAt(0);
      // Validate against the editing host, not the inner edit target
      const container = this.store?.editingElement || null;
      if (!container) return false;

      const startEl = this._nearestElement(range.startContainer);
      const endEl = this._nearestElement(range.endContainer);
      if (!startEl || !endEl) return false;
      if (!container.contains(startEl) || !container.contains(endEl))
        return false;

      const startBlock = this._nearestBlock(startEl, container);
      const endBlock = this._nearestBlock(endEl, container);
      // If both resolve and are different, selection crosses blocks -> invalid
      if (startBlock && endBlock && startBlock !== endBlock) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  _nearestElement(node) {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) return node;
    return node.parentElement || null;
  }

  _isBlockElement(el) {
    try {
      const tn = (el.tagName || "").toUpperCase();
      const blockTags = new Set([
        "DIV",
        "P",
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "UL",
        "OL",
        "LI",
        "SECTION",
        "ARTICLE",
        "NAV",
        "ASIDE",
        "HEADER",
        "FOOTER",
        "MAIN",
        "TABLE",
        "THEAD",
        "TBODY",
        "TFOOT",
        "TR",
        "TD",
        "TH",
        "DL",
        "DT",
        "DD",
        "PRE",
        "BLOCKQUOTE",
      ]);
      if (blockTags.has(tn)) return true;
      const cs = window.getComputedStyle(el);
      const disp = cs && cs.display;
      return (
        disp === "block" ||
        disp === "list-item" ||
        disp === "table" ||
        disp === "flex" ||
        disp === "grid"
      );
    } catch (_) {
      return false;
    }
  }

  _nearestBlock(el, boundary) {
    let cur = el;
    while (cur && cur !== boundary && cur !== document.body) {
      if (this._isBlockElement(cur)) return cur;
      cur = cur.parentElement;
    }
    return boundary || null;
  }

  _ancestorWithTag(node, tagName, boundary) {
    if (!node || !tagName) return null;
    const target = String(tagName).toLowerCase();
    let cur = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (cur && cur !== boundary && cur !== document.body) {
      if (cur.tagName?.toLowerCase?.() === target) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  _unwrapElement(el) {
    const parent = el?.parentNode;
    if (!parent) return;
    const selection = window.getSelection();
    const nodes = [];
    while (el.firstChild) {
      const child = el.firstChild;
      nodes.push(child);
      parent.insertBefore(child, el);
    }
    parent.removeChild(el);
    if (nodes.length && selection) {
      const range = document.createRange();
      range.setStartBefore(nodes[0]);
      range.setEndAfter(nodes[nodes.length - 1]);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  toggleInlineTag(tagName) {
    this._freezeToolbarPositionDuring(() => {
      try {
        if (!this.store?.isContentEditable) {
          this.store?.enableContentEditable();
        }
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const host = this.store?.editingElement || null;
        if (!host) return;
        const startEl = this._nearestElement(range.startContainer) || range.startContainer;
        const endEl = this._nearestElement(range.endContainer) || range.endContainer;
        const existingStart = this._ancestorWithTag(startEl, tagName, host);
        const existingEnd = this._ancestorWithTag(endEl, tagName, host);
        if (existingStart && existingStart === existingEnd) {
          this._unwrapElement(existingStart);
          this.store?.scheduleSnapshot();
          return;
        }
        const fragment = range.extractContents();
        const wrapper = document.createElement(String(tagName));
        wrapper.appendChild(fragment);
        range.insertNode(wrapper);
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        sel.removeAllRanges();
        sel.addRange(newRange);
        this.store?.scheduleSnapshot();
      } catch (_) {}
    });
  }

  createLink() {
    this._freezeToolbarPositionDuring(() => {
      try {
        if (!this.store?.isContentEditable) {
          this.store?.enableContentEditable();
        }
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        if (!this.isValidLinkSelection()) return;
        // Wrap selection in an anchor with placeholder href
        document.execCommand("createLink", false, "#");
        // Try to detect the created anchor and switch toolbar to link mode immediately
        try {
          const range = sel.getRangeAt(0);
          const host = this.store?.editingElement || null;
          const nearestEl = (node) => {
            if (!node) return null;
            if (node.nodeType === Node.ELEMENT_NODE) return node;
            return node.parentElement || null;
          };
          const findAnchorUp = (node, boundary) => {
            let cur = nearestEl(node);
            while (cur && cur !== boundary && cur !== document.body) {
              if (cur.tagName && cur.tagName.toLowerCase() === "a") return cur;
              cur = cur.parentElement;
            }
            return null;
          };
          let anchor =
            findAnchorUp(range.startContainer, host) ||
            findAnchorUp(range.endContainer, host);
          // As a fallback, search for the closest <a> around the range
          if (!anchor && host) {
            const anchors = host.querySelectorAll("a");
            for (const a of anchors) {
              if (range.intersectsNode && range.intersectsNode(a)) {
                anchor = a;
                break;
              }
            }
          }
          if (anchor) {
            // Place caret inside the anchor (end of contents)
            try {
              const r = document.createRange();
              r.selectNodeContents(anchor);
              r.collapse(false);
              sel.removeAllRanges();
              sel.addRange(r);
            } catch (_) {}
            // Tell store to treat this as the current inline link target
            try {
              this.store?.setInlineLinkEditingTarget(anchor);
            } catch (_) {}
            try {
              this.store?.updateEEToolbarPosition();
            } catch (_) {}
          }
        } catch (_) {}
        this.store?.scheduleSnapshot();
      } catch (_) {}
    });
  }

  unlinkSelection() {
    this._freezeToolbarPositionDuring(() => {
      try {
        if (!this.store?.isContentEditable) {
          this.store?.enableContentEditable();
        }
        document.execCommand("unlink", false);
        this.store?.setInlineLinkEditingTarget(null);
        this.store?.scheduleSnapshot();
      } catch (_) {}
    });
  }

  execCommand(cmd) {
    this._freezeToolbarPositionDuring(() => {
      const el = this.store?.editingElement;
      if (!el) return;
      if (!this.store?.isContentEditable) {
        this.store?.enableContentEditable();
      }
      document.execCommand(cmd, false);
      this.store?.scheduleSnapshot();
    });
  }

  // Attribute + slot form panel
  renderFormPanel(actions) {
    const schema = actions.attributes?.schema || {};
    return html`
      ${Object.keys(schema).length
        ? html`
            <div class="attributes">
              ${Object.entries(schema).map(([name, def]) =>
                this.renderAttributeField(name, def)
              )}
            </div>
          `
        : nothing}
    `;
  }

  // Remaining attributes only (exclude those shown inline); vertical form
  renderRemainingFormPanel(actions) {
    if (!this.showAllOpen) return nothing;
    const schema = actions.attributes?.schema || {};
    const rest = Object.entries(schema).filter(
      ([name, def]) => !this._inlineAttrNames.includes(name) && def?.type !== 'popover'
    );
    if (!rest.length) return nothing;
    return html`
      <div class="attributes">
        ${rest.map(([name, def]) => this.renderAttributeField(name, def))}
      </div>
    `;
  }

  // Inline edit starter (pen icon)
  renderEditButton(actions) {
    const canShow =
      !!actions?.textFormatting?.enabled &&
      this.store &&
      !this.store.isContentEditable;
    if (!canShow) return nothing;
    return html`
      <sp-action-button
        quiet
        title="Edit text"
        @click=${() =>
          this._freezeToolbarPositionDuring(() => this.startInlineEditing())}
      >
        <sp-icon-edit slot="icon"></sp-icon-edit>
      </sp-action-button>
    `;
  }

  startInlineEditing() {
    try {
      this.store?.enableContentEditable();
    } catch (_) {}
  }

  // Slot helpers
  _slotHasAnyContent(parent, slotName, inShadow) {
    try {
      if (!parent) return false;
      if (inShadow) {
        const selector =
          slotName === "default"
            ? "slot:not([name])"
            : `slot[name="${slotName}"]`;
        const slotEl = parent.shadowRoot?.querySelector(selector);
        const assigned = slotEl ? slotEl.assignedNodes() : [];
        return assigned.some(
          (n) =>
            n.nodeType === Node.ELEMENT_NODE ||
            (n.nodeType === Node.TEXT_NODE &&
              n.textContent &&
              n.textContent.trim())
        );
      }
      if (slotName === "default") {
        // any child without slot attr or any non-empty text node
        const hasEl = Array.from(parent.children).some(
          (c) => !c.hasAttribute("slot")
        );
        const hasText = Array.from(parent.childNodes).some(
          (n) =>
            n.nodeType === Node.TEXT_NODE &&
            n.textContent &&
            n.textContent.trim()
        );
        return hasEl || hasText;
      }
      // named slot: only elements with matching slot attribute
      return Array.from(parent.children).some(
        (c) => c.getAttribute("slot") === slotName
      );
    } catch (_) {
      return false;
    }
  }
  typeTextInSlot(parent, slotName) {
    this._freezeToolbarPositionDuring(() => {
      if (!parent || !slotName) return;
      this.store?.selectSlot(parent, slotName);
    });
  }

  addElementToSlot(tagName, slotName) {
    const parent = this.store?.editingElement;
    if (!parent) return;
    this._freezeToolbarPositionDuring(() => {
      try {
        let el = null;
        const isCustom = typeof tagName === "string" && tagName.includes("-");
        if (isCustom) {
          const ctor = customElements.get(tagName);
          el = ctor.ee.create();
        }
        if (!el) {
          el = document.createElement(tagName);
        }

        // Provide sensible defaults for common vanilla elements
        try {
          const tag = (
            typeof tagName === "string"
              ? tagName
              : el?.tagName?.toLowerCase?.() || ""
          ).toLowerCase();
          if (tag === "a") {
            // Ensure anchor is interactable and visible
            if (!el.getAttribute("href")) el.setAttribute("href", "#");
            const hasContent =
              !!(el.textContent && el.textContent.trim()) ||
              el.childNodes.length > 0;
            if (!hasContent) {
              el.textContent = "Link";
              // Mark as placeholder without adding a DOM attribute
              el.eePlaceholder = true;
            }
          }
        } catch (_) {}

        if (
          slotName !== "default" &&
          el &&
          el.setAttribute &&
          !el.hasAttribute("slot")
        ) {
          el.setAttribute("slot", slotName);
        }

        // Insert next to the last existing element in the same slot (if any)
        const isSameSlot = (child) => {
          if (!(child && child.nodeType === Node.ELEMENT_NODE)) return false;
          if (slotName === "default") return !child.hasAttribute("slot");
          return child.getAttribute("slot") === slotName;
        };
        const children = Array.from(parent.children);
        let lastSameSlot = null;
        for (let i = children.length - 1; i >= 0; i--) {
          if (isSameSlot(children[i])) {
            lastSameSlot = children[i];
            break;
          }
        }

        if (lastSameSlot && lastSameSlot.parentNode === parent) {
          // Insert after the last same-slot sibling for natural ordering within the slot
          const ref = lastSameSlot.nextSibling;
          parent.insertBefore(el, ref);
        } else {
          // Fallback: append to parent
          parent.appendChild(el);
        }
        this.store?.selectElement(el);
        this.store?.scheduleSnapshot();
      } catch (e) {
        this.log &&
          this.log("warn", "Failed to add element to slot", {
            tagName,
            slotName,
            e,
          });
      }
    });
  }

  clearSlot(slotName) {
    const parent = this.store?.editingElement;
    if (!parent) return;
    this._freezeToolbarPositionDuring(() => {
      const toRemove = Array.from(parent.childNodes).filter((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node;
          return slotName === "default"
            ? !el.hasAttribute("slot")
            : el.getAttribute("slot") === slotName;
        }
        // Also remove text nodes assigned to default slot
        if (node.nodeType === Node.TEXT_NODE) {
          if (slotName === "default") return true;
        }
        return false;
      });
      toRemove.forEach((n) => n.remove());
      // Keep slot context selected
      this.store?.selectSlot(parent, slotName);
      this.store?.scheduleSnapshot();
    });
  }

  renderAttributeField(name, def) {
    const element = this.selectedElement || this.store?.editingElement;
    // Evaluate visibility/derived state based on live element
    let evaluateResult = null;
    if (def && typeof def.evaluate === 'function') {
      evaluateResult = def.evaluate({
        element,
        name,
        def,
        read: (attrName, fallbackDef = { default: "" }) => this.getAttributeValue(element, attrName, fallbackDef),
      }) || null;
    }
    if (evaluateResult && evaluateResult.render === false) {
      return nothing;
    }
    const currentValue = this.getAttributeValue(element, name, def);

    if ((def.type === "custom" || def.type === "popover") && def.render) {
      const control = def.render({
        html,
        value: currentValue,
        onChange: (v) => this.updateAttribute(name, v),
        updateAttribute: (attrName, v) => this.updateAttribute(attrName, v),
        read: (attrName) => this.getAttributeValue(element, attrName, { default: "" }),
      });
      return html` <div>
        <sp-field-label>${def.label || name}</sp-field-label>
        ${control}
        ${def.description
          ? html`<sp-help-text>${def.description}</sp-help-text>`
          : nothing}
      </div>`;
    }

    if (def.type === "enum" && Array.isArray(def.options)) {
      const pickerId = `picker-${name}`;
      return html` <div>
        <sp-field-label for="${pickerId}">${def.label || name}</sp-field-label>
        <sp-picker
          id="${pickerId}"
          value="${currentValue}"
          placeholder="${def.placeholder || def.description || ""}"
          @change=${(e) => this.updateAttribute(name, e.target.value)}
        >
          ${def.options.map((opt) => {
            const val = String(opt);
            // Schema may provide a renderer function for options that returns markup
            if (def.optionRenderer) {
              try {
                const content = def.optionRenderer(val);
                return html`<sp-menu-item value="${val}"
                  >${unsafeHTML(content)}</sp-menu-item
                >`;
              } catch (_) {
                // fall back to plain text if renderer throws
              }
            }
            return html`<sp-menu-item value="${val}">${val}</sp-menu-item>`;
          })}
        </sp-picker>
        ${def.description
          ? html`<sp-help-text>${def.description}</sp-help-text>`
          : nothing}
      </div>`;
    }

    if (def.type === "boolean") {
      return html` <div>
        <sp-checkbox
          ?checked=${!!currentValue}
          @change=${(e) => this.updateBooleanAttribute(name, e.target.checked)}
          >${def.label || name}</sp-checkbox
        >
        ${def.description
          ? html`<sp-help-text>${def.description}</sp-help-text>`
          : nothing}
      </div>`;
    }

    if (def.type === "number") {
      return html` <div>
        <sp-field-label>${def.label || name}</sp-field-label>
        <sp-number-field
          value="${Number(currentValue) || 0}"
          min="${def.min ?? ""}"
          max="${def.max ?? ""}"
          step="${def.step ?? 1}"
          placeholder="${def.placeholder || def.description || ""}"
          @change=${(e) => this.updateAttribute(name, e.target.valueAsNumber)}
        ></sp-number-field>
        ${def.description
          ? html`<sp-help-text>${def.description}</sp-help-text>`
          : nothing}
      </div>`;
    }

    // default text
    return html` <div>
      <sp-field-label>${def.label || name}</sp-field-label>
      <sp-textfield
        value="${String(currentValue || "")}"
        placeholder="${def.placeholder || def.description || ""}"
        @change=${(e) => this.updateAttribute(name, e.target.value)}
      ></sp-textfield>
      ${def.description
        ? html`<sp-help-text>${def.description}</sp-help-text>`
        : nothing}
    </div>`;
  }

  getAttributeValue(element, name, def) {
    if (!element) return def?.default ?? "";
    if (def?.type === "boolean") return element.hasAttribute(name);
    return element.getAttribute(name) ?? def?.default ?? "";
  }

  getAttributeValues() {
    const actions = this.actions;
    const element = this.selectedElement || this.store?.editingElement;
    const schema = actions?.attributes?.schema || {};
    if (!element)
      return Object.fromEntries(
        Object.keys(schema).map((k) => [k, schema[k]?.default ?? null])
      );
    const values = {};
    for (const [attrName, def] of Object.entries(schema)) {
      if (def.type === "boolean") {
        values[attrName] = element.hasAttribute(attrName);
      } else if (def.type === "number") {
        const v = element.getAttribute(attrName);
        values[attrName] =
          v !== null && v !== undefined ? Number(v) : def.default ?? null;
      } else {
        values[attrName] = element.getAttribute(attrName) ?? def.default ?? "";
      }
    }
    return values;
  }

  updateBooleanAttribute(name, checked) {
    this._freezeToolbarPositionDuring(() => {
      const element = this.selectedElement || this.store?.editingElement;
      if (!element) return;
      if (checked) {
        element.setAttribute(name, "");
      } else {
        element.removeAttribute(name);
      }
      this.store?.scheduleSnapshot();
    });
  }

  handleBooleanAttributeChange(name, checked) {
    this.updateBooleanAttribute(name, checked);
  }

  updateAttribute(name, value) {
    this._freezeToolbarPositionDuring(() => {
      const element = this.selectedElement || this.store?.editingElement;
      if (!element) return;
      if (value === undefined || value === null) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, String(value));
      }
      this.store?.scheduleSnapshot();
    });
  }

  // All slot selection/editing helpers removed

  renderReorderGroup(actions) {
    const el = actions.element;
    const canUp = !!actions.reordering?.canMoveUp;
    const canDown = !!actions.reordering?.canMoveDown;
    if (!canUp && !canDown) {
      return nothing;
    }
    return html`
      <sp-action-group quiet selects="none">
        <sp-action-button
          quiet
          title="Move up"
          ?disabled=${!canUp}
          @click=${() =>
            this._freezeToolbarPositionDuring(() =>
              this.store.moveElementBefore(el)
            )}
        >
          <sp-icon-chevron-up slot="icon"></sp-icon-chevron-up>
        </sp-action-button>
        <sp-action-button
          quiet
          title="Move down"
          ?disabled=${!canDown}
          @click=${() =>
            this._freezeToolbarPositionDuring(() =>
              this.store.moveElementAfter(el)
            )}
        >
          <sp-icon-chevron-down slot="icon"></sp-icon-chevron-down>
        </sp-action-button>
      </sp-action-group>
    `;
  }

  renderSelectParentButton() {
    const can = !!this.store?.canSelectParent;
    if (!can) return nothing;
    return html`
      <sp-action-button
        class="select-parent-btn"
        quiet
        title="Select parent"
        @click=${() => this.store.selectParent()}
      >
        <span slot="icon" class="select-parent-icon">
          <sp-icon-chevron-double-left style="transform: rotate(45deg);"></sp-icon-chevron-double-left>
        </span>
      </sp-action-button>
    `;
  }

  renderDuplicateDelete(actions) {
    const el = actions.element;
    const slotSelected = !!actions.slots?.current;
    const canDuplicate = actions.duplicationAllowed !== false && !slotSelected;
    const lockable = this.hasAuthoringSchema(el);
    const locked = lockable && this.isAuthoringLocked(el);
    return html`
      <sp-action-group quiet selects="none">
        ${this.renderLockButton(actions)}
        ${locked
          ? nothing
          : html`
              <sp-action-button
                quiet
                title="Duplicate"
                ?disabled=${!canDuplicate}
                @click=${() =>
                  this._freezeToolbarPositionDuring(() =>
                    this.store.duplicateElement(el)
                  )}
              >
                <sp-icon-duplicate slot="icon"></sp-icon-duplicate>
              </sp-action-button>
              ${slotSelected
                ? nothing
                : html`<sp-action-button
                    quiet
                    title="Delete"
                    @click=${() =>
                      this._freezeToolbarPositionDuring(() =>
                        this.store.deleteElement(el)
                      )}
                  >
                    <sp-icon-delete slot="icon"></sp-icon-delete>
                  </sp-action-button>`}
            `}
      </sp-action-group>
    `;
  }
}

customElements.define("ee-toolbar", makeLitObserver(EEToolbar));

export { EEToolbar };

import { LitElement, html, css } from "lit";







import "./merch-mnemonic.js";

class SpectrumProductPalette extends LitElement {
  static properties = {
    name: { type: String, reflect: true },
    size: { type: String, reflect: true },
    products: { type: Array },
    // Editor store for direct updates (optional; resolves from editor context if not provided)
    store: { type: Object, attribute: false },
    // Attribute names to update on the current editing element
    nameAttr: { type: String, attribute: 'name-attr' },
    sizeAttr: { type: String, attribute: 'size-attr' },
  };

  static styles = css`
    :host {
      display: inline-block;
    }
    .panel {
      display: block;
      /* Prefer growing horizontally; clamp to viewport */
      width: max-content;
      max-width: min(90vw, 1280px);
      max-height: min(70vh, 720px);
      overflow: auto; /* last resort scroll */
      box-sizing: border-box;
    }
    .grid {
      display: grid;
      /* Fixed 6 columns for a wider popover */
      grid-template-columns: repeat(6, 84px);
      gap: 10px;
      padding: var(--spectrum-global-dimension-size-100);
      background-color: var(--spectrum-alias-component-background-color);
    }
    button.tile {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 84px;
      height: 84px;
      padding: 6px 4px;
      border: 1px solid var(--spectrum-global-color-gray-300);
      background: var(--spectrum-global-color-gray-50);
      border-radius: var(--spectrum-global-dimension-size-100);
      cursor: pointer;
    }
    button.tile[aria-current="true"] {
      outline: 2px solid var(--spectrum-global-color-blue-600);
    }
    /* Prevent nested mnemonic from handling pointer events (no new tabs) */
    button.tile merch-mnemonic {
      pointer-events: none;
    }
    .name {
      max-width: 100%;
      text-align: center;
      font-size: 11px;
      color: var(--spectrum-alias-label-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* Compact buttons in the size selector */
    sp-action-group {
      --swc-actionbutton-m-min-width: 0;
      padding: var(--spectrum-global-dimension-size-100);
      display: inline-flex;
      flex-wrap: wrap;
      gap: var(--spectrum-global-dimension-size-100);
    }
    sp-field-label {
      padding: var(--spectrum-global-dimension-size-100);
      padding-bottom: 0;
      display: inline-block;
    }
  `;

  constructor() {
    super();
    this.name = "";
    this.size = "m";
    this.products = [];
    this.nameAttr = 'name';
    this.sizeAttr = 'size';
  }

  handlePick(name) {
    this.name = name || "";
    this.applyToEditingElement('name');
  }

  handleSize(size) {
    this.size = size || "m";
    this.applyToEditingElement('size');
  }

  renderTile(name) {
    const isCurrent = this.name === name;
    const title = name || "default-app-icon";
    return html`
      <button
        type="button"
        class="tile"
        aria-current=${isCurrent ? "true" : "false"}
        title=${title}
        aria-label=${title}
        @click=${{
          handleEvent: (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handlePick(name);
          },
          capture: true,
        }}
      >
        <merch-mnemonic icon-only size="l" name=${name}></merch-mnemonic>
        <div class="name">${title}</div>
      </button>
    `;
  }

  get previewIconTemplate() {
    const n = this.name;
    if (!n) return html`<sp-icon-app slot="icon" size="m"></sp-icon-app>`;
    // Show current product icon in the toolbar trigger at size "m" and disable pointer events
    return html`<merch-mnemonic slot="icon" icon-only size="m" name=${n} style="pointer-events: none;"></merch-mnemonic>`;
  }

  render() {
    const items = Array.isArray(this.products) ? this.products : [];
    return html`
      <overlay-trigger triggered-by="click hover" placement="bottom-start" offset="6">
        <sp-action-button slot="trigger" size="l" quiet title="Choose product icon" aria-label="Choose product icon">
          ${this.previewIconTemplate}
        </sp-action-button>
        <sp-popover slot="click-content" open>
          <div class="panel">
            <sp-field-label size="s">Size</sp-field-label>
            <sp-action-group
              quiet
              selects="single"
            @change=${(e) => { e.stopPropagation(); }}
            @click=${(e) => { e.stopPropagation(); }}
            >
              ${["xxs", "xs", "s", "m", "l", "xl", "xxl"].map((sz) => html`
                <sp-action-button
                  quiet
                  ?selected=${(this.size || "m") === sz}
                @click=${(e) => { e.stopPropagation(); this.handleSize(sz); }}
                >${sz.toUpperCase()}</sp-action-button>
              `)}
            </sp-action-group>
            <div class="grid" role="grid" aria-label="Adobe products">
              ${items.map((name) => this.renderTile(name))}
            </div>
          </div>
        </sp-popover>
      </overlay-trigger>
    `;
  }

  // Apply current selection to the editor's selected element
  applyToEditingElement(what) {
      const store = this.store || (document.querySelector('experience-elements-editor')?.editorStore || null);
    const current = store?.editingElement || null;
    if (!current) return;
    // Target parent element when selection is slot content
    const actions = (store && (store.toolbarActions || store.toolbarActionsData)) || null;
    const el = (actions && actions.isSlotContent && actions.parentElement) ? actions.parentElement : current;
    if (!what || what === 'name') {
      const n = (this.name || '').trim();
      const a = this.nameAttr || 'name';
      if (!n) el.removeAttribute(a); else el.setAttribute(a, n);
    }
    if (!what || what === 'size') {
      const s = (this.size || '').trim();
      const a = this.sizeAttr || 'size';
      if (!s) el.removeAttribute(a); else el.setAttribute(a, s);
    }
    store?.scheduleSnapshot?.();
  }
}

customElements.define("spectrum-product-palette", SpectrumProductPalette);

export { SpectrumProductPalette };

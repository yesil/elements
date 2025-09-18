import { LitElement, html, css } from "lit";






const SIZES = ["xxs", "xs", "s", "m", "l", "xl", "xxl"];


class SpectrumSizePalette extends LitElement {
  static properties = {
    size: { type: String, reflect: true },
    // Editor store for direct updates (optional; resolves from editor context if not provided)
    store: { type: Object, attribute: false },
    // Attribute name to update on the editing element
    attr: { type: String },
    // Optional allowed sizes override; pass as property (Array)
    sizes: { attribute: false },
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      text-align: left;
      background-color: var(--spectrum-alias-component-background-color);
      box-sizing: border-box;
      padding: 2px 2px;
      border-radius: var(--spectrum-global-dimension-size-100);
    }
    sp-menu { min-width: 160px; }
  `;

  constructor() {
    super();
    this.size = "";
    this.attr = "size";
  }

  #pick(v) {
    this.size = (v || "").toLowerCase();
    this.applyToEditingElement();
  }

  #renderRow(size) {
    const isCurrent = (this.size || "") === (size || "");
    const label = (size || "").toUpperCase();
    return html`<sp-menu-item value="${size}" ?selected=${isCurrent}
      >${label}</sp-menu-item
    >`;
  }

  render() {
    const selected = (this.size || "").trim().toLowerCase();
    const hasSelection = SIZES.includes(selected);
    const selectedLabel = hasSelection ? selected.toUpperCase() : "Size";
    const allowed = Array.isArray(this.sizes) && this.sizes.length
      ? this.sizes.filter((s) => SIZES.includes(s))
      : SIZES;
    const onMenuChange = (e) => {
      // Prevent bubbling 'change' from sp-menu reaching parent listeners,
      // so only the host's re-dispatched change event is observed.
      e.stopPropagation();
      const v = e.target?.value;
      if (v) this.#pick(v);
    };
    return html`
      <overlay-trigger triggered-by="click hover" placement="bottom-start" offset="6">
        <sp-action-button slot="trigger" size="l" quiet title="Choose size">
          ${selectedLabel}
        </sp-action-button>
        <sp-popover slot="click-content" open>
          <sp-menu selects="single" @change=${onMenuChange}>
            ${allowed.map((s) => this.#renderRow(s))}
          </sp-menu>
        </sp-popover>
      </overlay-trigger>
    `;
  }

  // Apply current size to the editor's selected element
  applyToEditingElement() {
    const store = this.store || (document.querySelector('experience-elements-editor')?.editorStore || null);
    const current = store?.editingElement || null;
    const name = this.attr || 'size';
    if (!current || !name) return;
    // Target parent element when selection is slot content
    const actions = (store && (store.toolbarActions || store.toolbarActionsData)) || null;
    const el = (actions && actions.isSlotContent && actions.parentElement) ? actions.parentElement : current;
    const v = (this.size || '').trim();
    if (!v) el.removeAttribute(name);
    else el.setAttribute(name, v);
    store?.scheduleSnapshot?.();
  }
}

customElements.define("spectrum-size-palette", SpectrumSizePalette);

export { SpectrumSizePalette };

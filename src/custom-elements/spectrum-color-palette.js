import { LitElement, html, css, nothing } from "lit";









class SpectrumColorPalette extends LitElement {
  static properties = {
    color: { type: String, reflect: true },
    // Editor store for direct updates (optional; will resolve from editor context if not provided)
    store: { type: Object, attribute: false },
    // Attribute name to write on the current editing element
    attr: { type: String },
    swatchSize: { type: Number, attribute: "swatch-size" },
    includeInherit: { type: Boolean, attribute: "include-inherit" },
    label: { type: String },
    _expanded: { state: true },
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      text-align: left;
      background-color: var(--spectrum-alias-component-background-color);
      box-sizing: border-box;
      padding: 2px 2px; /* unify with icon palette */
      border-radius: var(--spectrum-global-dimension-size-100);
    }

    button.swatch {
      display: inline-block;
      border: 1px solid var(--spectrum-global-color-gray-200);
      padding: 0;
      margin: 0 2px; /* remove vertical margin to normalize height */
      width: 34px; /* 10% smaller baseline */
      height: 34px; /* 10% smaller baseline */
      cursor: pointer;
      background: transparent;
      vertical-align: middle;
    }

    overlay-trigger[placement="bottom-start"] {
      display: inline-block;
      vertical-align: middle;
    }
    button.swatch[aria-current="true"] {
      outline: 2px solid var(--spectrum-global-color-blue-600);
    }
    /* Inherit swatch: show a neutral placeholder tile */
    button.swatch.inherit {
      background: var(--spectrum-global-color-gray-75);
      border-color: var(--spectrum-global-color-gray-300);
      position: relative;
    }
    button.swatch.inherit::after {
      content: "";
      position: absolute;
      inset: 20%;
      border-radius: var(--spectrum-global-dimension-size-50);
      background: var(--spectrum-global-color-gray-200);
      border: 1px solid var(--spectrum-global-color-gray-400);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }
    /* Popover content layout */
    .popover-content {
      background-color: var(--spectrum-global-color-gray-50);
      padding: var(--spectrum-global-dimension-size-200);
      max-height: 60vh;
      overflow: auto;
    }
    .inherit-row {
      display: flex;
      align-items: center;
      gap: var(--spectrum-global-dimension-size-150);
      margin-bottom: var(--spectrum-global-dimension-size-200);
    }
    table.color-table {
      border-collapse: separate;
      border-spacing: 6px;
    }
    table.color-table thead th {
      font-size: 11px;
      font-weight: 600;
      color: var(--spectrum-global-color-gray-800);
      text-align: center;
      padding: 2px 4px;
      white-space: nowrap;
    }
    table.color-table tbody th {
      font-size: 12px;
      font-weight: 500;
      color: var(--spectrum-global-color-gray-900);
      text-align: left;
      padding: 2px 6px;
      white-space: nowrap;
    }
    table.color-table td {
      padding: 0;
      text-align: center;
    }
    /* Swatch icon used inside the action button */
    .button-swatch {
      display: inline-block;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      box-sizing: border-box;
      border: 1px solid var(--spectrum-global-color-gray-300);
      background-clip: padding-box;
    }
  `;

  constructor() {
    super();
    this.color = "";
    this.attr = "color";
    this.swatchSize = 29; // 10% smaller default
    this.includeInherit = true;
    this._expanded = false;
  }

  get #tones() {
    return [
      100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400,
    ];
  }

  get #mainColors() {
    return ["yellow", "green", "blue", "red"];
  }

  get #allColors() {
    const others = [
      "gray",
      "orange",
      "chartreuse",
      "celery",
      "seafoam",
      "indigo",
      "purple",
      "fuchsia",
      "magenta",
    ];
    return [...this.#mainColors, ...others];
  }

  get #orderedColors() {
    return this.#allColors;
  }

  handlePick(token) {
    this.color = token || "";
    this.applyToEditingElement();
  }

  toggleMore() {
    this._expanded = !this._expanded;
  }

  renderSwatch(token) {
    const size = `${this.swatchSize}px`;
    // Do not set background inline for inherit so CSS can render the placeholder tile
    const style = token
      ? `width:${size};height:${size};background: var(${token});`
      : `width:${size};height:${size};`;
    const isCurrent = this.color === token;
    const cls = token ? "swatch" : "swatch inherit";
    if (!token) {
      return html`<overlay-trigger triggered-by="click hover" placement="top" offset="6">
        <button
          class="${cls}"
          slot="trigger"
          title="Inherit"
          aria-current=${isCurrent ? "true" : "false"}
          style=${style}
          @click=${(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            this.handlePick(token);
          }}
        ></button>
        <sp-tooltip slot="hover-content">Inherit</sp-tooltip>
      </overlay-trigger>`;
    }
    const [_, colorName, tone] = token.match(/^--spectrum-([a-z]+)-(\d{3,4})$/) || [
      null,
      token,
      "",
    ];
    const label = `${colorName} ${tone}`;
    return html`<overlay-trigger triggered-by="click hover" placement="top" offset="6">
      <button
        class="${cls}"
        slot="trigger"
        title=${label}
        aria-label=${label}
        aria-current=${isCurrent ? "true" : "false"}
        style=${style}
        @click=${(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          this.handlePick(token);
        }}
      ></button>
      <sp-tooltip slot="hover-content">${label}</sp-tooltip>
    </overlay-trigger>`;
  }

  render() {
    const tones = this.#tones;
    const colors = this.#orderedColors;
    const selectedToken = this.color || "";
    const swatchIcon = selectedToken
      ? html`<span slot="icon" class="button-swatch" style="background: var(${selectedToken});"></span>`
      : html`<sp-icon-color-harmony slot="icon" size="l"></sp-icon-color-harmony>`;
    return html`
      ${this.label ? html`<sp-field-label>${this.label}</sp-field-label>` : nothing}
      <overlay-trigger placement="bottom-start" offset="6">
        <sp-action-button
          slot="trigger"
          size="l"
          quiet
          title="Choose color"
        >
          ${swatchIcon}
        </sp-action-button>
        <sp-popover slot="click-content" open>
          <div class="popover-content">
            ${this.includeInherit
              ? html`<div class="inherit-row">
                  <sp-field-label size="s">Inherit</sp-field-label>
                  ${this.renderSwatch("")}
                </div>`
              : nothing}
            <table class="color-table" role="grid" aria-label="Spectrum color tokens">
              <thead>
                <tr>
                  <th scope="col">Color</th>
                  ${tones.map((t) => html`<th scope="col">${t}</th>`)}
                </tr>
              </thead>
              <tbody>
                ${colors.map(
                  (name) => html`<tr>
                    <th scope="row">${this.#formatLabel(name)}</th>
                    ${tones.map((tone) => html`<td>
                      ${this.renderSwatch(`--spectrum-${name}-${tone}`)}
                    </td>`)}
                  </tr>`
                )}
              </tbody>
            </table>
          </div>
        </sp-popover>
      </overlay-trigger>
    `;
  }

  #formatLabel(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  // Apply current palette value to the editor's selected element
  applyToEditingElement() {
    const store = this.store || (document.querySelector('experience-elements-editor')?.editorStore || null);
    const current = store?.editingElement || null;
    const name = this.attr || 'color';
    if (!current || !name) return;
    // Target parent element when selection is slot content
    const actions = (store && (store.toolbarActions || store.toolbarActionsData)) || null;
    const el = (actions && actions.isSlotContent && actions.parentElement) ? actions.parentElement : current;
    const v = (this.color || '').trim();
    if (!v) el.removeAttribute(name);
    else el.setAttribute(name, v);
    store?.scheduleSnapshot?.();
  }
}

customElements.define("spectrum-color-palette", SpectrumColorPalette);

export { SpectrumColorPalette };

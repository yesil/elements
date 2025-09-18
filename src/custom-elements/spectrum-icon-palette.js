import { LitElement, html, css } from "lit";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";








// Import a wide set of Spectrum workflow icons





















// Minimal list of Spectrum icon tags; this can be extended or fetched dynamically
const DEFAULT_ICONS = [
  "sp-icon-info",
  "sp-icon-add",
  "sp-icon-checkmark",
  "sp-icon-close",
  "sp-icon-edit",
  "sp-icon-more",
  "sp-icon-alert",
  "sp-icon-star",
  "sp-icon-tag",
  "sp-icon-link",
  "sp-icon-email",
  "sp-icon-user",
  "sp-icon-download",
  "sp-icon-upload",
  "sp-icon-search",
  "sp-icon-calendar",
  "sp-icon-home",
  "sp-icon-heart",
  "sp-icon-settings",
  "sp-icon-flag",
];

class SpectrumIconPalette extends LitElement {
  static properties = {
    name: { type: String, reflect: true },
    size: { type: String, reflect: true },
    color: { type: String, reflect: true },
    rotate: { type: Number, reflect: true },
    // Flip controls
    flipH: { type: Boolean, reflect: true, attribute: 'flip-h' },
    flipV: { type: Boolean, reflect: true, attribute: 'flip-v' },
    icons: { type: Array },
    label: { type: String },
    _expanded: { state: true },
    // Editor store for direct updates (optional; resolves from editor context if not provided)
    store: { type: Object, attribute: false },
    // Attribute names to update on the current editing element
    nameAttr: { type: String, attribute: 'name-attr' },
    sizeAttr: { type: String, attribute: 'size-attr' },
    rotateAttr: { type: String, attribute: 'rotate-attr' },
    flipHAttr: { type: String, attribute: 'flip-h-attr' },
    flipVAttr: { type: String, attribute: 'flip-v-attr' },
  };

  static styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      max-width: 560px;
      background-color: var(--spectrum-alias-component-background-color);
      box-sizing: border-box;
      padding: 2px 2px; /* unify with color palette */
      border-radius: var(--spectrum-global-dimension-size-100);
    }
    button.icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--spectrum-global-color-gray-300);
      background: var(--spectrum-global-color-gray-50);
      width: 29px; /* unify height with color swatch */
      height: 29px; /* unify height with color swatch */
      border-radius: 6px;
      cursor: pointer;
    }
    button.icon[aria-current="true"] {
      outline: 2px solid var(--spectrum-global-color-blue-600);
    }
    /* Inherit icon tile: neutral placeholder */
    button.icon.inherit {
      position: relative;
      background: var(--spectrum-global-color-gray-75);
      border-color: var(--spectrum-global-color-gray-300);
    }
    button.icon.inherit::after {
      content: "";
      position: absolute;
      inset: 22%;
      border-radius: var(--spectrum-global-dimension-size-50);
      background: var(--spectrum-global-color-gray-200);
      border: 1px solid var(--spectrum-global-color-gray-400);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }
    .grid {
      display: grid;
      background-color: var(--spectrum-global-color-gray-50);
      grid-template-columns: repeat(8, 36px); /* 10% smaller cells */
      gap: 6px;
      padding: 8px;
    }
    /* Compose preview transform via CSS variables so rotate + flips can combine */
    sp-action-button [slot="icon"] {
      transform:
        var(--ee-icon-rotate, none)
        var(--ee-icon-flipx, none)
        var(--ee-icon-flipy, none);
    }
    :host([rotate="90"])  { --ee-icon-rotate: rotate(90deg); }
    :host([rotate="180"]) { --ee-icon-rotate: rotate(180deg); }
    :host([rotate="270"]) { --ee-icon-rotate: rotate(270deg); }
    :host([flip-h]) { --ee-icon-flipx: scaleX(-1); }
    :host([flip-v]) { --ee-icon-flipy: scaleY(-1); }
  `;

  constructor() {
    super();
    this.name = "";
    this.icons = DEFAULT_ICONS;
    this.size = "m";
    this.color = "";
    this.rotate = 0;
    this.flipH = false;
    this.flipV = false;
    this._expanded = false;
    this.nameAttr = 'name';
    this.sizeAttr = 'size';
    this.rotateAttr = 'rotate';
    this.flipHAttr = 'flip-h';
    this.flipVAttr = 'flip-v';
  }

  firstUpdated() {
    // Ensure local state reflects the currently selected element
    try {
      const store = this.store || (document.querySelector('experience-elements-editor')?.editorStore || null);
      const current = store?.editingElement || null;
      if (!current) return;
      // If current selection is slot content, prefer the parent element as the target
      const actions = (store && (store.toolbarActions || store.toolbarActionsData)) || null;
      const el = (actions && actions.isSlotContent && actions.parentElement) ? actions.parentElement : current;
      const get = (attr) => (el.getAttribute(attr) ?? '').toString();
      this.name = get(this.nameAttr || 'name') || this.name;
      this.size = (get(this.sizeAttr || 'size') || this.size || 'm').toLowerCase();
      const r = Number(get(this.rotateAttr || 'rotate'));
      this.rotate = Number.isFinite(r) ? r : this.rotate;
      this.flipH = el.hasAttribute(this.flipHAttr || 'flip-h');
      this.flipV = el.hasAttribute(this.flipVAttr || 'flip-v');
    } catch (_) {}
  }

  handlePick(tag) {
    this.name = tag || "";
    this.applyToEditingElement('name');
  }

  renderIcon(tag) {
    const isCurrent = this.name === tag;
    if (!tag) {
      return html`<overlay-trigger triggered-by="click hover" placement="top" offset="6">
        <button
          class="icon inherit"
          slot="trigger"
          aria-current=${isCurrent ? "true" : "false"}
          title="Inherit"
          @click=${() => this.handlePick("")}
        ></button>
        <sp-tooltip slot="hover-content">Inherit</sp-tooltip>
      </overlay-trigger>`;
    }
    const t = unsafeStatic(tag);
    return staticHtml`<button class="icon" aria-current=${
      isCurrent ? "true" : "false"
    } title=${tag} @click=${() => this.handlePick(tag)}>
      <${t}></${t}>
    </button>`;
  }

  render() {
    const selectedTag = this.name && this.icons.includes(this.name)
      ? this.name
      : "";
    const SelectedIcon = selectedTag ? unsafeStatic(selectedTag) : null;
    return html`
      ${this.label ? html`<sp-field-label>${this.label}</sp-field-label>` : null}
      <overlay-trigger triggered-by="click hover" placement="bottom-start" offset="6">
        <sp-action-button slot="trigger" size="l" quiet title="Choose icon">
          ${SelectedIcon
            ? staticHtml`<${SelectedIcon} slot="icon" ${this.color ? `style=\"color: var(${this.color});\"` : ''}></${SelectedIcon}>`
            : html`<sp-icon-more slot="icon" size="l"></sp-icon-more>`}
        </sp-action-button>
        <sp-popover slot="click-content" open>
          <div class="grid">
            ${this.renderIcon("")}
            ${this.icons.map((t) => this.renderIcon(t))}
          </div>
          <sp-divider size="s"></sp-divider>
          <div class="size-controls" style="padding: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <sp-field-label size="s">Size</sp-field-label>
            <sp-action-group
              quiet
              selects="single"
              @change=${(e) => { e.stopPropagation(); }}
              @click=${(e) => { e.stopPropagation(); }}
            >
              ${['xxs','xs','s','m','l','xl','xxl'].map((sz) => html`
                <sp-action-button
                  quiet
                  ?selected=${(this.size || 'm') === sz}
                  @click=${() => {
                    this.size = (sz || '').toLowerCase();
                    this.applyToEditingElement('size');
                  }}
                >${sz}</sp-action-button>
              `)}
            </sp-action-group>
          </div>
          <div class="rotate-controls" style="padding: 8px; display: flex; align-items: center; gap: 8px;">
            <sp-field-label size="s">Rotate</sp-field-label>
            <sp-action-group quiet selects="none">
              ${[0, 90, 180, 270].map((deg) => html`
                <sp-action-button
                  quiet
                  ?selected=${Number(this.rotate) === deg}
                  @click=${() => {
                    this.rotate = deg;
                    this.applyToEditingElement('rotate');
                  }}
                >${deg}&deg;</sp-action-button>
              `)}
            </sp-action-group>
          </div>
          <div class="flip-controls" style="padding: 8px; display: flex; align-items: center; gap: 8px;">
            <sp-field-label size="s">Flip</sp-field-label>
            <sp-action-group quiet>
              <sp-action-button
                quiet
                toggles
                .selected=${!!this.flipH}
                @click=${() => {
                  this.flipH = !this.flipH;
                  this.applyToEditingElement('flipH');
                }}
              >H</sp-action-button>
              <sp-action-button
                quiet
                toggles
                .selected=${!!this.flipV}
                @click=${() => {
                  this.flipV = !this.flipV;
                  this.applyToEditingElement('flipV');
                }}
              >V</sp-action-button>
            </sp-action-group>
          </div>
        </sp-popover>
      </overlay-trigger>
    `;
  }

  // Apply current palette values to the editor's selected element
  applyToEditingElement(what) {
    const store = this.store || (document.querySelector('experience-elements-editor')?.editorStore || null);
    const current = store?.editingElement || null;
    if (!current) return;
    // If current selection is slot content, prefer the parent element as the target
    const actions = (store && (store.toolbarActions || store.toolbarActionsData)) || null;
    const el = (actions && actions.isSlotContent && actions.parentElement) ? actions.parentElement : current;
    const setOrRemove = (attr, val) => {
      if (!attr) return;
      const v = (val ?? '').toString().trim();
      if (!v) el.removeAttribute(attr);
      else el.setAttribute(attr, v);
    };
    const setBool = (attr, flag) => {
      if (!attr) return;
      if (flag) el.setAttribute(attr, '');
      else el.removeAttribute(attr);
    };
    if (!what || what === 'name') setOrRemove(this.nameAttr || 'name', this.name || '');
    if (!what || what === 'size') setOrRemove(this.sizeAttr || 'size', (this.size || '').toLowerCase());
    if (!what || what === 'rotate') setOrRemove(this.rotateAttr || 'rotate', Number(this.rotate) || 0);
    if (!what || what === 'flipH') setBool(this.flipHAttr || 'flip-h', !!this.flipH);
    if (!what || what === 'flipV') setBool(this.flipVAttr || 'flip-v', !!this.flipV);
    store?.scheduleSnapshot?.();
  }
}

customElements.define("spectrum-icon-palette", SpectrumIconPalette);

export { SpectrumIconPalette };

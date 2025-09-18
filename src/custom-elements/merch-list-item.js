import { LitElement, html, nothing } from "lit";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";
import { merchListItemStyleSheet } from "./merch-list-item.css.js";

export class MerchListItem extends LitElement {
  static styles = [merchListItemStyleSheet];

  static properties = {
    name: { type: String, attribute: "name", reflect: true },
    size: { type: String, attribute: "size", reflect: true },
    color: { type: String, attribute: "color", reflect: true },
    rotate: { type: Number, attribute: "rotate", reflect: true },
    flipH: { type: Boolean, attribute: 'flip-h', reflect: true },
    flipV: { type: Boolean, attribute: 'flip-v', reflect: true },
  };

  constructor() {
    super();
    this.name = "";
    this.size = "";
    this.color = "";
    this.rotate = null;
    this.flipH = null;
    this.flipV = null;
    this._iconDefaultsListener = null;
    this._iconDefaultsSource = null;
  }

  connectedCallback() {
    super.connectedCallback();
    // ARIA listitem semantics on host
    this.setAttribute('role', 'listitem');
    // Re-render when nearest parent merch-list updates its defaults
    this._iconDefaultsListener = () => this.requestUpdate();
    this._iconDefaultsSource = this.closest("merch-list");
    if (this._iconDefaultsSource) {
      this._iconDefaultsSource.addEventListener(
        "merch-list:icon-defaults-changed",
        this._iconDefaultsListener
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._iconDefaultsSource && this._iconDefaultsListener) {
      this._iconDefaultsSource.removeEventListener(
        "merch-list:icon-defaults-changed",
        this._iconDefaultsListener
      );
    }
    this._iconDefaultsSource = null;
    this._iconDefaultsListener = null;
  }

  renderIcon() {
    const { name, size, color } = this.resolveIconProps();
    if (!name) return nothing;
    const t = unsafeStatic(name);
    const style = color
      ? color.startsWith("--")
        ? `color: var(${color})`
        : `color: ${color}`
      : null;
    return staticHtml`<${t} size=${size || nothing} style=${style || nothing}></${t}>`;
  }

  render() {
    const iconTpl = this.renderIcon();
    return html`
      <div id="item">
        <div id="icon">
          <slot name="icon">${iconTpl}</slot>
        </div>
        <div id="content">
          <slot></slot>
        </div>
      </div>
    `;
  }

  resolveIconProps() {
    const parent = this.closest("merch-list");
    const localName = this.name || parent?.name;
    const localSize = this.size || parent?.size;
    const localColor = this.color || parent?.color;
    const localRotation =
      this.rotate != null && this.rotate !== ""
        ? this.rotate
        : parent?.rotate;
    return { name: localName, size: localSize, color: localColor, rotate: localRotation };
  }
}

customElements.define("merch-list-item", MerchListItem);

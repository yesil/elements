import { LitElement, html } from "lit";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";
import { merchCalloutStyleSheet } from "./merch-callout.css.js";


/**
 * MerchCallout
 * LitElement implementation with Spectrum icon support.
 * Attributes:
 * - variant: visual variant string (e.g., 'default')
 * - name: tag name of a Spectrum icon (e.g., 'sp-icon-info')
 * - size: Spectrum icon size token ('s' | 'm' | 'l')
 * - color: CSS var token name (e.g., '--spectrum-blue-900') applied to color
 */
export class MerchCallout extends LitElement {
  static get properties() {
    return {
      name: { type: String, attribute: "name" },
      size: { type: String, attribute: "size" },
      color: { type: String, attribute: "color" },
      rotate: { type: Number, attribute: "rotate" },
      flipH: { type: Boolean, attribute: 'flip-h', reflect: true },
      flipV: { type: Boolean, attribute: 'flip-v', reflect: true },
    };
  }

  static get styles() {
    return [merchCalloutStyleSheet];
  }

  constructor() {
    super();
    this.name = "";
    this.size = "m";
    this.color = "";
    this.rotate = 0;
    this.flipH = false;
    this.flipV = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // Expose as an advisory note region
    this.setAttribute('role', 'note');
    this.ensureIconRegistered();
  }

  updated(changed) {
    if (changed.has('name')) this.ensureIconRegistered();
  }

  static #attempted = new Set();
  async ensureIconRegistered() {
    const tag = (this.name || '').trim();
    if (!tag || customElements.get(tag) || MerchCallout.#attempted.has(tag)) return;
    MerchCallout.#attempted.add(tag);
    // Best-effort dynamic import for workflow icons in preview/runtime
    if (tag.startsWith('sp-icon-')) {
      try {
        await import(`@spectrum-web-components/icons-workflow/icons/${tag}.js`);
      } catch (e) {
        console.warn(`[merch-callout] failed to load icon module for ${tag}`, e);
      }
    }
  }

  get iconTemplate() {
    const tag = (this.name || "").trim();
    const size = (this.size || "m").trim();
    try {
      if (tag && customElements.get(tag)) {
        const T = unsafeStatic(tag);
        return staticHtml`<${T} size=${size}></${T}>`;
      }
    } catch (_) {}
    return html`<sp-icon-info size=${size}></sp-icon-info>`;
  }

  render() {
    const iconStyle = this.color ? `color: var(${this.color})` : "";
    return html`
      <div id="content">
        <slot></slot>
      </div>
      <div id="icon" style=${iconStyle}>
        <slot name="icon">${this.iconTemplate}</slot>
      </div>
    `;
  }
}

customElements.define("merch-callout", MerchCallout);

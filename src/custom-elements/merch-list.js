import { LitElement, html } from "lit";
import { merchListStyleSheet } from "./merch-list.css.js";

export class MerchList extends LitElement {
  static styles = [merchListStyleSheet];

  static properties = {
    name: { type: String, attribute: "name" },
    size: { type: String, attribute: "size" },
    color: { type: String, attribute: "color" },
    rotate: { type: Number, attribute: "rotate" },
    flipH: { type: Boolean, attribute: 'flip-h', reflect: true },
    flipV: { type: Boolean, attribute: 'flip-v', reflect: true },
  };

  constructor() {
    super();
    this.name = "";
    this.size = "";
    this.color = "";
    this.rotate = 0;
    this.flipH = false;
    this.flipV = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // ARIA list semantics
    this.setAttribute("role", "list");
    // Keep aria-labelledby in sync with label slot
    this.updateAriaLabelling();
    try {
      const s = this.shadowRoot?.querySelector('slot[name="label"]');
      if (s) s.addEventListener("slotchange", () => this.updateAriaLabelling());
    } catch (_) {}
  }

  updateAriaLabelling() {
    try {
      const labelEl = this.querySelector('[slot="label"]');
      if (labelEl) {
        if (!labelEl.id)
          labelEl.id = `ml-label-${Math.random().toString(36).slice(2, 8)}`;
        this.setAttribute("aria-labelledby", labelEl.id);
      } else {
        this.removeAttribute("aria-labelledby");
      }
    } catch (_) {}
  }

  updated(changed) {
    // Notify children that icon defaults may have changed when attributes update
    if (
      changed.has("name") ||
      changed.has("size") ||
      changed.has("color") ||
      changed.has("rotate") ||
      changed.has('flipH') ||
      changed.has('flipV')
    ) {
      try {
        this.dispatchEvent(
          new CustomEvent("merch-list:icon-defaults-changed", {
            bubbles: true,
            composed: true,
          })
        );
      } catch (_) {}
    }
    // Ensure ARIA stays correct when attributes or children change
    this.updateAriaLabelling();
  }

  render() {
    return html`
      <slot name="label"></slot>
      <slot></slot>
    `;
  }
}

customElements.define("merch-list", MerchList);

import { merchBadgeStyleSheet } from "./merch-badge.css.js";

export class MerchBadge extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.adoptedStyleSheets = [merchBadgeStyleSheet];
  }

  static get observedAttributes() {
    return ["color"];
  }

  connectedCallback() {
    this.render();
    if (!this.hasAttribute("color")) {
      this.setAttribute("color", "--spectrum-yellow-400");
    }
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    if (!this.isConnected) return;
    // Safety check to prevent null reference errors
    if (!this.shadowRoot) {
      return;
    }
    
    const color = this.getAttribute("color");

    this.shadowRoot.innerHTML = `
      <div class="badge" style="background-color: var(${color});">
        <slot></slot>
      </div>
    `;
  }
}

customElements.define("merch-badge", MerchBadge);

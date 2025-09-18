import { LitElement, html } from "lit";
import { merchCardsCompareStyleSheet } from "./merch-cards-compare.css.js";

export class MerchCardsCompare extends LitElement {
  static styles = [merchCardsCompareStyleSheet];

  static properties = {
    resizing: { type: String, reflect: true },
  };

  constructor() {
    super();
    this.resizing = "hug"; // Default to 'hug'
  }

  connectedCallback() {
    super.connectedCallback();
  }

  firstUpdated() {
    // Observe slot changes to request update on child cards
    const slot = this.shadowRoot.querySelector("slot");
    slot.addEventListener("slotchange", () => {
      this.updateChildCards();
      this.updateGridColumnCount();
    });
    this.updateChildCards();
    this.updateGridColumnCount();
  }

  clearCSSVariables() {
    // Get all CSS variables set on this element
    const styles = this.style;
    const cssText = styles.cssText;

    // Match all CSS variable declarations
    const varPattern = /--[\w-]+(?:-\d+)?-height/g;
    const matches = cssText.match(varPattern) || [];

    // Remove each CSS variable
    matches.forEach((varName) => {
      styles.removeProperty(varName);
    });
  }

  updateChildCards() {
    const slot = this.shadowRoot.querySelector('slot');
    const cards = slot.assignedElements().filter(el => el.tagName === 'MERCH-CARD-COMPARE');
    
    // Request update on all child cards
    cards.forEach(card => {
      if (card.requestUpdate) {
        card.requestUpdate();
      }
    });
  }

  updated(changedProperties) {
    // When resizing changes, update child cards
    if (changedProperties.has("resizing")) {
      this.updateChildCards();
    }
    this.updateGridColumnCount();
  }

  willUpdate() {
    // Clear any previously set CSS variables before update
    this.clearCSSVariables();
  }

  render() {
    return html`<slot></slot>`;
  }

  updateGridColumnCount() {
    const slot = this.shadowRoot.querySelector('slot');
    if (!slot) return;
    // Count any direct child assigned to this slot (not nested descendants)
    const directChildren = slot.assignedElements({ flatten: false }) || [];
    const count = Math.max(1, Math.min(3, directChildren.length || 0));
    this.style.setProperty('--merch-cards-cols', String(count));
  }
}

customElements.define("merch-cards-compare", MerchCardsCompare);

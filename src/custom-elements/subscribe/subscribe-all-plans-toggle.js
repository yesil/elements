import { LitElement, html } from 'lit';
import { subscribeToggleStyleSheet } from './subscribe-all-plans-toggle.css.js';



export class SubscribeAllPlansToggle extends LitElement {
  static styles = [subscribeToggleStyleSheet];

  static properties = {
    term: { type: String, reflect: true },
  };

  constructor() {
    super();
    this.term = 'monthly';
  }

  connectedCallback() {
    super.connectedCallback();
    try {
      const initial = (this.getAttribute('default-term') || this.term || 'monthly').toLowerCase();
      this.term = initial === 'annual' ? 'annual' : 'monthly';
    } catch (_) {}
  }

  onChange = (e) => {
    const value = e.target?.value === 'annual' ? 'annual' : 'monthly';
    this.term = value;
    this.dispatchEvent(new CustomEvent('billing-term-change', {
      detail: { term: this.term },
      bubbles: true,
      composed: true,
    }));
  };

  get selected() {
    return this.term === 'annual' ? 'annual' : 'monthly';
  }

  render() {
    return html`
      <div class="row" role="group" aria-label="Billing term">
        <sp-radio-group value=${this.selected} @change=${this.onChange} emphasized>
          <sp-radio value="monthly">Monthly</sp-radio>
          <sp-radio value="annual">Annual</sp-radio>
        </sp-radio-group>
      </div>
    `;
  }
}

customElements.define('subscribe-all-plans-toggle', SubscribeAllPlansToggle);

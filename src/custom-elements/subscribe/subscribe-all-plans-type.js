import { LitElement, html, nothing } from 'lit';
import { subscribePlanStyleSheet } from './subscribe-all-plans-type.css.js';

export class SubscribeAllPlansType extends LitElement {
  static styles = [subscribePlanStyleSheet];

  static properties = {
    planId: { type: String, attribute: 'plan-id' },
    analyticsId: { type: String, attribute: 'analytics-id' },
    term: { type: String, reflect: true },
  };

  constructor() {
    super();
    this.planId = '';
    this.analyticsId = '';
    this.term = 'monthly';
  }

  connectedCallback() {
    super.connectedCallback();
    this.syncTermAttr();
  }

  updated() {
    this.syncTermAttr();
  }

  syncTermAttr() {
    try {
      const t = this.term === 'annual' ? 'annual' : 'monthly';
      this.setAttribute('data-term', t);
    } catch (_) {}
  }


  render() {
    return html`
      <div class="row">
        <div class="head">
          <slot name="title"></slot>
          <slot name="subtitle"></slot>
        </div>
        <div class="prices"><slot name="price"></slot><slot name="annual-price"></slot></div>
        <div class="desc"><slot name="description"></slot></div>
      </div>
    `;
  }
}

customElements.define('subscribe-all-plans-type', SubscribeAllPlansType);

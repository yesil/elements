import { inlinePriceStyleSheet } from './inline-price.css.js';

export class InlinePrice extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.adoptedStyleSheets = [inlinePriceStyleSheet];
  }

  static get observedAttributes() {
    return ['value', 'currency', 'period', 'old-value', 'variant', 'prefix'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const value = this.getAttribute('value') || '0.00';
    const currency = this.getAttribute('currency') || 'US$';
    const period = this.getAttribute('period') || '';
    const oldValue = this.getAttribute('old-value');
    const variant = this.getAttribute('variant') || 'default';
    const prefix = this.getAttribute('prefix') || '';

    // ARIA: expose an accessible label for assistive tech
    const periodLabel = period === 'mo'
      ? 'per month'
      : period === 'yr'
      ? 'per year'
      : period === 'week'
      ? 'per week'
      : period === 'day'
      ? 'per day'
      : '';

    const parts = [];
    if (prefix) parts.push(prefix);
    parts.push(`${currency} ${value}`);
    if (periodLabel) parts.push(periodLabel);
    const ariaLabel = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (ariaLabel) this.setAttribute('aria-label', ariaLabel);
    else this.removeAttribute('aria-label');
    
    this.shadowRoot.innerHTML = `
      <div class="price-container ${variant}">
        ${prefix ? `<span class="prefix">${prefix}</span>` : ''}
        ${oldValue ? `<span class="old-value"><span class="old-currency">${currency}</span>${oldValue}/${period}</span>` : ''}
        <span class="currency">${currency}</span>
        <span class="value">${value}</span>
        ${period ? `<span class="period">/${period}</span>` : ''}
      </div>
    `;
  }
}

customElements.define('inline-price', InlinePrice);

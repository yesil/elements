
import { Button } from '@spectrum-web-components/button';

export class CheckoutButton extends Button {
  static get properties() {
    return {
      ...super.properties,
      href: { type: String }
    };
  }

  constructor() {
    super();
    this.variant = 'accent';
    this.treatment = 'fill';
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.handleClick.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.handleClick.bind(this));
  }

  handleClick(e) {
    const href = this.getAttribute('href');
    
    if (this.disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    if (href && !e.defaultPrevented) {
      e.preventDefault();
      window.open(href, '_blank');
    }
  }
}

customElements.define('checkout-button', CheckoutButton);
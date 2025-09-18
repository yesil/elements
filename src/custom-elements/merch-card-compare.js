import { LitElement, html } from 'lit';
import { merchCardCompareStyleSheet } from './merch-card-compare.css.js';

// Module-scope IntersectionObserver for performance
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.requestUpdate();
      cardObserver.unobserve(entry.target);
    }
  });
}, {
  rootMargin: '50px' // Start rendering 50px before entering viewport
});

export class MerchCardCompare extends LitElement {
  static styles = [merchCardCompareStyleSheet];

  static properties = {
    variant: { type: String },
  };

  constructor() {
    super();
    this.variant = 'default';
    // Private fields
    this.#jsonLdScript = null;
  }

  // Private state
  #jsonLdScript;

  connectedCallback() {
    super.connectedCallback();
    // A11y semantics for the card container
    this.setAttribute('role', 'article');
    // Only render if visible, otherwise wait for intersection
    if (this.isVisible()) {
    } else {
      cardObserver.observe(this);
    }

    // Keep ARIA and JSON-LD in sync when slots change
    try {
      const slotNames = ['heading-xs','body-xxs','price','annual-price','legal-disclaimer','promo-text','body-xs','footer'];
      slotNames.forEach((name) => {
        const s = this.shadowRoot?.querySelector(`slot[name="${name}"]`);
        if (s) s.addEventListener('slotchange', () => this.updateA11yAndJsonLd());
      });
    } catch (_) {}
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cardObserver.unobserve(this);
  }

  isVisible() {
    const rect = this.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  firstUpdated() {
    // After first render, calculate slot heights if parent is merch-cards-compare
    this.updateSlotHeights();
    this.updateA11yAndJsonLd();
  }

  updated() {
    // Update heights on subsequent renders too
    this.updateSlotHeights();
    this.updateA11yAndJsonLd();
  }

  render() {
    return html`
      <slot name="badge"></slot>
      <slot name="mnemonics"></slot>
      <slot name="heading-xs"></slot>
      <slot name="body-xxs"></slot>
      <slot name="price"></slot>
      <slot name="annual-price"></slot>
      <slot name="legal-disclaimer"></slot>
      <slot name="promo-text"></slot>
      <slot name="body-xs"></slot>
      <slot name="callout"></slot>
      <slot name="footer"></slot>
      <slot name="footer-list"></slot>
    `;
  }

  /**
   * Synchronizes the heights of list items across compare cards
   * @param {HTMLElement} merchList - The merch-list element containing items
   * @param {HTMLElement} parent - The parent element to set CSS variables on
   */
  syncListItemHeights(merchList, parent) {
    const listItems = merchList.querySelectorAll('merch-list-item');
    listItems.forEach((item, index) => {
      const itemStyles = window.getComputedStyle(item);
      const itemMarginTop = parseFloat(itemStyles.marginTop) || 0;
      const itemMarginBottom = parseFloat(itemStyles.marginBottom) || 0;
      // Use offsetHeight which includes padding, border, and scrollbar (if present)
      // This is more reliable than computedStyle.height which might return 'auto'
      const itemHeight = item.offsetHeight + itemMarginTop + itemMarginBottom;
      
      if (itemHeight > 0) {
        // Get current parent value for this list item
        const varName = `--merch-list-item-${index}-height`;
        const currentValue = parseFloat(parent.style.getPropertyValue(varName)) || 0;
        
        // Update parent's CSS variable only if our height is bigger
        if (itemHeight > currentValue) {
          parent.style.setProperty(varName, `${itemHeight}px`);
        }
        
        // Set min-height on the list item itself
        item.style.minHeight = `var(${varName})`;
      }
    });
  }

  updateSlotHeights() {
    const parent = this.parentElement;
    if (!parent) return;
    
    // Only update heights if parent has resizing='fill'
    if (parent.getAttribute('resizing') !== 'fill') return;

    const slots = [
      'badge',
      'mnemonics', 'heading-xs', 'body-xxs', 'price', 'annual-price',
      'legal-disclaimer', 'promo-text', 'body-xs',
      'callout', 'footer', 'footer-list'
    ];
    
    // Measure only this card's slot heights
    slots.forEach(slotName => {
      const slot = this.shadowRoot?.querySelector(`slot[name="${slotName}"]`);
      if (!slot) return;
      
      const nodes = slot.assignedNodes();
      if (nodes.length > 0) {
        let slotHeight = 0;
        nodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const styles = window.getComputedStyle(node);
            const marginTop = parseFloat(styles.marginTop) || 0;
            const marginBottom = parseFloat(styles.marginBottom) || 0;
            // Use offsetHeight for consistency and better performance
            const totalHeight = node.offsetHeight + marginTop + marginBottom;
            slotHeight = Math.max(slotHeight, totalHeight);
            
            // Handle merch-list-item elements
            if (slotName === 'footer-list' && node.tagName === 'MERCH-LIST') {
              this.syncListItemHeights(node, parent);
            }
          }
        });
        
        if (slotHeight > 0) {
          // Get current parent value
          const currentValue = parseFloat(parent.style.getPropertyValue(`--${slotName}-height`)) || 0;
          
          // Update parent's CSS variable only if our height is bigger
          if (slotHeight > currentValue) {
            parent.style.setProperty(`--${slotName}-height`, `${slotHeight}px`);
          }
        }
      }
    });
  }

  // Helper: map display currency to ISO 4217 code
  getCurrencyCode(symbol) {
    const map = {
      'US$': 'USD',
      '$': 'USD',
      'EUR': 'EUR',
      '€': 'EUR',
      'GBP': 'GBP',
      '£': 'GBP',
      'JPY': 'JPY',
      '¥': 'JPY',
      'AUD': 'AUD',
      'CAD': 'CAD'
    };
    if (!symbol) return 'USD';
    if (map[symbol]) return map[symbol];
    // Try to extract letters
    const letters = String(symbol).replace(/[^A-Za-z]/g, '').toUpperCase();
    return letters.length >= 3 ? letters.slice(0,3) : 'USD';
  }

  // Helper: get trimmed text from slotted light DOM nodes
  getSlotText(slotName) {
    try {
      const nodes = Array.from(this.querySelectorAll(`[slot="${slotName}"]`));
      const texts = nodes.map((n) => (n.textContent || '').trim()).filter(Boolean);
      return texts.join(' ').replace(/\s+/g, ' ').trim();
    } catch (_) { return ''; }
  }

  // Helper: ensure heading has id and return it
  ensureHeadingId() {
    try {
      let heading = this.querySelector('[slot="heading-xs"]');

      // If there is no element assigned to heading-xs but there is text content,
      // wrap the text nodes into a <span slot="heading-xs"> and use that as the label source.
      if (!heading && this.shadowRoot) {
        const slotEl = this.shadowRoot.querySelector('slot[name="heading-xs"]');
        if (slotEl) {
          const assigned = slotEl.assignedNodes();
          const textNodes = assigned.filter(
            (n) => n && n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim()
          );
          if (textNodes.length) {
            const wrapper = document.createElement('span');
            wrapper.setAttribute('slot', 'heading-xs');
            wrapper.textContent = textNodes
              .map((n) => n.textContent)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            // Insert before the first text node to keep ordering
            const ref = textNodes[0];
            this.insertBefore(wrapper, ref);
            // Remove all the original text nodes contributing to the slot
            textNodes.forEach((n) => n.remove());
            heading = wrapper;
          }
        }
      }

      if (!heading) return null;
      if (!heading.id) {
        const id = `mcc-title-${Math.random().toString(36).slice(2, 8)}`;
        heading.id = id;
      }
      return heading.id;
    } catch (_) { return null; }
  }

  // Build and attach/update JSON-LD for this card
  updateJsonLd() {
    // Do not emit JSON-LD in editor or preview contexts
    if (this.hasAttribute('data-ee-suppress-jsonld')) return;
    if (this.closest('experience-elements-editor')) return;
    if (this.closest('[data-ee-preview]')) return;
    try {
      // Reuse any existing EE JSON-LD script and remove duplicates
      try {
        const existing = this.querySelectorAll('script[type="application/ld+json"][data-ee-jsonld="product-card"]');
        if (existing && existing.length > 0) {
          this.#jsonLdScript = existing[0];
          for (let i = 1; i < existing.length; i++) existing[i].remove();
        }
      } catch (_) {}

      const name = this.getSlotText('heading-xs');
      const description = this.getSlotText('body-xs');
      const priceEl = this.querySelector('inline-price[slot="price"]');
      const annualEl = this.querySelector('inline-price[slot="annual-price"]');

      const buildOffer = (el, label) => {
        if (!el) return null;
        const price = el.getAttribute('value') || '';
        const currency = this.getCurrencyCode(el.getAttribute('currency'));
        const href = (this.querySelector('checkout-button[slot="footer"][href]')?.getAttribute('href')) ||
                     (this.querySelector('a[slot="footer"][href]')?.getAttribute('href')) || undefined;
        if (!price) return null;
        const offer = {
          '@type': 'Offer',
          price: price,
          priceCurrency: currency,
        };
        if (href) offer.url = href;
        if (label) offer.category = label; // Simple discriminator (Monthly/Annual)
        return offer;
      };

      const monthly = buildOffer(priceEl, 'Monthly');
      const annual = buildOffer(annualEl, 'Annual');

      let offers = null;
      if (monthly && annual) {
        offers = { '@type': 'AggregateOffer', offers: [monthly, annual] };
      } else if (monthly) {
        offers = monthly;
      } else if (annual) {
        offers = annual;
      }

      if (!name || !offers) {
        // Remove script(s) if incomplete
        try {
          const existing = this.querySelectorAll('script[type="application/ld+json"][data-ee-jsonld="product-card"]');
          existing.forEach((n) => n.remove());
        } catch (_) {}
        this.#jsonLdScript = null;
        return;
      }

      const json = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        ...(description ? { description } : {}),
        offers,
      };

      const text = JSON.stringify(json);
      if (!this.#jsonLdScript) {
        const s = document.createElement('script');
        s.type = 'application/ld+json';
        s.setAttribute('data-ee-jsonld', 'product-card');
        s.textContent = text;
        // Append to light DOM inside the card element
        this.appendChild(s);
        this.#jsonLdScript = s;
      } else {
        this.#jsonLdScript.textContent = text;
      }
    } catch (_) {
      // On any error, do not throw; keep UI functional
    }
  }

  // Update ARIA labeling and JSON-LD together
  updateA11yAndJsonLd() {
    try {
      const titleId = this.ensureHeadingId();
      if (titleId) {
        this.setAttribute('aria-labelledby', titleId);
        this.removeAttribute('aria-label');
      } else {
        const label = this.getSlotText('heading-xs') || 'Comparison Card';
        this.setAttribute('aria-label', label);
        this.removeAttribute('aria-labelledby');
      }
    } catch (_) {}
    this.updateJsonLd();
  }
}

customElements.define('merch-card-compare', MerchCardCompare);

import { LitElement, html, nothing } from 'lit';
import { subscribeAllPlansStyleSheet } from './subscribe-all-plans.css.js';






export class SubscribeAllPlans extends LitElement {
  static styles = [subscribeAllPlansStyleSheet];

  static properties = {
    open: { type: Boolean, reflect: true },
    modal: { type: Boolean, reflect: true },
    showAllThreshold: { type: Number, attribute: 'show-all-threshold' },
  };

  constructor() {
    super();
    this.open = false;
    this.modal = false;
    this.showAllThreshold = undefined;
  }

  // If embedded under an ee-reference, prefer modal presentation
  willUpdate(_changed) {
    try {
      if (!this.modal) {
        const inEeReference = this.closest && this.closest('ee-reference');
        if (inEeReference) this.modal = true;
      }
    } catch (_) {}
  }

  connectedCallback() {
    super.connectedCallback();
    this.updateAria();
    this.updateAppVisibility();
    window.addEventListener('keydown', this.onKeyDown);
    // Sync initial term from toggle to types
    this.#initTermFromToggle();
    // React to term change events from the toggle
    this.addEventListener('billing-term-change', this.onBillingTermChange);
    // Prefer modal when embedded in ee-reference and auto-open on connect
    this.#syncModalWithContext();
    try {
      requestAnimationFrame(() => {
        this.#syncModalWithContext();
        if (this.modal && !this.open) this.open = true;
      });
    } catch (_) {
      // Fallback if rAF not available
      this.#syncModalWithContext();
      if (this.modal && !this.open) this.open = true;
    }
  }

  updated(changed) {
    if (changed.has('modal')) this.updateAria();
    if (changed.has('showAllThreshold')) this.updateAppVisibility();
    this.updateAria();
  }

  updateAria() {
    try {
      const header = this.querySelector('[slot="header"]');
      let headingId = null;
      if (header) {
        if (!header.id) header.id = `sap-title-${Math.random().toString(36).slice(2,8)}`;
        headingId = header.id;
      }
      if (!this.modal) {
        this.setAttribute('role', 'region');
        this.removeAttribute('aria-modal');
        if (headingId) {
          this.setAttribute('aria-labelledby', headingId);
          this.removeAttribute('aria-label');
        } else {
          this.setAttribute('aria-label', 'Subscribe - All Plans');
          this.removeAttribute('aria-labelledby');
        }
      } else {
        // Modal ARIA handled by sp-overlay + sp-dialog
        this.removeAttribute('role');
        this.removeAttribute('aria-modal');
        this.removeAttribute('aria-labelledby');
        this.removeAttribute('aria-label');
      }
    } catch (_) {}
  }

  updateAppVisibility() {
    try {
      const includes = this.querySelector('[slot="includes"]');
      if (!includes) return;
      
      const items = includes.querySelectorAll('.items .item');
      const showAllLink = includes.querySelector('.items a[href="#"]');
      
      if (this.showAllThreshold === undefined || this.showAllThreshold === null || this.showAllThreshold <= 0) {
        // Show all apps, hide the "Show all" link
        items.forEach(item => item.style.display = '');
        if (showAllLink) showAllLink.style.display = 'none';
      } else {
        // Hide apps beyond threshold, show "Show all" link with dynamic text
        items.forEach((item, index) => {
          if (index < this.showAllThreshold) {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
        
        if (showAllLink) {
          const totalApps = items.length;
          showAllLink.textContent = `Show all ${totalApps}+ apps`;
          showAllLink.style.display = '';
        }
      }
    } catch (_) {}
  }

  get isOpen() {
    return !!this.open;
  }

  renderPage() {
    return html`
      <section id="container" aria-label="Subscribe - All Plans">
        <div id="grid" class="sap-grid">
          <div id="header"><slot name="header"></slot></div>
          

          <div id="icons"><slot name="icons"></slot></div>
          <div id="desc"><slot name="description"></slot></div>

          <div id="includes"><slot name="includes"></slot></div>
          <div id="extras"><slot name="extras"></slot></div>
          <div id="recommended"><slot name="recommended"></slot></div>

          <main id="offers">
            <slot></slot>
          </main>

          <div id="continue">
            <div class="continue-wrapper">
              <div class="stock-offer">
                <slot name="stock-offer">
                  <sp-checkbox id="stock-offer-checkbox">Include Adobe Stock (optional)</sp-checkbox>
                </slot>
              </div>
              <span class="secure-text">🔒 Secure transaction</span>
              <sp-button variant="accent" size="l" @click=${this.onContinue}>Continue</sp-button>
            </div>
          </div>

          <div id="footer"><slot name="footer"></slot></div>
        </div>
      </section>
    `;
  }

  renderModal() {
    return html`
      <overlay-trigger
        type="modal"
        triggered-by="click"
        receives-focus="auto"
        .open=${this.isOpen ? 'click' : undefined}
        @sp-closed=${this.onOverlayClosed}
      >
        <sp-dialog-wrapper dismissable underlay slot="click-content">
          <div slot="heading"><slot name="header"></slot></div>
          <div class="sap-grid sap-grid--modal">
            <div id="icons"><slot name="icons"></slot></div>
            <div id="desc"><slot name="description"></slot></div>

            <div id="includes"><slot name="includes"></slot></div>
            <div id="extras"><slot name="extras"></slot></div>
            <div id="recommended"><slot name="recommended"></slot></div>

            <section id="offers">
              <slot></slot>
            </section>

            <div id="continue">
              <div class="continue-wrapper">
                <div class="stock-offer">
                  <slot name="stock-offer">
                    <sp-checkbox id="stock-offer-checkbox">Include Adobe Stock (optional)</sp-checkbox>
                  </slot>
                </div>
                <span class="secure-text">🔒 Secure transaction</span>
                <sp-button variant="accent" size="l" @click=${this.onContinue}>Continue</sp-button>
              </div>
            </div>
          </div>
          <div slot="button"><slot name="footer"></slot></div>
        </sp-dialog-wrapper>
      </overlay-trigger>
    `;
  }

  onOverlayClosed = () => {
    this.open = false;
  };

  onContinue = () => {
    const selectedPlanId = this.#getSelectedPlanId();
    // Notify host that continue was requested with the selected plan
    this.dispatchEvent(new CustomEvent('subscribe-continue', {
      detail: { planId: selectedPlanId },
      bubbles: true,
      composed: true
    }));
  };

  #getSelectedPlanId() {
    const selectedType = this.querySelector('subscribe-all-plans-type[data-selected="true"]');
    return selectedType ? selectedType.getAttribute('plan-id') || '' : '';
  }

  disconnectedCallback() {
    this.removeEventListener('billing-term-change', this.onBillingTermChange);
    window.removeEventListener('keydown', this.onKeyDown);
    super.disconnectedCallback();
  }

  onKeyDown = (e) => {
    if (this.modal && this.isOpen && (e.key === 'Escape' || e.key === 'Esc')) {
      this.open = false;
    }
  };

  render() {
    return this.modal ? this.renderModal() : this.renderPage();
  }

  onBillingTermChange = (e) => {
    try {
      e.stopPropagation();
      const term = (e.detail?.term || '').toLowerCase() === 'annual' ? 'annual' : 'monthly';
      this.#setTypesTerm(term);
    } catch (_) {}
  };

  #syncModalWithContext() {
    try {
      if (!this.modal) {
        const inEeReference = this.closest && this.closest('ee-reference');
        if (inEeReference) this.modal = true;
      }
    } catch (_) {}
  }

  #initTermFromToggle() {
    try {
      const toggle = this.querySelector('subscribe-all-plans-toggle');
      let term = 'monthly';
      if (toggle) {
        const tAttr = (toggle.getAttribute('term') || toggle.getAttribute('default-term') || '').toLowerCase();
        if (tAttr === 'annual') term = 'annual';
      }
      this.#setTypesTerm(term);
    } catch (_) {}
  }

  #setTypesTerm(term) {
    try {
      this.querySelectorAll('subscribe-all-plans-type').forEach((el) => {
        el.term = term;
      });
    } catch (_) {}
  }
}

customElements.define('subscribe-all-plans', SubscribeAllPlans);

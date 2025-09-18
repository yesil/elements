const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  :host {
    padding: 20px;
    background: var(--spectrum-alias-component-background-color);
    border-radius: 16px;
    border: 1px solid var(--spectrum-alias-border-color);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--spectrum-global-color-gray-900) 10%, transparent);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    font-family: 'Adobe Clean', 'Segoe UI', Roboto, sans-serif;
    height: 100%;
    margin: 0 auto;
    max-width: 379px;
    padding: 24px;
    position: relative;

  }

  /* Badge slot styling */
  slot[name="badge"] {
    display: block;
    position: absolute;
    top: 16px;
    right: 0;
  }

  /* Placeholder while loading */
  .card-placeholder {
    min-height: 400px;
    background: linear-gradient(
      90deg,
      var(--spectrum-global-color-gray-100) 25%,
      var(--spectrum-global-color-gray-50) 50%,
      var(--spectrum-global-color-gray-100) 75%
    );
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
  }

  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Slot styling with min-height from CSS variables */
  slot[name="mnemonics"] {
    display: flex;
    gap: 4px;
    min-height: var(--mnemonics-height, auto);
  }

  slot[name="heading-xs"] {
    display: block;
    min-height: var(--heading-xs-height, auto);
    margin-top: 16px;
  }

  slot[name="body-xxs"] {
    display: block;
    min-height: var(--body-xxs-height, auto);
    margin-top: 8px;
  }

  slot[name="price"] {
    display: block;
    min-height: var(--price-height, auto);
    margin-top: 16px;
  }

  slot[name="annual-price"] {
    display: block;
    min-height: var(--annual-price-height, auto);
    margin-top: 4px;
  }

  slot[name="legal-disclaimer"] {
    display: block;
    min-height: var(--legal-disclaimer-height, auto);
    margin-top: 4px;
  }

  slot[name="promo-text"] {
    display: block;
    min-height: var(--promo-text-height, auto);
    margin-top: 12px;
  }

  slot[name="body-xs"] {
    display: block;
    min-height: var(--body-xs-height, auto);
    margin-top: 12px;
    color: var(--spectrum-global-color-gray-900);
  }

  slot[name="callout"] {
    display: block;
    min-height: var(--callout-height, auto);
    margin-top: 16px;
  }

  slot[name="footer"] {
    display: flex;
    gap: 4px;
    min-height: var(--footer-height, auto);
    margin-top: 24px;
    margin-bottom: 16px;
    justify-content: flex-end;
    align-items: end;
  }
    

  slot[name="footer-list"] {
    display: block;
    min-height: var(--footer-list-height, auto);
  }

  ::slotted([slot="heading-xs"]) {
    font-size: 18px;
    font-weight: 700;
        color: var(--spectrum-global-color-gray-900);
    margin: 0;
  }

  ::slotted([slot="body-xxs"]) {
    font-size: 12px;
    font-weight: 400;
        color: var(--spectrum-global-color-gray-900);
    margin: 0;
  }

  ::slotted([slot="legal-disclaimer"]) {
    font-size: 12px;
    margin: 0;
        color: var(--spectrum-global-color-gray-900);
    line-height: 1.3;
  }

  ::slotted([slot="promo-text"]) {
    margin: 0;
    font-size: 14px;
    color: var(--spectrum-global-color-green-700);
    font-weight: 400;
  }
  
  ::slotted([slot="promo-text"]) a {
    color: var(--spectrum-global-color-blue-800);
    text-decoration: none;
  }
  
  ::slotted([slot="promo-text"]) a:hover {
    text-decoration: underline;
  }

  ::slotted([slot="body-xs"]) {
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
  }

  ::slotted([slot="callout"]) {
    margin: 0;
  }

  ::slotted([slot="footer"]) {
    align-self: center;
  }

  ::slotted([slot="footer-list"]) {
    margin: 0;
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--spectrum-alias-border-color);
  }
`;

export const merchCardCompareStyleSheet = new CSSStyleSheet();
merchCardCompareStyleSheet.replaceSync(styles);

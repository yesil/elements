const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  :host {
    display: inline-block;
    font-family: 'Adobe Clean', 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
    color: var(--spectrum-alias-text-color);
  }

  .price-container {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    flex-wrap: wrap;
  }

  .prefix {
    font-size: 14px;
    font-weight: 400;
    color: var(--spectrum-alias-secondary-text-color);
    margin-right: 4px;
  }

  .currency {
    font-size: 0.75em;
    font-weight: 400;
  }

  .value {
    font-weight: 700;
  }

  .period {
    font-size: 0.875em;
    font-weight: 400;
    color: var(--spectrum-alias-secondary-text-color);
  }

  .old-value {
    text-decoration: line-through;
    color: var(--spectrum-alias-placeholder-text-color);
    font-weight: 400;
    margin-right: 8px;
  }

  .old-currency {
    font-size: 0.75em;
  }

  /* Variant: default */
  .price-container.default .value {
    font-size: 24px;
    color: var(--spectrum-alias-heading-text-color);
  }

  /* Variant: large */
  .price-container.large .value {
    font-size: 32px;
    color: var(--spectrum-alias-heading-text-color);
  }

  /* Variant: small */
  .price-container.small .value {
    font-size: 18px;
    color: var(--spectrum-alias-heading-text-color);
  }

  /* Variant: annual */
  .price-container.annual {
    font-size: 14px;
    color: var(--spectrum-alias-secondary-text-color);
  }

  .price-container.annual .value {
    font-size: 14px;
    font-weight: 400;
  }
`;

export const inlinePriceStyleSheet = new CSSStyleSheet();
inlinePriceStyleSheet.replaceSync(styles);

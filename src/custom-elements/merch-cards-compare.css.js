const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  :host {
    display: grid;
    gap: 16px;
    padding: 16px;
    min-width: 320px;
    min-height: 320px;
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    font-family: 'Adobe Clean', 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  }


  /* Default: 3 columns on desktop */
  @media (min-width: 1024px) {
    :host {
      grid-template-columns: repeat(var(--merch-cards-cols, 3), 379px);
      justify-content: center;
    }
  }

  /* Tablet: 2 columns */
  @media (min-width: 768px) and (max-width: 1023px) {
    :host {
      grid-template-columns: repeat(2, 379px);
    }
  }

  /* Mobile: single column, centered */
  @media (max-width: 767px) {
    :host {
      grid-template-columns: 379px;
      justify-content: center;
      padding: 8px;
    }
  }
`;

export const merchCardsCompareStyleSheet = new CSSStyleSheet();
merchCardsCompareStyleSheet.replaceSync(styles);

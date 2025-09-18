const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: 'Adobe Clean', 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  }

  slot[name="label"] {
    display: block;
  }

  ::slotted([slot="label"]) {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: var(--spectrum-alias-heading-text-color);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin: 0;
  }
  
  ::slotted([slot="label"].body-xs) {
    font-size: 14px;
    line-height: 1.4;
  }
  
  ::slotted([slot="label"].bold) {
    font-weight: 700;
  }

  ::slotted(merch-list-item) {
    display: block;
  }
`;

export const merchListStyleSheet = new CSSStyleSheet();
merchListStyleSheet.replaceSync(styles);

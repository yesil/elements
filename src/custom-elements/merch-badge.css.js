const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  :host {
    display: inline-block;
    font-family: 'Adobe Clean', 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  }

  .badge {
    align-items: center;
    border-radius: 4px 0 0 4px;
    display: flex;
    font-size: 12px;
    font-weight: 600;
    height: 40px;
    justify-content: center;
    letter-spacing: 0.5px;
    line-height: 1;
    padding: 2px 10px 3px 10px;
    white-space: nowrap;
    color: var(--spectrum-alias-text-color);
    font-family: var(--Font-adobe-clean, "Adobe Clean");
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 150%; /* 21px */
  }
`;

export const merchBadgeStyleSheet = new CSSStyleSheet();
merchBadgeStyleSheet.replaceSync(styles);

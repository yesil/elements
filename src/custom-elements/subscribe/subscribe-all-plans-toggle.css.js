const styles = `
  :host {
    display: block;
  }
  .row {
    display: inline-flex;
    gap: var(--spectrum-global-dimension-size-200);
    align-items: center;
  }
`;

export const subscribeToggleStyleSheet = new CSSStyleSheet();
subscribeToggleStyleSheet.replaceSync(styles);


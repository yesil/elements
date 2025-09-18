const styles = `
  :host {
    display: inline-block;
  }

  :host(not([icon-only])) {
    cursor: pointer;
  }

  img {
    display: block;
    width: var(--icon-size);
    height: var(--icon-size);
  }
  
  :host([size="xxs"]) { --icon-size: 12px; }
  :host([size="xs"]) { --icon-size: 14px; }
  :host([size="s"]) { --icon-size: 16px; }
  :host([size="m"]) { --icon-size: 24px; }
  :host([size="l"]), :host(:not([size])) { --icon-size: 40px; }
  
  :host([size="xl"]) {
    --icon-size: 48px;
  }
  
  :host([size="xxl"]) {
    --icon-size: 64px;
  }
`;

export const merchMnemonicStyleSheet = new CSSStyleSheet();
merchMnemonicStyleSheet.replaceSync(styles);

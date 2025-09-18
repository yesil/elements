const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  :host {
    align-items: center;
    background: var(--spectrum-global-color-gray-100);
    border-radius: 4px;
    box-sizing: border-box;
    color: var(--spectrum-alias-text-color);
    display: flex;
    font-family: 'Adobe Clean', 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    gap: 8px;
    padding: 8px 12px;
  }

  #icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-left: auto;
  }

  /* Compose transform using numeric variables so output is always valid */
  #icon {
    transform:
      rotate(var(--ee-rotate, 0deg))
      scaleX(var(--ee-flipx, 1))
      scaleY(var(--ee-flipy, 1));
  }
  :host([rotate="90"])  { --ee-rotate: 90deg; }
  :host([rotate="180"]) { --ee-rotate: 180deg; }
  :host([rotate="270"]) { --ee-rotate: 270deg; }
  :host([flip-h]) { --ee-flipx: -1; }
  :host([flip-v]) { --ee-flipy: -1; }

  #icon svg {
    width: 1em;
    height: 1em;
  }
  #icon ::slotted(sp-icon-*) {
    display: inline-flex;
  }

  #content {
    flex: 1;
    line-height: 1.4;
  }

  ::slotted([slot="icon"]) {
    display: flex;
    align-items: center;
  }
`;

export const merchCalloutStyleSheet = new CSSStyleSheet();
merchCalloutStyleSheet.replaceSync(styles);

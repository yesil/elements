const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  :host {
    display: block;
    font-family: 'Adobe Clean', 'Segoe UI', Roboto, sans-serif;
    box-sizing: border-box;
  }

  #item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--spectrum-alias-text-color);
  }

  #icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--spectrum-global-color-green-700);
  }

  /* Compose transform with local or inherited rotate + flips via numeric variables */
  :host {
    /* Choose local values if present; otherwise inherited; provide numeric defaults */
    --ee-rotate-final: var(--ee-rotate-local, var(--ee-rotate-inherited, 0deg));
    --ee-flipx-final: var(--ee-flipx-local, var(--ee-flipx-inherited, 1));
    --ee-flipy-final: var(--ee-flipy-local, var(--ee-flipy-inherited, 1));
  }
  #icon {
    transform:
      rotate(var(--ee-rotate-final, 0deg))
      scaleX(var(--ee-flipx-final, 1))
      scaleY(var(--ee-flipy-final, 1));
  }
  /* Local attributes set local variables */
  :host([rotate="90"])  { --ee-rotate-local: 90deg; }
  :host([rotate="180"]) { --ee-rotate-local: 180deg; }
  :host([rotate="270"]) { --ee-rotate-local: 270deg; }
  :host([flip-h]) { --ee-flipx-local: -1; }
  :host([flip-v]) { --ee-flipy-local: -1; }
  /* Inherit from nearest merch-list ancestor when local not present */
  :host(:not([rotate])):host-context(merch-list[rotate="90"]) { --ee-rotate-inherited: 90deg; }
  :host(:not([rotate])):host-context(merch-list[rotate="180"]) { --ee-rotate-inherited: 180deg; }
  :host(:not([rotate])):host-context(merch-list[rotate="270"]) { --ee-rotate-inherited: 270deg; }
  :host(:not([flip-h])):host-context(merch-list[flip-h]) { --ee-flipx-inherited: -1; }
  :host(:not([flip-v])):host-context(merch-list[flip-v]) { --ee-flipy-inherited: -1; }

  /* Let Spectrum icon size control intrinsic svg size */

  #content {
    flex: 1;
  }

  #content ::slotted(a) {
    color: var(--spectrum-global-color-blue-600);
    text-decoration: underline;
  }

  #content ::slotted(a:hover) {
    color: var(--spectrum-global-color-blue-700);
  }

  ::slotted([slot="icon"]) {
    display: flex;
    align-items: center;
    color: inherit;
  }
`;

export const merchListItemStyleSheet = new CSSStyleSheet();
merchListItemStyleSheet.replaceSync(styles);

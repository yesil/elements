import { css } from "lit";

export const eeTreeNavStyles = css`
  :host {
    display: block;
    height: 100%;
    color: var(--spectrum-alias-text-color);
  }

  /* Honor the hidden attribute on the host even with component styles */
  :host([hidden]) {
    display: none !important;
  }

  .nav-root {
    /* Apply sidebar card styling directly to the tree */
    height: calc(100% - var(--spectrum-global-dimension-size-400));
    margin: var(--spectrum-global-dimension-size-200) 0;
    background: var(--spectrum-alias-component-background-color);
    border: 1px solid var(--spectrum-alias-border-color);
    border-radius: var(--spectrum-global-dimension-size-100);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: var(--spectrum-global-dimension-size-100);
  }

  .controls {
    display: flex;
    gap: var(--spectrum-global-dimension-size-100);
    align-items: center;
    padding: var(--spectrum-global-dimension-size-100)
      var(--spectrum-global-dimension-size-0);
  }

  .tree {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;           /* enable both vertical & horizontal */
    overflow-x: auto;
    overflow-y: auto;
    padding: var(--spectrum-global-dimension-size-100) 0;
  }

  .node {
    --indent: 0px;
    padding-left: calc(var(--indent));
    /* ensure deep indentation contributes to overall content width for horizontal scrolling */
    width: max-content;
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-125);
    padding: var(--spectrum-global-dimension-size-65)
      var(--spectrum-global-dimension-size-100);
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    transition: background 120ms ease, transform 120ms ease;
    outline: none;
    /* avoid wrapping so long labels/indent create horizontal overflow */
    white-space: nowrap;
    /* ensure row contributes its intrinsic width (indent + icons + capped label) */
    width: max-content;
  }

  .node-row:hover {
    background: var(--spectrum-menu-item-background-color-hover);
  }

  /* Drag & drop source/target cues */
  .node-row[drag-source] {
    opacity: 0.8;
  }
  .node-row[data-drop-allowed] {
    outline: 2px dashed var(--spectrum-alias-focus-color);
    outline-offset: -2px;
    background: color-mix(in srgb, var(--spectrum-global-color-blue-400) 16%, transparent);
  }
  .node-row[data-drop-pos="before"] {
    box-shadow: inset 0 2px 0 var(--spectrum-alias-focus-color);
  }
  .node-row[data-drop-pos="after"] {
    box-shadow: inset 0 -2px 0 var(--spectrum-alias-focus-color);
  }
  .node-row[data-drop-denied] {
    cursor: not-allowed;
  }

  /* Dedicated placeholder line for precise insertion feedback */
  .drop-placeholder {
    height: 8px;
    position: relative;
  }
  .drop-placeholder::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    background: var(--spectrum-alias-focus-color);
    transform: translateY(-50%);
    border-radius: 1px;
  }

  .node-row[selected] {
    background: var(--spectrum-menu-item-background-color-hover);
    border-left: 2px solid var(--spectrum-alias-focus-color);
  }

  /* Browser focus ring inside the tree */
  .node-row:focus {
    box-shadow: 0 0 0 2px var(--spectrum-alias-focus-color) inset;
  }

  /* Persist visual focus only when nav is active (keyboard or recent interaction) */
  :host([data-nav-active]) .node-row[focused]:not([selected]) {
    box-shadow: 0 0 0 1px var(--spectrum-alias-focus-color) inset;
  }

  .caret {
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transform: none;
    transition: transform 160ms ease;
    color: var(--spectrum-alias-icon-color);
  }

  .caret[expanded] {
    transform: rotate(90deg);
  }

  .label {
    flex: 1 1 auto;
    font-size: var(--spectrum-global-dimension-size-175);
    line-height: 1.3;
    /* allow label to shrink and ellipsize within available space */
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: min(100%, var(--ee-tree-label-max, 480px));
  }

  .icon-slot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: var(--spectrum-alias-icon-color);
  }

  .children {
    overflow: hidden;
    will-change: height, opacity;
    transition: height 140ms ease, opacity 140ms ease;
    opacity: 1;
    /* allow descendant widths to contribute to horizontal scroll calculations */
  }

  .children[collapsed] {
    height: 0 !important;
    opacity: 0;
  }
`;

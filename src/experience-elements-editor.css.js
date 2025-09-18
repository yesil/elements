import { css } from "lit";

export const experienceElementsEditorStyles = css`

  :host {
    --ee-canvas-max: 1440px;
    display: none;
    grid-template-rows: var(--ee-toolbar-height, 60px) 1fr;
    /* Toolbar row + main content row */
    justify-content: stretch;
    height: 100vh;
    overflow: hidden;
    font-family: var(--spectrum-global-font-family-base);
    background: var(--spectrum-alias-background-color-default);
    position: relative;
    box-sizing: border-box;
  }


  :host([open]) {
    display: grid;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  .loading-spinner {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  /* Center only modal dialogs; fullscreen manages its own layout */
  sp-dialog-wrapper[open][mode="modal"] {
    display: flex;
    align-items: center;
    justify-content: center; /* center middle group between flexible sides */
    justify-content: center;
  }

  #editor-toolbar {
    grid-row: 1;
    grid-column: 1 / 4;
    background: var(--spectrum-alias-component-background-color);
    padding: var(--spectrum-global-dimension-size-200)
      var(--spectrum-global-dimension-size-400);
    border-bottom: 1px solid var(--spectrum-alias-border-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-300);
    backdrop-filter: blur(10px);
    background: color-mix(in srgb, var(--spectrum-alias-component-background-color) 95%, transparent);
  }

  #editor-toolbar sp-textfield {
    --mod-textfield-border-width: 0;
  }

  #toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-200);
    flex: 1 1 0;
  }

  #toolbar-center {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-200);
    /* Center area should size to its content */
    flex: 0 0 auto;
    width: -moz-fit-content;
    width: fit-content;
    --mod-textfield-spacing-block-start: 0;
  }

  /* Ensure Spectrum controls align perfectly on the center line */
  #toolbar-center sp-action-button,
  #toolbar-center sp-textfield {
    align-self: center;
  }

  /* Keep file name inline, even when space is tight */
  #name-actions {
    display: inline-flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-150);
  }

  /* Ensure buttons align with the textfield vertically */
  /* Removed custom top offset to keep center alignment consistent */

  /* Make the name field feel inline while staying Spectrum */
  #fragment-name {
    flex: 1;
    align-items: center;
    display: inline-flex;
    font-size: var(--spectrum-global-dimension-font-size-200);
    font-weight: 600;
    max-width: 300px;
    text-align: center;
    cursor: pointer;
  }

  #fragment-name:active {
    min-width: 220px;
  }

  #toolbar-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spectrum-global-dimension-size-200);
    flex: 1 1 0;
  }

  .toolbar-icon-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .toolbar-icon-wrap .count-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    pointer-events: none;
  }

  /* Main grid row holds left sidebar, canvas, right sidebar */
  #editor-main {
    grid-row: 2;
    grid-column: 1 / 4;
    display: grid;
    grid-template-columns: auto 1fr auto; /* left | center | right */
    column-gap: var(--spectrum-global-dimension-size-200);
    align-items: stretch;
    height: 100%;
    overflow: hidden;
    padding: 0 var(--spectrum-global-dimension-size-200);
  }
  /* Consistent column gap; sidebar width collapses via [open] on ee-tree-nav */

  /* Place ee-tree-nav directly in the first column */
  #editor-main > ee-tree-nav {
    grid-column: 1;
    position: relative;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
    min-width: 0; /* allow grid to collapse this track */
    width: var(--ee-left-sidebar-width, 360px);
    opacity: 1;
    transition: width 200ms ease, opacity 140ms ease;
  }
  #editor-main > ee-tree-nav:not([open]) {
    width: 0;
    opacity: 0;
  }

  /* Larger desktop: widen tree to 480px at >= 1920px */
  @media (min-width: 1920px) {
    #editor-main > ee-tree-nav[open] {
      width: 480px;
    }
  }

  /* #editor-pane wrapper removed; canvas-container is placed directly in column 2 */

  #right-sidebar {
    grid-column: 3;
    position: relative;
    height: 100%;
    transition: width 180ms ease;
    padding: var(--spectrum-global-dimension-size-200)
      var(--spectrum-global-dimension-size-200);
    background: transparent;
    width: 360px;
    overflow: hidden;
  }
  #right-sidebar.closed { width: 0; padding-left: 0; padding-right: 0; }
  #right-sidebar.open { width: 360px; }

  /* Shared card styling for sidebars */
  /* left/right sidebar cards removed; components style themselves */

  #comments-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
  }

  /* Leave dialog layout */
  .leave-dialog-body {
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-200);
    padding: var(--spectrum-global-dimension-size-100) 0;
  }
  .leave-dialog-text {
    color: var(--spectrum-alias-text-color);
  }
  /* scroll inside the panel if needed */

  /* Resizer removed: fixed-width sidebar */

  /* Canvas column */

  #canvas-container {
    grid-column: 2; /* center column inside #editor-main */
    position: relative;
    min-width: 0;   /* allow shrink without overflow */
    height: 100%;
    display: flex;
    justify-content: flex-start; /* stick to tree-nav */
    align-items: flex-start;
    /* Align with tree-nav vertical rhythm: top=200, right/bottom=400, left=0 */
    padding: var(--spectrum-global-dimension-size-200)
      0
      var(--spectrum-global-dimension-size-200)
      0;
    overflow: auto;
    /* keep scroll chaining from propagating to ancestors so the container stays put */
    overscroll-behavior: contain;
    /* ensure transformed children never paint outside the container */
    contain: paint;
  }

  #surface-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    max-width: 1440px;
    /* Align top with tree-nav using container padding only */
    margin: 0;
    background: var(--spectrum-alias-component-background-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
    border-radius: var(--spectrum-global-dimension-size-100);
    border: 1px dashed var(--spectrum-alias-border-color);
    padding: var(--spectrum-global-dimension-size-600);
    overflow-x: hidden; /* clip zoomed content inside */
  }

  /* Centered spinner overlay over the surface wrapper while loading */
  #surface-spinner {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  /* Inner content that receives zoom/pan transforms */
  #surface-content {
    position: relative;
    width: 100%;
    min-height: 100%;
    will-change: transform;
    transform-origin: 0 0;
    /* Improve rendering quality during zoom */
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    transform: translateZ(0);
  }

  /* Visual outline for the currently selected (editing) element.
     Elements are provided to the editor via a <slot>, so style the
     slotted node with ::slotted to cross the shadow boundary. */
  ::slotted([data-ee-selected]) {
    outline: 2px solid var(--spectrum-alias-focus-color);
    outline-offset: 2px;
    border-radius: var(--spectrum-global-dimension-size-50);
  }

  /* Hovered-by-comment outline: light blue, does not affect toolbar */
  ::slotted([data-ee-comment-hovered]) {
    outline: 2px solid var(--spectrum-global-color-blue-400);
    outline-offset: 2px;
    border-radius: var(--spectrum-global-dimension-size-50);
  }

  /* Slot selection is styled directly on the <slot> element within open shadow DOM. */

  /* ContentEditable space handling fix */
  [contenteditable] {
    white-space: pre-wrap;
  }

  #reset-zoom {
    min-width: 60px;
`;

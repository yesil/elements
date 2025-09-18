import { css } from "lit";

export const eeVersionsPanelStyles = css`
  #panel-root {
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-200);
    height: 100%;
    color: var(--spectrum-alias-text-color, var(--spectrum-global-color-gray-700));
  }
  #header {
    display: flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-200);
  }
  #header h3 {
    margin: 0;
    font-size: 14px;
  }
  #list {
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-150);
  }
  .item {
    padding: var(--spectrum-global-dimension-size-200);
    border: 1px solid var(--spectrum-alias-border-color);
    border-radius: var(--spectrum-global-dimension-size-50);
    background: var(--spectrum-alias-component-background-color);
  }
  pre.diff {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 12px;
    line-height: 1.5;
    padding: var(--spectrum-global-dimension-size-200);
    border: 1px solid var(--spectrum-alias-border-color);
    border-radius: var(--spectrum-global-dimension-size-50);
    background: var(--spectrum-alias-component-background-color);
    max-height: 320px;
    overflow: auto;
    white-space: pre-wrap;
  }
  .d-eq { color: inherit; opacity: 0.9; }
  .d-add { color: var(--spectrum-global-color-green-600); }
  .d-del { color: var(--spectrum-global-color-red-600); }
  .row {
    display: flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-200);
  }
  .name {
    font-weight: 600;
  }
  .spacer { flex: 1; }
  .muted { opacity: 0.7; font-size: 12px; }
  #composer {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--spectrum-global-dimension-size-200);
  }

  /* Compare slider layout */
  #compare-viewport {
    width: 100%;
    height: 100%;
    overflow: auto;
    border: none;
    border-radius: 0;
    background: transparent;
  }
  #compare-scene {
    position: relative;
    height: 100%;
    cursor: col-resize;
    overflow: scroll;
    --compare-divider-width: var(--spectrum-global-dimension-size-50, 4px);
  }
  .compare-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  /* Keep full-width layout; reveal with clip-path to avoid reflow/shifts */
  .compare-after-clip {
    overflow: visible;
  }
  /* Reveal selected on the right side */
  .compare-after-clip.reveal-right {
    -webkit-clip-path: inset(0 0 0 var(--divider-percent, 50%));
    clip-path: inset(0 0 0 var(--divider-percent, 50%));
  }
  /* Reveal selected on the left side */
  .compare-after-clip.reveal-left {
    -webkit-clip-path: inset(0 calc(100% - var(--divider-percent, 50%)) 0 0);
    clip-path: inset(0 calc(100% - var(--divider-percent, 50%)) 0 0);
  }
  .compare-content {
    padding: var(--spectrum-global-dimension-size-200);
    width: 100%;
    box-sizing: border-box;
  }
  /* Prevent interactions with embedded content while allowing scroll on viewport */
  .compare-layer, .compare-layer * { pointer-events: none; }
  /* Scale media to fit width */
  .compare-content img,
  .compare-content video,
  .compare-content canvas,
  .compare-content svg { max-width: 100%; height: auto; }

  /* Divider visuals now rendered via transparent canvas overlay */

  /* Transparent canvas overlay for divider glow/gradient */
  #compare-canvas {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  #compare-divider {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--divider-percent, 50%);
    transform: translateX(-50%);
    width: var(--compare-divider-width);
    max-width: var(--spectrum-global-dimension-size-300);
    background: rgba(57, 57, 57, 0.65);
    background: color-mix(in srgb, var(--spectrum-global-color-gray-900) 55%, transparent);
    border-radius: var(--spectrum-global-dimension-size-50);
    box-shadow: 0 0 0 1px var(--spectrum-alias-border-color);
    opacity: 0.9;
    pointer-events: none;
    z-index: 2;
  }

  /* Remove badges to avoid layout shifts; keep layout clean */
  #compare-legend {
    position: absolute;
    top: 8px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    pointer-events: none;
    z-index: 3;
    padding: 0 var(--spectrum-global-dimension-size-200);
  }
  #compare-legend .legend-left,
  #compare-legend .legend-right {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--spectrum-global-dimension-size-50);
    font-size: 12px;
    background: color-mix(in srgb, var(--spectrum-global-color-gray-50) 70%, transparent);
    color: var(--spectrum-alias-text-color, var(--spectrum-global-color-gray-700));
    border: 1px solid var(--spectrum-alias-border-color);
  }

  /* Visual annotations for DOM nodes */
  .d-added { outline: 2px solid var(--spectrum-global-color-green-600); outline-offset: 2px; }
  .d-removed { outline: 2px solid var(--spectrum-global-color-red-600); outline-offset: 2px; }
  .d-changed { outline: 2px solid var(--spectrum-global-color-orange-600); outline-offset: 2px; }
  .d-text-changed { background: color-mix(in srgb, var(--spectrum-global-color-orange-600) 20%, transparent); }

  /* Center only modal dialogs; let fullscreen manage its own layout */
  sp-dialog-wrapper[open][mode="modal"] {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Fallback to viewport centering if host isn't full height */
  :host(:not(:defined)), :host {
    contain: paint;
  }
  sp-dialog-wrapper[open][mode="modal"][underlay] {
    position: fixed;
    inset: 0;
    z-index: 10000;
    pointer-events: none; /* allow dialog to own interactions */
  }
  sp-dialog-wrapper[open][mode="modal"] sp-dialog {
    pointer-events: auto;
  }

  /* Fullscreen dialog wrapper to ensure it mounts above and captures ESC/underlay */
  sp-dialog-wrapper[open][mode="fullscreen"] {
    position: fixed;
    inset: 0;
    z-index: 10000;
    pointer-events: none;
  }
  sp-dialog-wrapper[open][mode="fullscreen"] sp-dialog {
    pointer-events: auto;
  }
`;

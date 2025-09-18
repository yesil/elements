import { css } from "lit";

export const eeToolbarStyles = css`
  :host {
    display: inline-block;
    position: fixed;
    inset: 0;
    pointer-events: none;
  }

  :host([static]) {
    position: relative;
    inset: auto;
    pointer-events: auto;
  }

  #ee-toolbar {
    position: fixed;
    left: 0;
    top: 0;
    pointer-events: auto;
    background: var(--spectrum-global-color-gray-100);
    border: 1px solid var(--spectrum-global-color-gray-500);
    border-radius: 9999px; /* pill */
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.10);
    padding: 8px 16px; /* thinner */
    animation: eeToolbarFadeIn 0.12s ease-out;
    overflow: hidden;
  }

  :host([static]) #ee-toolbar {
    position: relative;
    left: auto;
    top: auto;
    transform: none !important;
    width: 100%;
    max-width: 100%;
    margin: 8px 0;
  }

  @keyframes eeToolbarFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
  }
  .row::-webkit-scrollbar {
    display: none; /* WebKit */
  }

  .toolbar-header {
    display: none; /* compact pill hides header */
  }

  .title {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title .label {
    font-weight: 600;
    color: var(--spectrum-global-color-gray-900);
    font-size: var(--spectrum-global-dimension-font-size-100);
  }

  .title .description {
    color: var(--spectrum-global-color-gray-600);
    font-size: var(--spectrum-global-dimension-font-size-75);
  }

  sp-divider { display: none; }
  /* Show dividers placed around author controls group in toolbar */
  sp-divider.author-controls-divider {
    display: inline-block;
    align-self: stretch;
    height: 40px;
    width: 1px;
    margin-inline: var(--spectrum-global-dimension-size-100);
  }

  .groups { display: contents; }

  .actions {
    display: flex;
    gap: var(--spectrum-global-dimension-size-75);
    align-items: center;
    flex-wrap: wrap;
  }

  .attributes {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .footer { display: none; }

  /* Make action buttons feel compact */
  sp-action-button[quiet] {
    --spectrum-actionbutton-height: 28px;
    --mod-actionbutton-min-width: 28px;
    padding-inline: 8px;
  }

  sp-picker {
    --spectrum-picker-height: 28px;
  }

  sp-number-field, sp-textfield {
    --spectrum-textfield-height: 28px;
  }

  sp-field-label, sp-help-text { display: none !important; }

  /* In popover (expanded form), show labels and help text and stack fields vertically */
  :host sp-popover .popover-content {
    padding: var(--spectrum-global-dimension-size-200)
      var(--spectrum-global-dimension-size-300);
    min-width: 280px;
    max-width: 420px;
  }
  :host sp-popover .attributes {
    display: grid !important;
    grid-template-columns: 1fr;
    gap: var(--spectrum-global-dimension-size-150);
  }
  :host sp-popover sp-field-label,
  :host sp-popover sp-help-text {
    display: block !important;
  }
  :host sp-popover sp-number-field,
  :host sp-popover sp-textfield,
  :host sp-popover sp-picker {
    width: 100%;
  }

  /* Form mode styles removed; popovers show full content instead */

  /* Functional groups */
  .group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* Select Parent button: rotated icon, smooth background sheen on hover */
  sp-action-button.select-parent-btn sp-icon-arrow-up-right {
    transform: rotate(-90deg);
  }

  .select-parent-btn .select-parent-icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .select-parent-btn .select-parent-icon::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 6px;
    background-image: linear-gradient(
      to top left,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0) 45%,
      rgba(255, 255, 255, 0.28) 50%,
      rgba(255, 255, 255, 0) 55%,
      rgba(255, 255, 255, 0) 100%
    );
    background-size: 200% 200%;
    background-position: 100% 100%;
    opacity: 0;
    pointer-events: none;
    will-change: background-position, opacity;
    transition: opacity 180ms ease-out;
  }

  @keyframes eeSheenDiagBRtoTL {
    from {
      background-position: 100% 100%;
    }
    to {
      background-position: 0% 0%;
    }
  }

  .select-parent-btn:hover .select-parent-icon::after {
    opacity: 1;
    animation: eeSheenDiagBRtoTL 360ms ease-out;
  }

`;

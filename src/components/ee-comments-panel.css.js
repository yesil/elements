import { css } from "lit";

export const eeCommentsPanelStyles = css`
  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }
  :host {
    display: block;
    height: 100%;
    box-sizing: border-box;
  }

  #panel-root {
    display: grid;
    grid-template-rows: auto auto 1fr;
    height: 100%;
    padding: var(--spectrum-global-dimension-size-300);
    gap: var(--spectrum-global-dimension-size-200);
    color: var(--spectrum-alias-text-color, currentColor);
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  #header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spectrum-global-dimension-size-200);
    color: var(--spectrum-alias-text-color, inherit);
  }

  #composer {
    display: grid;
    grid-template-rows: auto auto;
    align-items: stretch;
    gap: var(--spectrum-global-dimension-size-150);
  }

  #comments-list {
    overflow: auto;
    padding-right: var(--spectrum-global-dimension-size-100);
    color: var(--spectrum-alias-text-color, currentColor);
    width: 100%;
    max-width: 100%;
  }

  sp-textfield {
    width: 100%;
  }

  .comment-item {
    display: grid;
    grid-template-rows: auto auto;
    gap: var(--spectrum-global-dimension-size-100);
    margin-bottom: var(--spectrum-global-dimension-size-150);
    padding: var(--spectrum-global-dimension-size-150);
    border-radius: var(--spectrum-global-dimension-size-75);
    border: 1px solid var(--spectrum-alias-border-color);
    background: var(--spectrum-alias-component-background-color);
    color: var(--spectrum-alias-text-color, currentColor);
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .comment-item[data-active="true"] {
    box-shadow: inset 0 0 0 1px var(--spectrum-alias-focus-color);
  }

  .comment-item:hover {
    border-color: var(--spectrum-alias-focus-color);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-100);
    flex-wrap: wrap;
    min-width: 0;
  }

  .author {
    font-weight: 600;
    color: var(--spectrum-alias-text-color, currentColor);
  }

  .spacer {
    flex: 1 1 auto;
  }

  .comment-text {
    font-size: var(--spectrum-global-dimension-font-size-100);
    line-height: 1.4;
    color: var(--spectrum-alias-text-color, currentColor);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  #header { min-width: 0; }
  #header h3 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 75%;
  }

  .comment-meta {
    display: flex;
    gap: var(--spectrum-global-dimension-size-150);
    align-items: center;
    color: var(--spectrum-alias-text-color, inherit);
  }

  .timestamp {
    font-size: var(--spectrum-global-dimension-font-size-75);
    color: var(--spectrum-alias-text-color, var(--spectrum-global-color-gray-700));
  }
`;

import { css } from "lit";

export const eeReferencesPanelStyles = css`
  :host {
    display: block;
  }

  #panel {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: var(--spectrum-global-dimension-size-200);
  }

  #header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  #list {
    max-height: 100%;
    overflow: auto;
  }

  #empty {
    color: var(--spectrum-alias-label-text-color);
    padding: var(--spectrum-global-dimension-size-200);
  }
`;


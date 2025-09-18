import { css } from 'lit';

// Lit-friendly styles: export a CSSResult for use in `static styles`.
export const eeReferenceStyleSheet = css`
  :host {
    display: contents;
  }

  /* In the editor, render ee-reference as an inline-block wrapper so it can be
     selected, outlined, and measured like normal elements. */
  :host-context(experience-elements-editor),
  #surface-wrapper :host {
    display: inline-block;
  }
`;

const styles = `
  :host {
    display: inline-block;
    box-sizing: border-box;
    color: var(--spectrum-alias-text-color);
    /* Tune these to match pixel spec */
    --sap-max-width: 1130px;
    --sap-section-gap: var(--spectrum-global-dimension-size-300); /* ~24px */
    --sap-plan-padding: var(--spectrum-global-dimension-size-300);
    --sap-border-radius: var(--spectrum-global-dimension-size-75);
    --sap-offers-width: 342px; /* right column width */
    --sap-price-col: 280px;   /* price column width inside plan row */
    --sap-cta-col: 200px;     /* CTA column width inside plan row */
  }


  /* Page wrapper */
  #container {
    display: block;
    max-width: var(--sap-max-width);
    margin-inline: auto;
    margin-block: var(--spectrum-global-dimension-size-400);
    padding-inline: var(--spectrum-global-dimension-size-300);
    box-sizing: border-box;
  }

  /* Single Grid Layout (page + modal) */
  .sap-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr var(--sap-offers-width);
    grid-template-rows: auto auto auto auto auto auto;
    grid-template-areas:
      "header header header header"
      "icons  icons  icons  offers"
      "desc   desc   desc   offers"
      "includes extras recommended offers"
      ". . . continue"
      "footer footer footer footer";
    gap: var(--sap-section-gap);
    align-items: start;
  }

  /* Modal content uses same grid, without header/footer area inside content */
  .sap-grid.sap-grid--modal {
    grid-template-areas:
      "icons  icons  icons  offers"
      "desc   desc   desc   offers"
      "includes extras recommended offers"
      ". . . continue";
    width: fit-content;
    max-width: 100%;
  }

  /* Grid area assignments */
  #header { grid-area: header; display: grid; align-content: center; }
  #icons { grid-area: icons; display: inline-flex; gap: var(--spectrum-global-dimension-size-100); align-items: center; }
  #desc { grid-area: desc; color: var(--spectrum-alias-secondary-text-color); }
  #includes { grid-area: includes; }
  #extras { grid-area: extras; }
  #recommended { grid-area: recommended; }
  #offers { grid-area: offers; display: grid; gap: var(--spectrum-global-dimension-size-200); }
  #continue { grid-area: continue; display: flex; justify-content: end; }
  #footer { grid-area: footer; display: grid; justify-content: end; }

  /* Header typography (author-provided heading) */
  ::slotted([slot="header"]) { margin: 0; font-weight: 700; }
  ::slotted(h2[slot="header"]) { font-size: 22px; line-height: 28px; }
  ::slotted(h3[slot="header"]) { font-size: 18px; line-height: 24px; font-weight: 600; }

  /* Section heading styles inside left meta areas */
  #includes h3, #extras h3, #recommended h3 {
    margin: 0 0 var(--spectrum-global-dimension-size-100) 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--spectrum-alias-label-text-color);
  }
  #recommended ul { margin: 0; padding-left: 1.2em; }
  #recommended li { list-style: disc; margin-block: 0.25em; }
  #includes .items { display: grid; gap: var(--spectrum-global-dimension-size-100); }
  #includes .item { display: inline-flex; align-items: center; gap: var(--spectrum-global-dimension-size-100); }

  /* Continue section */
  .continue-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spectrum-global-dimension-size-100);
  }
  .stock-offer {
    align-self: stretch;
  }
  .stock-offer ::slotted(*) {
    display: inline-flex;
    align-items: center;
  }
  .secure-text {
    font-size: var(--spectrum-global-dimension-size-150);
    color: var(--spectrum-alias-text-color);
    display: flex;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-75);
  }

  /* Style plan rows consistently when slotted */
  ::slotted(subscribe-all-plans-type) {
    border: 1px solid var(--spectrum-global-color-gray-300);
    border-radius: var(--sap-border-radius);
    padding: var(--sap-plan-padding);
    background: var(--spectrum-global-color-gray-50);
  }

  /* Dialog sizing: let content define width; keep reasonable viewport max */
  sp-dialog { max-width: calc(100vw - 64px); }
  sp-divider { margin-block: var(--spectrum-global-dimension-size-150); }

  /* Responsive */
  @media (max-width: 920px) {
  .sap-grid {
      grid-template-columns: 1fr;
      grid-template-areas:
        "header"
        "icons"
        "desc"
        "offers"
        "includes"
        "extras"
        "recommended"
        "continue"
        "legal"
        "footer";
    }
    .sap-grid.sap-grid--modal {
      grid-template-areas:
        "icons"
        "desc"
        "offers"
        "includes"
        "extras"
        "recommended"
        "continue";
    }
    #footer { justify-content: start; }
  }

  /* Debug overlay removed per request */
`;

export const subscribeAllPlansStyleSheet = new CSSStyleSheet();
subscribeAllPlansStyleSheet.replaceSync(styles);

const styles = `
  :host { 
    display: block; 
    border: 2px solid var(--spectrum-global-color-gray-300);
    border-radius: var(--spectrum-global-dimension-size-100);
    padding: var(--spectrum-global-dimension-size-300);
    background: var(--spectrum-global-color-gray-50);
  }

  :host([data-term="annual"][data-selected="true"]) {
    border-color: var(--spectrum-global-color-blue-400);
    background: var(--spectrum-global-color-blue-50);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-200);
    align-items: flex-start;
  }

  .head { 
    display: flex; 
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-50);
    width: 100%;
  }
  
  .desc { 
    color: var(--spectrum-alias-secondary-text-color); 
    font-size: 14px;
    line-height: 1.4;
  }
  
  .prices { 
    display: flex; 
    gap: var(--spectrum-global-dimension-size-100); 
    align-items: baseline;
    margin: var(--spectrum-global-dimension-size-100) 0;
  }
  

  /* Spacing tweaks for slotted elements */
  ::slotted([slot="title"]) { 
    font-weight: 700; 
    font-size: 16px; 
    line-height: 22px; 
    margin: 0;
  }
  
  ::slotted([slot="subtitle"]) { 
    color: var(--spectrum-alias-secondary-text-color); 
    font-size: 13px; 
    line-height: 18px; 
    margin: 0;
  }
  
  ::slotted([slot="description"]) { 
    font-size: 13px; 
    line-height: 18px; 
    margin: 0;
  }
  
  ::slotted([slot="price"]) { 
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
  }
  
  ::slotted([slot="annual-price"]) { 
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
  }

  /* Toggle price visibility based on term */
  :host([data-term="monthly"]) ::slotted([slot="annual-price"]) { display: none !important; }
  :host([data-term="annual"]) ::slotted([slot="price"]) { display: none !important; }
`;

export const subscribePlanStyleSheet = new CSSStyleSheet();
subscribePlanStyleSheet.replaceSync(styles);

import { InlinePrice } from './inline-price.js';

// Patch InlinePrice with authoring capabilities
InlinePrice.ee = {
  getElementIcon(html) {
    return html`$`;
  },

  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: 'Inline Price',
        description: 'Displays pricing information with currency, value, and optional period',
        category: 'commerce',
        supportsTextFormatting: false,
      },
      attributes: {
        value: {
          type: 'text',
          default: '19.99',
          label: 'Price Value',
          description: 'The numeric price value (e.g., 19.99)',
          pattern: '^[0-9]+(\\.[0-9]{1,2})?$',
        },
        currency: {
          type: 'enum',
          options: ['US$', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'],
          default: 'US$',
          label: 'Currency',
          description: 'Currency symbol or code',
        },
        period: {
          type: 'enum',
          options: ['', 'mo', 'yr', 'day', 'week'],
          default: 'mo',
          label: 'Billing Period',
          description: 'Billing period (monthly, yearly, etc.)',
        },
        variant: {
          type: 'enum',
          options: ['default', 'strike', 'accent'],
          default: 'default',
          label: 'Display Variant',
          description: 'Visual style variant',
        },
        'old-value': {
          type: 'text',
          default: '',
          label: 'Old Price Value',
          description: 'Previous price for strikethrough display',
          pattern: '^[0-9]+(\\.[0-9]{1,2})?$',
        },
        prefix: {
          type: 'text',
          default: '',
          label: 'Price Prefix',
          description: 'Text before the price (e.g., "Starting at")',
          maxLength: 20,
        },
      },
      slots: { order: [], configs: {} },
    };
  },
  
  // Create a new instance with default values
  create() {
    const price = document.createElement('inline-price');
    price.setAttribute('value', '19.99');
    price.setAttribute('currency', 'US$');
    price.setAttribute('period', 'mo');
    return price;
  },

  sanitize(el) {
    try {
      // Ensure numeric attributes are clean
      const cleanNumber = (v) => {
        if (v == null) return '';
        const m = String(v).match(/[0-9]+(?:\.[0-9]{1,2})?/);
        return m ? m[0] : '';
      };
      const currencies = ['US$', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];
      const periods = ['', 'mo', 'yr', 'day', 'week'];
      const value = cleanNumber(el.getAttribute('value'));
      if (value) el.setAttribute('value', value); else el.removeAttribute('value');
      const oldValue = cleanNumber(el.getAttribute('old-value'));
      if (oldValue) el.setAttribute('old-value', oldValue); else el.removeAttribute('old-value');
      const curr = el.getAttribute('currency');
      if (!curr || !currencies.includes(curr)) el.setAttribute('currency', 'US$');
      const per = el.getAttribute('period');
      if (per == null || !periods.includes(per)) el.setAttribute('period', 'mo');
      // Trim prefix
      const prefix = el.getAttribute('prefix');
      if (prefix != null) {
        const trimmed = prefix.trim();
        if (trimmed) el.setAttribute('prefix', trimmed); else el.removeAttribute('prefix');
      }
    } catch (_) {}
  },

  // Serialize element to JSON (attributes only; no slots)
  toJson(el, _serializeNode) {
    const attributes = {};
    const names = ['value','currency','period','variant','old-value','prefix'];
    for (const name of names) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }
    return { tag: el.tagName.toLowerCase(), attributes };
  }
};

export { InlinePrice };

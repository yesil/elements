import { MerchBadge } from './merch-badge.js';
import { makeSWCColorSchema } from '../utils/author-schemas.js';

MerchBadge.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: 'Badge',
        description: 'Small status or category badge for highlighting important information',
        category: 'indicators',
        supportsTextFormatting: false,
      },
      attributes: {
        color: makeSWCColorSchema({ label: 'Badge Color', description: 'Color override for the badge' }),
      },
      slots: {
        order: ['default'],
        configs: {
          default: {
            label: 'Badge Text',
            description: 'Short text label for the badge',
            allowedStyles: [],
            allowLinks: false,
            textFormatting: 'none',
            inlineEditable: true,
            multiline: false,
            maxLength: 20,
            minLength: 1,
            placeholder: 'Badge',
          },
        },
      },
    };
  },
  
  // Create a new instance with default values
  create() {
    const badge = document.createElement('merch-badge');
    
    // Set content and attributes after the element is fully constructed
    requestAnimationFrame(() => {
      // The element should be ready now
      badge.textContent = 'Badge';
      // Don't set color attribute since the constructor already sets it to 'yellow'
    });
    
    return badge;
  },

  sanitize(el) {
    try {
      // Trim and limit badge text length
      const text = (el.textContent || '').trim();
      el.textContent = text.slice(0, 40);
      // Clean color attribute
      const color = el.getAttribute('color');
      if (color != null) {
        const trimmed = color.trim();
        if (!trimmed) el.removeAttribute('color'); else el.setAttribute('color', trimmed);
      }
    } catch (_) {}
  },

  // Serialize element to JSON, aware of default text content only
  toJson(el, _serializeNode) {
    const attributes = {};
    const schemaAttrs = Object.keys(this.getSchema()?.attributes || {});
    for (const name of schemaAttrs) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }
    const text = (el.textContent || '').trim();
    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (text) result.slots = { default: [{ text }] };
    return result;
  }
};

export { MerchBadge };

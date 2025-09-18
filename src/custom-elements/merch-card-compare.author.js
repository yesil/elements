import { MerchCardCompare } from './merch-card-compare.js';

MerchCardCompare.ee = {
  getSchema() {
    const slotConfigs = {
      'badge': {
        label: 'Badge', description: 'Short badge text displayed at the top of the card',
        allowedTags: ['merch-badge'], allowedStyles: [], allowedFormats: [], allowLinks: false,
        maxLength: 1, minLength: 0, placeholder: 'e.g., "BEST VALUE"'
      },
      'mnemonics': {
        label: 'Product Icons', description: 'Container for mnemonics',
        allowedTags: ['merch-mnemonic'], allowedStyles: [], allowedFormats: [], allowLinks: false,
        maxLength: 4, minLength: 0, placeholder: 'Add mnemonics'
      },
      'heading-xs': {
        label: 'Card Title', description: 'Main heading for the card',
        // Only allow an <h3> as slotted content for the title
        allowedTags: ['h3'],
        allowedStyles: ['bold','italic','underline','strikethrough'],
        // Limit formatting to inline emphasis + alignment (no lists)
        allowedFormats: ['align-left','align-center','align-right'],
        textFormatting: 'default',
        allowLinks: false,
        inlineEditable: true,
        maxLength: 1,
        minLength: 0,
        placeholder: 'Enter card title'
      },
      'body-xxs': {
        label: 'Subtitle', description: 'Small subtitle text, typically used for pricing context',
        allowedTags: ['p','span'],
        allowedStyles: ['bold','italic','underline','strikethrough',],
        allowedFormats: ['paragraph','align-left','align-center','align-right','unordered-list','ordered-list'],
        textFormatting: 'default',
        allowLinks: true, inlineEditable: true, maxLength: 5, minLength: 0, placeholder: 'e.g., "Starting at"'
      },
      'price': {
        label: 'Primary Price', description: 'Primary price display with optional inline text',
        // Allow formatted inline text before/after the inline-price component
        allowedTags: ['inline-price', 'span'],
        allowedStyles: ['bold', 'italic', 'underline', 'strikethrough'],
        allowedFormats: [],
        textFormatting: 'default',
        allowLinks: true,
        inlineEditable: true,
        maxLength: null, minLength: 0, placeholder: 'Add price and optional text'
      },
      'annual-price': {
        label: 'Annual Price', description: 'Annual price display (optional)',
        allowedTags: ['inline-price'], allowedStyles: [], allowedFormats: [], allowLinks: false,
        maxLength: null, minLength: 0, placeholder: 'Add annual price'
      },
      'legal-disclaimer': {
        label: 'Legal Disclaimer', description: 'Legal text or pricing terms',
        allowedTags: ['span','a'],
        allowedStyles: ['bold','italic','underline','strikethrough',],
        allowedFormats: ['align-left','align-center','align-right'],
        textFormatting: 'default',
        allowLinks: true, maxLength: 100, minLength: 0, placeholder: 'e.g., "Annual, paid monthly"'
      },
      'promo-text': {
        label: 'Promotional Text', description: 'Promotional or offer text with links',
        allowedTags: ['div','p','span','a'],
        allowedStyles: ['bold','italic','underline','strikethrough',],
        allowedFormats: ['paragraph','align-left','align-center','align-right','unordered-list','ordered-list'],
        textFormatting: 'default',
        allowLinks: true, maxLength: 200, minLength: 0, placeholder: 'Enter promotional message'
      },
      'body-xs': {
        label: 'Description', description: 'Main body text with rich formatting support',
        allowedStyles: ['bold','italic','underline','strikethrough',],
        allowedFormats: ['align-left','align-center','align-right','unordered-list','ordered-list','paragraph'],
        textFormatting: 'default',
        allowLinks: true, inlineEditable: true, maxLength: 500, minLength: 0, placeholder: 'Enter description'
      },
      'callout': {
        label: 'Callout Message', description: 'Callout message component',
        allowedTags: ['merch-callout'], allowedStyles: [], allowedFormats: [], allowLinks: false,
        maxLength: 1, minLength: 0, placeholder: 'Add callout component'
      },
      'footer': {
        label: 'Action Buttons', description: 'Container for CTA buttons',
        allowedTags: ['a','checkout-button'], allowedStyles: [], allowedFormats: [], allowLinks: false,
        maxLength: 3, minLength: 0, placeholder: 'Add action buttons'
      },
      'footer-list': {
        label: 'Footer List', description: 'Feature list container with items',
        allowedTags: ['merch-list'], allowedStyles: ['bold'], allowedFormats: [], allowLinks: true,
        maxLength: 1, minLength: 0, placeholder: 'Add footer list'
      },
    };
    return {
      schemaVersion: 1,
      element: {
        label: 'Comparison Card',
        description: 'A card component for comparing products or plans with aligned slots for consistent comparison layouts',
        category: 'commerce',
        supportsTextFormatting: true,
      },
      attributes: {},
      slots: {
        order: Object.keys(slotConfigs),
        configs: slotConfigs,
      },
    };
  },
  
  // Create a new instance with default values
  create() {
    const card = document.createElement('merch-card-compare');
    card.innerHTML = `
      <merch-badge slot="badge">Badge</merch-badge>
      <h3 slot="heading-xs">Heading</h3>
      <p slot="body-xxs">Starting at</p>
      <inline-price slot="price" value="0.00" currency="US$" period="mo"></inline-price>
      <div slot="body-xs">Description</div>
      <checkout-button slot="footer">Select</checkout-button>
    `;
    return card;
  },

  sanitize(el) {
    try {
      // Ensure only one badge element in 'badge' slot
      const badges = Array.from(el.querySelectorAll('[slot="badge"]'));
      if (badges.length > 1) badges.slice(1).forEach((b) => b.remove());
      // Coerce heading-xs slot content to a single <h3>
      const headings = Array.from(el.querySelectorAll('[slot="heading-xs"]'));
      if (headings.length) {
        // Keep only the first node; remove the rest
        const [first, ...rest] = headings;
        rest.forEach((n) => n.remove());
        // Never strip an ee-reference wrapper in this slot
        const firstTag = first.tagName?.toLowerCase?.();
        if (firstTag === 'ee-reference') {
          // Preserve as-authored; do not coerce to <h3>
        } else if (firstTag !== 'h3') {
          const h3 = document.createElement('h3');
          h3.setAttribute('slot', 'heading-xs');
          // Preserve visible text; strip markup per allowLinks=false
          const text = (first.textContent || '').trim();
          h3.textContent = text || 'Heading';
          first.replaceWith(h3);
        }
      }
      // Preserve inline markup (e.g., links) in text slots. Generic sanitization
      // like whitespace-only text trimming is handled globally in utils/sanitize.js.
      // No additional flattening here to avoid stripping anchors or inline tags.
    } catch (_) {}
  },

  // Serialize element to JSON, aware of named slots and their expected content
  toJson(el, serializeNode) {
    const attributes = {};
    const schemaAttrs = Object.keys(this.getSchema()?.attributes || {});
    for (const name of schemaAttrs) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }

    const cfg = this.getSchema();
    const slots = {};
    const slotOrder = cfg?.slots?.order || [];
    slotOrder.forEach((slotName) => {
      const maxLen = cfg?.slots?.configs?.[slotName]?.maxLength;
      const items = [];
      if (maxLen === 1) {
        const node = el.querySelector(`[slot="${slotName}"]`);
        if (node) {
          const tag = node.tagName.toLowerCase();
          const Ctor = customElements.get(tag);
          if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(node, serializeNode));
          else if (serializeNode) items.push(serializeNode(node));
        }
      } else {
        const nodes = el.querySelectorAll(`[slot="${slotName}"]`);
        for (const node of nodes) {
          const tag = node.tagName.toLowerCase();
          const Ctor = customElements.get(tag);
          if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(node, serializeNode));
          else if (serializeNode) items.push(serializeNode(node));
        }
      }
      if (items.length) slots[slotName] = items;
    });

    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (Object.keys(slots).length) result.slots = slots;
    return result;
  }
};

export { MerchCardCompare };

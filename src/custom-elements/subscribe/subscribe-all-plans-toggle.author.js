import './subscribe-all-plans-toggle.js';

const Ctor = customElements.get('subscribe-all-plans-toggle');

Ctor.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: 'Billing Toggle',
        description: 'Monthly/Annual selection control',
        category: 'commerce',
        supportsTextFormatting: false,
      },
      attributes: {
        'default-term': {
          type: 'enum',
          options: ['monthly', 'annual'],
          default: 'monthly',
          label: 'Default Term',
          description: 'Initial billing term selection',
        },
      },
      slots: { order: [], configs: {} },
    };
  },

  create() {
    const el = document.createElement('subscribe-all-plans-toggle');
    el.setAttribute('default-term', 'monthly');
    return el;
  },

  sanitize(el) {
    try {
      const t = (el.getAttribute('default-term') || 'monthly').toLowerCase();
      el.setAttribute('default-term', t === 'annual' ? 'annual' : 'monthly');
    } catch (_) {}
  },

  toJson(el) {
    const attributes = {};
    if (el.hasAttribute('default-term')) attributes['default-term'] = el.getAttribute('default-term');
    return { tag: el.tagName.toLowerCase(), attributes };
  },
};

export { Ctor as SubscribeAllPlansToggle };


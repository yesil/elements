import './subscribe-all-plans-type.js';

const Ctor = customElements.get('subscribe-all-plans-type');

Ctor.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: 'Subscribe Plan Type',
        description: 'A single subscription option with price(s) and CTA',
        category: 'commerce',
        supportsTextFormatting: true,
      },
      attributes: {
        'plan-id': {
          type: 'text',
          default: '',
          label: 'Plan ID',
          description: 'Plan identifier used for CTA link composition',
        },
        'analytics-id': {
          type: 'text',
          default: '',
          label: 'Analytics ID',
          description: 'Optional analytics identifier',
        },
      },
      slots: {
        order: ['title','subtitle','description','price','annual-price','cta'],
        configs: {
          title: {
            label: 'Title', description: 'Plan title',
            allowedStyles: ['bold','italic','underline','strikethrough'],
            allowLinks: false,
            textFormatting: 'default',
            inlineEditable: true, multiline: false, maxLength: 1, minLength: 0, placeholder: 'Plan title'
          },
          subtitle: {
            label: 'Subtitle', description: 'Optional subtitle',
            allowedStyles: ['bold','italic','underline','strikethrough'],
            allowLinks: false,
            textFormatting: 'default',
            inlineEditable: true, multiline: false, maxLength: 1, minLength: 0, placeholder: 'Subtitle'
          },
          description: {
            label: 'Description', description: 'Plan description text',
            allowedStyles: ['bold','italic','underline','strikethrough',],
            allowedFormats: ['unordered-list','ordered-list'],
            allowLinks: false,
            textFormatting: 'default',
            inlineEditable: true, multiline: true, maxLength: null, minLength: 0, placeholder: 'Describe key features'
          },
          price: {
            label: 'Monthly Price', description: 'Monthly price (inline-price element)',
            allowedTags: ['inline-price'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: 1, minLength: 0
          },
          'annual-price': {
            label: 'Annual Price', description: 'Annual price (inline-price element)',
            allowedTags: ['inline-price'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: 1, minLength: 0
          },
          cta: {
            label: 'CTA', description: 'Checkout button',
            allowedTags: ['checkout-button'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: 1, minLength: 0
          },
        }
      }
    };
  },

  create() {
    const el = document.createElement('subscribe-all-plans-type');
    const price = document.createElement('inline-price');
    price.setAttribute('slot', 'price');
    price.setAttribute('value', '9.99');
    price.setAttribute('currency', 'US$');
    price.setAttribute('period', 'mo');
    el.appendChild(price);
    const annual = document.createElement('inline-price');
    annual.setAttribute('slot', 'annual-price');
    annual.setAttribute('value', '119.88');
    annual.setAttribute('currency', 'US$');
    annual.setAttribute('period', 'yr');
    el.appendChild(annual);
    const cta = document.createElement('checkout-button');
    cta.setAttribute('slot', 'cta');
    cta.textContent = 'Subscribe';
    el.appendChild(cta);
    return el;
  },

  sanitize(el) {
    try {
      const pid = (el.getAttribute('plan-id') || '').trim();
      if (pid) el.setAttribute('plan-id', pid); else el.removeAttribute('plan-id');
      const aid = (el.getAttribute('analytics-id') || '').trim();
      if (aid) el.setAttribute('analytics-id', aid); else el.removeAttribute('analytics-id');
    } catch (_) {}
  },

  toJson(el, serializeNode) {
    const attributes = {};
    ['plan-id','analytics-id'].forEach((a) => { if (el.hasAttribute(a)) attributes[a] = el.getAttribute(a); });
    const slots = {};
    const push = (slotName) => {
      const nodes = Array.from(el.children).filter((c) => (slotName === 'default' ? !c.hasAttribute('slot') : c.getAttribute('slot') === slotName));
      const items = [];
      for (const node of nodes) {
        const tag = node.tagName?.toLowerCase?.();
        const Ctor = tag ? customElements.get(tag) : null;
        if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(node, serializeNode));
        else if (serializeNode) items.push(serializeNode(node));
      }
      if (items.length) slots[slotName] = items;
    };
    ['title','subtitle','description','price','annual-price','cta'].forEach(push);
    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (Object.keys(slots).length) result.slots = slots;
    return result;
  }
};

export { Ctor as SubscribeAllPlansType };

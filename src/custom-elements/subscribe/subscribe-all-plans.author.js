import { html } from 'lit';
import './subscribe-all-plans.js';

// Patch with authoring capabilities
const Ctor = customElements.get('subscribe-all-plans');

Ctor.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: 'Subscribe All Plans',
        description: 'Container for subscription options with optional modal presentation',
        category: 'commerce',
        supportsTextFormatting: true,
      },
      attributes: {
        'data-modal': {
          type: 'boolean',
          default: false,
          label: 'Render as modal',
          description: 'When enabled, persists with modal attribute. Editor always shows page layout.',
        },
        'show-all-threshold': {
          type: 'number',
          default: null,
          label: 'Show all threshold',
          description: 'Number of apps to show before displaying "Show all X+ apps" link. Leave empty to show all apps.',
          min: 1,
        },
      },
      slots: {
        order: ['header', 'icons', 'description', 'includes', 'extras', 'recommended', 'toggle', 'default', 'footer'],
        configs: {
          header: {
            label: 'Header', description: 'Heading content for the subscribe container',
            allowedStyles: ['bold','italic','underline','strikethrough'],
            allowLinks: false,
            textFormatting: 'default',
            inlineEditable: true, multiline: false, placeholder: 'Subscribe'
          },
          icons: {
            label: 'Product Icons', description: 'Product icon(s) to display',
            allowedTags: ['merch-mnemonic'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: null, minLength: 0
          },
          description: {
            label: 'Product Description', description: 'Short description text under the header',
            allowedStyles: ['bold','italic','underline','strikethrough'],
            allowLinks: false,
            textFormatting: 'default',
            inlineEditable: true, multiline: true, maxLength: null, minLength: 0, placeholder: 'Describe the bundle'
          },
          includes: {
            label: 'Includes', description: 'Included apps or items',
            allowedTags: ['merch-mnemonic','div','span','a'], allowedStyles: [], allowedFormats: [], allowLinks: true,
            maxLength: null, minLength: 0
          },
          extras: {
            label: 'Extras', description: 'Extra benefits/features list',
            allowedTags: ['merch-list'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: 1, minLength: 0
          },
          recommended: {
            label: 'Recommended For', description: 'Audience list (bulleted or text)',
            allowedTags: ['ul','li','div','span'],
            allowedStyles: ['bold','italic','underline','strikethrough'],
            allowedFormats: ['unordered-list','ordered-list'],
            allowLinks: false,
            textFormatting: 'default',
            inlineEditable: true, multiline: true, maxLength: null, minLength: 0, placeholder: 'Photo, Graphic design, ...'
          },
          toggle: {
            label: 'Billing Toggle', description: 'Monthly/Annual toggle',
            allowedTags: ['subscribe-all-plans-toggle'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: 1, minLength: 0
          },
          default: {
            label: 'Plans', description: 'Plan rows',
            allowedTags: ['subscribe-all-plans-type'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: 3, minLength: 1
          },
          footer: {
            label: 'Footer', description: 'Optional action or note',
            allowedTags: ['checkout-button'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: 1, minLength: 0
          },
        },
      },
    };
  },

  // Create a default instance hierarchy
  create() {
    const root = document.createElement('subscribe-all-plans');
    // Toggle
    const toggle = document.createElement('subscribe-all-plans-toggle');
    toggle.setAttribute('slot', 'toggle');
    toggle.setAttribute('default-term', 'monthly');
    root.appendChild(toggle);

    // Plan example
    const plan = document.createElement('subscribe-all-plans-type');
    const title = document.createElement('span');
    title.setAttribute('slot', 'title');
    title.textContent = 'Individual Plan';
    plan.appendChild(title);

    const price = document.createElement('inline-price');
    price.setAttribute('slot', 'price');
    price.setAttribute('value', '19.99');
    price.setAttribute('currency', 'US$');
    price.setAttribute('period', 'mo');
    plan.appendChild(price);

    const annual = document.createElement('inline-price');
    annual.setAttribute('slot', 'annual-price');
    annual.setAttribute('value', '239.88');
    annual.setAttribute('currency', 'US$');
    annual.setAttribute('period', 'yr');
    plan.appendChild(annual);

    root.appendChild(plan);
    return root;
  },

  sanitize(el) {
    try {
      // Modal handling per authoring requirement
      const flag = el.hasAttribute('data-modal');
      if (flag) el.setAttribute('modal', ''); else el.removeAttribute('modal');
      el.removeAttribute('data-modal');
    } catch (_) {}
  },

  toJson(el, serializeNode) {
    const attributes = {};
    // Persist modal based on data-modal when present, otherwise real attribute
    const modalFlag = el.hasAttribute('data-modal') || el.hasAttribute('modal');
    if (modalFlag) attributes['modal'] = true;
    
    // Persist show-all-threshold attribute
    const threshold = el.getAttribute('show-all-threshold');
    if (threshold !== null && threshold !== '' && Number(threshold) > 0) {
      attributes['show-all-threshold'] = Number(threshold);
    }

    const slots = {};
    // Collect children per slot declarations
    const bySlot = (name) => Array.from(el.children).filter((c) =>
      (name === 'default' ? !c.hasAttribute('slot') : c.getAttribute('slot') === name)
    );

    const pushSerialized = (arr, node) => {
      const tag = node.tagName?.toLowerCase?.();
      const Ctor = tag ? customElements.get(tag) : null;
      if (Ctor?.ee?.toJson) arr.push(Ctor.ee.toJson(node, serializeNode));
      else if (serializeNode) arr.push(serializeNode(node));
    };

    const collect = (slotName) => {
      const nodes = bySlot(slotName);
      if (!nodes.length) return;
      const items = [];
      nodes.forEach((n) => pushSerialized(items, n));
      if (items.length) slots[slotName] = items;
    };

    collect('header');
    collect('icons');
    collect('description');
    collect('includes');
    collect('extras');
    collect('recommended');
    collect('toggle');
    // default
    {
      const items = [];
      bySlot('default').forEach((n) => pushSerialized(items, n));
      if (items.length) slots['default'] = items;
    }
    collect('footer');

    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (Object.keys(slots).length) result.slots = slots;
    return result;
  }
};

export { Ctor as SubscribeAllPlans };

import { MerchList } from './merch-list.js';
import { makeSWCIconNameSchema, makeSWCIconSizeSchema, makeSWCColorSchema } from '../utils/author-schemas.js';

// Patch MerchList with authoring capabilities
MerchList.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: 'Feature List',
        description: 'Container for feature or benefit list items',
        category: 'content',
        supportsTextFormatting: true,
      },
      attributes: {
        'name': makeSWCIconNameSchema({ defaultValue: 'sp-icon-checkmark', label: 'Default Icon Name' }),
        'color': makeSWCColorSchema({ defaultValue: '', label: 'Default Icon Color' }, 5),
        'size': makeSWCIconSizeSchema({ defaultValue: 'm', label: 'Default Icon Size' }),
      },
      slots: {
        order: ['label','default'],
        configs: {
          label: {
            label: 'Label', description: 'Short label/title for the list',
            allowedStyles: ['bold', 'italic', 'underline', 'strikethrough'],
            allowLinks: false,
            textFormatting: 'default',
            inlineEditable: true, multiline: false, maxLength: 1, minLength: 0, placeholder: 'List label'
          },
          default: {
            label: 'List Items', description: 'Container for merch-list-item elements (default slot - no slot attribute needed)',
            allowedTags: ['merch-list-item'], allowedStyles: [], allowedFormats: [], allowLinks: false,
            maxLength: null, minLength: 0, placeholder: 'Add list items'
          },
        },
      },
    };
  },
  
  // Create a new instance with default values
  create() {
    const list = document.createElement('merch-list');
    
    // Add a couple of default list items
    const item1 = document.createElement('merch-list-item');
    item1.textContent = '100GB cloud storage';
    list.appendChild(item1);
    
    const item2 = document.createElement('merch-list-item');
    item2.textContent = 'Access to premium templates';
    list.appendChild(item2);
    
    const item3 = document.createElement('merch-list-item');
    item3.textContent = 'Advanced collaboration tools';
    list.appendChild(item3);
    
    return list;
  },

  sanitize(el, helpers = {}) {
    try {
      el.removeAttribute('style');
      // Keep aria-labelledby and label ids; ignore them during diff instead of stripping
      // (helpers.beforeSave kept for future hooks, intentionally not removing ARIA/ids)
      // Preserve markup inside merch-list-item children (including links)
      // Do not collapse to textContent; only remove stray empty text nodes at root
      // Element-specific sanitizers will run per-item via global sanitizeTree
      // Keep only merch-list-item children in default slot untouched here
      Array.from(el.children).forEach((child) => {
        if (child.tagName?.toLowerCase() !== 'merch-list-item') return;
        // No-op: let merch-list-item.ee.sanitize handle its own cleanup
      });
      // Remove stray text nodes
      Array.from(el.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) n.remove();
      });
      // Clean default icon attrs (trim empties)
      ['name','color','size','rotate','flip-h','flip-v'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v != null && !String(v).trim()) el.removeAttribute(a);
      });
    } catch (_) {}
  },

  // Serialize element to JSON, aware of 'label' slot and default list items
  toJson(el, serializeNode) {
    const attributes = {};
    const schemaAttrs = Object.keys(this.getSchema()?.attributes || {});
    for (const name of schemaAttrs) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }

    const slots = {};
    // Label slot: gather text-only content
    let labelText = '';
    const labelNode = el.querySelector('[slot="label"]');
    if (labelNode) labelText = (labelNode.textContent || '').trim();
    if (labelText) slots['label'] = [{ text: labelText }];

    // Default slot: only merch-list-item children
    const items = [];
    const itemNodes = el.querySelectorAll('merch-list-item:not([slot])');
    for (const child of itemNodes) {
      const Ctor = customElements.get('merch-list-item');
      if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(child, serializeNode));
      else if (serializeNode) items.push(serializeNode(child));
    }
    if (items.length) slots['default'] = items;

    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (Object.keys(slots).length) result.slots = slots;
    return result;
  }
};

export { MerchList };

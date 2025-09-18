import { CheckoutButton } from './checkout-button.js';
import './spectrum-size-palette.js';


// Unified schema-based authoring API
CheckoutButton.ee = {
  getElementIcon(html) {
    return html`<sp-icon-shopping-cart></sp-icon-shopping-cart>`;
  },

  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: 'Checkout Button',
        description: 'Call-to-action button for checkout and purchase flows',
        category: 'commerce',
        supportsTextFormatting: true,
      },
      attributes: {
        variant: {
          type: 'enum',
          options: ['secondary', 'accent', 'primary', 'negative'],
          default: 'secondary',
          label: 'Button Variant',
          description:
            'Visual style variant for the button (typically secondary or accent in card footers)',
        },
        size: {
          type: 'popover',
          default: 'm',
          label: 'Button Size',
          description: 'Size of the button',
          render: ({ html, value }) => html`<spectrum-size-palette
            .size=${value}
            .sizes=${['s','m','l','xl']}
            attr="size"
          ></spectrum-size-palette>`,
        },
        treatment: {
          type: 'enum',
          options: ['fill', 'outline'],
          default: 'fill',
          label: 'Button Treatment',
          description: 'Fill or outline style',
        },
        href: {
          type: 'text',
          default: '',
          label: 'Link URL',
          description: 'URL to open when button is clicked',
          placeholder: 'https://checkout.adobe.com/...',
        },
        disabled: {
          type: 'boolean',
          default: false,
          label: 'Disabled',
          description: 'Disable button interaction',
        },
      },
      slots: {
        order: ['default'],
        configs: {
          default: {
            label: 'Button Text',
            description: 'Button label text',
            allowedTags: ['span'],
            allowedStyles: ['bold', 'italic', 'underline'],
            textFormatting: 'default',
            allowLinks: false,
            inlineEditable: true,
            multiline: false,
            maxLength: 30,
            minLength: 1,
            placeholder: 'e.g., "Buy now" or "Free trial"',
          },
        },
      },
    };
  },
  
  // Create a new instance with default values
  create() {
    const button = document.createElement('checkout-button');
    button.textContent = 'Buy Now';
    button.setAttribute('variant', 'accent');
    button.setAttribute('size', 'm');
    return button;
  },

  // Sanitize before saving
  sanitize(el) {
    try {
      // Trim text content in default slot
      const texts = [];
      Array.from(el.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = n.textContent.replace(/^\s+|\s+$/g, '');
          if (t) texts.push(t);
          n.remove();
        }
      });
      if (texts.length) {
        el.textContent = texts.join(' ');
      }
      // Normalize known attributes to allowed values
      const variantOpts = ['secondary', 'accent', 'primary', 'negative'];
      const sizeOpts = ['s', 'm', 'l', 'xl'];
      if (el.hasAttribute('variant') && !variantOpts.includes(el.getAttribute('variant'))) {
        el.setAttribute('variant', 'accent');
      }
      if (el.hasAttribute('size') && !sizeOpts.includes(el.getAttribute('size'))) {
        el.setAttribute('size', 'm');
      }
      // Drop empty href
      if (el.getAttribute('href') === '') el.removeAttribute('href');
    } catch (_) {}
  },

  // Serialize element to JSON, aware of default content (text and inline formatting)
  toJson(el, serializeNode) {
    const attributes = {};
    const names = ['variant','size','treatment','href','disabled'];
    for (const name of names) {
      if (!el.hasAttribute(name)) continue;
      if (name === 'disabled') attributes[name] = true; else attributes[name] = el.getAttribute(name);
    }

    const items = [];
    const inlineNodes = el.querySelectorAll(':scope > span:not([slot]), :scope > strong:not([slot]), :scope > em:not([slot])');
    if (inlineNodes.length > 0) {
      for (const node of inlineNodes) {
        const tag = node.tagName.toLowerCase();
        const Ctor = customElements.get(tag);
        if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(node, serializeNode));
        else if (serializeNode) items.push(serializeNode(node));
      }
    } else {
      const text = (el.textContent || '').trim();
      if (text) items.push({ text });
    }

    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (items.length) result.slots = { default: items };
    return result;
  }
};

export { CheckoutButton };

import { EeReference } from './ee-reference.js';

// Authoring metadata for ee-reference
EeReference.ee = {
  getSchema(element) {
    // Determine whether the currently edited instance has the `inline` attribute
    let inline = false;
    try {
      const editor = document.querySelector('experience-elements-editor');
      const current = editor?.editorStore?.editingElement || null;
      const target = element || current || null;
      if (
        target &&
        target.tagName &&
        target.tagName.toLowerCase() === 'ee-reference' &&
        target.hasAttribute('inline')
      ) {
        inline = true;
      }
    } catch (_) {}

    return {
      schemaVersion: 1,
      element: {
        label: 'Reference',
        description: 'Inline content reference to a saved element (by URN).',
        category: 'structure',
        supportsTextFormatting: false,
      },
      attributes: {
        urn: {
          type: 'text',
          default: '',
          label: 'Reference URN',
          description: 'URN of the saved element to inline (e.g., urn:eeid:…).',
          placeholder: 'urn:eeid:…',
        },
        inline: {
          type: 'boolean',
          default: false,
          label: 'Inline',
          description: 'Inline referenced content immediately; hides the trigger slot.',
        },
      },
      // Trigger slot: when provided, referenced content loads upon a 'fire' event
      slots: {
        // Hide 'trigger' slot in authoring UI when inline is present on the element
        order: inline ? [] : ['trigger'],
        configs: {
          trigger: {
            label: 'Trigger',
            description: 'Click target to load the experience. Accepts inline text or checkout-link.',
            allowedTags: ['span', 'sp-button', 'checkout-link', 'checkout-button'],
            allowedStyles: ['bold', 'italic', 'underline', 'strikethrough'],
            allowLinks: true,
            textFormatting: 'default',
            inlineEditable: true,
            multiline: false,
            placeholder: 'Open experience…',
          },
        },
      },
    };
  },

  // Contribute custom toolbar actions for ee-reference
  // Editor will call this when ee-reference is selected
  getToolbarActions(el, helpers) {
    const urn  = el.getAttribute('urn') || '';
    if (!urn) return [];
    return [
      {
        id: 'open-in-editor',
        label: 'Open in Editor',
        icon: 'open-in',
        run: () => helpers.openInEditor(urn),
      },
    ];
  },

  // Create a new instance with no default urn
  create() {
    const el = document.createElement('ee-reference');
    return el;
  },

  // Sanitize: remove self-references to the current document and warn
  sanitize(el, helpers) {
    const urn = el.getAttribute('urn') || '';
    const currentId = helpers.currentDocumentId || el.closest('experience-elements-editor')?.getAttribute('data-ee-current-id') || null;
    if (urn && currentId && urn === currentId) {
      el.remove();
      helpers.showToast('Removed self-reference: cannot reference the current document.');
      return;
    }

    const isInline = el.hasAttribute('inline');
    if (isInline && urn) {
      // Inline mode: remove all children and persist inline directive comment
      try { while (el.firstChild) el.removeChild(el.firstChild); } catch (_) {}
      const comment = document.createComment(`inline:${urn}`);
      el.appendChild(comment);
      return;
    } else {
      // Trigger mode: keep only children assigned to the trigger slot
      const children = Array.from(el.childNodes);
      for (const n of children) {
        if (n.nodeType !== Node.ELEMENT_NODE) { n.remove(); continue; }
        const slot = n.getAttribute ? n.getAttribute('slot') : null;
        if (slot !== 'trigger') n.remove();
      }
      // If there is no direct trigger child, emit an inline comment directive as a fallback
      const hasTrigger = !!el.querySelector(':scope > [slot="trigger"]');
      if (!hasTrigger && urn) {
        try { while (el.firstChild) el.removeChild(el.firstChild); } catch (_) {}
        const comment = document.createComment(`inline:${urn}`);
        el.appendChild(comment);
      }
    }
  },

  toJson(el /*, serializeNode */) {
    const attributes = {};
    if (el.hasAttribute('urn')) attributes.urn = el.getAttribute('urn');
    if (el.hasAttribute('inline')) attributes.inline = true;
    return { tag: el.tagName.toLowerCase(), attributes };
  },
};

// Author-time defense: listen for ee-self-reference events and remove the offending element
document.addEventListener('ee-self-reference', (e) => {
  const target = e.target;
  if (!target) return;
  target.remove();
  const editor = target.closest('experience-elements-editor') || document.querySelector('experience-elements-editor');
  editor.showToast('Removed self-reference: cannot reference the current document.');
});

export { EeReference };

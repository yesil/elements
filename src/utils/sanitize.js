// Generic sanitization utilities for saving snapshots

function stripAuthoringArtifacts(root, helpers = {}) {
  const walk = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      // Remove embedded JSON-LD scripts; structured data should be generated at runtime
      if (el.tagName && el.tagName.toLowerCase() === 'script') {
        const type = el.getAttribute && el.getAttribute('type');
        if (String(type).toLowerCase() === 'application/ld+json') {
          el.remove();
          return; // Do not descend into removed node
        }
      }
      // Remove authoring-time attributes and overrides
      // Remove authoring-time attributes and overrides
      // 1) Known attributes
      ['contenteditable'].forEach((attr) => {
        if (el.hasAttribute && el.hasAttribute(attr)) el.removeAttribute(attr);
      });
      // 2) Any data-ee-* attribute automatically
      const toRemove = [];
      for (const { name } of Array.from(el.attributes || [])) {
        if (typeof name === 'string' && name.toLowerCase().startsWith('data-ee-')) {
          // Preserve persistent anchors for comments and authoring lock state
          const lower = name.toLowerCase();
          if (lower === 'data-ee-comment-id') continue;
          if (lower === 'data-ee-locked') continue;
          toRemove.push(name);
        }
      }
      toRemove.forEach((name) => el.removeAttribute(name));
      // Remove inline overrides we may have added for editing
      if (el.style) {
        el.style.removeProperty('user-select');
        el.style.removeProperty('-webkit-user-select');
      }
      // Normalize empty inline style attributes (e.g., style="")
      if (el.hasAttribute && el.hasAttribute('style')) {
        const css = (el.getAttribute('style') || '').trim().replace(/;+$/g, '');
        if (!css) el.removeAttribute('style');
      }
      // Remove all class attributes in sanitized output to avoid authoring/presentational noise
      // Limit this to before-save and comparison contexts
      if (el.hasAttribute && el.hasAttribute('class')) {
        // If helpers.beforeSave is explicitly false, keep classes; otherwise remove
        if (helpers.beforeSave !== false) el.removeAttribute('class');
      }
    }

    // Trim trivial text nodes around elements
    if (node.childNodes && node.childNodes.length) {
      // Create a stable list snapshot
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
          // Remove nodes that are ONLY ASCII collapsible whitespace (space, tab, CR, LF, FF).
          // Do NOT trim the edges of mixed text nodes to preserve author-intended spacing
          // between inline content and links.
          const t = child.textContent || '';
          if (/^[ \t\r\n\f]+$/.test(t)) {
            child.remove();
            continue;
          }
          // Remove stray trailing delimiter text nodes like '|' at the very end of a container
          // that sometimes appear after editing/link operations. Only remove when it is the
          // last child of its parent and contains nothing but optional whitespace around '|'.
          if (child === node.lastChild && /^\s*\|\s*$/.test(t)) {
            child.remove();
            continue;
          }
          // Otherwise leave text content as-is.
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    }
  };
  walk(root);
}

function applyElementSanitizers(root, helpers) {
  const visit = (el) => {
    const tag = el.tagName?.toLowerCase?.();
    const ctor = tag ? customElements.get(tag) : null;
    const sanitize = ctor?.ee?.sanitize;
    if (sanitize) sanitize(el, helpers);
    // Recurse into children
    Array.from(el.children || []).forEach((c) => visit(c));
  };
  visit(root);
}

export function sanitizeTree(root, helpers = {}) {
  // Phase 0: remove all comments (author-time directives can be re-added by *.author.js later)
  (function removeAllComments(node) {
    try {
      const children = Array.from(node.childNodes || []);
      for (const child of children) {
        if (!child) continue;
        if (child.nodeType === Node.COMMENT_NODE) {
          child.remove();
          continue;
        }
        if (child.childNodes && child.childNodes.length) removeAllComments(child);
      }
    } catch (_) {}
  })(root);

  // First strip authoring-only attributes and trim trivial text
  const normalizedHelpers = normalizeHelpers(helpers);
  stripAuthoringArtifacts(root, normalizedHelpers);
  // Then allow element-specific sanitizers to run
  applyElementSanitizers(root, normalizedHelpers);
  return root;
}

function normalizeHelpers(helpers) {
  const editor = document.querySelector('experience-elements-editor');
  const showToast = helpers.showToast || ((msg) => {
    if (editor && editor.showToast) editor.showToast(msg);
    else console.warn(msg);
  });
  return {
    currentDocumentId:
      helpers.currentDocumentId || editor?.getAttribute?.('data-ee-current-id') || null,
    showToast,
    beforeSave: !!helpers.beforeSave,
  };
}

export default sanitizeTree;

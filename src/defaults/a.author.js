

// Default authoring schema for vanilla <a> elements
// Returns a normalized schema object compatible with the toolbar expectations
export function getDefaultAnchorSchema(/* element */) {
  const attributes = {
    href: {
      type: "text",
      default: "#",
      label: "Link URL",
      description: "Destination URL for the link",
      placeholder: "https://example.com or #",
    },
    title: {
      type: "text",
      default: "",
      label: "Title",
      description: "Link title",
    },
    "aria-label": {
      type: "text",
      default: "",
      label: "ARIA Label",
      description: "Accessible label for assistive technologies",
    },
    target: {
      type: "enum",
      options: ["_self", "_blank", "_parent", "_top"],
      default: "_self",
      label: "Open In",
      description: "Where to open the linked document",
    },
    rel: {
      type: "text",
      default: "",
      label: "Rel",
      description: 'Relationship tokens (e.g., "noopener noreferrer")',
      placeholder: "noopener noreferrer",
    },
    download: {
      type: "boolean",
      default: false,
      label: "Download",
      description: "Indicate that the target should be downloaded",
    },
  };

  // Provide a minimal default slot config for inline text/editing
  const slotConfigDefault = {
    label: "Link Text",
    description: "Visible link text",
    allowedStyles: ["bold", "italic", "underline", "strikethrough"],
    textFormatting: "default",
    allowLinks: false,
    inlineEditable: true,
    multiline: false,
    maxLength: 120,
    minLength: 1,
    placeholder: "Link text",
  };

  return {
    attributes,
    slots: ["default"],
    elementLabel: "Link",
    elementDescription: "A hyperlink to another page or resource",
    supportsTextFormatting: true,
    getSlotConfig: (name) =>
      name === "default" ? slotConfigDefault : undefined,
    getSlotLabel: (name) => (name === "default" ? "Link Text" : name),
  };
}

// Serialize a vanilla <a> element to JSON in a schema-aware way
export function toJsonAnchor(el, serializeNode) {
  if (!el) return null;
  const tag = "a";
  const attributes = {};
  const names = ["href", "target", "rel", "title", "aria-label", "download"];
  for (const name of names) {
    if (!el.hasAttribute(name)) continue;
    if (name === "download") attributes[name] = true;
    else attributes[name] = el.getAttribute(name);
  }

  // Collect inline children; if none, fall back to text
  const items = [];
  const inlineNodes = el.querySelectorAll(
    ":scope > span:not([slot]), :scope > strong:not([slot]), :scope > em:not([slot])"
  );
  if (inlineNodes.length > 0) {
    for (const node of inlineNodes) {
      const nTag = node.tagName?.toLowerCase?.();
      const Ctor = nTag ? customElements.get(nTag) : null;
      if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(node, serializeNode));
      else if (serializeNode) items.push(serializeNode(node));
    }
  } else {
    const text = (el.textContent || "").trim();
    if (text) items.push({ text });
  }

  const result = { tag, attributes };
  if (items.length) result.slots = { default: items };
  return result;
}

// Register this default authoring for vanilla anchors so EditorStore can discover it at runtime
try {
  if (typeof window !== "undefined") {
    window.eeDefaults = window.eeDefaults || {};
    window.eeDefaults["a"] = {
      getSchema: getDefaultAnchorSchema,
      toJson: toJsonAnchor,
    };
  }
} catch (_) {}

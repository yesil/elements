import "../custom-elements/spectrum-size-palette.js";
// Default authoring schema for Spectrum sp-button elements
// Mirrors vanilla <a> support pattern: attributes + inline text slot
export function getDefaultSpButtonSchema(/* element */) {
  const attributes = {
    variant: {
      type: "enum",
      options: ["accent", "primary", "secondary", "negative"],
      default: "secondary",
      label: "Variant",
      description: "Visual style variant",
    },
    size: {
      type: "popover",
      default: "m",
      label: "Size",
      description: "Button size",
      render: ({ html, value }) => html`<spectrum-size-palette
        .size=${value}
        .sizes=${['s','m','l','xl']}
        attr="size"
      ></spectrum-size-palette>`,
    },
    treatment: {
      type: "enum",
      options: ["fill", "outline"],
      default: "fill",
      label: "Treatment",
      description: "Fill or outline treatment",
    },
    quiet: {
      type: "boolean",
      default: false,
      label: "Quiet",
      description: "Use quiet style",
    },
    disabled: {
      type: "boolean",
      default: false,
      label: "Disabled",
      description: "Disable the button",
    },
  };

  const slotConfigDefault = {
    label: "Button Label",
    description: "Visible button text",
    allowedTags: ["span"],
    allowedStyles: ["bold", "italic", "underline"],
    textFormatting: "default",
    allowLinks: false,
    inlineEditable: true,
    multiline: false,
    maxLength: 60,
    minLength: 1,
    placeholder: "Button",
  };

  return {
    attributes,
    slots: ["default"],
    elementLabel: "Button",
    elementDescription: "Spectrum button with label and style options",
    supportsTextFormatting: true,
    getSlotConfig: (name) => (name === "default" ? slotConfigDefault : undefined),
    getSlotLabel: (name) => (name === "default" ? "Button Label" : name),
  };
}

export function toJsonSpButton(el, serializeNode) {
  if (!el) return null;
  const tag = "sp-button";
  const attributes = {};
  const names = ["variant", "size", "treatment", "quiet", "disabled"];
  for (const name of names) {
    if (!el.hasAttribute(name)) continue;
    if (name === "quiet" || name === "disabled") attributes[name] = true;
    else attributes[name] = el.getAttribute(name);
  }

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

// Register this default authoring for sp-button so EditorStore can discover it at runtime
try {
  if (typeof window !== "undefined") {
    window.eeDefaults = window.eeDefaults || {};
    window.eeDefaults["sp-button"] = {
      getSchema: getDefaultSpButtonSchema,
      toJson: toJsonSpButton,
    };
  }
} catch (_) {}

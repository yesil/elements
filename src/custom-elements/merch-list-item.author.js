import { MerchListItem } from "./merch-list-item.js";
import {
  makeSWCIconNameSchema,
  makeSWCColorSchema,
} from "../utils/author-schemas.js";

MerchListItem.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: "List Item",
        description: "Feature or bullet list item with icon and text",
        category: "content",
        supportsTextFormatting: true,
      },
      attributes: {
        name: makeSWCIconNameSchema({
          defaultValue: "",
          description: "Inherit from list if empty",
        }),
        color: makeSWCColorSchema({
          defaultValue: "",
          description: "Inherit from list if empty",
        }),
      },
      slots: {
        order: ["default"],
        configs: {
          default: {
            label: "Item Text",
            description:
              "Inline editable list item content with formatting and links",
            allowedStyles: ["bold", "italic", "underline", "strikethrough"],
            allowLinks: true,
            textFormatting: "default",
            inlineEditable: true,
            multiline: false,
            maxLength: 200,
            minLength: 1,
            placeholder: "List item",
          },
        },
      },
    };
  },

  // Create a new instance with default values
  create() {
    const item = document.createElement("merch-list-item");
    item.textContent = "Unlimited creative assets";
    return item;
  },

  sanitize(el) {
    ["name", "color", "size", "rotate", "flip-h", "flip-v"].forEach((a) => {
      const v = el.getAttribute(a);
      if (v != null && !String(v).trim()) el.removeAttribute(a);
    });
  },

  // Serialize element to JSON, preserving inline links and simple inline markup in default slot
  toJson(el, _serializeNode) {
    const attributes = {};
    // Explicitly include common icon attributes even if not surfaced in schema controls
    const names = ["name", "color", "size", "rotate", "flip-h", "flip-v"];
    for (const name of names) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }

    const items = [];
    // Collect inline children in the default slot
    const inlineNodes = el.querySelectorAll(
      ":scope > a:not([slot]), :scope > span:not([slot]), :scope > strong:not([slot]), :scope > em:not([slot])"
    );
    if (inlineNodes.length > 0) {
      for (const node of inlineNodes) {
        const nTag = node.tagName?.toLowerCase?.();
        const Ctor = nTag ? customElements.get(nTag) : null;
        if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(node, _serializeNode));
        else if (_serializeNode) items.push(_serializeNode(node));
      }
    } else {
      const text = (el.textContent || "").trim();
      if (text) items.push({ text });
    }

    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (items.length) result.slots = { default: items };
    return result;
  },
};

export { MerchListItem };

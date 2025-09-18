import { MerchCallout } from "./merch-callout.js";
import {
  makeSWCIconNameSchema,
  makeSWCColorSchema,
} from "../utils/author-schemas.js";

MerchCallout.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: "Callout Message",
        description:
          "Highlighted callout message with icon for important information",
        category: "messaging",
        supportsTextFormatting: true,
      },
      attributes: {
        "name": makeSWCIconNameSchema({
          defaultValue: "",
          label: "Icon",
          description: "Spectrum icon (leave empty to use default info icon)",
        }),
        "color": makeSWCColorSchema({
          defaultValue: "",
          label: "Icon Color",
          description: "Icon color (Spectrum token)",
        }),
      },
      slots: {
        order: ["default"],
        configs: {
          default: {
            label: "Callout Text",
            description: "Short text label for the callout",
            allowedStyles: ["bold", "italic", "underline", "strikethrough"],
            allowLinks: false,
            textFormatting: "default",
            inlineEditable: true,
            multiline: false,
            maxLength: 1,
            minLength: 1,
            placeholder: "Callout",
          },
        },
      },
    };
  },

  // Create a new instance with default values
  create() {
    const callout = document.createElement("merch-callout");
    callout.textContent = "Limited time offer";
    callout.setAttribute("variant", "default");
    return callout;
  },

  sanitize(el) {
    try {
      // Trim callout text
      const text = (el.textContent || "").trim();
      el.textContent = text.slice(0, 120);
      // Clean icon name: if provided but not registered, drop it
      const iconName = (el.getAttribute("name") || "").trim();
      if (iconName && !customElements.get(iconName)) {
        el.removeAttribute("name");
      }
      // Normalize icon-size
      const size = (el.getAttribute("size") || "m").trim();
      const ok = ["xxs", "xs", "s", "m", "l", "xl", "xxl"];
      el.setAttribute("size", ok.includes(size) ? size : "m");
      // Clean icon-color
      const c = el.getAttribute("color");
      if (c != null && !String(c).trim()) el.removeAttribute("color");
      // Normalize icon-rotation
      const r = Number(el.getAttribute("rotate") || 0);
      const allowed = new Set([0, 90, 180, 270]);
      el.setAttribute("rotate", allowed.has(r) ? String(r) : "0");
      // Clean boolean flip attributes: ensure only presence/absence
      ['flip-h','flip-v'].forEach((attr) => {
        if (el.hasAttribute(attr)) {
          el.setAttribute(attr, "");
        }
      });
    } catch (_) {}
  },

  // Serialize element to JSON, aware of default text content only
  toJson(el, _serializeNode) {
    const attributes = {};
    const names = ['name','color','size','rotate','flip-h','flip-v'];
    for (const name of names) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }

    // Only include default slot text (ignore any named icon slot content)
    const text = (el.textContent || '').trim();

    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (text) result.slots = { default: [{ text }] };
    return result;
  },
};

export { MerchCallout };

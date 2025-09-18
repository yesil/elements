import { MerchMnemonic } from "./merch-mnemonic.js";
// size control is handled inside the product palette
import "./spectrum-product-palette.js";


// List of Adobe products for the name attribute
const ADOBE_PRODUCTS = [
  "creative-cloud",
  "acrobat-pro",
  "photoshop",
  "premiere-pro",
  "illustrator",
  "stock",
  "express",
  "firefly",
  "after-effects",
  "lightroom",
  "indesign",
  "animate",
  "dreamweaver",
  "substance-3d-stager",
  "substance-3d-painter",
  "substance-3d-sampler",
  "substance-3d-designer",
  "substance-3d-modeler",
  "audition",
  "incopy",
  "aero",
  "photoshop-express",
  "digital-editions",
  "adobe-connect",
  "design-to-print",
  "coldfusion",
  "presenter-video-express",
  "framemaker-server",
  "http-dynamic-streaming",
  "captivate",
  "media-server",
  "fonts",
  "color",
  "photoshop-elements",
  "premiere-elements",
  "technical-communication-suite",
  "postscript",
  "behance",
  "robohelp",
  "fresco",
  "lightroom-classic",
  "experience-platform",
  "experience-cloud",
  "coldfusion-builder",
  "pdf-print-engine",
  "capture",
  "bridge",
  "frame-io",
  "character-animator",
  "media-encoder",
  "acrobat-scan",
  "framemaker",
  "acrobat-sign",
  "indesign-server",
  "portfolio",
  "acrobat-classic",
  "default-app-icon",
];

// Unified schema-based authoring API
MerchMnemonic.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: "Product Icon",
        description: "Adobe product icon mnemonic with optional link",
        category: "branding",
        supportsTextFormatting: false,
      },
      attributes: {
        name: {
          // Popover palette showing real product icons
          type: "popover",
          default: "creative-cloud",
          label: "Product Name",
          description: "Adobe product to display",
          render: ({ html, value, onChange, read, updateAttribute }) => {
            const sz = (read && read("size")) || "m";
            return html`<spectrum-product-palette
              .name=${value}
              .size=${sz}
              .products=${ADOBE_PRODUCTS}
              @change=${(e) => onChange(e.detail?.name ?? e.detail?.value)}
              @size-change=${(e) => updateAttribute && updateAttribute('size', e.detail?.size)}
            ></spectrum-product-palette>`;
          },
        },
        "icon-only": {
          type: "boolean",
          default: false,
          label: "Disable link",
          description: "Display icon without wrapping link element",
        },
        href: {
          type: "text",
          default: "",
          label: "Custom Link URL",
          description: "Override the default product link (optional)",
          placeholder: "Override link",
          // Hide when icon-only is enabled. Receives the live element.
          evaluate: ({ element }) => {
            const el = element;
            const iconOnly = !!el && el.hasAttribute && el.hasAttribute('icon-only');
            return { render: !iconOnly };
          },
        },
      },
      slots: { order: [], configs: {} },
    };
  },

  // Optional icon for tree/listing
  getElementIcon(html) {
    return html`<sp-icon-app
      size="l"
      name="Product Icon"
      style="color: var(--spectrum-global-color-red-900)"
    ></sp-icon-app>`;
  },

  // Create a new instance with default values
  create() {
    const mnemonic = document.createElement("merch-mnemonic");
    mnemonic.setAttribute("name", "photoshop");
    mnemonic.setAttribute("size", "m");
    return mnemonic;
  },

  sanitize(el) {
    try {
      const allowed = new Set(ADOBE_PRODUCTS);
      const sizeOk = new Set(["xxs", "xs", "s", "m", "l", "xl", "xxl"]);
      const name = (
        el.getAttribute("name") ||
        el.getAttribute("product") ||
        ""
      ).trim();
      el.setAttribute("name", allowed.has(name) ? name : "creative-cloud");
      const size = (el.getAttribute("size") || "l").trim().toLowerCase();
      el.setAttribute("size", sizeOk.has(size) ? size : "l");
      const href = el.getAttribute("href");
      if (href != null && !String(href).trim()) el.removeAttribute("href");
    } catch (_) {}
  },

  // Serialize element to JSON (no slots; attributes only)
  toJson(el, _serializeNode) {
    const attributes = {};
    const names = ["name", "size", "href", "icon-only"];
    for (const name of names) {
      if (!el.hasAttribute(name)) continue;
      if (name === "icon-only") attributes[name] = true;
      else attributes[name] = el.getAttribute(name);
    }
    return { tag: el.tagName.toLowerCase(), attributes };
  },
};

export { MerchMnemonic };

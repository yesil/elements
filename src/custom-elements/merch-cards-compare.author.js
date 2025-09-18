import { MerchCardsCompare } from "./merch-cards-compare.js";

// Patch MerchCardsCompare with authoring capabilities
MerchCardsCompare.ee = {
  getSchema() {
    return {
      schemaVersion: 1,
      element: {
        label: "Compare Cards",
        description:
          "Container for multiple comparison cards with automatic layout and height synchronization",
        category: "layout",
        supportsTextFormatting: false,
      },
      attributes: {
        resizing: {
          type: "enum",
          options: ["hug", "fill"],
          default: "hug",
          label: "Resizing Mode",
          description:
            "How cards adapt to content: hug (natural height) or fill (synchronized heights)",
        },
      },
      slots: {
        order: ["default"],
        configs: {
          default: {
            label: "Comparison Cards",
            description:
              "Container for merch-card-compare elements (2-4 recommended)",
            allowedTags: ["merch-card-compare"],
            allowedStyles: [],
            allowedFormats: [],
            allowLinks: false,
            maxLength: null,
            minLength: 2,
            placeholder: "Add comparison cards",
          },
        },
      },
    };
  },

  // Create a new instance with default values
  create() {
    const container = document.createElement("merch-cards-compare");

    // Add three comparison cards as default
    const merchCardCompareElement = customElements.get("merch-card-compare");
    for (let i = 0; i < 3; i++) {
      const card = merchCardCompareElement.create();
      container.appendChild(card);
    }

    return container;
  },

  sanitize(el) {
    try {
      // Remove container-level authoring attributes
      el.removeAttribute("id");
      el.removeAttribute("style");

      // Preserve IDs that are used by accessibility relations
      const preserveIds = new Set();
      try {
        // Keep ids of heading-xs nodes inside each compare card
        el.querySelectorAll(
          'merch-card-compare [slot="heading-xs"][id]'
        ).forEach((n) => {
          const v = n.getAttribute("id");
          if (v) preserveIds.add(v);
        });
        // Keep ids referenced by aria-labelledby on compare cards
        el.querySelectorAll("merch-card-compare[aria-labelledby]").forEach(
          (card) => {
            const ref = card.getAttribute("aria-labelledby") || "";
            ref
              .split(/\s+/)
              .filter(Boolean)
              .forEach((id) => preserveIds.add(id));
          }
        );
        // Keep ids referenced by aria-describedby, just in case
        el.querySelectorAll("[aria-describedby]").forEach((host) => {
          const ref = host.getAttribute("aria-describedby") || "";
          ref
            .split(/\s+/)
            .filter(Boolean)
            .forEach((id) => preserveIds.add(id));
        });
      } catch (_) {}

      // Remove all other id attributes in subtree
      Array.from(el.querySelectorAll("[id]")).forEach((node) => {
        const id = node.getAttribute("id");
        if (!preserveIds.has(id)) node.removeAttribute("id");
      });

      // Remove non-card elements from default slot, but NEVER strip ee-reference
      Array.from(el.children).forEach((child) => {
        const tag = child.tagName?.toLowerCase?.() || "";
        if (tag === "ee-reference") return; // preserve references
        if (tag !== "merch-card-compare") {
          child.remove();
        }
      });
    } catch (_) {}
  },

  // Serialize element to JSON, aware it only contains merch-card-compare children
  toJson(el, serializeNode) {
    const attributes = {};
    const schemaAttrs = Object.keys(this.getSchema()?.attributes || {});
    for (const name of schemaAttrs) {
      if (el.hasAttribute(name)) attributes[name] = el.getAttribute(name);
    }

    const items = [];
    const cards = el.querySelectorAll("merch-card-compare:not([slot])");
    for (const child of cards) {
      const Ctor = customElements.get("merch-card-compare");
      if (Ctor?.ee?.toJson) items.push(Ctor.ee.toJson(child, serializeNode));
      else if (serializeNode) items.push(serializeNode(child));
    }

    const result = { tag: el.tagName.toLowerCase(), attributes };
    if (items.length) result.slots = { default: items };
    return result;
  },
};

export { MerchCardsCompare };

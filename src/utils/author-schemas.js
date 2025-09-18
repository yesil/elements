import "../custom-elements/spectrum-color-palette.js";
import "../custom-elements/spectrum-icon-palette.js";
import "../custom-elements/spectrum-size-palette.js";

export function makeSWCIconNameSchema(options = {}, visibleCount = 4) {
  const {
    defaultValue = "sp-icon-add",
    label = "Icon Name",
    description = "Spectrum icon tag name",
    rotationAttr = "rotate",
    flipHAttr = "flip-h",
    flipVAttr = "flip-v",
  } = options;
  return {
    type: "popover",
    default: defaultValue,
    label,
    description,
    render: ({ html, value, onChange, updateAttribute, read }) => {
      const rotation = read ? read(rotationAttr) || 0 : 0;
      const size = read ? read("size") || "m" : "m";
      const color = read ? read("color") || "" : "";
      const rawFlipH = read ? read(flipHAttr) : null;
      const rawFlipV = read ? read(flipVAttr) : null;
      const flipH = !!(rawFlipH !== null && rawFlipH !== undefined && String(rawFlipH).toLowerCase() !== 'false');
      const flipV = !!(rawFlipV !== null && rawFlipV !== undefined && String(rawFlipV).toLowerCase() !== 'false');
      // Palette updates attributes directly via editorStore; no event wiring
      return html`<spectrum-icon-palette
        .name=${value}
        .size=${size}
        .color=${color}
        .rotate=${Number(rotation) || 0}
        .flipH=${flipH}
        .flipV=${flipV}
        name-attr="name"
        size-attr="size"
        rotate-attr=${rotationAttr}
        flip-h-attr=${flipHAttr}
        flip-v-attr=${flipVAttr}
      ></spectrum-icon-palette>`;
    },
  };
}

export function makeSWCIconSizeSchema(options = {}) {
  const {
    defaultValue = "m",
    label = "Icon Size",
    description = "Spectrum icon size",
  } = options;
  return {
    type: "popover",
    default: defaultValue,
    label,
    description,
    render: ({ html, value }) => {
      // Palette updates attributes directly via editorStore; no event wiring
      return html`<spectrum-size-palette .size=${value} attr="size"></spectrum-size-palette>`;
    },
  };
}

export function makeSWCColorSchema(options = {}, visibleCount = 4) {
  const {
    defaultValue = "",
    label = "Icon Color",
    description = "Adobe Spectrum color (CSS var)",
  } = options;

  return {
    type: "popover",
    default: defaultValue,
    label,
    description,
    render: ({ html, value }) => {
      // Palette updates attributes directly via editorStore; no event wiring
      return html`<spectrum-color-palette .color=${value} attr="color"></spectrum-color-palette>`;
    },
  };
}

import { css } from "lit";

export const experienceElementsHomeNewStyles = css`
  :host {
    display: block;
    height: 100vh;
    overflow: hidden;
    background: var(--spectrum-alias-background-color-default);
    color: var(--spectrum-alias-text-color);
    position: relative;
    box-sizing: border-box;
    /* Header height token for layout math */
    /*
     * App-specific surface tokens for tiles. These derive from Spectrum
     * aliases so that light/dark themes both look correct while ensuring
     * a visible surface in light mode.
     */
    /* Lighter neutral surface for tiles */
    --ee-tile-bg: var(--spectrum-global-color-gray-200);
    --ee-tile-border: var(--spectrum-alias-border-color-quiet);
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* Main Layout Container */
  .home-container {
    display: flex;
    height: 100vh;
    position: relative;
  }

  /* Main Content Area */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Scrollable area containing hero + content */
  .content-scroll {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .section-loading {
    display: grid;
    place-items: center;
    min-height: 100vh;
  }

  /* Recent section loading centered within its own container */
  .recent-section-loading {
    display: grid;
    place-items: center;
    min-height: 280px;
  }

  /* No overlay/z-index needed; spinner centers in layout via .section-loading */

  /* Back references list inside delete dialog */
  .backrefs-title {
    margin-top: var(--spectrum-global-dimension-size-200);
    margin-bottom: var(--spectrum-global-dimension-size-75);
    font-size: 12px;
    color: var(--spectrum-alias-label-text-color, var(--spectrum-global-color-gray-800));
  }
  .backrefs-loading {
    margin-top: var(--spectrum-global-dimension-size-200);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .backrefs-list {
    height: 200px;
    overflow: auto;
    border: 1px solid var(--spectrum-alias-border-color);
    border-radius: var(--spectrum-alias-border-radius-regular, 6px);
    background: var(--spectrum-alias-background-color-secondary);
    padding: var(--spectrum-global-dimension-size-75);
  }
  /* sp-sidenav will render items; container paddings adjusted above */

  /* Divider between folders and documents */
  .folders-docs-divider {
    margin: var(--spectrum-global-dimension-size-300) 0;
  }

  /* Hero Section with Gradient */
  .hero-section {
    border-radius: var(--spectrum-global-dimension-size-200);
    /*
     * Full-bleed, color-rich gradient derived from the design image.
     * Uses Spectrum tokens with hex fallbacks to ensure theming works
     * while avoiding a half-white/empty side at large widths.
     */
    --hero-peach-0: var(--spectrum-global-color-static-orange-50, #fff4ef);
    --hero-peach-1: var(--spectrum-global-color-static-orange-100, #ffe8dc);
    --hero-orange-0: var(--spectrum-global-color-static-orange-400, #ff9a3d);
    --hero-orange-1: var(--spectrum-global-color-static-orange-500, #ff7b00);
    --hero-red-0: var(--spectrum-global-color-static-red-500, #ef4a2a);
    --hero-purple-0: var(--spectrum-global-color-static-purple-500, #8b84ff);

    /* Layered gradients: warm radial core, purple top-right glow, red/orange lower-right,
       on top of a soft peach base so the left side is never white. */
    background:
      /* Left-side warm wash to avoid any white gap */
      linear-gradient(90deg,
        color-mix(in srgb, var(--hero-orange-0) 28%, transparent) 0%,
        transparent 45%),
      /* Additional left glow to deepen color on wide screens */
      radial-gradient(80% 120% at -10% 50%,
        color-mix(in srgb, var(--hero-orange-0) 55%, transparent) 0%,
        transparent 70%),
      radial-gradient(65% 85% at 75% 55%,
        color-mix(in srgb, var(--hero-orange-0) 85%, transparent) 0%,
        color-mix(in srgb, var(--hero-orange-1) 70%, transparent) 35%,
        transparent 72%),
      radial-gradient(55% 70% at 100% 0%,
        color-mix(in srgb, var(--hero-purple-0) 80%, transparent) 0%,
        color-mix(in srgb, var(--hero-purple-0) 45%, transparent) 35%,
        transparent 70%),
      radial-gradient(60% 70% at 85% 110%,
        color-mix(in srgb, var(--hero-red-0) 85%, transparent) 0%,
        color-mix(in srgb, var(--hero-orange-1) 65%, transparent) 35%,
        transparent 65%),
      linear-gradient(90deg, var(--hero-peach-0) 0%, var(--hero-peach-1) 100%);

    background-repeat: no-repeat;
    background-size: 100% 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 500px;
    position: relative;
    overflow: hidden;
  }

  .hero-content {
    max-width: 600px;
    text-align: center;
    color: #000;
  }

  .hero-headline {
    font-size: 36px;
    font-weight: 800;
    margin: 0 0 var(--spectrum-global-dimension-size-200) 0;
    font-family: "Adobe Clean", sans-serif;
    line-height: 42px;
  }

  .hero-description {
    font-size: 22px;
    line-height: 1.5;
    margin: 0 0 var(--spectrum-global-dimension-size-400) 0;
    font-family: "Adobe Clean", sans-serif;
  }

  /* Quick Action Card */
  .quick-action-card {
    background: var(--spectrum-alias-background-color-secondary);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0px 2px 8px 0px rgba(0, 0, 0, 0.16);
    margin-bottom: var(--spectrum-global-dimension-size-400);
  }

  .quick-action-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--spectrum-alias-text-color);
    margin-bottom: var(--spectrum-global-dimension-size-200);
    font-family: "Adobe Clean", sans-serif;
  }

  .quick-actions {
    display: flex;
    gap: var(--spectrum-global-dimension-size-200);
  }

  .quick-action-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-100);
  }

  .quick-action-button {
    height: 100px;
    background: var(--spectrum-alias-background-color-secondary);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease;
    border: none;
  }

  .quick-action-button:hover {
    background: var(--spectrum-alias-background-color-hover);
  }

  .quick-action-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--spectrum-alias-text-color);
    text-align: center;
    font-family: "Adobe Clean", sans-serif;
  }

  /* Element Type Icons */
  .element-types {
    display: flex;
    gap: var(--spectrum-global-dimension-size-300);
    justify-content: center;
  }

  .element-type-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-50);
    cursor: pointer;
  }

  .element-type-icon {
    width: 64px;
    height: 64px;
    background: var(--spectrum-alias-background-color-secondary);
    border-radius: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease;
  }

  .element-type-icon:hover {
    transform: scale(1.05);
  }

  .element-type-label {
    font-size: 12px;
    font-weight: 700;
    color: #000;
    text-align: center;
    font-family: "Adobe Clean", sans-serif;
  }

  /* Content Section */
  .content-section {
    flex: 0 0 auto;
    padding: var(--spectrum-global-dimension-size-400);
    background: var(--spectrum-alias-background-color-default, #f8f8f8);
  }

  /* Recent Section */
  .recent-section {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spectrum-global-dimension-size-300);
  }

  .section-title {
    font-size: 20px;
    font-weight: 800;
    font-family: "Adobe Clean", sans-serif;
  }

  .view-all-link {
    font-size: 14px;
    color: var(--spectrum-alias-text-color);
    text-decoration: none;
    font-family: "Adobe Clean", sans-serif;
    cursor: pointer;
  }

  .view-all-link:hover {
    text-decoration: underline;
  }

  .element-card {
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-100);
    cursor: pointer;
    overflow: hidden;
  }

  .element-thumbnail {
    background: var(--ee-tile-bg);
    border-radius: 16px;
    padding: 8px;
    aspect-ratio: 1.5;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--ee-tile-border);
  }

  /* Do not allow inner preview/icon content to capture clicks */
  .element-thumbnail > * {
    pointer-events: none;
  }

  .element-preview {
    background: var(--ee-tile-bg);
    border-radius: 8px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--ee-tile-border);
  }

  .element-preview-placeholder {
    color: var(--spectrum-alias-placeholder-text-color);
    font-size: 12px;
    font-family: "Adobe Clean", sans-serif;
  }

  .element-info {
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-50);
  }

  .element-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--spectrum-alias-text-color);
    font-family: "Adobe Clean", sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .element-time {
    font-size: 12px;
    color: var(--spectrum-alias-secondary-text-color);
    font-family: "Adobe Clean", sans-serif;
    opacity: 1;
  }

  /* Loading State */
  .loading-spinner {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  /* Creation Dialog - cleaner design */
  #dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--spectrum-global-dimension-size-300) var(--spectrum-global-dimension-size-200);
    margin-bottom: var(--spectrum-global-dimension-size-200);
  }

  #dialog-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    color: var(--spectrum-alias-text-color);
  }

  #dialog-search {
    width: 300px;
  }

  #dialog-content-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 800px;
    overflow: hidden;
  }

  #dialog-content-wrapper sp-accordion {
    flex: 1;
    overflow-y: auto;
    width: 100%;
    border: none;
  }

  #dialog-content-wrapper sp-accordion-item {
    width: 100%;
    border: none;
    border-top: 1px solid var(--spectrum-alias-border-color-quiet);
  }

  #dialog-content-wrapper sp-accordion-item:first-child {
    border-top: none;
  }

  #dialog-content-wrapper sp-accordion-item[open] {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--spectrum-alias-background-color-transparent);
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 320px);
    gap: var(--spectrum-global-dimension-size-1000);
    overflow-y: auto;
    width: 100%;
    background: transparent;
    justify-items: start;
    /* Provide breathing room so hover outlines aren't clipped */
    padding: var(--spectrum-global-dimension-size-300);
    box-sizing: border-box;
  }

  /* Create dialog min width/height */
  #create-dialog {
    --mod-dialog-min-width: 1200px;
  }
  .create-dialog-body {
    min-width: 1200px;
    min-height: 800px;
  }

  .elements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 248px);
    gap: var(--spectrum-global-dimension-size-500);
    padding: var(--spectrum-global-dimension-size-300);
    width: 100%;
    justify-items: stretch;
  }

  .elements-grid .element-thumbnail {
    height: 150px;
    overflow: hidden;
  }

  .template-preview-card {
    cursor: pointer;
    transition: transform 0.2s ease;
    width: 320px;
    overflow: hidden;
  }

  .template-preview-card:hover,
  .template-preview-card:focus-visible {
    transform: none;
    outline: 2px solid var(--spectrum-global-color-blue-500);
    outline-offset: 10px;
    border-radius: var(--spectrum-global-dimension-size-50);
  }
  /* Unify layers on hover/focus */
  .template-preview-card:hover .template-preview-container,
  .template-preview-card:focus-visible .template-preview-container {
    background: transparent;
    border-color: transparent;
  }

  .template-preview-container {
    border-radius: var(--spectrum-global-dimension-size-100);
    width: 320px;
    height: 320px;
    overflow: hidden;
    margin-bottom: var(--spectrum-global-dimension-size-100);
    border: 1px solid var(--ee-tile-border);
  }

  .template-title {
    font-size: 14px;
    text-align: center;
    color: var(--spectrum-alias-text-color);
  }

  .element-card {
    padding: var(--spectrum-global-dimension-size-200);
    background: var(--ee-tile-bg);
    border-radius: var(--spectrum-global-dimension-size-100);
    cursor: pointer;
    transition: background 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: var(--spectrum-global-dimension-size-100);
    text-align: left;
    border: 1px solid var(--ee-tile-border);
  }

  .element-card:hover,
  .element-card:focus-visible {
    outline: 2px solid var(--spectrum-global-color-blue-500);
    outline-offset: 2px;
  }
  /* On hover/focus, unify tile visuals by removing inner surfaces */
  .element-card:hover .element-thumbnail,
  .element-card:focus-visible .element-thumbnail,
  .element-card:hover .element-preview,
  .element-card:focus-visible .element-preview {
    background: transparent;
    border-color: transparent;
  }

  .element-card.drag-over {
    outline: 2px solid var(--spectrum-global-color-purple-500);
    outline-offset: 2px;
  }

  /* Differentiate folders: centered content, outline, light background, yellow icon */
  .element-card.folder {
    outline: 1px solid var(--spectrum-alias-border-color-quiet);
    outline-offset: 0;
    /* Match document cards layout for name placement */
    align-items: flex-start;
    justify-content: flex-start;
  }

  /* Selection highlight */
  .element-card[data-selected="true"] {
    box-shadow: 0 0 0 2px var(--spectrum-global-color-blue-500);
  }

  .files-toolbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--spectrum-global-dimension-size-100);
    margin-bottom: var(--spectrum-global-dimension-size-200);
  }

  /* New Folder dialog content */
  #new-folder-content {
    display: flex;
    flex-direction: column;
    gap: var(--spectrum-global-dimension-size-200);
    padding: var(--spectrum-global-dimension-size-200);
  }

  sp-action-bar {
    position: fixed;
    bottom: 20px;
    right: 50%;
    transform: translateX(50%);
  }
`;

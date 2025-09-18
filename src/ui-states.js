/**
 * UI State Names for Web Component Editor
 * Simple constants for referencing different UI states
 */

export const UIStates = {
  // Main Views
  GALLERY_VIEW: 'gallery-view',           // Browsing saved elements
  EDITOR_VIEW: 'editor-view',             // Active editing mode
  
  // Canvas States  
  CANVAS_EMPTY: 'canvas-empty',           // No elements on canvas
  CANVAS_POPULATED: 'canvas-populated',   // Has elements on canvas
  
  // Selection States
  ELEMENT_SELECTED: 'element-selected',   // An element is selected
  NO_SELECTION: 'no-selection',           // Nothing selected
  
  // Panel States
  SIDEBAR_VISIBLE: 'sidebar-visible',     // Sidebar panel shown
  SIDEBAR_HIDDEN: 'sidebar-hidden',       // Sidebar panel hidden
  
  // Dialog States
  CREATION_DIALOG_OPEN: 'creation-dialog-open', // New element dialog open
  CREATION_DIALOG_CLOSED: 'creation-dialog-closed',
  
  // Empty States
  NO_ELEMENTS: 'no-elements',             // No saved elements
  NO_SLOTS_AVAILABLE: 'no-slots-available', // No slots to add to
  NO_SEARCH_RESULTS: 'no-search-results'  // Search returned nothing
};

/**
 * UI Modes
 */
export const UIModes = {
  BROWSE: 'browse',   // Browsing elements
  EDIT: 'edit',       // Editing an element
  PREVIEW: 'preview'  // Preview mode
};

export default {
  UIStates,
  UIModes
};
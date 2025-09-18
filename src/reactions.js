import { reaction } from "picosm";

// Central registration for all reactions in the app.
// Initialize once from the App and pass all stores.
// Dependencies that appear later (like the editor element) are fetched lazily inside reactions.
export function registerReactions({ appStore, editorStore, commentStore }) {
  const disposers = [];
  const add = (d) => disposers.push(d);
  const editor = () => document.querySelector("experience-elements-editor");

  // Use case: Deep-linking to an element (?id=...) or content arrival mounts the canvas.
  // When the active document id or its HTML changes, ask the editor to mount/update the content.
  add(
    reaction(
      editorStore,
      (s) => [s.currentElementId],
      () => {
        const ed = editor();
        ed.loadEditorContent();
        // Refresh "Used In" list on each editor open
        try {
          const urn = editorStore.currentElementId;
          if (urn) appStore?.usedInStore?.refreshFor?.(urn);
        } catch (_) {}
        // Initialize Versions list on editor load for counts and panel
        try {
          appStore?.versionStore?.refreshVersions?.();
        } catch (_) {}
      }
    )
  );
  add(
    reaction(
      appStore,
      (s) => [s.currentElement && s.currentElement.html],
      () => {
        // Mount or swap content whenever the current element HTML changes
        const ed = editor();
        ed.loadEditorContent();
      }
    )
  );

  // Use case (R2): Selecting an element/slot in the tree or via comments keeps UI in sync and centers the target.
  // This reaction uses the last USER action (editorStore.lastAction.user === true) to decide when to center.
  // It only recenters for explicit user-originated interactions from tree-nav ('tree:*') or comments ('comment:*').
  add(
    reaction(
      editorStore,
      (s) => [s.editingElement, s.currentSlot],
      () => {
        const ed = editor();
        ed.scrollSideNavToSelection();
        ed.updateCommentsOverlay();
        // Ensure toolbar visibility follows selection state consistently
        try {
          const el = editorStore.editingElement;
          if (el) editorStore.showEEToolbar(el);
          else editorStore.hideEEToolbar();
        } catch (_) {}
        // Use the last user action so programmatic state updates (e.g., editor:select)
        // don’t mask the original user intent.
        const last = editorStore.lastUserAction || {};
        const t = String(last.type || "");
        const isUser = !!last.user;
        if (!isUser) return;
        if (!t.startsWith("tree:") && !t.startsWith("comment:")) return;
        const el = editorStore.editingElement;
        const slotName = editorStore.currentSlot || null;
        let anchor = el;
        if (slotName && el && el.shadowRoot) {
          const selector =
            slotName === "default"
              ? "slot:not([name])"
              : `slot[name="${slotName}"]`;
          const slotEl = el.shadowRoot.querySelector(selector);
          if (slotEl) anchor = slotEl;
        }
        // Only center if the target is actually outside the canvas viewport (use the same viewport as zoom: #surface-wrapper)
        try {
          const viewport = ed?.shadowRoot?.querySelector?.("#surface-wrapper");
          const vr = viewport?.getBoundingClientRect?.();
          const ar = anchor?.getBoundingClientRect?.();
          const outOfViewport = !!(
            vr &&
            ar &&
            (ar.right < vr.left ||
              ar.left > vr.right ||
              ar.bottom < vr.top ||
              ar.top > vr.bottom)
          );
          if (outOfViewport) {
            ed.centerOnElement(anchor);
            try { editorStore.setLastAction(t.startsWith("tree:") ? "tree:center-on-exec" : "comment:center-on-exec", {}); } catch (_) {}
          } else {
            try {
              editorStore.setLastAction(
                t.startsWith("tree:") ? "tree:center-on-skip" : "comment:center-on-skip",
                {
                  reason: "visible",
                  viewport: vr ? { x: Math.round(vr.left), y: Math.round(vr.top), w: Math.round(vr.width), h: Math.round(vr.height) } : null,
                  anchor: ar ? { x: Math.round(ar.left), y: Math.round(ar.top), w: Math.round(ar.width), h: Math.round(ar.height) } : null,
                }
              );
            } catch (_) {}
          }
        } catch (_) {
          // If we cannot measure, avoid forcing a center to prevent unexpected jumps
        }
      }
    )
  );

  // Use case: Hovering comments in the panel draws a dashed connector to the element on canvas.
  // Also toggles a subtle highlight on the target element for clarity.
  let lastHoveredEl = null;
  const updateComments = () => {
    const ed = editor();
    ed.syncCommentsPanelView();
    ed.updateCommentsOverlay();
    const id = commentStore.hoveredCommentId;
    const el = ed.getElementForComment(id);
    if (lastHoveredEl && lastHoveredEl !== el) {
      lastHoveredEl.removeAttribute("data-ee-comment-hovered");
      lastHoveredEl = null;
    }
    if (el) {
      el.setAttribute("data-ee-comment-hovered", "");
      lastHoveredEl = el;
    }
  };
  add(
    reaction(
      commentStore,
      (cs) => [cs.hoveredCommentId, cs.commentsPanelOpen],
      updateComments
    )
  );

  // Use case: Clicking a comment selects its element in the editor and recenters if needed.
  add(
    reaction(
      commentStore,
      (cs) => [cs.selectedCommentId],
      () => {
        const ed = editor();
        const id = commentStore.selectedCommentId;
        const el = ed.getElementForComment(id);
        ed.selectElement(el);
      }
    )
  );

  // Use case: Keep the connector overlay accurate when the viewport resizes or user scrolls the canvas.
  const onResize = () => updateComments();
  window.addEventListener("resize", onResize);
  let currentContainer = null;
  const bindScrollListener = () => {
    const ed = editor();
    const container = ed.shadowRoot.querySelector("#canvas-container");
    if (!container) return;
    if (currentContainer === container) return;
    if (currentContainer) currentContainer.removeEventListener("scroll", onScroll, { passive: true });
    currentContainer = container;
    currentContainer.addEventListener("scroll", onScroll, { passive: true });
  };
  const onScroll = () => updateComments();
  // Bind/rebind whenever selection or document changes (proxy for editor mount)
  add(
    reaction(
      editorStore,
      (s) => [s.currentElementId, s.editingElement],
      () => bindScrollListener()
    )
  );

  // Use case: When landing on Home (no active doc and not creating), load/refresh the gallery.
  let wasHome = false;
  add(
    reaction(
      appStore,
      (s) => [s.editorStore.currentElementId, s.showCreationDialog],
      () => {
        const isHome = !appStore.editorStore.currentElementId && !appStore.showCreationDialog;
        if (isHome && !wasHome) {
          wasHome = true;
          appStore.documentStore.loadAllElementsInto(appStore);
        } else if (!isHome) {
          wasHome = false;
        }
      }
    )
  );

  // Use case: After saves complete while on Home, refresh the elements list to reflect changes.
  let prevSaving = appStore.documentStore.isSaving;
  add(
    reaction(
      appStore.documentStore,
      (s) => [s.isSaving],
      () => {
        const isHome = !appStore.editorStore.currentElementId && !appStore.showCreationDialog;
        const now = appStore.documentStore.isSaving;
        if (prevSaving && !now && isHome) {
          appStore.documentStore.loadAllElementsInto(appStore);
        }
        prevSaving = now;
      }
    )
  );

  // Use case: Navigating folders in Home reloads the scoped list
  add(
    reaction(
      appStore,
      (s) => [s.currentFolderUrn],
      () => {
        const isHome = !appStore.editorStore.currentElementId && !appStore.showCreationDialog;
        if (isHome) appStore.documentStore.loadAllElementsInto(appStore);
      }
    )
  );

  // Use case: Changing gallery view should (re)load the correct set for Home
  add(
    reaction(
      appStore,
      (s) => [s.galleryView],
      () => {
        const isHome = !appStore.editorStore.currentElementId && !appStore.showCreationDialog;
        if (isHome) appStore.documentStore.loadAllElementsInto(appStore);
      }
    )
  );

  return () => {
    window.removeEventListener("resize", onResize);
    if (currentContainer) currentContainer.removeEventListener("scroll", onScroll, { passive: true });
    for (const d of disposers.splice(0)) d();
  };
}

import { makeObservable } from "picosm";

export class UsedInStore {
  static observableActions = [
    "openUsedInPanel",
    "closeUsedInPanel",
    "toggleUsedInPanel",
    "setIsLoading",
    "setItems",
    "refreshFor",
  ];

  constructor() {
    this.documentStore = null;
    this.editorStore = null;
    this.commentStore = null;
    this.versionStore = null;
  }

  // State
  panelOpen = false;
  isLoading = false;
  items = [];

  openUsedInPanel() {
    this.panelOpen = true;
    // Close other right panels to keep a single panel open
    try { this.commentStore?.closeCommentsPanel?.(); } catch (_) {}
    try { this.versionStore?.closeVersionsPanel?.(); } catch (_) {}
  }
  closeUsedInPanel() {
    this.panelOpen = false;
  }
  toggleUsedInPanel() {
    this.panelOpen = !this.panelOpen;
    if (this.panelOpen) {
      try { this.commentStore?.closeCommentsPanel?.(); } catch (_) {}
      try { this.versionStore?.closeVersionsPanel?.(); } catch (_) {}
      // Kick off a refresh for current element when opening
      const urn = this.editorStore?.currentElementId;
      if (urn) this.refreshFor(urn);
    }
  }

  setIsLoading(v) { this.isLoading = !!v; }

  setItems(list) {
    const norm = Array.isArray(list) ? list.map((d) => ({
      urn: String(d.urn || d.id || d.target || d.target_urn || d.source || d.source_urn || ""),
      name: d.name != null ? String(d.name) : "Untitled",
      isFolder: !!(d.is_folder || d.isFolder),
    })) : [];
    // Exclude folders from the menu
    this.items = norm.filter((x) => !!x.urn && !x.isFolder);
  }

  async refreshFor(urn) {
    if (!urn || !this.documentStore) return [];
    this.setIsLoading(true);
    try {
      // Ask backend for recursive referrers (both inline and non-inline)
      const list = await this.documentStore.getDocumentReferrers(urn, true, null);
      this.setItems(list);
      return list;
    } finally {
      this.setIsLoading(false);
    }
  }
}

makeObservable(UsedInStore);


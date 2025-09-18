import { makeObservable } from "picosm";

export class VersionStore {
  static observableActions = [
    "openVersionsPanel",
    "closeVersionsPanel",
    "toggleVersionsPanel",
    "setVersions",
    "setIsLoading",
    "createVersion",
    "renameVersion",
    "refreshVersions",
    "setSelectedVersionId",
  ];

  constructor() {
    this.editorStore = null;
    this.documentStore = null;
    this.commentStore = null; // to ensure only one panel is open at a time
  }

  // State
  versionsPanelOpen = false;
  isLoading = false;
  versions = [];
  selectedVersionId = null;

  openVersionsPanel() {
    this.versionsPanelOpen = true;
    // Close comments if open to keep a single right panel active
    try { this.commentStore?.closeCommentsPanel?.(); } catch (_) {}
  }
  closeVersionsPanel() {
    this.versionsPanelOpen = false;
  }
  toggleVersionsPanel() {
    this.versionsPanelOpen = !this.versionsPanelOpen;
    if (this.versionsPanelOpen) {
      try { this.commentStore?.closeCommentsPanel?.(); } catch (_) {}
    }
  }

  setIsLoading(value) {
    this.isLoading = !!value;
  }

  setVersions(list) {
    const arr = Array.isArray(list) ? list.map((v) => ({
      id: String(v.id || v.version_id || v.vid || v.name || ""),
      name: String(v.name || "Untitled"),
      created: v.created || v.created_at || v.timestamp || new Date().toISOString(),
      createdBy: v.created_by || v.author || null,
    })) : [];
    this.versions = arr;
  }

  setSelectedVersionId(id) {
    this.selectedVersionId = id || null;
  }

  async refreshVersions() {
    const urn = this.editorStore?.currentElementId;
    if (!urn) return [];
    this.setIsLoading(true);
    try {
      const list = await this.documentStore.getVersions(urn);
      this.setVersions(list);
      return list;
    } finally {
      this.setIsLoading(false);
    }
  }

  async createVersion(name) {
    const urn = this.editorStore?.currentElementId;
    if (!urn) return null;
    const ver = await this.documentStore.createVersion(urn, String(name || "Untitled"));
    // Refresh list to include newly created version at the top
    await this.refreshVersions();
    return ver;
  }

  async renameVersion(versionId, newName) {
    const urn = this.editorStore?.currentElementId;
    if (!urn || !versionId) return null;
    const res = await this.documentStore.renameVersion(urn, versionId, String(newName || "Untitled"));
    await this.refreshVersions();
    return res;
  }
}

makeObservable(VersionStore);

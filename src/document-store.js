import { makeObservable } from "picosm";
import DA_SDK from "https://da.live/nx/utils/sdk.js";

const DEFAULT_SOURCE_CONFIG = {
  baseUrl: "https://admin.da.live",
  org: "yesil",
  site: "elements",
  branch: "",
  documentsRoot: "",
  manifestPath: "documents/index.json",
  extension: ".html",
  previewBaseUrl: "",
  liveBaseUrl: "",
  cdnBaseUrl: "",
};

const EMPTY_MANIFEST = {
  version: 1,
  updated: null,
  items: [],
};

function isoNow() {
  return new Date().toISOString();
}

function toStringValue(value) {
  return value == null ? "" : String(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function trimSlashes(value) {
  return toStringValue(value).replace(/^\/+|\/+$/g, "");
}

function joinPath(...segments) {
  const parts = [];
  for (const segment of segments) {
    if (!segment) continue;
    const tokens = toStringValue(segment)
      .split("/")
      .map((token) => token.trim())
      .filter(Boolean);
    parts.push(...tokens);
  }
  return parts.join("/");
}

function sanitizeSegment(segment) {
  return segment
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-]+|[-]+$/g, "")
    || "item";
}

function slugPathFromUrn(urn) {
  const raw = toStringValue(urn).trim();
  if (!raw) return "item";
  const parts = raw.split("/").map((part) => sanitizeSegment(part)).filter(Boolean);
  return parts.join("/") || "item";
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function cloneManifest(manifest) {
  if (!manifest || typeof manifest !== "object") return { ...EMPTY_MANIFEST };
  const items = Array.isArray(manifest.items) ? manifest.items.map((item) => ({ ...item })) : [];
  return {
    version: manifest.version || 1,
    updated: manifest.updated || null,
    items,
  };
}

export class DocumentStore {
  static observableActions = [
    "setIsSaving",
    "setIsLoadingElements",
    "setIsInitializing",
    "setIsLoadingShares",
    "setSharesForUrn",
    "clearSharesForUrn",
  ];

  static token = null;
  static config = null;

  static configure(config = {}) {
    DocumentStore.config = config ? { ...config } : null;
  }

  #writes;
  #elementsLoad;

  constructor(configOrUrl = null) {
    this.providedApiUrl = typeof configOrUrl === "string" ? configOrUrl : null;
    this.providedConfig = configOrUrl && typeof configOrUrl === "object" ? configOrUrl : null;

    this.apiBaseUrl = null;
    this.sourceBaseUrl = null;
    this.previewBaseUrl = null;
    this.liveBaseUrl = null;
    this.cdnBaseUrl = null;
    this.websocketUrl = null;

    this.branch = "";
    this.documentsRoot = "";
    this.documentsRootPath = "";
    this.manifestPath = null;
    this.defaultExtension = ".json";

    this.configLoaded = false;
    this.accessToken = null;
    this.isInitializing = true;
    this.appStore = null;
    this.commentStore = null;

    this.isSaving = false;
    this.isLoadingElements = false;
    this.isLoadingShares = false;
    this.sharesByUrn = new Map();

    this.manifestCache = null;

    this.#writes = new Set();
    this.#elementsLoad = { promise: null, key: null };
  }

  get isBusy() {
    return this.#writes.size > 0;
  }

  async waitUntilIdle() {
    while (this.#writes.size) {
      const snapshot = Array.from(this.#writes);
      await Promise.allSettled(snapshot);
    }
  }

  #trackWrite(promise) {
    const tracked = Promise.resolve(promise).finally(() => {
      this.#writes.delete(tracked);
      if (this.#writes.size === 0) this.setIsSaving(false);
    });
    this.#writes.add(tracked);
    this.setIsSaving(true);
    return tracked;
  }

  async loadApiEndpoint() {
    if (this.configLoaded && this.apiBaseUrl) {
      return this.apiBaseUrl;
    }

    const resolved = await this.#resolveConfig();
    if (!isNonEmptyString(resolved.org) || !isNonEmptyString(resolved.site)) {
      throw new Error("DocumentStore Source configuration requires `org` and `site`");
    }

    const baseUrl = toStringValue(resolved.baseUrl || DEFAULT_SOURCE_CONFIG.baseUrl).replace(/\/+$/, "");
    const encodedOrg = encodeURIComponent(resolved.org);
    const encodedSite = encodeURIComponent(resolved.site);

    this.sourceBaseUrl = `${baseUrl}/source/${encodedOrg}/${encodedSite}`;

    this.branch = trimSlashes(resolved.branch || resolved.projectRoot || "");
    this.documentsRoot = trimSlashes(resolved.documentsRoot || DEFAULT_SOURCE_CONFIG.documentsRoot);
    this.documentsRootPath = this.branch
      ? joinPath(this.branch, this.documentsRoot)
      : this.documentsRoot;

    const manifestRelative = trimSlashes(
      resolved.manifestPath || joinPath(this.documentsRoot || "", "index.json"),
    );
    this.manifestPath = this.branch ? joinPath(this.branch, manifestRelative) : manifestRelative;

    const ext = resolved.extension || DEFAULT_SOURCE_CONFIG.extension;
    this.defaultExtension = ext.startsWith(".") ? ext : `.${ext}`;

    this.previewBaseUrl = toStringValue(resolved.previewBaseUrl || resolved.previewUrl || "");
    this.liveBaseUrl = toStringValue(resolved.liveBaseUrl || resolved.liveUrl || "");
    this.cdnBaseUrl = toStringValue(resolved.cdnBaseUrl || resolved.cdnUrl || this.liveBaseUrl);
    this.websocketUrl = toStringValue(resolved.websocketUrl || resolved.websocket || "");

    this.apiBaseUrl = this.sourceBaseUrl;
    this.configLoaded = true;
    return this.apiBaseUrl;
  }

  async init() {
    await this.loadApiEndpoint();
    this.setIsInitializing(false);
    return true;
  }

  setIsSaving(value) {
    this.isSaving = !!value;
  }

  setIsLoadingElements(value) {
    this.isLoadingElements = !!value;
  }

  setIsInitializing(value) {
    this.isInitializing = !!value;
  }

  setIsLoadingShares(value) {
    this.isLoadingShares = !!value;
  }

  setSharesForUrn(urn, list) {
    if (!urn) return;
    this.sharesByUrn.set(String(urn), Array.isArray(list) ? list : []);
  }

  clearSharesForUrn(urn) {
    if (!urn) return;
    this.sharesByUrn.delete(String(urn));
  }

  async getAccessToken() {
    const { context, token, actions } = await DA_SDK;
    console.log("getAccessToken", context, token, actions);
    if (DocumentStore.token) {
      this.accessToken = DocumentStore.token;
      return this.accessToken;
    }
    this.accessToken = null;
    return null;
  }

  async saveDocument(doc) {
    if (!doc || typeof doc !== "object") {
      throw new Error("saveDocument requires a document object");
    }
    await this.loadApiEndpoint();

    const manifest = await this.#loadManifest();
    const existing = doc.urn ? manifest.items.find((item) => item.urn === doc.urn) : null;
    const { storedDoc, summary } = await this.#normalizeIncomingDocument(doc, existing);

    const writePromise = (async () => {
      if (!storedDoc.isFolder) {
        const payload = storedDoc.html || "";
        await this.#uploadFile(summary.filePath, payload, "text/html");
      }
      this.#upsertManifestEntry(manifest, summary);
      await this.#persistManifest(manifest);
      return this.#mapStoredDocToResult(storedDoc);
    })();

    return this.#trackWrite(writePromise);
  }

  async getDocument(urn) {
    if (!isNonEmptyString(urn)) {
      throw new Error("getDocument requires a URN string");
    }
    await this.loadApiEndpoint();

    const manifest = await this.#loadManifest();
    const entry = manifest.items.find((item) => item.urn === urn && !item.deleted) || null;
    if (!entry) return null;
    if (entry.isFolder) {
      return {
        id: entry.urn,
        urn: entry.urn,
        name: entry.name || entry.urn,
        html: "",
        element: null,
        comments: [],
        isFolder: true,
        parentUrn: entry.parentUrn ?? null,
        json: {},
        lastModified: entry.lastModified || entry.updated || entry.created || null,
        created: entry.created || null,
      };
    }

    const resource = await this.#getSourceResource(entry.filePath);
    if (resource.status === 404) return null;

    let html = "";
    if (resource.metadata) {
      html = await this.#getHtmlViaMetadata(resource.metadata);
    } else if (typeof resource.content === "string") {
      html = resource.content;
    } else if (resource.content && typeof resource.content === "object" && typeof resource.content.html === "string") {
      html = resource.content.html;
    }
    if (typeof html !== "string") return null;

    const meta = resource.metadata;
    const lastModified = meta?.preview?.lastModified || meta?.live?.lastModified || entry.lastModified || entry.updated || entry.created || isoNow();
    const created = entry.created || lastModified;

    return this.#mapStoredDocToResult({
      urn: entry.urn,
      name: entry.name || entry.urn,
      html,
      isFolder: false,
      parentUrn: entry.parentUrn ?? null,
      filePath: entry.filePath,
      created,
      lastModified,
    });
  }

  async getAllDocuments() {
    return this.getDocuments(null);
  }

  async getRecentDocuments(limit = 8) {
    await this.loadApiEndpoint();
    const manifest = await this.#loadManifest();
    const documents = manifest.items
      .filter((item) => !item.deleted && !item.isFolder)
      .sort((a, b) => {
        const left = a.lastModified || a.updated || a.created || "";
        const right = b.lastModified || b.updated || b.created || "";
        return right.localeCompare(left);
      });
    const slice = limit != null ? documents.slice(0, Number(limit)) : documents;
    const resolved = await Promise.all(
      slice.map(async (item) => {
        try {
          return await this.getDocument(item.urn);
        } catch (_) {
          return null;
        }
      }),
    );
    return resolved.filter(Boolean);
  }

  async getDocuments(parentUrn = null) {
    await this.loadApiEndpoint();
    const manifest = await this.#loadManifest();
    const items = manifest.items.filter((item) => !item.deleted);
    const filtered = items.filter((item) => {
      if (parentUrn === undefined) return true;
      const value = item.parentUrn ?? null;
      if (parentUrn === null) return value === null;
      return value === parentUrn;
    });
    return filtered.map((item) => this.#manifestItemToDocument(item));
  }

  async loadAllElementsInto(appStore) {
    const view = appStore?.galleryView;
    const useFolderScope = view === "files";
    const isShared = view === "shared";
    const folder = useFolderScope ? appStore?.currentFolderUrn ?? null : undefined;
    const loadKey = isShared
      ? "shared"
      : useFolderScope
        ? `files:${folder ?? "root"}`
        : "recent";

    if (this.#elementsLoad.promise && this.#elementsLoad.key === loadKey) {
      return this.#elementsLoad.promise;
    }

    const loadPromise = (async () => {
      await this.waitUntilIdle();
      let docs = [];
      if (isShared) {
        docs = await this.getSharedDocuments(appStore?.currentFolderUrn ?? null, { order: "updated.desc,created.desc" });
      } else if (useFolderScope) {
        docs = await this.getDocuments(folder);
      } else {
        docs = await this.getRecentDocuments(8);
      }
      this.setIsLoadingElements(false);
      appStore?.setSavedElements?.(docs || []);
      appStore?.setIsReady?.(true);
      return docs;
    })().finally(() => {
      if (this.#elementsLoad.promise === loadPromise) {
        this.#elementsLoad = { promise: null, key: null };
        this.setIsLoadingElements(false);
      }
    });

    this.setIsLoadingElements(true);
    this.#elementsLoad = { promise: loadPromise, key: loadKey };
    return loadPromise;
  }

  async deleteDocument(urn) {
    if (!isNonEmptyString(urn)) {
      throw new Error("deleteDocument requires a URN string");
    }
    await this.loadApiEndpoint();
    const manifest = await this.#loadManifest();
    this.#removeManifestEntry(manifest, urn);
    await this.#persistManifest(manifest);
    return { urn };
  }

  async createFolder(name, parentUrn = null) {
    await this.loadApiEndpoint();
    const manifest = await this.#loadManifest();
    const now = isoNow();
    const suggestedUrn = isNonEmptyString(name) ? name : `folder-${manifest.items.length + 1}`;
    const urn = suggestedUrn.trim();
    const entry = {
      urn,
      name: String(name || urn),
      isFolder: true,
      parentUrn: parentUrn ?? null,
      lastModified: now,
      created: now,
      filePath: null,
      fileName: null,
      deleted: false,
    };
    this.#upsertManifestEntry(manifest, entry);
    await this.#persistManifest(manifest);
    return this.#manifestItemToDocument(entry);
  }

  async updateFolderName(urn, name) {
    if (!isNonEmptyString(urn)) return null;
    await this.loadApiEndpoint();
    const manifest = await this.#loadManifest();
    const entry = manifest.items.find((item) => item.urn === urn);
    if (!entry) return null;
    entry.name = String(name || urn);
    entry.lastModified = isoNow();
    await this.#persistManifest(manifest);
    return this.#manifestItemToDocument(entry);
  }

  async updateDocumentParent(urn, parentUrn) {
    if (!isNonEmptyString(urn)) return null;
    await this.loadApiEndpoint();
    const manifest = await this.#loadManifest();
    const entry = manifest.items.find((item) => item.urn === urn);
    if (!entry) return null;
    entry.parentUrn = parentUrn ?? null;
    entry.lastModified = isoNow();
    await this.#persistManifest(manifest);
    return this.#manifestItemToDocument(entry);
  }

  async moveDocuments(urns, targetParentUrn) {
    const list = Array.isArray(urns) ? urns : [];
    const ops = list.map((urn) => this.updateDocumentParent(urn, targetParentUrn));
    return Promise.all(ops);
  }

  async isAncestor(candidateUrn, nodeUrn) {
    if (!candidateUrn || !nodeUrn) return false;
    const manifest = await this.#loadManifest();
    const seen = new Set();
    let current = nodeUrn;
    while (current && !seen.has(current)) {
      seen.add(current);
      const entry = manifest.items.find((item) => item.urn === current);
      const parent = entry?.parentUrn || null;
      if (!parent) return false;
      if (parent === candidateUrn) return true;
      current = parent;
    }
    return false;
  }

  async copyDocuments(urns, targetParentUrn) {
    const list = Array.isArray(urns) ? urns : [];
    const copies = [];
    for (const originalUrn of list) {
      try {
        const doc = await this.getDocument(originalUrn);
        if (!doc || doc.isFolder) continue;
        const clone = {
          ...doc,
          urn: `${doc.urn}-copy-${Date.now()}`,
          parentUrn: targetParentUrn ?? null,
          name: doc.name ? `${doc.name} (copy)` : "Copy",
        };
        copies.push(await this.saveDocument(clone));
      } catch (_) {
        // ignore individual failures
      }
    }
    return copies;
  }

  async updateDocumentName(urn, name) {
    const doc = await this.getDocument(urn);
    if (!doc) return null;
    doc.name = String(name || urn);
    return this.saveDocument(doc);
  }

  async getShares() {
    this.setIsLoadingShares(false);
    return [];
  }

  async upsertShare() {
    throw new Error("Sharing is not supported by the Source API integration");
  }

  async deleteShare() {
    throw new Error("Sharing is not supported by the Source API integration");
  }

  async getSharedDocuments() {
    return [];
  }

  async publishDocument() {
    throw new Error("Publishing is not supported by the Source API integration");
  }

  async unpublishDocument() {
    throw new Error("Publishing is not supported by the Source API integration");
  }

  async getVersions() {
    return [];
  }

  async createVersion() {
    throw new Error("Versioning is not supported by the Source API integration");
  }

  async getVersionDetails() {
    return null;
  }

  async restoreVersion() {
    throw new Error("Versioning is not supported by the Source API integration");
  }

  async renameVersion() {
    throw new Error("Versioning is not supported by the Source API integration");
  }

  async getDocumentLinks() {
    return [];
  }

  async getDocumentReferrers() {
    return [];
  }

  serializeElement(element) {
    if (!element) return "";
    try {
      if (element.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        const parts = [];
        const children = Array.from(element.childNodes || []).filter((n) => n.nodeType === Node.ELEMENT_NODE);
        for (const child of children) parts.push(child.outerHTML);
        return parts.join("\n");
      }
      return element.outerHTML;
    } catch (_) {
      return "";
    }
  }

  deserializeElement(htmlString) {
    if (typeof htmlString !== "string") return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    const frag = document.createDocumentFragment();
    const children = Array.from(doc.body?.children || []);
    if (!children.length) return null;
    for (const child of children) {
      try {
        frag.appendChild(child.cloneNode(true));
      } catch (_) {}
    }
    return frag;
  }

  async #resolveConfig() {
    const resolved = { ...DEFAULT_SOURCE_CONFIG };
    const sources = [];
    if (this.providedConfig && typeof this.providedConfig === "object") sources.push(this.providedConfig);
    if (DocumentStore.config) sources.push(DocumentStore.config);
    if (this.providedApiUrl) {
      const parsed = this.#parseProvidedUrl(this.providedApiUrl);
      if (parsed) sources.push(parsed);
    }
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      for (const [key, value] of Object.entries(source)) {
        if (value === undefined || value === null || value === "") continue;
        resolved[key] = value;
      }
    }
    return resolved;
  }

  #parseProvidedUrl(url) {
    try {
      const parsed = new URL(url);
      const segments = trimSlashes(parsed.pathname).split("/");
      const idx = segments.indexOf("source");
      if (idx === -1 || segments.length < idx + 3) return null;
      const org = segments[idx + 1];
      const site = segments[idx + 2];
      const branchPath = segments.slice(idx + 3).join("/");
      return {
        baseUrl: `${parsed.protocol}//${parsed.host}`,
        org,
        site,
        branch: branchPath,
      };
    } catch (_) {
      return null;
    }
  }

  async #normalizeIncomingDocument(doc, existingEntry = null) {
    await this.loadApiEndpoint();
    const now = isoNow();
    const baseUrn = isNonEmptyString(doc?.urn)
      ? doc.urn.trim()
      : isNonEmptyString(doc?.name)
        ? doc.name.trim()
        : `document-${now}`;

    const urn = baseUrn;
    const htmlValue = doc?.isFolder
      ? ""
      : (typeof doc?.html === "string" && doc.html)
        ? doc.html
        : this.serializeElement(doc.element || null);

    let filePath = existingEntry?.filePath || null;
    if (!doc?.isFolder) {
      if (!filePath) {
        const fileKey = slugPathFromUrn(urn);
        const fileName = `${fileKey}${this.defaultExtension}`;
        filePath = this.documentsRootPath ? joinPath(this.documentsRootPath, fileName) : fileName;
      }
    }

    const storedDoc = {
      urn,
      name: doc?.name != null ? String(doc.name) : urn,
      html: htmlValue,
      isFolder: !!doc?.isFolder,
      parentUrn: doc?.parentUrn ?? existingEntry?.parentUrn ?? null,
      filePath,
      created: existingEntry?.created || doc?.created || now,
      lastModified: now,
    };

    const summary = {
      urn: storedDoc.urn,
      name: storedDoc.name,
      isFolder: storedDoc.isFolder,
      parentUrn: storedDoc.parentUrn,
      filePath: storedDoc.filePath,
      lastModified: storedDoc.lastModified,
      created: storedDoc.created,
      deleted: false,
    };

    return { storedDoc, summary };
  }

  #mapStoredDocToResult(storedDoc) {
    const element = storedDoc.isFolder ? null : this.deserializeElement(storedDoc.html || "");
    return {
      id: storedDoc.urn,
      urn: storedDoc.urn,
      name: storedDoc.name || storedDoc.urn,
      html: storedDoc.html || "",
      element,
      comments: [],
      isFolder: !!storedDoc.isFolder,
      parentUrn: storedDoc.parentUrn ?? null,
      json: {},
      references: null,
      sourcePath: storedDoc.filePath || null,
      lastModified: storedDoc.lastModified || storedDoc.updated || storedDoc.created || null,
      created: storedDoc.created || null,
      published: storedDoc.published || null,
      publishedBy: storedDoc.publishedBy || null,
    };
  }

  #manifestItemToDocument(item) {
    return {
      id: item.urn,
      urn: item.urn,
      html: "",
      element: null,
      comments: [],
      isFolder: !!item.isFolder,
      parentUrn: item.parentUrn ?? null,
      published: item.published ?? null,
      publishedBy: item.publishedBy ?? null,
      name: item.name ?? item.urn,
      lastModified: item.lastModified ?? item.updated ?? item.created ?? null,
      json: {},
      sourcePath: item.filePath || null,
    };
  }

  async #loadManifest(force = false) {
    if (this.manifestCache && !force) return this.manifestCache;
    if (!this.manifestPath) {
      this.manifestCache = cloneManifest(EMPTY_MANIFEST);
      return this.manifestCache;
    }

    const resource = await this.#getSourceResource(this.manifestPath);
    if (resource.status === 404) {
      this.manifestCache = cloneManifest(EMPTY_MANIFEST);
      return this.manifestCache;
    }

    if (resource.content) {
      const manifest = typeof resource.content === "object"
        ? resource.content
        : safeParseJson(resource.content);
      if (manifest && typeof manifest === "object") {
        manifest.items = Array.isArray(manifest.items) ? manifest.items : [];
        manifest.version = manifest.version || 1;
        this.manifestCache = cloneManifest(manifest);
        return this.manifestCache;
      }
    }

    if (resource.metadata) {
      try {
        const manifest = await this.#getJsonViaMetadata(resource.metadata);
        if (manifest && typeof manifest === "object") {
          manifest.items = Array.isArray(manifest.items) ? manifest.items : [];
          manifest.version = manifest.version || 1;
          this.manifestCache = cloneManifest(manifest);
          return this.manifestCache;
        }
      } catch (_) {}
    }

    this.manifestCache = cloneManifest(EMPTY_MANIFEST);
    return this.manifestCache;
  }

  async #persistManifest(manifest) {
    const canonical = cloneManifest(manifest);
    canonical.updated = isoNow();
    const payload = JSON.stringify(canonical, null, 2);
    if (this.manifestPath) {
      await this.#uploadFile(this.manifestPath, payload, "application/json");
    }
    this.manifestCache = cloneManifest(canonical);
    return this.manifestCache;
  }

  #upsertManifestEntry(manifest, entry) {
    manifest.items = Array.isArray(manifest.items) ? manifest.items : [];
    const index = manifest.items.findIndex((item) => item.urn === entry.urn);
    const record = {
      urn: entry.urn,
      name: entry.name || entry.urn,
      isFolder: !!entry.isFolder,
      parentUrn: entry.parentUrn ?? null,
      lastModified: entry.lastModified || isoNow(),
      created: entry.created || entry.lastModified || isoNow(),
      filePath: entry.filePath || null,
      deleted: !!entry.deleted,
    };
    if (index >= 0) {
      manifest.items[index] = { ...manifest.items[index], ...record };
    } else {
      manifest.items.push(record);
    }
    manifest.updated = isoNow();
    return record;
  }

  #removeManifestEntry(manifest, urn) {
    manifest.items = Array.isArray(manifest.items) ? manifest.items : [];
    const index = manifest.items.findIndex((item) => item.urn === urn);
    if (index >= 0) {
      manifest.items.splice(index, 1);
      manifest.updated = isoNow();
    }
  }

  async #getSourceResource(path) {
    const response = await this.#fetchSource(path, { method: "GET" });
    if (response.status === 404) return { status: 404 };
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to fetch resource ${path}: ${response.status} ${text}`);
    }
    const text = await response.text();
    const json = safeParseJson(text);
    if (json && typeof json === "object") {
      const hasMetadataFields = json.preview || json.live || json.links || json.resourcePath || json.webPath;
      const looksLikeManifest = Array.isArray(json.items);
      const looksLikeDocument = "html" in json || "json" in json || "isFolder" in json || "urn" in json;
      if (hasMetadataFields && !looksLikeManifest && !looksLikeDocument) {
        return { metadata: json };
      }
      return { content: json };
    }
    return { content: text };
  }

  async #getJsonViaMetadata(metadata) {
    const contentUrl = this.#resolveContentUrl(metadata);
    if (!contentUrl) return null;
    const response = await this.#fetchContent(contentUrl, {
      accept: "application/json",
      useAuth: false,
    });
    const text = await response.text();
    return safeParseJson(text);
  }

  async #getHtmlViaMetadata(metadata) {
    const contentUrl = this.#resolveContentUrl(metadata);
    if (!contentUrl) return "";
    const response = await this.#fetchContent(contentUrl, {
      accept: "text/html",
      useAuth: false,
    });
    return response.text();
  }

  #resolveContentUrl(metadata) {
    if (!metadata || typeof metadata !== "object") return null;
    const direct = metadata?.preview?.url || metadata?.links?.preview || metadata?.live?.url;
    if (direct) return direct;
    const resourcePath = metadata?.resourcePath || metadata?.webPath;
    if (resourcePath && this.previewBaseUrl) {
      return `${this.previewBaseUrl.replace(/\/+$/, "")}/${trimSlashes(resourcePath)}`;
    }
    return null;
  }

  async #fetchSource(path, options = {}, extra = {}) {
    await this.loadApiEndpoint();
    const allowAbsolute = !!extra.allowAbsolute;
    const omitAuth = !!extra.omitAuth;
    const url = allowAbsolute ? path : `${this.sourceBaseUrl}/${trimSlashes(path)}`;
    const init = { ...options };
    const headers = new Headers(init.headers || {});
    if (!omitAuth) {
      const token = await this.getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    init.headers = headers;
    return fetch(url, init);
  }

  async #uploadFile(path, content, contentType) {
    if (typeof FormData === "undefined") {
      throw new Error("FormData is required to upload files to the Source API");
    }
    const formData = new FormData();
    const fileName = (trimSlashes(path).split("/").pop() || "file").replace(/[^\w\-.]+/g, "_");
    const blob = typeof Blob !== "undefined" ? new Blob([content], { type: contentType }) : content;
    formData.append("data", blob, fileName);
    const response = await this.#fetchSource(path, { method: "POST", body: formData });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to upload ${path}: ${response.status} ${text}`);
    }
    const text = await response.text().catch(() => "");
    return safeParseJson(text);
  }

  async #fetchContent(url, { accept = "application/json", useAuth = false } = {}) {
    const headers = new Headers();
    if (accept) headers.set("Accept", accept);
    if (useAuth) {
      const token = await this.getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to fetch ${url}: ${response.status} ${text}`);
    }
    return response;
  }

}

makeObservable(DocumentStore);

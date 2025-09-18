import { reaction } from 'picosm';
import { GalleryViews } from './store.js';
import DA_SDK from "https://da.live/nx/utils/sdk.js";

export class Router {
  constructor(store) {
    this.store = store;
    this.isUpdatingFromUrl = false;
    this.isUpdatingFromStore = false;
    this.lastHashUpdate = null;
    this.cleanupReaction = null;
    this.#navDisposer = null;
    this.#wasHome = false;
    this.currentHash = this.#getHashFromWindow();
    this.lastHashUpdate = this.currentHash;
    this.handleParentMessage = (event) => {
      if (!event || !event.data) return;
      const { hash, action, details } = event.data;
      let incoming = null;
      if (typeof hash === 'string') {
        incoming = hash;
      } else if (action === 'hashchange' && typeof details === 'string') {
        incoming = details;
      }
      if (incoming == null) return;
      const normalized = this.#normalizeHash(incoming);
      if (normalized === this.lastHashUpdate && this.isUpdatingFromStore) return;
      if (normalized === this.currentHash) return;
      this.currentHash = normalized;
      if (!this.isUpdatingFromStore) {
        this.handleRouteFromHash(normalized);
      }
    };
    window.addEventListener('message', this.handleParentMessage);
    // Query-parameter based routing only. Preserve current path and
    // encode state in the hash fragment of the parent URL.

    this.initDA_SDK();
    // Setup reactions and listeners
    this.setupStoreReactions();
    this.setupBrowserListeners();
    
    // Initialize from URL
    this.handleRouteFromHash(this.currentHash);
  }

  async initDA_SDK() {
    try {
      const { actions, hash } = await DA_SDK;
      this.actions = actions;
      if (typeof hash === 'string') {
        const normalized = this.#normalizeHash(hash);
        this.currentHash = normalized;
        this.lastHashUpdate = normalized;
        this.handleRouteFromHash(normalized);
        this.#updateIframeHash(normalized);
      }
    } catch (_) {
      // SDK not available; rely on iframe hash only
    }
  }
  
  // No base path manipulation needed for query-only routing
  
  setupStoreReactions() {
    // Use picosm's reaction to observe store changes
    this.cleanupReaction = reaction(
      this.store,
      (store) => [
        store?.editorStore?.currentElementId,
        store.galleryView,
        store.searchQuery,
        store.showCreationDialog,
        store.creationDialogCategory,
        // Track folder navigation to preserve in URL
        store.currentFolderUrn
      ],
      (currentElementId, galleryView, searchQuery, showCreationDialog, creationDialogCategory) => {
        if (this.isUpdatingFromUrl) {
          return; // Skip if we're updating from URL to prevent loops
        }
        
        this.isUpdatingFromStore = true;
        this.updateHashFromStore();
        this.isUpdatingFromStore = false;
      },
      0 // No debouncing, update immediately
    );
  }
  
  setupBrowserListeners() {
    this.handleHashChange = () => {
      if (this.isUpdatingFromStore) return;
      const hash = this.#getHashFromWindow();
      if (hash === this.currentHash) return;
      this.currentHash = hash;
      this.handleRouteFromHash(hash);
    };

    window.addEventListener('hashchange', this.handleHashChange);
  }
  
  updateHashFromStore() {
    let params = new URLSearchParams();

    if (this.store?.editorStore?.currentElementId) {
      params = new URLSearchParams();
      params.set('id', this.store.editorStore.currentElementId);
    } else if (this.store.showCreationDialog) {
      params = new URLSearchParams();
      params.set('new', '1');
      if (this.store.creationDialogCategory && this.store.creationDialogCategory !== 'templates') {
        params.set('category', this.store.creationDialogCategory);
      }
      if (this.store.currentFolderUrn) params.set('folder', this.store.currentFolderUrn);
      if (this.store.galleryView && this.store.galleryView !== 'all') params.set('view', this.store.galleryView);
      if (this.store.searchQuery) params.set('q', this.store.searchQuery);
    } else {
      params = new URLSearchParams();
      if (this.store.galleryView && this.store.galleryView !== 'all') {
        params.set('view', this.store.galleryView);
      }
      if (this.store.searchQuery) {
        params.set('q', this.store.searchQuery);
      }
      if (this.store.galleryView === 'files' && this.store.currentFolderUrn) {
        params.set('folder', this.store.currentFolderUrn);
      }
    }

    const newHash = this.#normalizeHash(params.toString());
    if (newHash === this.lastHashUpdate && newHash === this.currentHash) return;

    this.lastHashUpdate = newHash;
    this.currentHash = newHash;

    const hashForParent = newHash ? `#${newHash}` : '';

    this.actions.setHash(hashForParent);

    this.#updateIframeHash(newHash);
  }
  
  async handleRouteFromHash(hashValue = this.#getHashFromWindow()) {
    this.isUpdatingFromUrl = true;
    // Show global navigation spinner while processing route
    this.store.setIsNavigating(true);
    // Cancel any prior navigation watcher
    if (this.#navDisposer) {
      try { this.#navDisposer(); } catch (_) {}
      this.#navDisposer = null;
    }
    const normalizedHash = this.#normalizeHash(hashValue);
    this.currentHash = normalizedHash;
    const params = this.#parseHash(normalizedHash);

    // Parse and apply gallery view ASAP so downstream reactions (e.g., folder load) scope correctly
    const viewParam = params.get('view') || 'all';
    const validViewsEarly = Object.values(GalleryViews);
    const validatedViewEarly = validViewsEarly.includes(viewParam) ? viewParam : 'all';
    if (this.store.galleryView !== validatedViewEarly) {
      this.store.setGalleryView(validatedViewEarly);
    }

    const folderParam = params.get('folder');

    // Synchronize folder context first, so subsequent UI has correct state
    await this.#syncFolderFromParam(folderParam);
    
    // Handle different routes
    if (params.has('id')) {
      // Element editing via query param
      const elementId = params.get('id');
      
      // Close creation dialog if open
      if (this.store.showCreationDialog && this.store.setShowCreationDialog) {
        this.store.setShowCreationDialog(false);
      }
      
      if (elementId) {
        // Force editor view immediately so refresh doesn't flash home
      if (this.store?.editorStore?.setCurrentElementId) {
        this.store.editorStore.setCurrentElementId(elementId);
      }
      if (this.store.openElement) {
        this.store.openElement(elementId);
      }
      }
      // Clear global spinner; editor will show its own surface-centered spinner while loading
      this.store.setIsNavigating(false);
    } else if (params.has('new')) {
      // New element creation via query param
      const category = params.get('category') || 'templates';
      
      if (this.store.setShowCreationDialog) {
        this.store.setShowCreationDialog(true);
      }
      if (this.store.setCreationDialogCategory) {
        this.store.setCreationDialogCategory(category);
      }
      // Clear spinner immediately after toggling dialog state
      this.store.setIsNavigating(false);
    } else {
      // Gallery mode (default)
      
      // Clear element editing mode if we're in it
      if (this.store?.editorStore?.currentElementId) {
        if (this.store.closeElement) {
          this.store.closeElement();
        } else {
          this.store?.editorStore?.setCurrentElementId(null);
          this.store.setCurrentElement(null);
        }
      }
      // Clear spinner immediately; saving and gallery hydration continue in background
      this.store.setIsNavigating(false);
      
      // Close creation dialog if open
      if (this.store.showCreationDialog && this.store.setShowCreationDialog) {
        this.store.setShowCreationDialog(false);
      }
      
      // Parse and apply gallery parameters
      const view = params.get('view') || 'all';
      const searchQuery = params.get('q') || '';
      
      if (this.store.searchQuery !== searchQuery) {
        this.store.setSearchQuery(searchQuery);
      }
    }
    
    this.isUpdatingFromUrl = false;
  }

  handleRoute() {
    return this.handleRouteFromHash(this.#getHashFromWindow());
  }

  // Resolve folder path from a URN and reconstruct breadcrumbs in the store
  async #syncFolderFromParam(folderUrn) {
    const current = this.store.currentFolderUrn || null;
    const target = folderUrn && folderUrn.trim() !== '' ? folderUrn : null;
    if (current === target) return;
    if (!target) {
      // Clear to root
      this.store.setCurrentFolder(null);
      return;
    }
    try {
      // Walk up parents to root to reconstruct crumbs
      const chain = [];
      let cursor = target;
      const seen = new Set();
      // Prevent cycles with a reasonable bound
      for (let i = 0; i < 32 && cursor && !seen.has(cursor); i++) {
        seen.add(cursor);
        const doc = await this.store.documentStore.getDocument(cursor);
        if (!doc) break;
        chain.push({ urn: doc.urn, name: doc.name || 'Folder', parent: doc.parentUrn || null });
        cursor = doc.parentUrn || null;
      }
      // Build crumbs from root -> leaf
      chain.reverse();
      // Reset to root first
      this.store.setCurrentFolder(null);
      for (const item of chain) {
        this.store.setCurrentFolder(item.urn, item.name);
      }
    } catch (_) {
      // If reconstruction fails, at least set current to target without crumbs
      this.store.setCurrentFolder(target);
    }
  }
  
  cleanup() {
    // Remove event listeners
    if (this.handleHashChange) {
      window.removeEventListener('hashchange', this.handleHashChange);
    }
    window.removeEventListener('message', this.handleParentMessage);
    
    // Clean up picosm reaction
    if (this.cleanupReaction) {
      this.cleanupReaction();
    }
    // no-op: app-level reactions handle home loading
  }
  #navDisposer;
  #wasHome;

  #normalizeHash(value) {
    if (!value) return '';
    let hash = String(value);
    if (hash.startsWith('#')) hash = hash.slice(1);
    if (hash.startsWith('?')) hash = hash.slice(1);
    return hash;
  }

  #parseHash(value) {
    return new URLSearchParams(this.#normalizeHash(value));
  }

  #getHashFromWindow() {
    return this.#normalizeHash(window.location.hash || '');
  }

  #updateIframeHash(hash) {
    const base = `${window.location.pathname}${window.location.search}`;
    const target = hash ? `${base}#${hash}` : base;
    try {
      history.replaceState(null, '', target);
    } catch (_) {
      // Fallback when history API is unavailable
      if (hash) {
        window.location.hash = hash;
      } else if (window.location.hash) {
        window.location.hash = '';
      }
    }
  }
}

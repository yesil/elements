import { html, LitElement } from "lit";
import "./experience-elements-editor.js";
import { makeLitObserver } from "picosm";
import { Store, GalleryViews } from "./store.js";
import { TemplateStore } from "./template-store.js";
import { UserStore } from "./user-store.js";
import { experienceElementsHomeNewStyles } from "./experience-elements-home-new.css.js";

class ExperienceElementsHomeNew extends LitElement {
  static get styles() {
    return experienceElementsHomeNewStyles;
  }

  static get properties() {
    return {
      store: { type: Store, observe: true },
      templateStore: { type: TemplateStore, observe: true },
      userStore: { type: UserStore, observe: true },
      searchQuery: { type: String },
      // Files view state
      showNewFolderDialog: { type: Boolean },
      newFolderName: { type: String },
      renamingUrn: { type: String },
      renameValue: { type: String },
      renameError: { type: String },
      confirmDeleteOpen: { type: Boolean },
      newFolderError: { type: String },
      // "Used In" list for delete confirmation
      deleteUsages: { type: Array },
      isLoadingDeleteUsages: { type: Boolean },
      // Sharing dialog state (Home)
      shareDialogOpen: { type: Boolean },
      shareDialogUrn: { type: String },
      // Share data now sourced from DocumentStore (sharesByUrn, isLoadingShares)
      shareError: { type: String },
      newShareUser: { type: String },
      newSharePerms: { type: Array },
      // Team workspace
      isLoadingTeam: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.searchQuery = "";
    this.templateStore = null;
    this.userStore = null;
    this.#toastTimer = null;
    this.#templateObserver = null;
    this.#elementObserver = null;
    this.#boundKeydown = null;
    // Files view state
    this.showNewFolderDialog = false;
    this.newFolderName = "";
    this.renamingUrn = null;
    this.renameValue = "";
    this.renameError = "";
    this.confirmDeleteOpen = false;
    this.newFolderError = '';
    // "Used In" state for delete confirmation
    this.deleteUsages = [];
    this.isLoadingDeleteUsages = false;
    // Share dialog state
    this.shareDialogOpen = false;
    this.shareDialogUrn = null;
    // Shares data is managed by DocumentStore
    this.shareError = '';
    this.newShareUser = '';
    // Additional permissions beyond implicit Read
    this.newSharePerms = [];
    // Team workspace
    this.isLoadingTeam = false;
    // Pending bulk action URNs (keeps selection context when action bar auto-closes)
    this.pendingBulkUrns = null;
  }

  #templateObserver;
  #elementObserver;
  #toastTimer;
  #boundKeydown;

  async connectedCallback() {
    super.connectedCallback();
    // Store is initialized by ExperienceElementsApp; avoid duplicate init/fetches
    
    // Load external templates if configured
    if (this.store?.templateSources && this.store.templateSources.length > 0) {
      this.templateStore?.loadTemplates(this.store.templateSources);
    }

    // Add keyboard event listeners (use window to ensure ESC works after overlays)
    this.#boundKeydown = (e) => this.#handleKeyDown(e);
    window.addEventListener('keydown', this.#boundKeydown, { capture: true });

  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#boundKeydown) {
      window.removeEventListener('keydown', this.#boundKeydown, { capture: true });
      this.#boundKeydown = null;
    }
    // Clean up observers
    if (this.#templateObserver) {
      this.#templateObserver.disconnect();
      this.#templateObserver = null;
    }
    if (this.#elementObserver) {
      this.#elementObserver.disconnect();
      this.#elementObserver = null;
    }
  }

  render() {
    const effectiveView = this.#effectiveGalleryView;
    const inSharedView = effectiveView === GalleryViews.SHARED;
    const inFilesView = effectiveView === GalleryViews.MY_FILES;
    return html`
      <div class="home-container">
        <div class="main-content">
          <div class="content-scroll">
            ${inFilesView || inSharedView
              ? ''
              : this.#heroSectionUI}
            <div class="content-section">
              ${inSharedView
                ? this.#sharedWithMeSectionUI
                : inFilesView
                  ? html`${this.#filesToolbarUI}${this.#filesSectionUI}${this.#newFolderDialogUI}`
                  : this.#recentSectionUI}
            </div>
          </div>
        </div>
      </div>
      ${this.#selectionActionBarUI}
      ${this.#deleteConfirmUI}
      ${this.store.showCreationDialog ? this.#creationDialogUI : ""}
      ${this.#shareDialogUI}
    `;
  }

  // Default to the "All" gallery view until the store finishes initializing
  get #effectiveGalleryView() {
    return this.store?.galleryView ?? GalleryViews.ALL;
  }

  get #heroSectionUI() {
    return html`
      <div class="hero-section">
        <div class="hero-content">
          <h1 class="hero-headline">Scale. Simplify. Launch.</h1>
          <p class="hero-description">
            From Unified Paywalls to 3in1 Modals, Merch Cards, and Merch Content, create and scale experiences faster, all in one place. 
          </p>
          
          <div class="quick-action-card">
            <div class="quick-actions">
              <div class="quick-action-item">
                <button 
                  class="quick-action-button"
                  @click=${() => this.#openCreationDialog("templates")}
                >
                  <img src="./assets/icons/template-icon.svg" alt="Template" width="64" height="64" />
                </button>
                <div class="quick-action-label">Start from template</div>
              </div>
              <div class="quick-action-item">
                <button 
                  class="quick-action-button"
                  @click=${() => this.#openCreationDialog("blank")}
                >
                  <img src="./assets/icons/create-blank.svg" alt="Create blank" width="64" height="64" />
                </button>
                <div class="quick-action-label">Create blank element</div>
              </div>
            </div>
          </div>

          <div class="element-types">
            <div class="element-type-item" @click=${() => this.#createElementOfType('merch-card')}>
              <div class="element-type-icon">
                <img src="./assets/icons/merch-card-icon.svg" alt="Merch Card" width="36" height="36" />
              </div>
              <div class="element-type-label">Merch Card</div>
            </div>
            <div class="element-type-item" @click=${() => this.#createElementOfType('merch-list')}>
              <div class="element-type-icon">
                <img src="./assets/icons/collection-icon.svg" alt="Collection" width="36" height="36" />
              </div>
              <div class="element-type-label">Collection</div>
            </div>
            <div class="element-type-item" @click=${() => this.#createElementOfType('checkout-button')}>
              <div class="element-type-icon">
                <img src="./assets/icons/buy-modal-icon.svg" alt="Buy Modal" width="36" height="36" />
              </div>
              <div class="element-type-label">Buy Modal</div>
            </div>
            <div class="element-type-item" @click=${() => this.#createElementOfType('merch-mnemonic')}>
              <div class="element-type-icon">
                <img src="./assets/icons/marquee-icon.svg" alt="Marquee" width="36" height="36" />
              </div>
              <div class="element-type-label">Marquee</div>
            </div>
            <div class="element-type-item" @click=${() => this.#createElementOfType('merch-callout')}>
              <div class="element-type-icon">
                <img src="./assets/icons/accordion-icon.svg" alt="Accordion" width="36" height="36" />
              </div>
              <div class="element-type-label">Accordion</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  get #recentSectionUI() {
    const recentElements = this.store.filteredElements || [];
    const loading = !!this.store?.documentStore?.isLoadingElements;

    return html`
      <div class="recent-section">
        <div class="section-header">
          <h2 class="section-title">Recent</h2>
          <a class="view-all-link" href="?view=files">
            View all
          </a>
        </div>
        ${loading
          ? html`<div class="recent-section-loading"><sp-progress-circle indeterminate size="l"></sp-progress-circle></div>`
          : recentElements.length === 0 
          ? html`
              <sp-illustrated-message 
                heading="Nothing here yet" 
                description="Create your first element to get started"
              ></sp-illustrated-message>
            `
          : html`
              <div class="elements-grid">
                ${recentElements.map(doc => this.#elementCardUI(doc))}
              </div>
            `
        }
      </div>
    `;
  }

  get #filesSectionUI() {
    const loading = !!this.store?.documentStore?.isLoadingElements;
    const items = (this.store?.filteredElements || []).slice();
    if (loading) {
      return html`
        <div class="section-loading">
          <sp-progress-circle indeterminate size="l"></sp-progress-circle>
        </div>
      `;
    }
    if (!items.length) {
      return html`
        ${this.#breadcrumbsUI}
        <sp-illustrated-message heading="Empty" description="Create a folder or element to get started"></sp-illustrated-message>`;
    }
    // Split into folders and documents, sort each by name
    const folders = items.filter((i) => !!i.isFolder).sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1; if (an > bn) return 1; return 0;
    });
    const docs = items.filter((i) => !i.isFolder).sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1; if (an > bn) return 1; return 0;
    });
    return html`
      ${this.#breadcrumbsUI}
      ${folders.length ? html`
        <div class="elements-grid">${folders.map((doc) => this.#fileTileUI(doc))}</div>
      ` : ''}
      ${folders.length && docs.length ? html`<sp-divider class="folders-docs-divider" size="m"></sp-divider>` : ''}
      ${docs.length ? html`
        <div class="elements-grid">${docs.map((doc) => this.#fileTileUI(doc))}</div>
      ` : ''}
    `;
  }

  #fileTileUI(doc) {
    const isFolder = !!doc.isFolder;
    const renaming = isFolder && this.renamingUrn === doc.urn;
    const selected = !!this.store?.selectedUrns?.has?.(doc.urn);
    return html`
      <div
        class="element-card ${isFolder ? 'folder' : ''}"
        role="button"
        tabindex="0"
        data-selected=${selected ? 'true' : 'false'}
        draggable=${!isFolder && !this.store?.selectionMode}
        @dragstart=${(e) => this.#onDragStart(doc, e)}
        @click=${(e) => {
          if (this.store?.selectionMode) { e.preventDefault(); e.stopPropagation(); this.store.toggleSelect(doc.urn); return; }
          if (isFolder) this.store.enterFolder(doc); else this.#openElement(doc.urn);
        }}
        @keydown=${(e) => { if (e.key === 'Enter') { if (isFolder) this.store.enterFolder(doc); else this.#openElement(doc.urn); } }}
      >
        ${isFolder
          ? html`
              <div
                class="element-thumbnail"
                @dragenter=${(e) => this.#onDragEnterFolder(doc, e)}
                @dragover=${(e) => this.#onDragOverFolder(e)}
                @dragleave=${(e) => this.#onDragLeaveFolder(doc, e)}
                @drop=${(e) => this.#onDropFolder(doc, e)}
              >
                <sp-icon-folder size="xxl"></sp-icon-folder>
              </div>
            `
          : html`
              <div class="element-thumbnail">
                <div class="element-preview" data-doc-urn=${doc.urn}>
                  <div class="element-preview-placeholder">Loading...</div>
                </div>
              </div>
            `}
        <div class="element-info">
          ${renaming
            ? html`
                <div>
                  <sp-textfield
                    value=${this.renameValue}
                    autofocus
                    @input=${(e) => (this.renameValue = e.target.value)}
                    @keydown=${(e) => { if (e.key === 'Enter') this.#commitRename(doc); if (e.key === 'Escape') this.#cancelRename(); }}
                    @blur=${() => this.#commitRename(doc)}
                  ></sp-textfield>
                  ${this.renameError ? html`<sp-help-text validation-state="negative">${this.renameError}</sp-help-text>` : ''}
                </div>
              `
            : html`
                <div class="element-name" @dblclick=${() => isFolder && this.#startRename(doc)}>
                  ${doc.name || (isFolder ? 'Folder' : 'Untitled')}
                </div>
              `}
          <div class="element-time">${this.#formatDate(doc.lastModified)}</div>
        </div>
      </div>
    `;
  }

  #onTileMenu(e, doc) {
    const v = e?.target?.value;
    if (v === 'open') {
      if (doc.isFolder) this.store.enterFolder(doc); else this.#openElement(doc.urn);
    }
  }

  // Files toolbar: New Folder button
  get #filesToolbarUI() {
    const inSelection = !!this.store?.selectionMode;
    const count = (this.store?.selectedUrns?.size || 0);
    return html`
      <div class="files-toolbar">
        <sp-action-group quiet>
          <sp-action-menu label="Create" @change=${(e) => this.#onCreateMenuChange(e)}>
            <sp-icon-new slot="icon"></sp-icon-new>
            <sp-menu-item value="document">Document</sp-menu-item>
            <sp-menu-item value="folder">Folder</sp-menu-item>
            <span slot="label">Create</span>
          </sp-action-menu>
        </sp-action-group>
        <sp-action-group quiet>
          <sp-action-button @click=${() => this.#toggleSelection()}>
            ${inSelection ? 'Done' : 'Select'}
            <sp-icon-select-multi slot="icon"></sp-icon-select-multi>
          </sp-action-button>
          ${inSelection && count === 0 ? html`
            <sp-action-button @click=${() => this.store?.selectAllVisible?.()}>
              Select All
              <sp-icon-select-all-items slot="icon"></sp-icon-select-all-items>
            </sp-action-button>
          ` : ''}
        </sp-action-group>
      </div>
    `;
  }

  get #selectionActionBarUI() {
    const count = (this.store?.selectedUrns?.size || 0);
    const open = !!this.store?.selectionMode;
    const view = this.#effectiveGalleryView;
    const bulkView = view === GalleryViews.MY_FILES || view === GalleryViews.SHARED;
    if (!open || !bulkView || count === 0) return '';
    const selectedUrn = count === 1 ? Array.from(this.store?.selectedUrns || [])[0] : null;
    const items = this.store?.filteredElements || [];
    const selectedItem = selectedUrn ? items.find((d) => d.urn === selectedUrn) : null;
    const isFolder = !!selectedItem?.isFolder;
    return html`
      <sp-action-bar emphasized open @close=${() => this.#onCloseActionBar()}>
        <span
          role="button"
          tabindex="0"
          title="Clear selection"
          @click=${() => this.#clearSelectionOnly()}
          @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.#clearSelectionOnly(); } }}
          style="cursor: pointer; user-select: none;"
        >
          ${count} Selected • Clear
        </span>
        ${count === 1 ? html`
          <sp-action-button slot="buttons" label="Share" @click=${() => this.#openShareForSelection()}>
            <sp-icon-user-group slot="icon"></sp-icon-user-group>
          </sp-action-button>
          ${!isFolder ? html`
            <sp-action-button slot="buttons" label="Publish" @click=${() => this.#bulkPublish('publish')}>
              <sp-icon-upload-to-cloud slot="icon"></sp-icon-upload-to-cloud>
            </sp-action-button>
            <sp-action-button slot="buttons" label="Unpublish" @click=${() => this.#bulkPublish('unpublish')}>
              <sp-icon-revert slot="icon"></sp-icon-revert>
            </sp-action-button>
          ` : ''}
          <sp-action-button slot="buttons" label="Delete" variant="negative" @click=${() => this.#openConfirmDelete()}>
            <sp-icon-delete slot="icon"></sp-icon-delete>
          </sp-action-button>
        ` : ''}
      </sp-action-bar>
    `;
  }

  #openShareForSelection() {
    const sel = Array.from(this.store?.selectedUrns || []);
    if (sel.length !== 1) return;
    this.#openShareDialog(sel[0]);
    // Auto-close the action bar after triggering the action
    this.#onCloseActionBar();
  }

  get #deleteConfirmUI() {
    if (!this.confirmDeleteOpen) return '';
    const count = (this.store?.selectedUrns?.size || 0);
    return html`
      <sp-dialog-wrapper
        open
        underlay
        dismissable
        mode="modal"
        size="s"
        headline="Delete ${count} item${count===1?'':'s'}?"
        confirm-label="Delete"
        cancel-label="Cancel"
        @close=${() => { this.confirmDeleteOpen = false; this.pendingBulkUrns = null; }}
        @cancel=${() => { this.confirmDeleteOpen = false; this.pendingBulkUrns = null; }}
        @confirm=${() => this.#onConfirmBulkDelete()}
      >
        <div>
          <div>This action cannot be undone.</div>
          ${this.isLoadingDeleteUsages
            ? html`<div class="backrefs-loading"><sp-progress-circle indeterminate size="s"></sp-progress-circle></div>`
            : this.deleteUsages?.length
              ? html`
                  <div class="backrefs-title">Used In</div>
                  <div class="backrefs-list">
                    <sp-sidenav>
                      ${this.deleteUsages.map((r) => html`
                        <sp-sidenav-item
                          value=${r.urn}
                          label=${r.name || r.urn}
                          @click=${() => this.#openUsage(r.urn)}
                        ></sp-sidenav-item>
                      `)}
                    </sp-sidenav>
                  </div>
                `
              : ''}
        </div>
      </sp-dialog-wrapper>
    `;
  }

  async #openUsage(urn) {
    if (!urn) return;
    this.confirmDeleteOpen = false;
    await this.store.openElement(urn);
  }

  // New Folder dialog
  get #newFolderDialogUI() {
    if (!this.showNewFolderDialog) return '';
    return html`
      <sp-dialog-wrapper
        open
        size="s"
        headline="New Folder"
        cancel-label="Cancel"
        confirm-label="Create"
        dismissable
        underlay
        mode="modal"
        @close=${() => (this.showNewFolderDialog = false)}
        @confirm=${() => this.#confirmCreateFolder()}
      >
        <div id="new-folder-content">
          <sp-field-group>
            <sp-field-label for="new-folder-name">Folder name</sp-field-label>
            <sp-textfield
              id="new-folder-name"
              placeholder="Enter folder name"
              value=${this.newFolderName}
              autofocus
              @input=${(e) => { this.newFolderName = e.target.value; this.newFolderError = ''; }}
              @keydown=${(e) => { if (e.key === 'Enter') this.#confirmCreateFolder(); }}
            ></sp-textfield>
            ${this.newFolderError ? html`<sp-help-text validation-state="negative">${this.newFolderError}</sp-help-text>` : ''}
          </sp-field-group>
          <sp-help-text size="s">Press Enter or Create to add the folder.</sp-help-text>
        </div>
      </sp-dialog-wrapper>
    `;
  }

  #openNewFolderDialog() {
    this.newFolderName = '';
    this.showNewFolderDialog = true;
  }
  async #confirmCreateFolder() {
    const name = (this.newFolderName || '').trim();
    if (!name) { this.newFolderError = 'Please enter a folder name'; return; }
    const parent = this.store?.currentFolderUrn || null;
    try {
      await this.store?.documentStore?.createFolder?.(name, parent);
      this.showNewFolderDialog = false;
      this.showToast('Folder created', 'positive');
    } catch (_) {
      this.newFolderError = 'Failed to create folder';
    }
  }

  // ------- Share Dialog -------
  get #shareDialogUI() {
    if (!this.shareDialogOpen) return '';
    const ds = this.store?.documentStore;
    const items = ds?.sharesByUrn?.get?.(this.shareDialogUrn) || [];
    return html`
      <sp-dialog-wrapper
        open
        underlay
        dismissable
        mode="modal"
        size="m"
        headline="Share"
        id="share-dialog"
        confirm-label="Add"
        cancel-label="Cancel"
        @confirm=${() => this.#onConfirmAddShare()}
        @cancel=${() => (this.shareDialogOpen = false)}
        @close=${() => (this.shareDialogOpen = false)}
      >
        <div id="share-content" style="display:flex; flex-direction:column; gap: var(--spectrum-global-dimension-size-200);">
          <sp-field-group>
            <sp-field-label for="share-user">Add user</sp-field-label>
            <sp-textfield
              id="share-user"
              placeholder="Add user email"
              value=${this.newShareUser}
              @input=${(e) => (this.newShareUser = e.target.value)}
              @keydown=${(e) => { if (e.key === 'Enter') this.#onConfirmAddShare(); }}
            ></sp-textfield>
            ${this.shareError ? html`<sp-help-text validation-state="negative">${this.shareError}</sp-help-text>` : ''}
          </sp-field-group>

          <sp-field-group>
            <sp-field-label>Permissions</sp-field-label>
            <div id="share-perms-new" style="display:flex; gap: var(--spectrum-global-dimension-size-200); align-items:center;" @change=${(e) => this.#onNewSharePermsChange(e)}>
              <sp-checkbox value="edit" ?checked=${this.newSharePerms.includes('edit')}>Edit</sp-checkbox>
              <sp-checkbox value="publish" ?checked=${this.newSharePerms.includes('publish')}>Publish</sp-checkbox>
            </div>
          </sp-field-group>
          <sp-divider size="m" style="margin: 12px 0;"></sp-divider>

          ${ds?.isLoadingShares
            ? html`<div class="section-loading"><sp-progress-circle indeterminate size="s"></sp-progress-circle></div>`
            : items.length === 0
              ? html`<sp-illustrated-message heading="No shares" description="No users have access yet."></sp-illustrated-message>`
              : html`
                  <sp-sidenav density="compact">
                    ${items.map((s) => this.#shareRowUI(s))}
                  </sp-sidenav>
                `}
        </div>
      </sp-dialog-wrapper>
    `;
  }

  #shareRowUI(share) {
    const email = share.email || '';
    const userId = share.user_id || share.userId || email || share.user || share.username || '';
    const displayName = (share.name || '').trim();
    const label = displayName ? `${displayName} (${email || userId})` : (email || userId);
    const perms = Array.isArray(share.perms) ? share.perms : [];
    const has = (p) => perms.includes(p);
    const onToggle = async (perm, checked) => {
      const next = new Set(perms);
      // Read is always granted; cannot be removed
      next.add('read');
      if (perm === 'publish') {
        if (checked) { next.add('publish'); next.add('unpublish'); }
        else { next.delete('publish'); next.delete('unpublish'); }
      } else if (perm === 'edit') {
        if (checked) next.add('edit'); else next.delete('edit');
      }
      const updated = Array.from(next);
      if (updated.length === 0) {
        await this.store.documentStore.deleteShare(this.shareDialogUrn, userId);
      } else {
        await this.store.documentStore.upsertShare(this.shareDialogUrn, userId, updated);
      }
      await this.#loadShares();
    };
    return html`
      <sp-sidenav-item value=${userId} label=${label}>
        <div style="display:flex; gap: var(--spectrum-global-dimension-size-200); align-items:center; padding: var(--spectrum-global-dimension-size-150) 0;">
          <sp-field-group style="display:flex; gap: var(--spectrum-global-dimension-size-200); align-items:center;">
            <sp-field-label size="s">Permissions</sp-field-label>
            <sp-checkbox ?checked=${has('edit')} @change=${(e) => onToggle('edit', e.target.checked)}>Edit</sp-checkbox>
            <sp-checkbox ?checked=${has('publish')} @change=${(e) => onToggle('publish', e.target.checked)}>Publish</sp-checkbox>
          </sp-field-group>
          <span style="flex:1"></span>
          <sp-action-button variant="negative" @click=${async () => { await this.store.documentStore.deleteShare(this.shareDialogUrn, userId); await this.#loadShares(); }}>Remove</sp-action-button>
        </div>
      </sp-sidenav-item>
    `;
  }

  async #addShareFromInput() {
    const user = (this.newShareUser || '').trim();
    if (!user) { this.shareError = 'Enter a user email'; return false; }
    const perms = this.#normalizePerms(this.newSharePerms);
    await this.store.documentStore.upsertShare(this.shareDialogUrn, user, perms);
    this.newShareUser = '';
    this.newSharePerms = [];
    await this.#loadShares();
    return true;
  }
  async #onConfirmAddShare() {
    const ok = await this.#addShareFromInput();
    if (ok) this.shareDialogOpen = false;
  }
  #onNewSharePermsChange(e) {
    const target = e.currentTarget;
    const values = Array.from(target.querySelectorAll('sp-checkbox'))
      .filter((c) => c.checked)
      .map((c) => c.getAttribute('value'));
    this.newSharePerms = values;
  }
  #normalizePerms(perms) {
    const set = new Set(Array.isArray(perms) ? perms : []);
    // Read cannot be changed; always included
    set.add('read');
    // Publish implies both publish and unpublish
    if (set.has('publish')) { set.add('unpublish'); }
    else { set.delete('unpublish'); }
    // Only allow known perms
    const valid = ['read','edit','publish','unpublish'];
    return Array.from(set).filter((p) => valid.includes(p));
  }
  async #openShareDialog(urn) {
    this.shareDialogUrn = urn;
    this.shareDialogOpen = true;
    await this.#loadShares();
  }
  async #loadShares() {
    await this.store.documentStore.getShares(this.shareDialogUrn);
  }

  // Inline rename (folders only)
  #startRename(doc) {
    this.renamingUrn = doc.urn;
    this.renameValue = doc.name || '';
    this.renameError = '';
  }

  #onCreateMenuChange(e) {
    const v = e?.target?.value;
    // In My Workspace, creating a new document should open
    // the creation modal with the Templates panel selected.
    if (v === 'document') this.#openCreationDialog('templates');
    else if (v === 'folder') this.#openNewFolderDialog();
  }

  async #onBulkPublishMenuChange(e) {
    const v = e?.target?.value;
    await this.#bulkPublish(v);
  }

  async #bulkPublish(kind) {
    const sel = Array.from(this.store?.selectedUrns || []);
    if (!sel.length) return;
    try {
      if (kind === 'publish') {
        for (const urn of sel) await this.store?.documentStore?.publishDocument?.(urn);
        this.showToast('Publish started', 'info');
      } else if (kind === 'unpublish') {
        for (const urn of sel) await this.store?.documentStore?.unpublishDocument?.(urn);
        this.showToast('Unpublish started', 'info');
      }
      // Auto-close the action bar after triggering the action
      this.#onCloseActionBar();
    } catch (_) {
      this.showToast('Operation failed', 'negative');
    }
  }

  async #bulkDeleteSelected(urns) {
    const list = Array.isArray(urns) ? urns : Array.from(this.store?.selectedUrns || []);
    if (!list.length) return;
    for (const urn of list) {
      try { await this.store?.documentStore?.deleteDocument?.(urn); } catch (_) {}
    }
    this.store?.clearSelection?.();
    this.store?.setSelectionMode?.(false);
    this.showToast('Deleted', 'positive');
  }

  #openConfirmDelete() {
    // Capture selection, close the action bar, then show confirm dialog
    this.pendingBulkUrns = Array.from(this.store?.selectedUrns || []);
    this.#onCloseActionBar();
    this.confirmDeleteOpen = true;
    this.#loadSelectionUsages(this.pendingBulkUrns);
  }
  async #onConfirmBulkDelete() {
    this.confirmDeleteOpen = false;
    const urns = Array.from(this.pendingBulkUrns || []);
    await this.#bulkDeleteSelected(urns);
    this.pendingBulkUrns = null;
  }

  async #loadSelectionUsages(urnsArg) {
    const urns = Array.isArray(urnsArg) ? urnsArg : Array.from(this.store?.selectedUrns || []);
    if (!urns.length || !this.store?.documentStore?.getDocumentReferrers) {
      this.deleteUsages = [];
      return;
    }
    this.isLoadingDeleteUsages = true;
    const seen = new Map();
    for (const u of urns) {
      const [direct, recursive] = await Promise.all([
        this.store.documentStore.getDocumentReferrers(u, false, null),
        this.store.documentStore.getDocumentReferrers(u, true, null),
      ]);
      const add = (items, assumedDistance) => {
        const arr = Array.isArray(items) ? items : [];
        for (const d of arr) {
          const targetUrn = String(d.urn || d.id || d.target || d.target_urn || d.source || d.source_urn || '');
          if (!targetUrn) continue;
          if (urns.includes(targetUrn)) continue; // avoid selected
          if (d.is_folder || d.isFolder) continue; // documents only
          // Prefer server-provided distance/depth when available; fallback to assumed
          let dist = Number(d.distance);
          if (!Number.isFinite(dist)) dist = Number(d.depth);
          if (!Number.isFinite(dist)) dist = Number(d.hops);
          if (!Number.isFinite(dist) && Array.isArray(d.path)) dist = d.path.length;
          if (!Number.isFinite(dist)) dist = assumedDistance;
          const name = d.name != null ? String(d.name) : 'Untitled';
          const prev = seen.get(targetUrn);
          if (!prev || dist < prev.distance) {
            seen.set(targetUrn, { urn: targetUrn, name, distance: dist });
          }
        }
      };
      add(recursive, 2);
      add(direct, 1);
    }
    const list = Array.from(seen.values()).sort((a, b) => {
      const da = Number.isFinite(a.distance) ? a.distance : 9999;
      const db = Number.isFinite(b.distance) ? b.distance : 9999;
      if (da !== db) return da - db;
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1; if (an > bn) return 1; return 0;
    });
    this.deleteUsages = list;
    this.isLoadingDeleteUsages = false;
  }

  #onCloseActionBar() {
    // Close (X) on the action bar exits selection mode and clears selection
    this.store?.setSelectionMode?.(false);
    this.store?.clearSelection?.();
  }

  #clearSelectionOnly() {
    // Clear retains selection mode so the user can continue selecting
    this.store?.clearSelection?.();
  }

  #toggleSelection() {
    const on = !this.store?.selectionMode;
    this.store?.setSelectionMode?.(on);
    if (!on) this.store?.clearSelection?.();
  }

  #cancelRename() {
    this.renamingUrn = null;
    this.renameValue = '';
    this.renameError = '';
  }
  async #commitRename(doc) {
    const val = (this.renameValue || '').trim();
    if (!val) return this.#cancelRename();
    try {
      await this.store?.documentStore?.updateFolderName?.(doc.urn, val);
      this.renameError = '';
      this.#cancelRename();
      this.showToast('Renamed', 'positive');
    } catch (e) {
      const msg = String(e && e.message || '');
      if (msg.toLowerCase().includes('network')) this.renameError = 'Network error';
      else this.renameError = 'Rename failed';
    }
  }

  get #breadcrumbsUI() {
    const crumbs = this.store?.folderCrumbs || [];
    const view = this.#effectiveGalleryView;
    if (!(view === GalleryViews.MY_FILES || view === GalleryViews.SHARED)) return '';
    const rootLabel = view === GalleryViews.SHARED ? 'Shared' : 'My Files';
    if (!crumbs.length) {
      return html`
        <sp-breadcrumbs class="breadcrumbs-wrap" style="margin-bottom: var(--spectrum-global-dimension-size-200);">
          <sp-breadcrumb-item @click=${() => this.store.setCurrentFolder(null)}>${rootLabel}</sp-breadcrumb-item>
        </sp-breadcrumbs>`;
    }
    if (crumbs.length <= 3) {
      return html`
        <sp-breadcrumbs class="breadcrumbs-wrap" style="margin-bottom: var(--spectrum-global-dimension-size-200);">
          <sp-breadcrumb-item @click=${() => this.store.setCurrentFolder(null)}>${rootLabel}</sp-breadcrumb-item>
          ${crumbs.map((c, i) => html`<sp-breadcrumb-item @click=${() => this.store.navigateToCrumb(i)}>${c.name || 'Folder'}</sp-breadcrumb-item>`)}
        </sp-breadcrumbs>
      `;
    }
    const first = crumbs[0];
    const last = crumbs[crumbs.length - 1];
    return html`
      <sp-breadcrumbs class="breadcrumbs-wrap" style="margin-bottom: var(--spectrum-global-dimension-size-200);">
        <sp-breadcrumb-item @click=${() => this.store.setCurrentFolder(null)}>${rootLabel}</sp-breadcrumb-item>
        <sp-breadcrumb-item @click=${() => this.store.navigateToCrumb(0)}>${first.name || 'Folder'}</sp-breadcrumb-item>
        <sp-breadcrumb-item>
          <sp-action-button quiet @click=${(e) => e.stopPropagation()}>…</sp-action-button>
        </sp-breadcrumb-item>
        <sp-breadcrumb-item @click=${() => this.store.navigateToCrumb(crumbs.length - 1)}>${last.name || 'Folder'}</sp-breadcrumb-item>
      </sp-breadcrumbs>
    `;
  }

  // Drag and drop: move documents into folders
  #onDragStart(doc, e) {
    try {
      if (doc?.isFolder) return;
      e.dataTransfer?.setData('text/urn', doc.urn);
      e.dataTransfer?.setDragImage?.(e.currentTarget, 10, 10);
    } catch (_) {}
  }
  #onDragEnterFolder(doc, e) {
    e.preventDefault();
    const card = e.currentTarget?.closest('.element-card');
    if (card) card.classList.add('drag-over');
  }
  #onDragOverFolder(e) {
    e.preventDefault();
  }
  #onDragLeaveFolder(doc, e) {
    const card = e.currentTarget?.closest('.element-card');
    if (card) card.classList.remove('drag-over');
  }
  async #onDropFolder(doc, e) {
    e.preventDefault();
    const card = e.currentTarget?.closest('.element-card');
    if (card) card.classList.remove('drag-over');
    try {
      const urn = e.dataTransfer?.getData('text/urn');
      if (!urn || urn === doc.urn) return;
      await this.store.documentStore.updateDocumentParent(urn, doc.urn);
      this.showToast('Moved', 'positive');
    } catch (_) {
      this.showToast('Move failed', 'negative');
    }
  }

  #elementCardUI(doc) {
    return html`
      <div 
        class="element-card"
        @click=${() => this.#openElement(doc.urn)}
        data-element-urn=${doc.urn}
      >
        <div class="element-thumbnail">
          <div class="element-preview" data-doc-urn=${doc.urn}>
            <div class="element-preview-placeholder">Loading...</div>
          </div>
        </div>
        <div class="element-info">
          <div class="element-name">${doc.name || 'Untitled'}</div>
          <div class="element-time">${this.#formatDate(doc.lastModified)}</div>
        </div>
      </div>
    `;
  }

  get #creationDialogUI() {
    const templates = this.templateStore?.templates || [];
    const filteredTemplates = this.searchQuery
      ? templates.filter(t =>
          t.title.toLowerCase().includes(this.searchQuery.toLowerCase())
        )
      : templates;

    // Get available elements from custom elements registry
    const availableElements = (customElements.all || []).filter(c => {
      const ctor = customElements.get(c);
      return ctor && ctor.ee;
    });
    const filteredElements = this.searchQuery
      ? availableElements.filter(c =>
          c.toLowerCase().includes(this.searchQuery.toLowerCase())
        )
      : availableElements;

    return html`
      <sp-dialog-wrapper
        id="create-dialog"
        open
        size="xl"
        dismiss-label="Cancel"
        dismissable
        underlay
        mode="modal"
        @close=${() => this.#closeCreationDialog()}
      >
        <div class="create-dialog-body">
        <div id="dialog-header">
          <h2 id="dialog-title">Create New Element</h2>
          <sp-search
            id="dialog-search"
            placeholder="Search..."
            value=${this.searchQuery}
            @input=${(e) => (this.searchQuery = e.target.value)}
            size="m"
          ></sp-search>
        </div>

        <div id="dialog-content-wrapper">
          <sp-accordion allow-multiple>
            ${templates.length > 0 ? html`
              <sp-accordion-item 
                label="Templates (${templates.length})" 
                ?open=${this.store.creationDialogCategory === "templates"}
              >
                ${filteredTemplates.length === 0
                  ? html`
                      <sp-illustrated-message
                        heading="No templates found"
                        description="${this.searchQuery ? 
                          `No templates match '${this.searchQuery}'` : 
                          'No templates loaded'}"
                      ></sp-illustrated-message>
                    `
                  : html`
                      <div class="templates-grid">
                        ${filteredTemplates.map(
                          ([title, url]) => html`
                            <div
                              class="template-preview-card"
                              data-template-id="${url}"
                              @click=${() => this.#selectTemplate(url)}
                            >
                              <div class="template-preview-container">
                                <div class="template-preview-placeholder">
                                  <span class="template-loading">Loading...</span>
                                </div>
                              </div>
                              <div class="template-title">${title}</div>
                            </div>
                          `
                        )}
                      </div>
                    `}
              </sp-accordion-item>
            ` : ''}
            <sp-accordion-item 
              label="Blank Elements (${availableElements.length})" 
              ?open=${this.store.creationDialogCategory === "blank"}
            >
              ${filteredElements.length === 0
                ? html`
                    <sp-illustrated-message
                      heading="No elements found"
                      description="No elements match '${this.searchQuery}'"
                    ></sp-illustrated-message>
                  `
                : html`
                    <div class="elements-grid">
                      ${filteredElements.map(
                        elementName => html`
                          <sp-action-button
                            quiet
                            class="element-card"
                            @click=${() => this.#selectBlankElement(elementName)}
                          >
                            ${this.#getElementIcon(elementName)}
                            ${elementName}
                          </sp-action-button>
                        `
                      )}
                    </div>
                  `}
            </sp-accordion-item>
          </sp-accordion>
        </div>
        </div>
      </sp-dialog-wrapper>
    `;
  }

  get #sharedWithMeSectionUI() {
    const loading = !!this.store?.documentStore?.isLoadingElements;
    const items = (this.store?.filteredElements || []);
    if (loading) {
      return html`<div class="section-loading"><sp-progress-circle indeterminate size="l"></sp-progress-circle></div>`;
    }
    if (!items.length) {
      return html`
        ${this.#breadcrumbsUI}
        <sp-illustrated-message heading="Nothing shared yet" description="Items shared with you will appear here."></sp-illustrated-message>`;
    }
    // Group folders first for consistency
    const folders = items.filter((i) => !!i.isFolder).sort((a, b) => (a.name||'').localeCompare(b.name||''));
    const docs = items.filter((i) => !i.isFolder).sort((a, b) => (a.name||'').localeCompare(b.name||''));
    return html`
      ${this.#breadcrumbsUI}
      ${this.#sharedToolbarUI}
      ${folders.length ? html`<div class="elements-grid">${folders.map((d) => this.#fileTileUI(d))}</div>` : ''}
      ${folders.length && docs.length ? html`<sp-divider class="folders-docs-divider" size="m"></sp-divider>` : ''}
      ${docs.length ? html`<div class="elements-grid">${docs.map((d) => this.#fileTileUI(d))}</div>` : ''}
    `;
  }

  // Shared view toolbar: creation disabled by default (enable later if effective 'edit' is available)
  get #sharedToolbarUI() {
    const inSelection = !!this.store?.selectionMode;
    const count = (this.store?.selectedUrns?.size || 0);
    return html`
      <div class="files-toolbar">
        <sp-action-group quiet>
          <sp-action-menu label="Create" selects="single" disabled>
            <sp-icon-new slot="icon"></sp-icon-new>
            <sp-menu-item value="document">Document</sp-menu-item>
            <sp-menu-item value="folder">Folder</sp-menu-item>
            <span slot="label">Create</span>
          </sp-action-menu>
        </sp-action-group>
        <sp-action-group quiet>
          <sp-action-button @click=${() => this.#toggleSelection()}>
            ${inSelection ? 'Done' : 'Select'}
            <sp-icon-select-multi slot="icon"></sp-icon-select-multi>
          </sp-action-button>
          ${inSelection && count === 0 ? html`
            <sp-action-button @click=${() => this.store?.selectAllVisible?.()}>
              Select All
              <sp-icon-select-all-items slot="icon"></sp-icon-select-all-items>
            </sp-action-button>
          ` : ''}
        </sp-action-group>
      </div>
    `;
  }

  // Creation dialog methods
  #openCreationDialog(tab = "templates") {
    this.store.setShowCreationDialog(true);
    const category = tab === "templates" ? "templates" : "blank";
    this.store.setCreationDialogCategory(category);
    this.searchQuery = "";
  }

  #closeCreationDialog() {
    this.store.setShowCreationDialog(false);
    this.searchQuery = "";
    
    // Disconnect observer when dialog closes
    if (this.#templateObserver) {
      this.#templateObserver.disconnect();
      this.#templateObserver = null;
    }
  }

  async #selectBlankElement(elementName) {
    this.#closeCreationDialog();
    await this.#createNewElement(elementName);
  }
  
  async #selectTemplate(url) {
    this.#closeCreationDialog();
    const htmlContent = await this.templateStore.fetchTemplateContent(url);
    if (htmlContent) {
      // Find the title from the templates array
      const templateEntry = this.templateStore.templates.find(([_, templateUrl]) => templateUrl === url);
      const title = templateEntry ? templateEntry[0] : 'New Element';
      await this.#createFromHTML(htmlContent, title);
    }
  }

  async #createElementOfType(elementType) {
    // Quick-start mapping: some element types start from templates
    const template = this.#elementTypeTemplates[elementType];
    if (template && template.url) {
      const content = await this.templateStore.fetchTemplateContent(template.url);
      if (content) {
        await this.#createFromHTML(content, template.title || 'New Element');
        return;
      }
      // If template fetch fails, fall back to blank element
    }
    await this.#createNewElement(elementType);
  }

  async #createNewElement(elementName) {
    // Create a new element using DocumentStore logic
    const element = document.createElement(elementName);
    element.id = `${elementName}-${Date.now()}`;
    
    // Apply default attributes from schema
    const elementSchema = this.#getElementSchema(elementName);
    if (elementSchema?.attributes) {
      Object.entries(elementSchema.attributes).forEach(([name, attr]) => {
        if (attr.defaultValue !== undefined) {
          element.setAttribute(name, attr.defaultValue);
        }
      });
    }
    
    const parentUrn = this.store?.galleryView === GalleryViews.MY_FILES
      ? (this.store.currentFolderUrn || null)
      : null;
    const elementConfig = {
      name: `New ${elementName}`,
      html: this.store.documentStore.serializeElement(element),
      created: new Date().toISOString(),
      parentUrn,
    };
    
    const created = await this.store.documentStore.saveDocument(elementConfig, { create: true });
    const urn = created?.urn;
    if (!urn) throw new Error('Create failed: missing URN in response');
    await this.store.openElement(urn);
  }

  async #createFromHTML(htmlContent, title) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const templateElement = doc.body.firstElementChild;
    
    if (templateElement) {
      // Create a new element of the same type as the template
      const elementName = templateElement.tagName.toLowerCase();
      
      // Clone the template element to use as the new element
      const newElement = templateElement.cloneNode(true);
      newElement.id = `${elementName}-${Date.now()}`;
      
      // Create the document configuration
      const parentUrn = this.store?.galleryView === GalleryViews.MY_FILES
        ? (this.store.currentFolderUrn || null)
        : null;
      const elementConfig = {
        name: title || 'New Element',
        html: this.store.documentStore.serializeElement(newElement),
        created: new Date().toISOString(),
        parentUrn,
      };
      
      const created = await this.store.documentStore.saveDocument(elementConfig, { create: true });
      const urn = created?.urn;
      if (!urn) throw new Error('Create failed: missing URN in response');
      await this.store.openElement(urn);
    }
  }

  // Template associations for quick-create tiles in the hero section
  get #elementTypeTemplates() {
    return {
      // Merch Card quick-create uses the single card template
      'merch-card': {
        title: 'Merch Card',
        url: './templates/single-card.html',
      },
      // Buy Modal quick-create uses the subscribe modal template
      'checkout-button': {
        title: 'Buy Modal',
        url: './templates/subscribe-all-plans-3.html',
      },
      // Other element types currently have no direct template mapping
    };
  }

  async #openElement(documentId) {
    // Before opening, exit selection state to avoid stale action bar
    this.store?.setSelectionMode?.(false);
    this.store?.clearSelection?.();
    // Open element in the shared store and switch to editor view
    await this.store.openElement(documentId);
  }

  // Helper methods
  #getElementSchema(elementOrTagName) {
    // Handle both element instances and tag names
    const isElement = elementOrTagName instanceof HTMLElement;
    const tagName = isElement 
      ? elementOrTagName.tagName.toLowerCase() 
      : elementOrTagName.toLowerCase();
    const element = isElement ? elementOrTagName : null;
    
    // Try to get constructor
    const constructor = isElement 
      ? elementOrTagName.constructor 
      : customElements.get(tagName);
    
    // Try to get schema from the constructor
    if (constructor) {
      // If the element has a getSchema method, use it
      if (typeof constructor.getSchema === 'function') {
        return constructor.getSchema(element);
      }
      // If the element has a static schema property, use it
      if (constructor.schema) {
        return constructor.schema;
      }
    }
    
    // Return basic schema structure
    return null;
  }

  #getElementIcon(elementName) {
    // Use Spectrum Workflow Icons
    if (elementName.includes("card"))
      return html`<sp-icon-view-card size="xl"></sp-icon-view-card>`;
    if (elementName.includes("list"))
      return html`<sp-icon-layers size="xl"></sp-icon-layers>`;
    if (elementName.includes("button"))
      return html`<sp-icon-shopping-cart size="xl"></sp-icon-shopping-cart>`;
    if (elementName.includes("mnemonic"))
      return html`<sp-icon-text size="xl"></sp-icon-text>`;
    if (elementName.includes("callout"))
      return html`<sp-icon-list-bulleted size="xl"></sp-icon-list-bulleted>`;
    if (elementName.includes("badge"))
      return html`<sp-icon-text size="xl"></sp-icon-text>`;
    if (elementName.includes("price"))
      return html`<sp-icon-shopping-cart size="xl"></sp-icon-shopping-cart>`;
    return html`<sp-icon-add size="xl"></sp-icon-add>`;
  }

  #formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 172800000) return "Yesterday";
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return date.toLocaleDateString();
  }

  #handleKeyDown(e) {
    // Handle escape key for dialogs and selection
    if (e.key === "Escape") {
      if (this.store.showCreationDialog) {
        e.preventDefault();
        this.#closeCreationDialog();
        return;
      }
      if (this.shareDialogOpen) {
        e.preventDefault();
        this.shareDialogOpen = false;
        return;
      }
      // Let confirmation dialogs handle their own ESC
      if (this.confirmDeleteOpen) return;
      // Cancel selection mode (and clear selection)
      if (this.store?.selectionMode) {
        e.preventDefault();
        this.store.setSelectionMode(false);
        this.store.clearSelection();
        return;
      }
    }

    const key = e.key;
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (key === "n" && isCtrlOrCmd) {
      // New element
      e.preventDefault();
      this.#openCreationDialog();
    }
  }

  

  showToast(label, variant = 'info') {
    if (this.#toastTimer) {
      clearTimeout(this.#toastTimer);
      this.#toastTimer = null;
    }
    const toast = document.createElement('sp-toast');
    toast.variant = variant;
    toast.open = true;
    toast.textContent = String(label || '');
    toast.style.position = 'fixed';
    toast.style.right = '16px';
    toast.style.bottom = '16px';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    this.#toastTimer = setTimeout(() => {
      toast.remove();
      this.#toastTimer = null;
    }, 3000);
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // Setup intersection observer for template previews whenever the dialog is open,
    // regardless of which accordion item is selected. This ensures templates load
    // even when toggled via the accordion header.
    if (this.store?.showCreationDialog) {
      this.#setupTemplateObserver();
    }
    
    // Setup intersection observer for element thumbnails
    if (this.store?.filteredElements?.length > 0) {
      this.#setupElementObserver();
    }

  }
  
  #setupTemplateObserver() {
    // Clean up existing observer
    if (this.#templateObserver) {
      this.#templateObserver.disconnect();
    }
    
    // Create new observer
    this.#templateObserver = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const card = entry.target;
            const templateId = card.dataset.templateId;
            // Prevent duplicate/in-flight loads
            if (!card.classList.contains('loaded') && !card.dataset.loading) {
              card.dataset.loading = '1';
              await this.#loadTemplatePreview(card, templateId);
            }
          }
        }
      },
      {
        root: null,
        rootMargin: '50px',
        threshold: 0.01
      }
    );
    
    // Observe all template preview cards
    requestAnimationFrame(() => {
      const cards = this.shadowRoot.querySelectorAll('.template-preview-card');
      cards.forEach(card => {
        this.#templateObserver.observe(card);
      });
    });
  }
  
  async #loadTemplatePreview(card, templateId) {
    const container = card.querySelector('.template-preview-container');
    if (!container) return;
    
    const htmlContent = await this.templateStore.fetchTemplateContent(templateId);
    
    if (htmlContent) {
      // Parse and inject the content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const element = doc.body.firstElementChild;
      
      if (element) {
        // Clear the placeholder
        container.innerHTML = '';
        
        // Create a wrapper for preview
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.setAttribute('data-ee-preview', '');
        
        // Create a preview container (unscaled initially to measure natural width)
        const preview = document.createElement('div');
        preview.style.transformOrigin = 'top center';
        preview.style.willChange = 'transform';
        preview.style.position = 'relative';
        preview.setAttribute('data-ee-preview', '');
        const cloned = element.cloneNode(true);
        preview.appendChild(cloned);
        
        wrapper.appendChild(preview);
        container.appendChild(wrapper);

        // Fit horizontally by computing scale based on content width vs container width
        requestAnimationFrame(() => {
          const contentRect = cloned.getBoundingClientRect();
          const contentWidth = contentRect.width || cloned.scrollWidth || cloned.offsetWidth || 0;
          const containerWidth = container.clientWidth || 0;
          let scale = 1;
          if (contentWidth > 0 && containerWidth > 0) {
            // Leave a bit of breathing room inside the card
            const maxWidth = Math.max(0, containerWidth - 8);
            scale = Math.min(1, maxWidth / contentWidth);
          }
          preview.style.transform = `scale(${scale})`;
        });

        card.classList.add('loaded');
        delete card.dataset.loading;
      }
    }
  }
  
  #setupElementObserver() {
    // Clean up existing observer
    if (this.#elementObserver) {
      this.#elementObserver.disconnect();
    }
    
    // Create new observer for element thumbnails
    this.#elementObserver = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const thumbnail = entry.target;
            const docId = thumbnail.dataset.docUrn;
            // Only load if not already loaded or in-flight
            if (!thumbnail.classList.contains('loaded') && !thumbnail.dataset.loading) {
              thumbnail.dataset.loading = '1';
              await this.#loadElementThumbnail(thumbnail, docId);
            }
          }
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.01
      }
    );
    
    // Observe all element thumbnails
    requestAnimationFrame(() => {
      const thumbnails = this.shadowRoot.querySelectorAll('.element-preview[data-doc-urn]');
      
      thumbnails.forEach(thumbnail => {
        this.#elementObserver.observe(thumbnail);
      });
    });
  }
  
  async #loadElementThumbnail(thumbnailContainer, docId) {
    // Find the document
    const doc = this.store.filteredElements.find(d => d.urn === docId);
    
    const content = doc?.html;
    if (!doc || !content) {
      thumbnailContainer.innerHTML = '<div class="element-preview-placeholder">Element</div>';
      thumbnailContainer.classList.add('loaded');
      delete thumbnailContainer.dataset.loading;
      return;
    }
    
    // Deserialize the element (may return a single Element or a DocumentFragment with multiple roots)
    const element = this.store.documentStore.deserializeElement(content);
    
    if (element) {
      // Clear the placeholder
      thumbnailContainer.innerHTML = '';
      
      // Create a wrapper for the element preview (top-aligned)
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'flex-start';
      wrapper.style.justifyContent = 'center';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.overflow = 'hidden';
      wrapper.style.position = 'relative';
      wrapper.setAttribute('data-ee-preview', '');
      
      // Create a preview container; scale computed after layout
      const previewContainer = document.createElement('div');
      previewContainer.style.transformOrigin = 'top center';
      previewContainer.style.willChange = 'transform';
      previewContainer.setAttribute('data-ee-preview', '');
      
      // Clone and append content (single root or multiple)
      let measureTarget = null;
      if (element.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        const inner = document.createElement('div');
        inner.style.display = 'inline-block';
        inner.appendChild(element.cloneNode(true));
        previewContainer.appendChild(inner);
        measureTarget = inner;
      } else {
        const clonedElement = element.cloneNode(true);
        previewContainer.appendChild(clonedElement);
        measureTarget = clonedElement;
      }
      
      wrapper.appendChild(previewContainer);
      thumbnailContainer.appendChild(wrapper);

      // Fit horizontally by computing scale based on content width vs container width
      requestAnimationFrame(() => {
        // Reset any previous scaling before measurement
        previewContainer.style.transform = 'scale(1)';
        const rect = measureTarget && measureTarget.getBoundingClientRect ? measureTarget.getBoundingClientRect() : null;
        const contentWidth = rect?.width || measureTarget?.scrollWidth || measureTarget?.offsetWidth || 0;
        const containerWidth = thumbnailContainer.clientWidth || 0;
        let scale = 1;
        if (contentWidth > 0 && containerWidth > 0) {
          const maxWidth = Math.max(0, containerWidth - 8);
          scale = Math.min(1, maxWidth / contentWidth);
        }
        previewContainer.style.transform = `scale(${scale})`;
      });

      thumbnailContainer.classList.add('loaded');
      delete thumbnailContainer.dataset.loading;
    } else {
      // Fallback
      thumbnailContainer.innerHTML = '<div class="element-preview-placeholder">Element</div>';
      thumbnailContainer.classList.add('loaded');
      delete thumbnailContainer.dataset.loading;
    }
  }
}

customElements.define(
  "experience-elements-home-new",
  makeLitObserver(ExperienceElementsHomeNew)
);

export { ExperienceElementsHomeNew };

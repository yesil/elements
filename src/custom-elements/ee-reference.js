// ee-reference: lightweight inline content reference element
// - Accepts a `urn` attribute containing a URN (e.g., urn:eeid:...)
// - Reads the referenced element content from DocumentStore
// - Inlines it as light-DOM children
// - Host renders with display: contents to avoid extra layout wrapper

import { LitElement, html, nothing } from "lit";
import { eeReferenceStyleSheet } from "./ee-reference.css.js";
import { DocumentStore } from "../document-store.js";

export class EeReference extends LitElement {
  static styles = [eeReferenceStyleSheet];

  static properties = {
    urn: { type: String, reflect: true },
    inline: { type: Boolean, reflect: true },
  };

  #currentRefToken = 0;
  #documentStore = null;
  #lastLoadedUrn = null;
  #loadingUrn = null;
  #loadPromise = null;

  constructor() {
    super();
    // Defer document store resolution to connectedCallback; allow context injection
    this.#documentStore = null;
    this.urn = "";
    this.inline = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // Resolve DocumentStore from context (self, ancestors, or host components)
    this.#documentStore = this.#resolveDocumentStore();
  }

  firstUpdated() {
    // Attempt initial auto-load after first render
    requestAnimationFrame(() => this.#maybeAutoLoad());
  }

  updated(changed) {
    // React to urn updates when no trigger is assigned
    if (changed.has("urn")) {
      if (!this.#hasTriggerAssigned()) {
        const urn = this.urn;
        if (this.#isSelfReference(urn)) {
          this.#emitSelfReference(urn);
        } else {
          this.#updateFromUrn();
        }
      }
    }
    // When inline flag changes, maybe auto load
    if (changed.has("inline")) {
      this.#maybeAutoLoad();
    }
  }

  // Template renders trigger slot only when not inline; default slot always present
  render() {
    const showTrigger = !this.inline;
    return html`
      <div id="container" style="display: contents" @click=${this.#onContainerClick} @fire=${this.#onContainerFire}>
        ${showTrigger
          ? html`<slot name="trigger" @slotchange=${this.#onTriggerSlotChange}></slot>`
          : nothing}
        <slot></slot>
      </div>
    `;
  }

  async #ensureDocumentStore() {
    // Fallback: create a local DocumentStore if not provided by context
    if (!this.#documentStore) {
      this.#documentStore = new DocumentStore();
    }
    if (!this.#documentStore.configLoaded) {
      await this.#documentStore.init();
    }
    return this.#documentStore;
  }

  async #getDocument(id) {
    const store = await this.#ensureDocumentStore();
    return await store.getDocument(id);
  }

  #deserializeElement(htmlString) {
    return this.#documentStore.deserializeElement(htmlString);
  }

  async #updateFromUrn() {
    const urn = this.urn;

    // Avoid redundant fetch when URN hasn't changed
    if (urn && this.#lastLoadedUrn && this.#lastLoadedUrn === urn) return;
    // Coalesce concurrent loads for the same URN without bumping the token
    if (this.#loadPromise && this.#loadingUrn === urn) return this.#loadPromise;

    // Clear only default slot content (preserve trigger slot and any other named slots)
    this.#clearDefaultSlotContent();

    if (!urn) return;
    // Break self-nesting: do not inline if any ancestor ee-reference has the same urn
    if (this.#hasAncestorWithUrn(urn)) return;
    // Break circuit when referencing the document being authored
    if (this.#isSelfReference(urn)) {
      this.#emitSelfReference(urn);
      return;
    }

    // Start a new load; bump staleness token only now
    const token = ++this.#currentRefToken;
    this.#loadingUrn = urn;
    const load = (async () => {
      const doc = await this.#getDocument(urn);
      if (token !== this.#currentRefToken) return; // stale
      if (!doc) return;
      const htmlString = doc.html;
      if (!htmlString || typeof htmlString !== "string") return;
      const el = this.#deserializeElement(htmlString);
      if (!el) return;
      el.removeAttribute && el.removeAttribute("slot");
      // In preview contexts, strip JSON-LD from loaded content and suppress re-injection
      if (this.closest('[data-ee-preview]')) {
        el.querySelectorAll('script[type="application/ld+json"]').forEach((n) => n.remove());
        el
          .querySelectorAll("merch-card-compare")
          .forEach((c) => c.setAttribute("data-ee-suppress-jsonld", ""));
      }
      this.appendChild(el);
      // Mark as loaded to prevent refetch until URN changes
      this.#lastLoadedUrn = urn;
    })();

    this.#loadPromise = load.finally(() => {
      // Clear loading markers only if this call is still current
      if (token === this.#currentRefToken) {
        this.#loadingUrn = null;
        this.#loadPromise = null;
      }
    });

    return this.#loadPromise;
  }

  #resolveDocumentStore() {
    // 1) Explicit context on the element itself
    if (this.documentStore instanceof DocumentStore) return this.documentStore;
    // 2) Walk ancestors for a provider
    let p = this.parentElement || (this.getRootNode && this.getRootNode().host) || null;
    while (p) {
      if (p.documentStore instanceof DocumentStore) return p.documentStore;
      if (p.store && p.store.documentStore instanceof DocumentStore) return p.store.documentStore;
      p = p.parentElement || (p.getRootNode && p.getRootNode().host) || null;
    }
    return null;
  }

  #clearDefaultSlotContent() {
    const toRemove = [];
    for (const n of Array.from(this.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) {
        toRemove.push(n);
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n;
        const slot = el.getAttribute && el.getAttribute("slot");
        // Keep trigger and any other explicitly named slots; remove default-slot content
        if (!slot) toRemove.push(el);
      }
    }
    toRemove.forEach((n) => n.remove());
  }

  get #triggerSlot() {
    return this.renderRoot?.querySelector?.('slot[name="trigger"]') || null;
  }

  #hasTriggerAssigned() {
    const slot = this.#triggerSlot;
    if (!slot) return false;
    const assignedEls = slot.assignedElements({ flatten: true }) || [];
    return assignedEls.length > 0;
  }

  #getCurrentDocIdFromContext() {
    let p = this.parentElement;
    while (p) {
      if (p.hasAttribute && p.hasAttribute("data-ee-current-id")) {
        const id = p.getAttribute("data-ee-current-id");
        if (id) return id;
      }
      p = p.parentElement;
    }
    return null;
  }

  #isSelfReference(urn) {
    const currentId = this.#getCurrentDocIdFromContext();
    if (!currentId || !urn) return false;
    return String(currentId) === String(urn);
  }

  #emitSelfReference(urn) {
    this.dispatchEvent(
      new CustomEvent("ee-self-reference", {
        bubbles: true,
        composed: true,
        detail: { urn },
      })
    );
  }

  #onTriggerSlotChange = () => {
    this.#maybeAutoLoad();
  };

  #onContainerFire = (_e) => {
    // Any 'fire' bubbling from inside the component triggers load
    this.#updateFromUrn();
  };

  #onContainerClick = (e) => {
    // If click originated within the assigned 'trigger' subtree, map to a 'fire' event
    const path = e.composedPath();
    let triggerRoot = null;
    for (const n of path) {
      if (!n || !n.tagName) continue;
      const el = n;
      if (el.getAttribute && el.getAttribute('slot') === 'trigger' && el.parentElement === this) {
        triggerRoot = el;
        break;
      }
    }
    if (!triggerRoot) return;
    // Map clicks on typical interactive elements to fire
    const clicked = path.find((n) => {
      const t = (n && n.tagName ? n.tagName.toLowerCase() : null);
      return t === 'sp-button' || t === 'sp-link' || t === 'a';
    });
    if (clicked) {
      e.preventDefault();
      triggerRoot.dispatchEvent(new Event('fire', { bubbles: true, composed: true }));
    }
  };

  #maybeAutoLoad() {
    if (this.#hasTriggerAssigned()) return; // Load on trigger only
    this.#updateFromUrn();
  }

  #hasAncestorWithUrn(urn) {
    let p = this.parentElement;
    while (p) {
      if (p.tagName && p.tagName.toLowerCase() === "ee-reference") {
        const r = p.getAttribute && p.getAttribute("urn");
        if (r && r === urn) return true;
      }
      p = p.parentElement;
    }
    return false;
  }

  // Public: force refresh the referenced content even if URN is unchanged
  refresh() {
    // Reset memoized URN so the next update fetches
    this.#lastLoadedUrn = null;
    this.#updateFromUrn();
  }
}

customElements.define("ee-reference", EeReference);

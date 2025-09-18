import { html, css, LitElement, nothing } from "lit";
import { makeLitObserver } from "picosm";
import "./experience-elements-editor.js";
import "./experience-elements-home-new.js";
import { Router } from "./router.js";
import { Store } from "./store.js";
import { registerReactions } from "./reactions.js";
import { UserStore } from "./user-store.js";

class ExperienceElementsApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
    }

    :host *,
    :host *::before,
    :host *::after {
      box-sizing: border-box;
    }
  `;

  static properties = {
    router: { type: Object },
    store: { type: Store, observe: true },
    userStore: { type: UserStore, observe: true },
  };

  constructor() {
    super();
    this.store = new Store();
    this.userStore = this.store.userStore;
    // Prime deep-link editing state before router to avoid flashing home
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        this.store.editorStore.setCurrentElementId(id);
        if (this.store.setIsNavigating) this.store.setIsNavigating(true);
      }
    } catch (_) {}
    // Ensure the store (and underlying DocumentStore) initialize before routing
    // so deep links like ?id=URN can open in the editor with local IndexedDB.
    this.store.init().then(() => {
      this.router = new Router(this.store);
    });
  }

  createRenderRoot() {
    return this;
  }

  initUserStore() {
    // IMS-gated: Populate current user from IMS profile if available
    if (
      typeof window !== "undefined" &&
      window.adobeIMS &&
      typeof window.adobeIMS.getProfile === "function"
    ) {
      window.adobeIMS.getProfile().then((profile) => {
        const email =
          profile && (profile.email || profile.userId || "user@adobe.com");
        const displayName =
          profile &&
          (profile.displayName ||
            profile.name ||
            this.userStore.extractNameFromEmail(email));
        this.userStore.setCurrentUser(email, displayName);
      });
    } else if (!this.userStore.loadCurrentUser()) {
      // Fallback to any saved user if IMS is not available
      const savedEmail = localStorage.getItem("user-email");
      const savedName = localStorage.getItem("user-display-name");
      if (savedEmail) {
        this.userStore.setCurrentUser(savedEmail, savedName);
      }
    }

    // No global window.* exposure; rely on component context
    this.store.setIsReady(true);
  }

  promptUserSetup() {
    const email = prompt(
      "Please enter your email address:",
      "user@example.com"
    );
    if (email) {
      const displayName = prompt(
        "Please enter your display name:",
        this.userStore.extractNameFromEmail(email)
      );

      // Save to localStorage
      localStorage.setItem("user-email", email);
      if (displayName) {
        localStorage.setItem("user-display-name", displayName);
      }

      // Set current user
      this.userStore.setCurrentUser(email, displayName);
    } else {
      // Use default if user cancels
      this.userStore.setCurrentUser("user@example.com", "User");
    }
  }

  connectedCallback() {
    super.connectedCallback();
    // Register reactions after first render so the editor exists in the DOM
    this.updateComplete.then(() => {
      if (!this.#cleanupAppReactions) {
        this.#cleanupAppReactions = registerReactions({
          appStore: this.store,
          editorStore: this.store.editorStore,
          commentStore: this.store.commentStore,
        });
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#cleanupAppReactions) this.#cleanupAppReactions();
    this.#cleanupAppReactions = null;
  }

  #cleanupAppReactions;

  get home() {
    // Hide home when editing or targeting an element (deep link)
    if (
      this.store.isEditingElement ||
      this.store?.editorStore?.currentElementId
    )
      return nothing;
    return html`<experience-elements-home-new
      .store=${this.store}
      .templateStore=${this.store.templateStore}
      .userStore=${this.store.userStore}
    ></experience-elements-home-new>`;
  }

  get editor() {
    // Always render the editor; it returns nothing internally until ready
    return html`<experience-elements-editor
      .store=${this.store}
      .userStore=${this.store.userStore}
      .editorStore=${this.store.editorStore}
      .commentStore=${this.store.commentStore}
      .zoomStore=${this.store.zoomStore}
      ?open=${this.store.editorStore.isEditorOpen}
    ></experience-elements-editor>`;
  }

  render() {
    const inEditor = !!(
      this.store.isEditingElement || this.store?.editorStore?.currentElementId
    );
    const busy = !!this.store.isNavigating && !inEditor;
    return html`<sp-theme
      color="${this.store.themeColor}"
      scale="medium"
      system="spectrum-two"
    >
      ${this.home} ${this.editor}
    </sp-theme>`;
  }
}

customElements.define(
  "experience-elements-app",
  makeLitObserver(ExperienceElementsApp)
);

import { LitElement, html, nothing } from "lit";
import { eeCommentsPanelStyles } from "./ee-comments-panel.css.js";
import { makeLitObserver } from "picosm";











export class EECommentsPanel extends LitElement {
  static get styles() {
    return eeCommentsPanelStyles;
  }

  static get properties() {
    return {
      store: { type: Object, observe: true },
      commentStore: { type: Object, observe: true },
    };
  }

  constructor() {
    super();
    this.store = null;
  }

  // Friendly date formatter (similar to experience-elements-home)
  formatFriendlyTime(dateInput) {
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return "";
      const now = new Date();
      const diff = now - date;
      if (diff < 60_000) return "Just now";
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
      if (diff < 172_800_000) return "Yesterday";
      if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} days ago`;
      return date.toLocaleDateString();
    } catch (_) {
      return "";
    }
  }

  // Public API for overlay positioning
  getCommentItemRect(id) {
    try {
      const el = this.renderRoot?.querySelector?.(`[data-comment-id="${id}"]`);
      return el ? el.getBoundingClientRect() : null;
    } catch (_) {
      return null;
    }
  }

  get comments() {
    return Array.isArray(this.commentStore?.comments)
      ? this.commentStore.comments
      : [];
  }

  onAdd() {
    // Prefer ShadowRoot.getElementById for direct lookup within shadow DOM
    const ta = this.renderRoot?.getElementById?.('story-0');
    const val = (ta?.value || "").toString().trim();
    if (!val) return;
    this.store?.setLastAction?.("comment:add", {});
    this.commentStore?.addCommentForEditingElement?.(val);
    if (ta) ta.value = "";
  }

  onDelete(id) {
    this.store?.setLastAction?.("comment:delete", { id });
    this.commentStore?.removeComment?.(id);
  }

  onToggleResolved(id, current) {
    this.store?.setLastAction?.("comment:toggleResolved", { id, to: current === "resolved" ? "open" : "resolved" });
    this.commentStore?.updateComment?.(id, { status: current === "resolved" ? "open" : "resolved" });
  }

  onCardEnter(id) {
    // Hover should not change selection; only update hover state
    this.commentStore?.setHoveredComment?.(id);
  }

  onCardLeave(id) {
    if (this.commentStore?.hoveredCommentId === id) this.commentStore?.setHoveredComment?.(null);
  }

  onCardClick(id) {
    try {
      // Click selects the comment; reactions will select + center the element
      const alreadySelected = this.commentStore?.selectedCommentId === id;
      this.commentStore?.setSelectedComment?.(id);

      // If no element is currently selected, or the same comment was clicked again,
      // proactively select the associated element to ensure UX consistency.
      const noEditing = !this.store?.editingElement;
      if (noEditing || alreadySelected) {
        const host = this.getRootNode()?.host;
        const el = host?.getElementForComment?.(id);
        if (el) {
          // Mark as comment click so EditorStore may center if out of viewport
          this.store?.setUserAction?.("comment:click", { id });
          // Select the element; EditorStore handles conditional centering.
          host?.selectElement?.(el);
        }
      }
    } catch (_) {}
  }

  get composer() {
    // Compute permission based only on the live editor store state to avoid
    // cross-store computed dependency issues (picosm doesn't track across stores).
    const el = this.store?.editingElement;
    const slotSelected = !!this.store?.currentSlot;
    const host = this.store?.editorElement || null;
    const can = !!el && !slotSelected && (!!host ? host.contains(el) : true);
    if (!can) return nothing;
    return html`
      <div id="composer">
        <sp-textfield id="story-0" multiline placeholder="Add a comment..." value=""></sp-textfield>
        <sp-button variant="primary" @click=${() => this.onAdd()}>Add</sp-button>
      </div>
    `;
  }

  renderComment(c) {
    const isResolved = c.status === "resolved";
    const activeAnchor = this.store?.editingElement?.getAttribute?.('data-ee-comment-id') || null;
    const isActive = !!activeAnchor && c.targetId === activeAnchor;
    // Determine display author; prefer explicit author, else compare email to current user to show 'You'
    const host = this.getRootNode()?.host;
    const currentEmail = host?.userStore?.currentUser?.email || null;
    let author = c.author || '';
    if (!author) {
      if (c.authorEmail && currentEmail && c.authorEmail === currentEmail) author = 'You';
      else if (c.authorEmail) author = c.authorEmail;
    }
    return html`
      <div
        class="comment-item"
        data-active=${isActive ? 'true' : nothing}
        data-comment-id=${c.id}
        @mouseover=${() => this.onCardEnter(c.id)}
        @focusin=${() => this.onCardEnter(c.id)}
        @mouseout=${() => this.onCardLeave(c.id)}
        @focusout=${() => this.onCardLeave(c.id)}
        @click=${() => this.onCardClick(c.id)}
      >
        <div class="row">
          ${author ? html`<span class="author">${author}</span>` : nothing}
          ${isResolved
            ? html`<sp-tag size="s" variant="positive">Resolved</sp-tag>`
            : html`<sp-tag size="s">Open</sp-tag>`}
          <span class="timestamp">${this.formatFriendlyTime(c.updatedAt || c.createdAt)}</span>
          <span class="spacer"></span>
          <sp-action-button quiet size="s" title=${isResolved ? "Reopen" : "Resolve"} @click=${(e) => { e.stopPropagation(); this.onToggleResolved(c.id, c.status); }}>
            ${isResolved
              ? html`<sp-icon-revert slot="icon"></sp-icon-revert>`
              : html`<sp-icon-checkmark-circle slot="icon"></sp-icon-checkmark-circle>`}
          </sp-action-button>
          <sp-action-button quiet size="s" title="Delete" @click=${(e) => { e.stopPropagation(); this.onDelete(c.id); }}>
            <sp-icon-delete slot="icon"></sp-icon-delete>
          </sp-action-button>
        </div>
        <div class="comment-text">${c.text}</div>
      </div>
    `;
  }

  render() {
    const count = this.comments.length;
    return html`
      <div id="panel-root">
        <div id="header">
          <h3 style="margin:0; font-size: 14px;">Comments (${count})</h3>
          <sp-action-button
            quiet
            title="Close comments"
            @click=${(e) => {
              try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch (_) {}
              this.store?.setLastAction?.("comment:closePanel", {});
              try { this.commentStore?.closeCommentsPanel?.(); } catch (_) {}
              try { const host = this.getRootNode()?.host; host?.syncCommentsPanelView?.(); } catch (_) {}
            }}
          >
            <sp-icon-close slot="icon"></sp-icon-close>
          </sp-action-button>
        </div>
        ${this.composer}
        <div id="comments-list">
          ${count
            ? this.comments.map((c) => this.renderComment(c))
            : html`<div style="opacity:0.7; padding: 8px;">No comments yet.</div>`}
        </div>
      </div>
    `;
  }
}

customElements.define("ee-comments-panel", makeLitObserver(EECommentsPanel));

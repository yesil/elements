import { LitElement, html, nothing } from "lit";
import { eeReferencesPanelStyles } from "./ee-used-in-panel.css.js";
import { makeLitObserver } from "picosm";









export class EEUsedInPanel extends LitElement {
  static get styles() { return eeReferencesPanelStyles; }
  static get properties() {
    return {
      usedInStore: { type: Object, observe: true },
      store: { type: Object, observe: true },
    };
  }

  // Panel title with count when available
  get title() {
    const items = this.usedInStore && Array.isArray(this.usedInStore.items)
      ? this.usedInStore.items
      : null;
    if (items) return `Used In (${items.length})`;
    return "Used In";
  }

  renderHeader() {
    return html`
      <div id="header">
        <div style="display:flex;align-items:center;gap: var(--spectrum-global-dimension-size-125);">
          <sp-icon-target></sp-icon-target>
          ${this.title}
        </div>
        <sp-action-button quiet size="m" title="Refresh" @click=${() => this.refresh()}>
          <sp-icon-refresh slot="icon"></sp-icon-refresh>
        </sp-action-button>
      </div>
    `;
  }

  refresh() {
    try {
      const urn = this.getRootNode()?.host?.store?.editorStore?.currentElementId;
      if (urn) this.usedInStore?.refreshFor?.(urn);
    } catch (_) {}
  }

  openURN(urn) {
    if (!urn) return;
    // Hard navigate in the same tab, preserving current base path
    const url = new URL(window.location.href);
    url.searchParams.set('id', String(urn || ''));
    url.searchParams.delete('new');
    url.searchParams.delete('category');
    window.location.href = url.toString();
  }

  renderList() {
    const items = Array.isArray(this.usedInStore?.items) ? this.usedInStore.items : [];
    if (this.usedInStore?.isLoading) {
      return html`<div id="list" style="display:grid;place-items:center;min-height:120px;">
        <sp-progress-circle indeterminate size="m"></sp-progress-circle>
      </div>`;
    }
    if (!items.length) {
      return html`<div id="empty">No usages yet.</div>`;
    }
    return html`
      <div id="list">
        <sp-sidenav>
          ${items.map((it) => html`
            <sp-sidenav-item
              value=${it.urn}
              label=${it.name || it.urn}
              @click=${() => this.openURN(it.urn)}
            ></sp-sidenav-item>
          `)}
        </sp-sidenav>
      </div>
    `;
  }

  render() {
    return html`
      <div id="panel">
        ${this.renderHeader()}
        <sp-help-text size="m" id="usage-help">Listed below are documents that use this fragment.</sp-help-text>
        ${this.renderList()}
      </div>
    `;
  }
}

makeLitObserver(EEUsedInPanel);
customElements.define("ee-used-in-panel", EEUsedInPanel);

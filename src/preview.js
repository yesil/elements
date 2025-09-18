import "./content-bundle.js";
import { DocumentStore } from "./document-store.js";

function getParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch (_) {
    return null;
  }
}

function isValidColor(value) {
  return value === "light" || value === "dark";
}

function applyThemeColor(theme, color) {
  if (!theme) return;
  theme.setAttribute("color", color);
}

function initThemeColor(theme) {
  // 1) Explicit ?color param wins
  const requested = getParam("color");
  if (isValidColor(requested)) {
    applyThemeColor(theme, requested);
  } else {
    // 2) Persisted app theme via localStorage (set by the editor app)
    try {
      const stored = localStorage.getItem("theme");
      if (isValidColor(stored)) {
        applyThemeColor(theme, stored);
      } else {
        // 3) Fallback to system preference
        const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
        const updateFromSystem = () =>
          applyThemeColor(theme, media && media.matches ? "dark" : "light");
        updateFromSystem();
        if (media && typeof media.addEventListener === "function") {
          media.addEventListener("change", updateFromSystem);
        } else if (media && typeof media.addListener === "function") {
          media.addListener(updateFromSystem);
        }
      }
    } catch (_) {
      // If storage is blocked, fallback to system
      const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
      const updateFromSystem = () =>
        applyThemeColor(theme, media && media.matches ? "dark" : "light");
      updateFromSystem();
      if (media && typeof media.addEventListener === "function") {
        media.addEventListener("change", updateFromSystem);
      } else if (media && typeof media.addListener === "function") {
        media.addListener(updateFromSystem);
      }
    }
  }

  // Keep in sync with app theme changes in other tabs/windows
  window.addEventListener("storage", (e) => {
    if (e && e.key === "theme" && isValidColor(e.newValue)) {
      applyThemeColor(theme, e.newValue);
    }
  });
}

async function render() {
  const id = getParam("id");
  const theme = document.querySelector("sp-theme");
  initThemeColor(theme);
  if (!id) {
    theme.innerHTML = "<p>Missing id parameter.</p>";
    return;
  }

  // Initialize DocumentStore to ensure API endpoint is loaded
  try {
    const documentStore = new DocumentStore();
    await documentStore.init();

    // Preview-only WebSocket: refresh only the relevant ee-reference when updates arrive
    await (async function connectWebSocket() {
      try {
        await documentStore.loadApiEndpoint();
        const wsURL = documentStore.websocketUrl;
        if (!wsURL) return;
        const token = await documentStore.getAccessToken();
        if (!token) return;
        let finalURL = wsURL;
        try {
          const u = new URL(wsURL);
          u.searchParams.set('access_token', token);
          finalURL = u.toString();
        } catch (_) {
          const hasQ = wsURL.includes('?');
          finalURL = `${wsURL}${hasQ ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
        }
        let attempts = 0;
        const maxAttempts = 5;
        const openWS = () => {
          const ws = new WebSocket(finalURL);
          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              const detail = msg && typeof msg === 'object' ? (msg.detail || {}) : {};
              const urn = detail.documentURN || detail.urn || msg.record_id || msg.id || null;
              if (!urn) return;
              const container = theme || document;
              const all = Array.from(container.querySelectorAll('ee-reference'));
              const matches = all.filter((el) => el.getAttribute && el.getAttribute('urn') === urn);
              if (!matches.length) return;
              const toRefresh = matches.filter((el) => !el.querySelector('ee-reference[urn="' + CSS.escape(urn) + '"]'));
              (toRefresh.length ? toRefresh : matches).forEach((el) => {
                if (typeof el.refresh === 'function') el.refresh();
              });
            } catch (_) { /* ignore */ }
          };
          ws.onopen = () => { attempts = 0; };
          ws.onclose = () => {
            if (attempts >= maxAttempts) return;
            attempts += 1;
            const delay = 1000 * attempts;
            setTimeout(openWS, delay);
          };
          ws.onerror = () => { /* ignore */ };
        };
        openWS();
      } catch (_) { /* ignore */ }
    })();
    
    const ref = document.createElement("ee-reference");
    ref.setAttribute("urn", id);
    // Provide DocumentStore via element context
    ref.documentStore = documentStore;
    // Add preview context marker
    ref.setAttribute("data-ee-preview", "true");
    theme.appendChild(ref);
  } catch (error) {
    console.error("Failed to initialize DocumentStore:", error);
    theme.innerHTML = "<p>Failed to load document. Please check the API configuration.</p>";
  }
}

render();

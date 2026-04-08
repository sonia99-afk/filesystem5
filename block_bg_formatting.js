(function () {
    if (typeof window === "undefined") return;
  
    window.__blockBgMap = window.__blockBgMap || Object.create(null);
  
    if (typeof window.snapshot === "function" && !window.snapshot.__blockBgPatched) {
      const _snapshot = window.snapshot;
      window.snapshot = function patchedSnapshotWithBlockBg() {
        const raw = _snapshot();
        const data = JSON.parse(raw);
  
        data.__blockBgMap = { ...(window.__blockBgMap || {}) };
  
        return JSON.stringify(data);
      };
      window.snapshot.__blockBgPatched = true;
    }
  
    if (typeof window.restore === "function" && !window.restore.__blockBgPatched) {
      const _restore = window.restore;
      window.restore = function patchedRestoreWithBlockBg(state) {
        try {
          const data = JSON.parse(state);
          window.__blockBgMap = data.__blockBgMap || Object.create(null);
        } catch (_) {
          window.__blockBgMap = Object.create(null);
        }
  
        _restore(state);
  
        requestAnimationFrame(() => {
          applyBgToAllRows();
        });
      };
      window.restore.__blockBgPatched = true;
    }
  
    function host() {
      return document.getElementById("tree");
    }
  
    function cssEscapeLocal(s) {
      const v = String(s);
      if (window.CSS && typeof CSS.escape === "function") return CSS.escape(v);
      return v.replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
    }
  
    function rowById(id) {
      const h = host();
      if (!h || !id) return null;
      return h.querySelector(`.row[data-id="${cssEscapeLocal(id)}"]`);
    }
  
    function applyBgToRow(row) {
      if (!row) return;
  
      const id = row.dataset?.id;
      if (!id) return;
  
      const bg = window.__blockBgMap?.[id] || "";
      row.style.backgroundColor = bg || "";
    }
  
    function applyBgToAllRows() {
      const h = host();
      if (!h) return;
  
      h.querySelectorAll(".row[data-id]").forEach(applyBgToRow);
    }
  
    function applyBlockBgToSelected(color) {
      if (typeof selectedId === "undefined" || !selectedId) return;
  
      const nextColor = color === "transparent" ? "" : String(color || "").trim();
      const prevColor = window.__blockBgMap?.[selectedId] || "";
  
      if (prevColor === nextColor) return;
  
      if (typeof pushHistory === "function") {
        pushHistory();
      }
  
      if (!window.__blockBgMap) {
        window.__blockBgMap = Object.create(null);
      }
  
      if (nextColor) {
        window.__blockBgMap[selectedId] = nextColor;
      } else {
        delete window.__blockBgMap[selectedId];
      }
  
      if (typeof render === "function") {
        render();
      } else {
        const row = rowById(selectedId);
        applyBgToRow(row);
      }
    }
  
    window.addEventListener("color-tools-change", (e) => {
      const detail = e.detail || {};
      if (detail.kind !== "block") return;
  
      applyBlockBgToSelected(detail.value || "");
    });
  
    if (typeof window.render === "function" && !window.render.__blockBgPatched) {
      const _render = window.render;
      window.render = function patchedRenderWithBlockBg() {
        _render();
        applyBgToAllRows();
      };
      window.render.__blockBgPatched = true;
    }
  
    window.blockBgFormatting = {
      applyToSelected: applyBlockBgToSelected,
      refresh: applyBgToAllRows,
      getMap() {
        return { ...(window.__blockBgMap || {}) };
      }
    };
  })();
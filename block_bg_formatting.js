(function () {
    if (typeof window === "undefined") return;
  
    window.__blockBgMap = window.__blockBgMap || Object.create(null);
  
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
  
      const nextColor = color === "transparent" ? "" : (color || "");
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
        applyBgToAllRows();
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
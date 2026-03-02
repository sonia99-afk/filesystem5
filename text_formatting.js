// text_formatting.js
(function () {
    if (typeof window === "undefined") return;
  
    // --- Persistent formatting storage ---
    // { [nodeId]: { b,i,u,s } }
    window.__fmtMap = window.__fmtMap || Object.create(null);
  
    function getFmt(id) {
      return window.__fmtMap[id] || { b: false, i: false, u: false, s: false };
    }
    function setFmt(id, next) {
      window.__fmtMap[id] = {
        b: !!next.b,
        i: !!next.i,
        u: !!next.u,
        s: !!next.s,
      };
    }
    function toggleFmtFlag(id, key) {
      const cur = getFmt(id);
      cur[key] = !cur[key];
      setFmt(id, cur);
    }
  
    // ---- CSS classes for formatting ----
    (function injectStyle() {
      const id = "text-formatting-style";
      if (document.getElementById(id)) return;
      const st = document.createElement("style");
      st.id = id;
      st.textContent = `
        .row .label{ display:inline; }
        .row.fmt-b .label{ font-weight:700; }
        .row.fmt-i .label{ font-style:italic; }
        .row.fmt-u .label{ text-decoration:underline; }
        .row.fmt-s .label{ text-decoration:line-through; }
  
        /* если комбинируем underline+strike — показываем оба */
        .row.fmt-u.fmt-s .label{ text-decoration: underline line-through; }
  
        .fmt-btn.active{ outline:1px solid #000; }
      `;
      document.head.appendChild(st);
    })();
  
    // ---- safe-extend hotkeys config (optional) ----
    (function ensureHotkeyDefaults() {
      const hk = window.hotkeys;
      if (!hk || !hk.DEFAULTS || !hk.get || !hk.set) return;
  
      const maybeAdd = (action, combo) => {
        if (hk.get(action)) return;
        try {
          hk.DEFAULTS[action] = combo;
          hk.set(action, combo);
        } catch (_) {}
      };
  
      maybeAdd("bold", "Control+B");
      maybeAdd("italic", "Control+I");
      maybeAdd("underline", "Control+U");
      maybeAdd("strike", "Control+Shift+X"); // зачёркнутый
    })();
  
    function host() {
      return document.getElementById("tree");
    }
  
    function isEditingNow() {
      const ae = document.activeElement;
      if (!ae) return false;
      if (ae.tagName === "INPUT" && ae.classList?.contains("edit")) return true;
      if (ae.tagName === "TEXTAREA" && ae.classList?.contains("tg-export")) return true;
      if (ae.isContentEditable) return true;
      return false;
    }
  
    function isTreeActive() {
      const h = host();
      if (!h) return false;
      return !!h.querySelector(".row.sel");
    }
  
    function ensureLabelSpan(row) {
      if (!row) return null;
  
      let label = row.querySelector(":scope > .label");
      if (label) return label;
  
      const act = row.querySelector(":scope > .act");
  
      const nodes = [];
      for (const n of Array.from(row.childNodes)) {
        if (act && n === act) break;
        nodes.push(n);
      }
  
      label = document.createElement("span");
      label.className = "label";
      for (const n of nodes) label.appendChild(n);
  
      if (act) row.insertBefore(label, act);
      else row.appendChild(label);
  
      return label;
    }
  
    function getTargetRows() {
      const h = host();
      if (!h) return [];
  
      const multi = Array.from(h.querySelectorAll(".row.multi"));
      if (multi.length) return multi;
  
      const sel = h.querySelector(".row.sel");
      return sel ? [sel] : [];
    }
  
    function applyFmtToRow(row) {
      if (!row) return;
      const id = row.dataset?.id;
      if (!id) return;
  
      ensureLabelSpan(row);
  
      const fmt = getFmt(id);
      row.classList.toggle("fmt-b", !!fmt.b);
      row.classList.toggle("fmt-i", !!fmt.i);
      row.classList.toggle("fmt-u", !!fmt.u);
      row.classList.toggle("fmt-s", !!fmt.s);
    }
  
    function applyFmtToAllRows() {
      const h = host();
      if (!h) return;
      h.querySelectorAll(".row[data-id]").forEach(applyFmtToRow);
    }
  
    function toggleOnTargets(flagKey) {
      if (window.hotkeysMode === "custom") return;
      if (isEditingNow()) return;
      if (!isTreeActive()) return;
  
      const rows = getTargetRows();
      if (!rows.length) return;
  
      for (const r of rows) {
        const id = r.dataset?.id;
        if (!id) continue;
        toggleFmtFlag(id, flagKey);
        applyFmtToRow(r);
      }
  
      syncButtons();
    }
  
    // ---- UI buttons (optional) ----
    function bindButton(id, flagKey) {
      const b = document.getElementById(id);
      if (!b || b.__fmtBound) return;
      b.__fmtBound = true;
  
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOnTargets(flagKey);
      });
    }
  
    function syncButtons() {
      const rows = getTargetRows();
      const r = rows[0];
      const id = r?.dataset?.id;
  
      const fmt = id ? getFmt(id) : { b: false, i: false, u: false, s: false };
  
      const map = [
        ["fmtBold", "b"],
        ["fmtItalic", "i"],
        ["fmtUnderline", "u"],
        ["fmtStrike", "s"],
      ];
  
      for (const [btnId, k] of map) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;
        btn.classList.toggle("active", !!fmt[k]);
      }
    }
  
    bindButton("fmtBold", "b");
    bindButton("fmtItalic", "i");
    bindButton("fmtUnderline", "u");
    bindButton("fmtStrike", "s");
  
    // ---- Hotkeys ----
    function handleHotkeys(e) {
      if (window.hotkeysMode === "custom") return;
      if (isEditingNow()) return;
      if (!isTreeActive()) return;
  
      if (typeof window.isHotkey !== "function") return;
  
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
      };
  
      if (window.isHotkey(e, "bold")) {
        stop();
        toggleOnTargets("b");
        return;
      }
      if (window.isHotkey(e, "italic")) {
        stop();
        toggleOnTargets("i");
        return;
      }
      if (window.isHotkey(e, "underline")) {
        stop();
        toggleOnTargets("u");
        return;
      }
      if (window.isHotkey(e, "strike")) {
        stop();
        toggleOnTargets("s");
        return;
      }
    }
  
    window.addEventListener("keydown", handleHotkeys, true);
  
    // ---- Patch render() to re-apply formatting after DOM rebuild ----
    (function patchRenderOnce() {
      if (typeof window.render !== "function") return;
      if (window.render.__fmtPatched) return;
  
      const _render = window.render;
      window.render = function patchedRenderFmt() {
        _render();
        try {
          applyFmtToAllRows();
          syncButtons();
        } catch (_) {}
      };
      window.render.__fmtPatched = true;
    })();
  
    // ---- Patch snapshot/restore so undo/redo keeps formatting too ----
    (function patchHistoryOnce() {
      if (typeof window.snapshot !== "function") return;
      if (typeof window.restore !== "function") return;
      if (window.snapshot.__fmtPatched) return;
  
      const _snapshot = window.snapshot;
      window.snapshot = function patchedSnapshotFmt() {
        const base = _snapshot(); // JSON string
        try {
          const obj = JSON.parse(base);
          obj.__fmtMap = window.__fmtMap || {};
          return JSON.stringify(obj);
        } catch (_) {
          return base;
        }
      };
      window.snapshot.__fmtPatched = true;
  
      const _restore = window.restore;
      window.restore = function patchedRestoreFmt(state) {
        try {
          const obj = JSON.parse(state);
          if (obj && obj.__fmtMap && typeof obj.__fmtMap === "object") {
            window.__fmtMap = obj.__fmtMap || Object.create(null);
          }
        } catch (_) {}
        _restore(state); // внутри будет render(), который мы уже патчили
      };
    })();
  
    // initial apply
    try {
      applyFmtToAllRows();
      syncButtons();
    } catch (_) {}
  })();
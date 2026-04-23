// multi_select_branch.js
// Выделение по одной branch-цепочке:
// Primary+Alt+Shift+ArrowLeft
// Primary+Alt+Shift+ArrowRight
//
// Логика как у alt+ArrowLeft / alt+ArrowRight,
// но с range-выделением по цепочке:
// parent <-> current <-> firstChild <-> firstChild...

(function () {
    if (typeof window === "undefined") return;
  
    const HOST_ID = "tree";
  
    (function injectStyle() {
      const id = "multi-select-branch-style";
      if (document.getElementById(id)) return;
  
      const st = document.createElement("style");
      st.id = id;
      st.textContent = `
  .row[data-multi-owner="branch"].multi{
    background:#bfe3ff !important;
    border-radius:2px;
  }
      `;
      document.head.appendChild(st);
    })();
  
    const state = {
      ids: new Set(),
      anchorId: null,
      branchKey: null,
    };
  
    function host() {
      return document.getElementById(HOST_ID);
    }
  
    function cssEscapeLocal(s) {
      const v = String(s);
      if (window.CSS && typeof CSS.escape === "function") return CSS.escape(v);
      return v.replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
    }
  
    function rowById(id) {
      const h = host();
      if (!h) return null;
      return h.querySelector(`.row[data-id="${cssEscapeLocal(id)}"]`);
    }
  
    function selectedRow() {
      const h = host();
      if (!h) return null;
      return h.querySelector(".row.sel");
    }
  
    function isEditingNow() {
      const ae = document.activeElement;
      if (!ae) return false;
      if (ae.tagName === "INPUT" && ae.classList?.contains("edit")) return true;
      if (ae.tagName === "TEXTAREA" && ae.classList?.contains("tg-export")) return true;
      if (ae.isContentEditable) return true;
      return false;
    }
  
    // Ключ цепочки теперь = anchorId.
    // Цепочка строится вокруг anchor, а не от самого верхнего первого номера дерева.
    function branchKeyForRow(row) {
      if (!row) return null;
      return row.dataset?.id || null;
    }
  
    function buildAncestorChain(id) {
      const out = [];
      let cur = id;
  
      while (cur) {
        out.push(cur);
        cur = parentOf(cur);
      }
  
      out.reverse(); // от корня к anchor
      return out;
    }
  
    function buildDescendantFirstChildChain(id) {
      const out = [];
      let cur = firstChildOf(id);
  
      while (cur) {
        out.push(cur);
        cur = firstChildOf(cur);
      }
  
      return out;
    }
  
    function rowsInBranchChain(branchKey) {
      const out = [];
      if (!branchKey) return out;
  
      const ids = [
        ...buildAncestorChain(branchKey),
        ...buildDescendantFirstChildChain(branchKey),
      ];
  
      for (const id of ids) {
        const row = rowById(id);
        if (row) out.push(row);
      }
  
      return out;
    }
  
    function reset() {
      state.ids.clear();
      state.anchorId = null;
      state.branchKey = null;
    }
  
    function applyClasses() {
      const h = host();
      if (!h) return;
  
      h.querySelectorAll('.row[data-multi-owner="branch"]').forEach((el) => {
        el.classList.remove("multi");
        el.removeAttribute("data-multi-owner");
      });
  
      for (const id of state.ids) {
        const r = rowById(id);
        if (r) {
          r.classList.add("multi");
          r.setAttribute("data-multi-owner", "branch");
        }
      }
    }
  
    function clickRow(row) {
      if (!row) return;
      row.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    }
  
    if (typeof window.render === "function" && !window.render.__multiBranchPatchedV1) {
      const _render = window.render;
      window.render = function patchedRenderBranch() {
        _render();
        applyClasses();
      };
      window.render.__multiBranchPatchedV1 = true;
    }
  
    function handleBranchRangeKey(dir) {
      const cur = selectedRow();
      if (!cur) return;
  
      const bk = state.anchorId || branchKeyForRow(cur);
  
      if (!state.anchorId) {
        state.anchorId = cur.dataset.id;
        state.branchKey = bk;
        state.ids = new Set([cur.dataset.id]);
        applyClasses();
        return;
      }
  
      const list = rowsInBranchChain(state.branchKey);
      const idx = list.indexOf(cur);
      if (idx < 0) return;
  
      const next = list[idx + dir];
      if (!next) return;
  
      const anchor = rowById(state.anchorId) || cur;
      const ia = list.indexOf(anchor);
      const ib = list.indexOf(next);
      if (ia < 0 || ib < 0) return;
  
      const from = Math.min(ia, ib);
      const to = Math.max(ia, ib);
  
      state.ids = new Set(list.slice(from, to + 1).map((r) => r.dataset.id));
  
      clickRow(next);
      applyClasses();
    }
  
    window.addEventListener(
      "keydown",
      (e) => {
        if (window.hotkeysMode === "custom") return;
        if (isEditingNow()) return;
        if (typeof isHotkey !== "function") return;
  
        if (isHotkey(e, "branchRangeLeft")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          handleBranchRangeKey(-1);
          return;
        }
  
        if (isHotkey(e, "branchRangeRight")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          handleBranchRangeKey(+1);
          return;
        }
      },
      true
    );
  
    function installPointerHandlers() {
      const h = host();
      if (!h) return;
      if (h.__multiBranchClickInstalledV1) return;
      h.__multiBranchClickInstalledV1 = true;
  
      h.addEventListener(
        "click",
        (e) => {
          const row = e.target?.closest?.(".row") || null;
          if (!row) {
            reset();
            applyClasses();
          }
        },
        true
      );
    }
  
    installPointerHandlers();
  
    window.addEventListener(
      "keydown",
      (e) => {
        if (isEditingNow()) return;
  
        const noMods = !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
        if (
          noMods &&
          (e.key === "ArrowUp" ||
           e.key === "ArrowDown" ||
           e.key === "ArrowLeft" ||
           e.key === "ArrowRight")
        ) {
          reset();
          applyClasses();
        }
      },
      true
    );
  
    window.multiSelectBranch = {
      getIds() {
        return Array.from(state.ids);
      },
      clear() {
        reset();
        applyClasses();
      },
      size() {
        return state.ids.size;
      },
      has(id) {
        return state.ids.has(id);
      },
      debug() {
        return {
          branchKey: state.branchKey,
          anchorId: state.anchorId,
          ids: Array.from(state.ids),
        };
      },
      handleBranchRangeKey,
    };
  })();
// multi_select_patch.js
// Массовое выделение подряд ТОЛЬКО на одном уровне (внутри одного UL):
// - rangeUp / rangeDown
// - rangeClick мышью: может быть и Click, и DblClick
//
// Подсветка: голубым
//
// API:
// window.multiSelect = { getIds, clear, has, size, debug }

(function () {
  if (typeof window === "undefined") return;

  const HOST_ID = "tree";

  (function injectStyle() {
    const id = "multi-select-style";
    if (document.getElementById(id)) return;

    const st = document.createElement("style");
    st.id = id;
    st.textContent = `
      .row.multi{
        background:#bfe3ff !important;
        border-radius:2px;
      }
    `;
    document.head.appendChild(st);
  })();

  const state = {
    anchorId: null,
    contextKey: null,
    ids: new Set(),
  };

  let synth = 0;
  let pendingSingleTimer = null;

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

  function contextKeyForRow(row) {
    if (!row) return null;

    const li = row.closest("li");
    if (!li) return null;

    const ul = li.parentElement;
    if (!ul || ul.tagName !== "UL") return null;

    const level = ul.dataset?.level ? String(ul.dataset.level) : "";

    const parentLi = ul.closest("li");
    const parentRow = parentLi ? parentLi.querySelector(":scope > .row") : null;
    const parentId = parentRow ? parentRow.dataset.id : "ROOT";

    return `${parentId}::${level}`;
  }

  function siblingRows(row) {
    if (!row) return [];

    const li = row.closest("li");
    if (!li) return [];

    const ul = li.parentElement;
    if (!ul || ul.tagName !== "UL") return [];

    const lis = Array.from(ul.children).filter((x) => x.tagName === "LI");
    const out = [];

    for (const li2 of lis) {
      const r = li2.querySelector(":scope > .row");
      if (r) out.push(r);
    }

    return out;
  }

  function reset() {
    state.anchorId = null;
    state.contextKey = null;
    state.ids.clear();
  }

  function applyClasses() {
    const h = host();
    if (!h) return;

    h.querySelectorAll('.row[data-multi-owner="level"]').forEach((el) => {
      el.classList.remove("multi");
      el.removeAttribute("data-multi-owner");
    });

    for (const id of state.ids) {
      const r = rowById(id);
      if (r) {
        r.classList.add("multi");
        r.setAttribute("data-multi-owner", "level");
      }
    }
  }

  function setRange(anchorRow, activeRow) {
    if (!anchorRow || !activeRow) return false;

    const aCtx = contextKeyForRow(anchorRow);
    const bCtx = contextKeyForRow(activeRow);

    if (!aCtx || !bCtx || aCtx !== bCtx) return false;

    const sibs = siblingRows(anchorRow);
    const ia = sibs.indexOf(anchorRow);
    const ib = sibs.indexOf(activeRow);
    if (ia < 0 || ib < 0) return false;

    const from = Math.min(ia, ib);
    const to = Math.max(ia, ib);

    state.anchorId = anchorRow.dataset.id;
    state.contextKey = aCtx;
    state.ids = new Set(sibs.slice(from, to + 1).map((r) => r.dataset.id));
    return true;
  }

  function clickRow(row) {
    if (!row) return;
    synth++;
    try {
      row.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    } finally {
      synth--;
    }
  }

  function isEditingNow() {
    const ae = document.activeElement;
    if (!ae) return false;
    if (ae.tagName === "INPUT" && ae.classList?.contains("edit")) return true;
    if (ae.tagName === "TEXTAREA" && ae.classList?.contains("tg-export")) return true;
    if (ae.isContentEditable) return true;
    return false;
  }

  function clearPendingSingle() {
    if (pendingSingleTimer) {
      clearTimeout(pendingSingleTimer);
      pendingSingleTimer = null;
    }
  }

  if (typeof window.render === "function" && !window.render.__multiLevelPatchedV2) {
    const _render = window.render;
    window.render = function patchedRender() {
      _render();
      applyClasses();
    };
    window.render.__multiLevelPatchedV2 = true;
  }

  function handleRangeKey(dir) {
    const cur = selectedRow();
    if (!cur) return;

    const ctx = contextKeyForRow(cur);

    if (!state.anchorId || state.contextKey !== ctx) {
      state.anchorId = cur.dataset.id;
      state.contextKey = ctx;
      state.ids = new Set([cur.dataset.id]);
      applyClasses();
      return;
    }

    const sibs = siblingRows(cur);
    const idx = sibs.indexOf(cur);
    const next = sibs[idx + dir];
    if (!next) return;

    const anchor = rowById(state.anchorId) || cur;

    const ok = setRange(anchor, next);
    if (!ok) {
      state.anchorId = next.dataset.id;
      state.contextKey = contextKeyForRow(next);
      state.ids = new Set([next.dataset.id]);
    }

    clickRow(next);
    applyClasses();
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (window.hotkeysMode === "custom") return;
      if (isEditingNow()) return;
      if (typeof isHotkey !== "function") return;

      if (isHotkey(e, "rangeUp")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleRangeKey(-1);
        return;
      }

      if (isHotkey(e, "rangeDown")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleRangeKey(+1);
        return;
      }
    },
    true
  );

  function processRangeRow(row) {
    const clicked = row;
    const ctxClicked = contextKeyForRow(clicked);

    if (!state.contextKey || state.contextKey !== ctxClicked) {
      state.contextKey = ctxClicked;
      state.anchorId = clicked.dataset.id;
      state.ids = new Set([clicked.dataset.id]);
      clickRow(clicked);
      applyClasses();
      return;
    }

    const id = clicked.dataset.id;

    if (state.ids.has(id)) {
      state.ids.delete(id);

      if (state.anchorId === id) {
        const next = state.ids.values().next().value || null;
        state.anchorId = next;
      }
    } else {
      state.ids.add(id);
      if (!state.anchorId) state.anchorId = id;
    }

    clickRow(clicked);
    applyClasses();
  }

  function handleRangePointer(e, baseToken) {
    if (synth) return;

    const row = e.target?.closest?.(".row") || null;

    if (e.target?.closest?.(".act")) return;

    if (!row) {
      if (baseToken === "Click") {
        reset();
        applyClasses();
      }
      return;
    }

    if (typeof isMouseHotkey !== "function") {
      if (baseToken === "Click") {
        reset();
        applyClasses();
      }
      return;
    }

    if (!isMouseHotkey(e, "rangeClick", baseToken)) {
      if (baseToken === "Click") {
        reset();
        applyClasses();
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    processRangeRow(row);
  }

  function installPointerHandlers() {
    const h = host();
    if (!h) return;
    if (h.__multiLevelClickInstalledV2) return;
    h.__multiLevelClickInstalledV2 = true;

    h.addEventListener(
      "click",
      (e) => {
        if (synth) return;

        clearPendingSingle();

        // ждём немного: вдруг это начало dblclick
        pendingSingleTimer = setTimeout(() => {
          pendingSingleTimer = null;
          handleRangePointer(e, "Click");
        }, 230);
      },
      true
    );

    h.addEventListener(
      "dblclick",
      (e) => {
        if (synth) return;

        clearPendingSingle();
        handleRangePointer(e, "DblClick");
      },
      true
    );
  }

  installPointerHandlers();

  window.multiSelect = {
    getIds() {
      return Array.from(state.ids);
    },
    clear() {
      reset();
      applyClasses();
    },
    has(id) {
      return state.ids.has(id);
    },
    size() {
      return state.ids.size;
    },
    debug() {
      return {
        anchorId: state.anchorId,
        contextKey: state.contextKey,
        ids: Array.from(state.ids),
      };
    },
  };

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
        window.multiSelect?.clear?.();
      }
    },
    true
  );

  try {
    applyClasses();
  } catch (_) {}
})();
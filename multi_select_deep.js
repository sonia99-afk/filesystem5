// multi_select_deep.js
// "Глубокое" мультивыделение (включая вложенные уровни):
// - deepUp / deepDown
// - deepClick мышью: может быть и Click, и DblClick
//
// Визуальная подсветка: .row[data-multi-owner="deep"].multi
// Экспорт API: window.multiSelectDeep = { getIds, clear, size, has, debug }

(function () {
  if (typeof window === "undefined") return;

  const HOST_ID = "tree";
  const SINGLE_CLICK_DELAY = 230;

  // ---- style ----
  (function injectStyle() {
    const id = "multi-select-style";
    if (document.getElementById(id)) return;

    const st = document.createElement("style");
    st.id = id;
    st.textContent = `
.row[data-multi-owner="deep"].multi{
  background:#bfe3ff !important;
  border-radius:2px;
}
    `;
    document.head.appendChild(st);
  })();

  // ---- internal state ----
  const state = {
    ids: new Set(),
    anchorId: null,
    blockKey: null,
  };

  let synth = 0;
  let pendingSingleTimer = null;

  // ---- helpers ----
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

  // blockKey = id верхнеуровневого узла (child of root UL) или ROOT
  function blockKeyForRow(row) {
    if (!row) return null;

    const h = host();
    if (!h) return null;

    const li = row.closest("li");
    if (!li) return null;

    const rootUl = h.querySelector(":scope > ul");
    if (!rootUl) return "ROOT";

    let curLi = li;
    while (curLi && curLi.parentElement && curLi.parentElement !== rootUl) {
      curLi = curLi.parentElement.closest("li");
    }

    if (curLi && curLi.parentElement === rootUl) {
      const topRow = curLi.querySelector(":scope > .row");
      return topRow ? topRow.dataset.id : "ROOT";
    }

    return "ROOT";
  }

  // Все строки внутри одной ветки в порядке DOM
  function rowsInBlock(blockKey) {
    const h = host();
    if (!h) return [];

    const rootUl = h.querySelector(":scope > ul");
    if (!rootUl) return Array.from(h.querySelectorAll(".row"));

    if (!blockKey || blockKey === "ROOT") {
      return Array.from(rootUl.querySelectorAll(".row"));
    }

    const topRow = rowById(blockKey);
    if (!topRow) return Array.from(rootUl.querySelectorAll(".row"));

    const topLi = topRow.closest("li");
    if (!topLi) return Array.from(rootUl.querySelectorAll(".row"));

    return Array.from(topLi.querySelectorAll(".row"));
  }

  function reset() {
    state.ids.clear();
    state.anchorId = null;
    state.blockKey = null;
  }

  function applyClasses() {
    const h = host();
    if (!h) return;

    h.querySelectorAll('.row[data-multi-owner="deep"]').forEach((el) => {
      el.classList.remove("multi");
      el.removeAttribute("data-multi-owner");
    });

    for (const id of state.ids) {
      const r = rowById(id);
      if (r) {
        r.classList.add("multi");
        r.setAttribute("data-multi-owner", "deep");
      }
    }
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

  function clearPendingSingle() {
    if (pendingSingleTimer) {
      clearTimeout(pendingSingleTimer);
      pendingSingleTimer = null;
    }
  }

  // ---- keep highlight after render() ----
  if (typeof window.render === "function" && !window.render.__multiDeepPatchedV2) {
    const _render = window.render;
    window.render = function patchedRenderDeep() {
      _render();
      applyClasses();
    };
    window.render.__multiDeepPatchedV2 = true;
  }

  // ---- deepUp / deepDown ----
  function handleDeepRangeKey(dir) {
    const cur = selectedRow();
    if (!cur) return;

    const bk = blockKeyForRow(cur);

    if (!state.anchorId || state.blockKey !== bk) {
      state.blockKey = bk;
      state.anchorId = cur.dataset.id;
      state.ids = new Set([cur.dataset.id]);
      applyClasses();
      return;
    }

    const list = rowsInBlock(state.blockKey);
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

      if (isHotkey(e, "deepUp")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleDeepRangeKey(-1);
        return;
      }

      if (isHotkey(e, "deepDown")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleDeepRangeKey(+1);
        return;
      }
    },
    true
  );

  function processDeepRow(row) {
    const clicked = row;
    const bk = blockKeyForRow(clicked);

    if (!state.blockKey || state.blockKey !== bk) {
      state.blockKey = bk;
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
        state.anchorId = state.ids.values().next().value || null;
      }
    } else {
      state.ids.add(id);
      if (!state.anchorId) state.anchorId = id;
    }

    clickRow(clicked);
    applyClasses();
  }

  function handleDeepPointer(e, baseToken) {
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

    if (!isMouseHotkey(e, "deepClick", baseToken)) {
      if (baseToken === "Click") {
        reset();
        applyClasses();
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    processDeepRow(row);
  }

  function installPointerHandlers() {
    const h = host();
    if (!h) return;
    if (h.__multiDeepClickInstalledV3) return;
    h.__multiDeepClickInstalledV3 = true;

    h.addEventListener(
      "click",
      (e) => {
        if (synth) return;

        clearPendingSingle();
        pendingSingleTimer = setTimeout(() => {
          pendingSingleTimer = null;
          handleDeepPointer(e, "Click");
        }, SINGLE_CLICK_DELAY);
      },
      true
    );

    h.addEventListener(
      "dblclick",
      (e) => {
        if (synth) return;

        clearPendingSingle();
        handleDeepPointer(e, "DblClick");
      },
      true
    );
  }

  installPointerHandlers();

  // ---- API ----
  window.multiSelectDeep = {
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
        blockKey: state.blockKey,
        anchorId: state.anchorId,
        ids: Array.from(state.ids),
      };
    },
  };

  // Сброс deep-выделения при обычной навигации стрелками
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

  try {
    applyClasses();
  } catch (_) {}
})();
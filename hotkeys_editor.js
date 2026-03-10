// hotkeys_editor.js
// Редактирование хоткеев по двойному клику на td[data-action].
// Новый режим: модификаторы + ОДНА клавиша (без аккордов/keyup-подтверждения).
// - Primary = Ctrl на Win/Linux, Cmd на macOS (в UI показываем "Ctrl/Cmd")
// - Mouse-actions назначаются либо Click, либо DblClick (с модификаторами)
// - Конфликты подсвечиваются красным бордером

(function () {
  if (typeof window === "undefined") return;

  let editingCell = null;
  let pendingMouseAssignTimer = null;
  let pendingMouseAssignEvent = null;

  // Все действия, которые назначаются мышью
  const MOUSE_ACTIONS = new Set([
    "rangeClick",
    "deepClick",
    "navClick",
    "renameClick",
    "addSiblingClick",
    "addChildClick",
    "deleteClick",
    "undoClick",
    "redoClick"
  ]);

  const SINGLE_CLICK_ASSIGN_DELAY = 240;

  function isEditingNow() {
    const ae = document.activeElement;
    if (!ae) return false;
    if (ae.tagName === "INPUT" && ae.classList?.contains("edit")) return true;
    if (ae.tagName === "TEXTAREA" && ae.classList?.contains("tg-export")) return true;
    if (ae.isContentEditable) return true;
    return false;
  }

  function platform() {
    return (
      window.hotkeys?.getPlatformInfo?.() || {
        isMac: false,
        primaryToken: "Primary",
        primaryLabel: "Ctrl",
      }
    );
  }

  function normalizeBaseKeyFromEvent(e) {
    if (!e) return "";

    const key = String(e.key || "");
    if (key === "Shift" || key === "Alt" || key === "Control" || key === "Meta" || key === "OS") {
      return "";
    }

    const code = String(e.code || "");
    if (code.startsWith("Key") && code.length === 4) return code.slice(3).toUpperCase();
    if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
    if (code.startsWith("Numpad") && code.length === 7 && /[0-9]/.test(code.slice(6))) return code.slice(6);

    if (key === " " || key === "Spacebar") return "Space";
    if (key === "Esc") return "Escape";
    if (key === "+") return "Plus";

    if (key.length === 1) return key.toUpperCase();

    return key;
  }

  function comboFromKeyEvent(e) {
    const { isMac, primaryToken } = platform();

    const base = normalizeBaseKeyFromEvent(e);
    if (!base) return "";

    const tokens = [];

    const primaryDown = isMac ? !!e.metaKey : !!e.ctrlKey;
    if (primaryDown) tokens.push(primaryToken);
    if (e.altKey) tokens.push("Alt");
    if (e.shiftKey) tokens.push("Shift");

    tokens.push(base);

    if (tokens.length === 2 && tokens.includes("Shift") && tokens.includes("Plus")) return "+";

    return window.hotkeys?.normalizeCombo?.(tokens.join("+")) || tokens.join("+");
  }

  // baseToken: "Click" | "DblClick"
  function comboFromMouseEvent(e, baseToken = "Click") {
    const { isMac, primaryToken } = platform();

    const tokens = [];

    const primaryDown = isMac ? !!e.metaKey : !!e.ctrlKey;
    if (primaryDown) tokens.push(primaryToken);
    if (e.altKey) tokens.push("Alt");
    if (e.shiftKey) tokens.push("Shift");

    tokens.push(baseToken);

    return window.hotkeys?.normalizeCombo?.(tokens.join("+")) || tokens.join("+");
  }

  function prettyHotkey(v) {
    const { primaryToken, primaryLabel } = platform();

    if (typeof v !== "string") return String(v ?? "");
    if (v.trim() === "+") return "+";

    const rawTokens = v
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!rawTokens.length) return "";

    const prio = (t) => {
      if (t === primaryToken) return 1;
      if (t === "Alt") return 2;
      if (t === "Shift") return 3;
      return 4;
    };

    const tokens = [...rawTokens].sort((a, b) => {
      const pa = prio(a);
      const pb = prio(b);
      if (pa !== pb) return pa - pb;
      return String(a).localeCompare(String(b));
    });

    const mapToken = (t) => {
      if (t === primaryToken) return primaryLabel;
      if (t === "Plus") return "+";
      if (t === "ArrowUp") return "↑";
      if (t === "ArrowDown") return "↓";
      if (t === "ArrowLeft") return "←";
      if (t === "ArrowRight") return "→";
      if (t === "DblClick") return "DblClick";
      return t;
    };

    return tokens.map(mapToken).join("+");
  }

  function setCellTextIfChanged(cell, text) {
    if (!cell) return;
    const t = String(text ?? "");
    if (cell.textContent !== t) cell.textContent = t;
  }

  function updateConflicts() {
    const conflicts = window.hotkeys?.findConflicts?.() || new Set();

    document.querySelectorAll("td[data-action].conflict").forEach((td) => td.classList.remove("conflict"));

    document.querySelectorAll("td[data-action]").forEach((td) => {
      const action = td.dataset.action;
      if (conflicts.has(action)) td.classList.add("conflict");
    });
  }

  function syncTableFromConfig() {
    document.querySelectorAll("td[data-action]").forEach((td) => {
      const action = td.dataset.action;
      const v = window.hotkeys?.get?.(action);
      if (typeof v === "string") td.textContent = prettyHotkey(v);
    });
    updateConflicts();
  }

  function clearPendingMouseAssign() {
    if (pendingMouseAssignTimer) {
      clearTimeout(pendingMouseAssignTimer);
      pendingMouseAssignTimer = null;
    }
    pendingMouseAssignEvent = null;
  }

  function clearEditing(cancelled) {
    if (!editingCell) return;

    clearPendingMouseAssign();

    const action = editingCell.dataset.action;
    editingCell.classList.remove("editing");
    editingCell.classList.remove("editing-click");

    if (cancelled) {
      const prev = editingCell.dataset.prevText;
      if (typeof prev === "string") {
        setCellTextIfChanged(editingCell, prev);
      } else {
        const v = window.hotkeys?.get?.(action);
        setCellTextIfChanged(editingCell, prettyHotkey(v));
      }
    }

    delete editingCell.dataset.prevText;
    editingCell = null;
  }

  function commitMouseAssignment(e, baseToken) {
    if (!editingCell) return;

    if (window.hotkeysMode !== "custom") {
      clearEditing(true);
      return;
    }

    const action = editingCell.dataset.action;
    if (!MOUSE_ACTIONS.has(action)) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const combo = comboFromMouseEvent(e, baseToken);

    window.hotkeys?.set?.(action, combo);
    const normalized = window.hotkeys?.get?.(action) || combo;
    setCellTextIfChanged(editingCell, prettyHotkey(normalized));

    clearEditing(false);
    updateConflicts();
    window.syncHotkeysTable?.();
  }

  function init() {
    syncTableFromConfig();

    // Вход в редактирование: двойной клик по ячейке хоткея
    document.addEventListener("dblclick", (e) => {
      const cell = e.target?.closest?.("td[data-action]");
      if (!cell) return;
      if (isEditingNow()) return;

      if (window.hotkeysMode !== "custom") {
        alert("Включите кастомный режим хоткеев, чтобы переназначать клавиши.");
        return;
      }

      if (editingCell) clearEditing(true);

      editingCell = cell;
      editingCell.dataset.prevText = editingCell.textContent;

      const action = editingCell.dataset.action;
      const isMouseAction = MOUSE_ACTIONS.has(action);

      editingCell.classList.add("editing");

      if (isMouseAction) {
        editingCell.classList.add("editing-click");
        setCellTextIfChanged(
          editingCell,
          "Кликните или сделайте двойной клик мышью… (Esc — отмена)"
        );
      } else {
        setCellTextIfChanged(
          editingCell,
          "Нажмите клавишу… (Esc — отмена)"
        );
      }
    });

    // KeyDown: сохраняем сразу (модификаторы + 1 клавиша)
    document.addEventListener(
      "keydown",
      (e) => {
        if (!editingCell) return;

        if (window.hotkeysMode !== "custom") {
          clearEditing(true);
          return;
        }

        const action = editingCell.dataset.action;
        const isMouseAction = MOUSE_ACTIONS.has(action);

        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          clearEditing(true);
          updateConflicts();
          return;
        }

        if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          return;
        }

        if (isMouseAction) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        if (e.repeat) return;

        const combo = comboFromKeyEvent(e);
        if (!combo) {
          setCellTextIfChanged(editingCell, "Нажмите клавишу (не модификатор)… (Esc — отмена)");
          return;
        }

        window.hotkeys?.set?.(action, combo);
        const normalized = window.hotkeys?.get?.(action) || combo;
        setCellTextIfChanged(editingCell, prettyHotkey(normalized));

        clearEditing(false);
        updateConflicts();
        window.syncHotkeysTable?.();
      },
      true
    );

    // Mouse assignment for mouse-actions — single click candidate
    document.addEventListener(
      "click",
      (e) => {
        if (!editingCell) return;

        if (window.hotkeysMode !== "custom") {
          clearEditing(true);
          return;
        }

        const action = editingCell.dataset.action;
        if (!MOUSE_ACTIONS.has(action)) return;

        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        clearPendingMouseAssign();
        pendingMouseAssignEvent = e;

        pendingMouseAssignTimer = setTimeout(() => {
          const ev = pendingMouseAssignEvent;
          clearPendingMouseAssign();
          if (!ev) return;
          commitMouseAssignment(ev, "Click");
        }, SINGLE_CLICK_ASSIGN_DELAY);
      },
      true
    );

    // Mouse assignment for mouse-actions — double click wins over click
    document.addEventListener(
      "dblclick",
      (e) => {
        if (!editingCell) return;

        if (window.hotkeysMode !== "custom") {
          clearEditing(true);
          return;
        }

        const action = editingCell.dataset.action;
        if (!MOUSE_ACTIONS.has(action)) return;

        clearPendingMouseAssign();
        commitMouseAssignment(e, "DblClick");
      },
      true
    );

    // Anti-sticky
    if (!window.__hkEditorAntiStickyInstalled) {
      window.__hkEditorAntiStickyInstalled = true;

      window.addEventListener("blur", () => {
        if (!editingCell) return;
        clearEditing(true);
        updateConflicts();
      });

      document.addEventListener("visibilitychange", () => {
        if (!editingCell) return;
        if (document.hidden) {
          clearEditing(true);
          updateConflicts();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
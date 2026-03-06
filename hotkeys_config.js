(function () {
  if (typeof window === "undefined") return;

  window.hotkeysMode = window.hotkeysMode || "builtin";

  function isMac() {
    const p = String(navigator.platform || "").toLowerCase();
    if (p.includes("mac")) return true;
    const ua = String(navigator.userAgent || "").toLowerCase();
    return ua.includes("mac os") || ua.includes("macintosh");
  }

  // Canonical internal modifier:
  // - User sees: Ctrl/Cmd
  // - Stored token: Primary
  // - Match: ctrlKey on Win/Linux, metaKey on macOS
  const PRIMARY = "Primary";

  const DEFAULTS = {
    // Добавления
    addSibling: "Enter",
    addChild: "Shift+Enter",

    addSiblingClick: "Alt+Click",
    addChildClick: "Alt+Shift+Click",

    // Навигация
    navUp: "ArrowUp",
    navDown: "ArrowDown",
    navLeft: "ArrowLeft",
    navRight: "ArrowRight",
    navClick: "Click",

    // Перемещение внутри уровня
    moveUp: "Shift+ArrowUp",
    moveDown: "Shift+ArrowDown",

    // Перемещение между уровнями
    indent: "Shift+ArrowRight",
    outdent: "Shift+ArrowLeft",

    // Диапазон (один уровень)
    rangeUp: "Primary+Alt+Shift+ArrowUp",
    rangeDown: "Primary+Alt+Shift+ArrowDown",
    rangeClick: "Primary+Alt+Shift+Click",

    // Глубокое выделение (ветка)
    deepUp: "Primary+Shift+ArrowUp",
    deepDown: "Primary+Shift+ArrowDown",
    deepClick: "Primary+Shift+Click",

    // Прочее
    rename: "`",
    renameClick: "DblClick",
    delete: "Backspace",
    deleteClick: "Shift+Click",

    // Undo/Redo
    undo: "Primary+Z",
    redo: "Primary+Shift+Z",

    undoClick: "Ctrl+DblClick",
    redoClick: "Ctrl+Alt+DblClick"
  };

  // Display label for Primary in UI
  function primaryLabel() {
    return "Ctrl/Cmd";
  }

  function normalizeKeyName(k) {
    if (!k) return "";

    const raw = String(k).trim();
    if (!raw) return "";

    // Common aliases
    if (raw === "Esc") return "Escape";
    if (raw === "Del") return "Delete";
    if (raw === " " || raw === "Spacebar" || raw === "Space") return "Space";
    if (raw === "+") return "Plus";
    if (raw === "Клик") return "Click";
    if (raw === "`" || raw === "Ё" || raw === "ё") return "`";

    const up = raw.toUpperCase();

    // Primary aliases
    if (
      up === "CTRL" ||
      up === "CONTROL" ||
      up === "CMD" ||
      up === "COMMAND" ||
      up === "META" ||
      up === "OS" ||
      up === "WIN" ||
      raw === "⌘" ||
      raw === "" ||
      raw === PRIMARY
    ) {
      return PRIMARY;
    }

    if (up === "OPTION") return "Alt";

    // Single character
    if (raw.length === 1) return raw.toUpperCase();

    return raw;
  }

  function sortTokens(tokens) {
    const prio = (t) => {
      if (t === PRIMARY) return 1;
      if (t === "Alt") return 2;
      if (t === "Shift") return 3;
      return 4;
    };
    return [...tokens].sort((a, b) => {
      const pa = prio(a), pb = prio(b);
      if (pa !== pb) return pa - pb;
      return String(a).localeCompare(String(b));
    });
  }

  function normalizeCombo(comboRaw) {
    const raw = String(comboRaw || "").trim();
    if (!raw) return "";

    // Historical special-case: Shift + Plus -> "+"
    if (raw === "+") return "+";

    const parts = raw
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeKeyName)
      .filter(Boolean);

    const normalized = sortTokens(parts);

    // Shift + Plus -> "+"
    if (normalized.length === 2 && normalized.includes("Shift") && normalized.includes("Plus")) {
      return "+";
    }

    return normalized.join("+");
  }

  let current = Object.fromEntries(
    Object.entries(DEFAULTS).map(([action, combo]) => [action, normalizeCombo(combo)])
  );

  function reset() {
    current = Object.fromEntries(
      Object.entries(DEFAULTS).map(([action, combo]) => [action, normalizeCombo(combo)])
    );
  }

  function set(action, combo) {
    current[action] = normalizeCombo(combo);
  }

  function get(action) {
    return current[action];
  }

  function getAll() {
    return { ...current };
  }

  function findConflicts() {
    const map = new Map();
    const conflicts = new Set();

    

    for (const [action, comboRaw] of Object.entries(current)) {
      const combo = normalizeCombo(comboRaw);
      const arr = map.get(combo) || [];
      arr.push(action);
      map.set(combo, arr);
    }

    for (const actions of map.values()) {
      if (actions.length > 1) actions.forEach((a) => conflicts.add(a));
    }

    return conflicts;
  }

  // Expose a tiny runtime helper so UI can show Ctrl/Cmd.
  function getPlatformInfo() {
    return {
      isMac: isMac(),
      primaryToken: PRIMARY,
      primaryLabel: primaryLabel(),
    };
  }

  window.hotkeys = {
    DEFAULTS,
    normalizeCombo,
    set,
    get,
    getAll,
    reset,
    findConflicts,
    getPlatformInfo,
  };
})();

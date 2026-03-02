// hotkeys_ui.js
// UI for "Редактирование хоткеев" exactly like in mock:
// - "Редактировать" (latches edit mode ON)
// - "Сохранить" (exit edit mode, keep changes)
// - "Не сохранять" (revert to snapshot taken when edit mode was entered, exit)
// - "Сброс к исходным" (revert to snapshot, stay in edit mode)
//
// IMPORTANT:
// - We do NOT change existing hotkey logic.
// - We only manage window.hotkeysMode (used by app.js as a lock) and hotkeys config values.

(function () {
  if (typeof window === "undefined") return;

  // Ensure exists (hotkeys_config.js normally sets it)
  window.hotkeysMode = window.hotkeysMode || "builtin";

  const IDs = {
    edit: "hkEditBtn",
    save: "hkSaveBtn",
    discard: "hkDiscardBtn",
    reset: "hotkeysResetBtn", // keep existing id for compatibility
  };

  let snapshot = null; // {action: combo}

  function el(id) {
    return document.getElementById(id);
  }

  function isEditing() {
    return window.hotkeysMode === "custom";
  }

  function setInactive(btn, inactive) {
    if (!btn) return;
    btn.disabled = !!inactive;
    btn.classList.toggle("is-inactive", !!inactive);
  }

  function setPressed(btn, pressed) {
    if (!btn) return;
    btn.classList.toggle("active", !!pressed);
  }

  function syncLabelAndButtons() {
    const bEdit = el(IDs.edit);
    const bSave = el(IDs.save);
    const bDiscard = el(IDs.discard);
    const bReset = el(IDs.reset);

    const on = isEditing();


    // In "выкл": only Edit is active
    setInactive(bEdit, on); // latched: can't unpress
    setPressed(bEdit, on);

    setInactive(bSave, !on);
    setInactive(bDiscard, !on);
    setInactive(bReset, !on);
  }

  function syncHotkeysTable() {
    // hotkeys_editor.js exposes this inner function only inside its IIFE,
    // so we refresh by re-rendering text values from hotkeys.get(action).
    // (same approach, but minimal)
    // Keep the same visual format as in hotkeys_editor.js (arrows, Ctrl label, etc.)
    function prettyHotkey(v) {
      if (typeof v !== "string") return String(v ?? "");
      if (v.trim() === "+") return "+";
      const rawTokens = v.split("+").map(s => s.trim()).filter(Boolean);
      if (!rawTokens.length) return "";
      const prio = (t) => {
        if (t === "Control") return 1;
        if (t === "Alt") return 2;
        if (t === "Shift") return 3;
        return 4;
      };
      const tokens = [...rawTokens].sort((a, b) => {
        const pa = prio(a), pb = prio(b);
        if (pa !== pb) return pa - pb;
        return String(a).localeCompare(String(b));
      });
      const mapToken = (t) => {
        if (t === "Control") return "Ctrl";
        if (t === "Plus") return "+";
        if (t === "ArrowUp") return "↑";
        if (t === "ArrowDown") return "↓";
        if (t === "ArrowLeft") return "←";
        if (t === "ArrowRight") return "→";
        return t;
      };
      return tokens.map(mapToken).join("+");
    }

    try {
      document.querySelectorAll("td[data-action]").forEach((td) => {
        const action = td.dataset.action;
        const v = window.hotkeys?.get?.(action);
        if (typeof v === "string") {
          td.textContent = prettyHotkey(v);
        }
      });

      // conflicts (same as in editor)
      const conflicts = window.hotkeys?.findConflicts?.() || new Set();
      document.querySelectorAll("td[data-action].conflict").forEach((td) => td.classList.remove("conflict"));
      document.querySelectorAll("td[data-action]").forEach((td) => {
        const action = td.dataset.action;
        if (conflicts.has(action)) td.classList.add("conflict");
      });
    } catch (_) {}
  }

  function takeSnapshot() {
    snapshot = window.hotkeys?.getAll?.() || null;
  }

  function restoreSnapshot() {
    if (!snapshot) return;
    for (const [action, combo] of Object.entries(snapshot)) {
      window.hotkeys?.set?.(action, combo);
    }
    syncHotkeysTable();
  }

  function enterEditMode() {
    if (isEditing()) return;
    takeSnapshot();
    window.hotkeysMode = "custom";
    syncLabelAndButtons();
  }

  function exitEditModeKeep() {
    if (!isEditing()) return;
    window.hotkeysMode = "builtin";
    snapshot = null;
    syncLabelAndButtons();
  }

  function exitEditModeDiscard() {
    if (!isEditing()) return;
    restoreSnapshot();
    window.hotkeysMode = "builtin";
    snapshot = null;
    syncLabelAndButtons();
  }

  // "Сброс к исходным" = вернуть ДЕФОЛТНЫЕ хоткеи (как раньше "Сбросить к стандартным").
  // Важно: остаёмся в режиме редактирования.
  function resetToDefaults() {
    if (!isEditing()) return;
    try {
      window.hotkeys?.reset?.();
    } catch (_) {}
    syncHotkeysTable();
  }

  function init() {
    const bEdit = el(IDs.edit);
    const bSave = el(IDs.save);
    const bDiscard = el(IDs.discard);
    const bReset = el(IDs.reset);

    if (bEdit) bEdit.addEventListener("click", enterEditMode);
    if (bSave) bSave.addEventListener("click", exitEditModeKeep);
    if (bDiscard) bDiscard.addEventListener("click", exitEditModeDiscard);
    if (bReset) bReset.addEventListener("click", resetToDefaults);

    syncLabelAndButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

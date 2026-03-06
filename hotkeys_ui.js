// hotkeys_ui.js
// UI for "Редактирование хоткеев":
// - "Редактировать" (включает кастомный режим)
// - "Сохранить" (выходит из режима, оставляя изменения)
// - "Не сохранять" (откатывает к снимку на момент входа и выходит)
// - "Сброс к исходным" (возвращает дефолты и остаётся в режиме)

(function () {
  if (typeof window === "undefined") return;

  window.hotkeysMode = window.hotkeysMode || "builtin";

  const IDs = {
    edit: "hkEditBtn",
    save: "hkSaveBtn",
    discard: "hkDiscardBtn",
    reset: "hotkeysResetBtn",
  };

  let snapshot = null;

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

  function platform() {
    return window.hotkeys?.getPlatformInfo?.() || { primaryToken: "Primary", primaryLabel: "Ctrl" };
  }

  function prettyHotkey(v) {
    const { primaryToken, primaryLabel } = platform();

    if (typeof v !== "string") return String(v ?? "");
    if (v.trim() === "+") return "+";

    const rawTokens = v.split("+").map((s) => s.trim()).filter(Boolean);
    if (!rawTokens.length) return "";

    const prio = (t) => {
      if (t === primaryToken) return 1;
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
      if (t === primaryToken) return primaryLabel; // Ctrl / Cmd
      if (t === "Plus") return "+";
      if (t === "ArrowUp") return "↑";
      if (t === "ArrowDown") return "↓";
      if (t === "ArrowLeft") return "←";
      if (t === "ArrowRight") return "→";
      if (t === "DblClick") return "DblClick";
      return t;
    };

    // Пользователь в UI видит “Ctrl/Cmd”
    return tokens.map(mapToken).join("+");
  }

  function syncLabelAndButtons() {
    const bEdit = el(IDs.edit);
    const bSave = el(IDs.save);
    const bDiscard = el(IDs.discard);
    const bReset = el(IDs.reset);

    const on = isEditing();

    setInactive(bEdit, on);
    setPressed(bEdit, on);

    setInactive(bSave, !on);
    setInactive(bDiscard, !on);
    setInactive(bReset, !on);
  }

  function syncHotkeysTable() {
    try {
      document.querySelectorAll("td[data-action]").forEach((td) => {
        const action = td.dataset.action;
        const v = window.hotkeys?.get?.(action);
        if (typeof v === "string") td.textContent = prettyHotkey(v);
      });

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

    // На всякий случай: если hotkeys_config загрузился позже — обновим таблицу
    setTimeout(syncHotkeysTable, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

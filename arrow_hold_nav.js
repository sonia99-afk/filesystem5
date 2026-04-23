// Arrow-hold repeat that cooperates with existing hotkey system (no conflicts)
(function () {
  const INITIAL_DELAY = 450;
  const REPEAT_MS = 60;

  let heldCode = null;     // ArrowUp/Down/Left/Right
  let heldAction = null;   
  let tStart = null;
  let tRepeat = null;

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || el.isContentEditable;
  }

  function stop() {
    heldCode = null;
    heldAction = null;
    if (tStart) { clearTimeout(tStart); tStart = null; }
    if (tRepeat) { clearInterval(tRepeat); tRepeat = null; }
  }

  function canRunNow() {
    if (typeof isTreeLocked === "function" && isTreeLocked()) return false;
    if (typeof treeHasFocus !== "undefined" && !treeHasFocus) return false;
    if (typeof selectedId === "undefined" || !selectedId) return false;
    return true;
  }

  function step(action) {
    if (!canRunNow()) return;

    switch (action) {
      case "rangeUp":
        return window.multiSelect?.handleRangeKey?.(-1);

      case "rangeDown":
        return window.multiSelect?.handleRangeKey?.(+1);

      case "deepUp":
        return window.multiSelectDeep?.handleDeepRangeKey?.(-1);

      case "deepDown":
        return window.multiSelectDeep?.handleDeepRangeKey?.(+1);

      // Эти функции — из app.js (глобальные)
      case "navUp":    return (typeof moveSelection === "function") ? moveSelection(-1) : undefined;
      case "navDown":  return (typeof moveSelection === "function") ? moveSelection(+1) : undefined;
      case "navLeft":  return (typeof goParent === "function") ? goParent(selectedId) : undefined;
      case "navRight": return (typeof goDeeper === "function") ? goDeeper(selectedId) : undefined;

      case "moveUp":   return (typeof moveByVisibleOrder === "function") ? moveByVisibleOrder(-1) : undefined;
      case "moveDown": return (typeof moveByVisibleOrder === "function") ? moveByVisibleOrder(+1) : undefined;

      case "levelNavUp":
        return window.levelNav?.up?.();

      case "levelNavDown":
        return window.levelNav?.down?.();

        case "branchNavLeft":
          return window.branchNav?.left?.();

        case "branchNavRight":
          return window.branchNav?.right?.();

        case "levelMoveUp":
          return window.levelMove?.up?.();

        case "levelMoveDown":
          return window.levelMove?.down?.();

          case "branchMoveLeft":
            return window.branchMove?.left?.();

          case "branchMoveRight":
            return window.branchMove?.right?.();

            case "branchRangeLeft":
  return window.multiSelectBranch?.handleBranchRangeKey?.(-1);

case "branchRangeRight":
  return window.multiSelectBranch?.handleBranchRangeKey?.(+1);
    }
  }

  function startRepeat(action, code) {
    stop();
    heldAction = action;
    heldCode = code;

    // первый шаг НЕ делаем: его уже делает твоя обычная обработка хоткеев
    tStart = setTimeout(() => {
      if (!heldAction || !heldCode) return;

      tRepeat = setInterval(() => {
        if (!heldAction || !heldCode) return;
        step(heldAction);
      }, REPEAT_MS);
    }, INITIAL_DELAY);
  }

  function resolveArrowActionFromEvent(e) {
    // стрелки только
    const code = e.code;
    if (code !== "ArrowUp" && code !== "ArrowDown" && code !== "ArrowLeft" && code !== "ArrowRight") return null;

    // если нет isHotkey (по какой-то причине) — ничего не делаем
    if (typeof isHotkey !== "function") return null;

    // На всякий случай: в режиме редактирования хоткеев не вмешиваемся
    if (window.hotkeysMode === "custom") return null;

    // Порядок важен: сначала более специфичные мультивыделения,
    // потом обычная навигация/перемещение.
    if (isHotkey(e, "rangeUp"))   return "rangeUp";
    if (isHotkey(e, "rangeDown")) return "rangeDown";
    if (isHotkey(e, "deepUp"))    return "deepUp";
    if (isHotkey(e, "deepDown"))  return "deepDown";

    if (isHotkey(e, "indent"))    return "indent";
    if (isHotkey(e, "outdent"))   return "outdent";
    if (isHotkey(e, "moveUp"))    return "moveUp";
    if (isHotkey(e, "moveDown"))  return "moveDown";
    if (isHotkey(e, "levelNavUp"))   return "levelNavUp";
    if (isHotkey(e, "levelNavDown")) return "levelNavDown";
    if (isHotkey(e, "branchNavLeft"))  return "branchNavLeft";
    if (isHotkey(e, "branchNavRight")) return "branchNavRight";
    if (isHotkey(e, "levelMoveUp"))   return "levelMoveUp";
    if (isHotkey(e, "levelMoveDown")) return "levelMoveDown";
    if (isHotkey(e, "branchMoveLeft"))  return "branchMoveLeft";
    if (isHotkey(e, "branchMoveRight")) return "branchMoveRight";
    if (isHotkey(e, "branchRangeLeft"))  return "branchRangeLeft";
if (isHotkey(e, "branchRangeRight")) return "branchRangeRight";
    if (isHotkey(e, "navLeft"))   return "navLeft";
    if (isHotkey(e, "navRight"))  return "navRight";
    if (isHotkey(e, "navUp"))     return "navUp";
    if (isHotkey(e, "navDown"))   return "navDown";

    return null;
  }

  // ВАЖНО:
  // - capture=true, чтобы увидеть событие даже если дальше кто-то сделает preventDefault/stopPropagation
  // - но мы НЕ предотвращаем и НЕ останавливаем событие → не ломаем существующую логику
  window.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.repeat) return; // таймеры заменяют repeat

    const action = resolveArrowActionFromEvent(e);
    if (!action) return;

    // Запускаем только если дерево вообще может принимать команды
    if (!canRunNow()) return;

    startRepeat(action, e.code);
  }, true);

  // Останавливаемся по отпусканию стрелки
  window.addEventListener("keyup", (e) => {
    if (!heldCode) return;

    // если отпустили ту же стрелку — стоп
    if (e.code === heldCode) stop();

    // Доп. защита от “смены модификатора на ходу”:
    // если отпустили Shift/Alt/Ctrl/Meta пока держим стрелку — стоп,
    // чтобы не повторять уже “не ту” команду.
    if (e.key === "Shift" || e.key === "Alt" || e.key === "Control" || e.key === "Meta" || e.key === "OS") {
      stop();
    }
  }, true);

  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
})();
// branch_nav.js
// Строгая навигация по текущей ветке:
// branchNavRight -> первый ребёнок
// branchNavLeft  -> родитель

(function () {
    if (typeof window === "undefined") return;
  
    function isEditingNow() {
      const ae = document.activeElement;
      if (!ae) return false;
      if (ae.tagName === "INPUT" && ae.classList?.contains("edit")) return true;
      if (ae.tagName === "TEXTAREA" && ae.classList?.contains("tg-export")) return true;
      if (ae.isContentEditable) return true;
      return false;
    }
  
    function branchNavRight() {
      if (!selectedId) return false;
  
      const childId = firstChildOf(selectedId);
      if (!childId) return false;
  
      selectedId = childId;
      treeHasFocus = true;
      render();
      return true;
    }
  
    function branchNavLeft() {
      if (!selectedId) return false;
  
      const p = parentOf(selectedId);
      if (!p) return false;
  
      selectedId = p;
      treeHasFocus = true;
      render();
      return true;
    }
  
    window.addEventListener(
      "keydown",
      (e) => {
        if (window.hotkeysMode === "custom") return;
        if (isEditingNow()) return;
        if (typeof isHotkey !== "function") return;
        if (!treeHasFocus) return;
        if (!selectedId) return;
  
        if (isHotkey(e, "branchNavLeft")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          branchNavLeft();
          return;
        }
  
        if (isHotkey(e, "branchNavRight")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          branchNavRight();
        }
      },
      true
    );
  
    window.branchNav = {
      left: branchNavLeft,
      right: branchNavRight,
    };
  })();
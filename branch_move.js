// branch_move.js
// Дополнительное перемещение по ветке на основе старой проверенной логики:
// Shift+Alt+ArrowLeft  -> outdentNode(selectedId)
// Shift+Alt+ArrowRight -> indentNode(selectedId)

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
  
    function moveBranchLeft() {
      if (!selectedId) return false;
      if (selectedId === root.id) return false;
      if (typeof outdentNode !== "function") return false;
  
      outdentNode(selectedId);
      return true;
    }
  
    function moveBranchRight() {
      if (!selectedId) return false;
      if (selectedId === root.id) return false;
      if (typeof indentNode !== "function") return false;
  
      indentNode(selectedId);
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
  
        if (isHotkey(e, "branchMoveLeft")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          moveBranchLeft();
          return;
        }
  
        if (isHotkey(e, "branchMoveRight")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          moveBranchRight();
        }
      },
      true
    );
  
    window.branchMove = {
      left() {
        return moveBranchLeft();
      },
      right() {
        return moveBranchRight();
      },
    };
  })();
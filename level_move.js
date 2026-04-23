// level_move.js
// Перемещение по одному level:
// Shift+Alt+ArrowUp / Shift+Alt+ArrowDown
// Логика аналогична level_nav.js, но вместо навигации двигает узел.

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
  
    function collectNodesOfSameLevel(targetLevel) {
      const out = [];
  
      (function walk(node) {
        if (!node) return;
  
        if (node.level === targetLevel) {
          out.push(node.id);
        }
  
        for (const ch of (node.children || [])) {
          walk(ch);
        }
      })(root);
  
      return out;
    }
  
    // function moveByLevel(dir) {
    //   if (!selectedId) return false;
    //   if (selectedId === root.id) return false;
    //   if (dir !== -1 && dir !== 1) return false;
  
    //   const found = findWithParent(root, selectedId);
    //   if (!found || !found.node) return false;
  
    //   const level = found.node.level;
    //   const ids = collectNodesOfSameLevel(level);
    //   if (!ids.length) return false;
  
    //   const idx = ids.indexOf(selectedId);
    //   if (idx < 0) return false;
  
    //   const targetId = ids[idx + dir];
    //   if (!targetId) return false;
    //   if (targetId === selectedId) return false;
  
    //   if (dir === -1) {
    //     return moveNodeRelativeToTarget(selectedId, targetId, "before");
    //   }
  
    //   return moveNodeRelativeToTarget(selectedId, targetId, "after");
    // }

    function moveByLevel(dir) {
        if (!selectedId) return false;
        if (selectedId === root.id) return false;
        if (dir !== -1 && dir !== 1) return false;
      
        const found = findWithParent(root, selectedId);
        if (!found || !found.node) return false;
      
        const level = found.node.level;
        const ids = collectNodesOfSameLevel(level);
        if (!ids.length) return false;
      
        const idx = ids.indexOf(selectedId);
        if (idx < 0) return false;
      
        const targetId = ids[idx + dir];
        if (!targetId) return false;
        if (targetId === selectedId) return false;
      
        const selectedParentId = parentOf(selectedId);
        const targetParentId = parentOf(targetId);
        const sameParent = selectedParentId === targetParentId;
      
        if (dir === -1) {
          return moveNodeRelativeToTarget(
            selectedId,
            targetId,
            sameParent ? "before" : "after"
          );
        }
      
        return moveNodeRelativeToTarget(
          selectedId,
          targetId,
          sameParent ? "after" : "before"
        );
      }
  
    window.addEventListener(
      "keydown",
      (e) => {
        if (window.hotkeysMode === "custom") return;
        if (isEditingNow()) return;
        if (typeof isHotkey !== "function") return;
        if (!treeHasFocus) return;
        if (!selectedId) return;
  
        if (isHotkey(e, "levelMoveUp")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          moveByLevel(-1);
          return;
        }
  
        if (isHotkey(e, "levelMoveDown")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          moveByLevel(+1);
        }
      },
      true
    );
  
    window.levelMove = {
      up() {
        return moveByLevel(-1);
      },
      down() {
        return moveByLevel(+1);
      },
    };
  })();
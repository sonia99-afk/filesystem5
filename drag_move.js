(function () {

    let dragId = null;
    
    function rowFromEvent(e){
      return e.target.closest(".row");
    }
    
    document.addEventListener("mousedown", (e)=>{
      const row = rowFromEvent(e);
      if(!row) return;
    
      dragId = row.dataset.id;
    });
    
    document.addEventListener("mouseup", (e)=>{
      if(!dragId) return;
    
      const row = rowFromEvent(e);
      if(!row){
        dragId = null;
        return;
      }
    
      const targetId = row.dataset.id;
    
      if(targetId !== dragId){
        moveNode(dragId, targetId);
      }
    
      dragId = null;
    });
    
    function moveNode(id, targetId){
        const r1 = findWithParent(root, id);
        const r2 = findWithParent(root, targetId);
      
        if(!r1 || !r2 || !r2.parent) return;
      
        pushHistory();
      
        // запоминаем: было ли имя дефолтным ДО смены уровня
        const wasDefault = (String(r1.node.name || "").trim() === String(DEFAULT_NAME[r1.node.level] || "").trim());
      
        const fromParent = r1.parent;
        const toParent = r2.parent;
      
        // переместить рядом (после target)
        fromParent.children = fromParent.children.filter(n => n.id !== id);
        const idx = toParent.children.findIndex(n => n.id === targetId);
        toParent.children.splice(idx + 1, 0, r1.node);
      
        // ✅ подогнать уровень под уровень цели
        const newLevel = r2.node.level;
        const delta = newLevel - r1.node.level;
      
        if (delta !== 0) {
          if (typeof shiftSubtreeLevel === "function") {
            // shiftSubtreeLevel сам обновит дефолтные имена в поддереве
            const ok = shiftSubtreeLevel(r1.node, delta);
            if (!ok) { undo(); return; }
          } else {
            r1.node.level = newLevel;
          }
        }
      
        // ✅ если имя было дефолтным — поставить дефолт для НОВОГО уровня
        if (wasDefault) {
          const def = DEFAULT_NAME[r1.node.level];
          if (def) r1.node.name = def;
        }
      
        selectedId = id;
        render();
      }
    
    })();
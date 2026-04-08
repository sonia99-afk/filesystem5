(function () {
    if (typeof window === "undefined") return;
  
    const HOST_ID = "tree";
  
    const clipboard = {
      mode: null,             // "copy" | "cut"
      items: [],
      sourceParentId: null,
      insertAfterId: null,
      sourceIds: [],
    };
  
    function host() {
      return document.getElementById(HOST_ID);
    }
  
    function isEditingNow() {
      const ae = document.activeElement;
      if (!ae) return false;
      if (ae.tagName === "INPUT" && ae.classList?.contains("edit")) return true;
      if (ae.tagName === "TEXTAREA" && ae.classList?.contains("tg-export")) return true;
      if (ae.isContentEditable) return true;
      return false;
    }
  
    function getSelectedIdsFromDomOrCurrent() {
      const h = host();
      if (!h) return selectedId ? [selectedId] : [];
  
      const multi = Array.from(h.querySelectorAll(".row.multi"))
        .map((r) => r.dataset?.id)
        .filter(Boolean);
  
      if (multi.length) return multi;
      return selectedId ? [selectedId] : [];
    }
  
    function filterTopmost(ids) {
      const set = new Set(ids);
      return ids.filter((id) => {
        let cur = id;
        while (true) {
          const p = parentOf(cur);
          if (!p) return true;
          if (set.has(p)) return false;
          cur = p;
        }
      });
    }
  
    function cloneMapValue(v) {
      if (v == null) return v;
      if (typeof v !== "object") return v;
      return JSON.parse(JSON.stringify(v));
    }
  
    function clearClipboard() {
      clipboard.mode = null;
      clipboard.items = [];
      clipboard.sourceParentId = null;
      clipboard.insertAfterId = null;
      clipboard.sourceIds = [];
    }
  
    function clearMultiSelectionIfPossible() {
      try { window.multiSelect?.clear?.(); } catch (_) {}
      try { window.multiSelectDeep?.clear?.(); } catch (_) {}
    }
  
    function cloneNodeDeepWithNewIds(node, idMap) {
      const newId = uid();
      idMap.set(node.id, newId);
  
      return {
        id: newId,
        level: node.level,
        name: node.name,
        nameHtml: node.nameHtml || "",
        captions: (node.captions || []).map((cap) => ({
          id: uid(),
          text: cap.text || "",
          textHtml: cap.textHtml || ""
        })),
        children: (node.children || []).map((ch) => cloneNodeDeepWithNewIds(ch, idMap))
      };
    }
  
    function collectSideMapsForIds(ids) {
      const fmtMap = Object.create(null);
      const colorFmtMap = Object.create(null);
      const blockBgMap = Object.create(null);
  
      for (const oldId of ids) {
        if (window.__fmtMap?.[oldId]) {
          fmtMap[oldId] = cloneMapValue(window.__fmtMap[oldId]);
        }
        if (window.__colorFmtMap?.[oldId]) {
          colorFmtMap[oldId] = cloneMapValue(window.__colorFmtMap[oldId]);
        }
        if (window.__blockBgMap?.[oldId]) {
          blockBgMap[oldId] = cloneMapValue(window.__blockBgMap[oldId]);
        }
      }
  
      return { fmtMap, colorFmtMap, blockBgMap };
    }
  
    function copySideMapsFromStoredItem(item, newIdMap) {
      window.__fmtMap ||= Object.create(null);
      window.__colorFmtMap ||= Object.create(null);
      window.__blockBgMap ||= Object.create(null);
  
      const originalToClipboardId = new Map(item.originalToClipboardId || []);
  
      for (const [originalId, clipboardId] of originalToClipboardId.entries()) {
        const newId = newIdMap.get(clipboardId);
        if (!newId) continue;
  
        if (item.fmtMap?.[originalId]) {
          window.__fmtMap[newId] = cloneMapValue(item.fmtMap[originalId]);
        }
  
        if (item.colorFmtMap?.[originalId]) {
          window.__colorFmtMap[newId] = cloneMapValue(item.colorFmtMap[originalId]);
        }
  
        if (item.blockBgMap?.[originalId]) {
          window.__blockBgMap[newId] = cloneMapValue(item.blockBgMap[originalId]);
        }
      }
    }
  
    function buildClipboardPayload(mode) {
      const rawIds = getSelectedIdsFromDomOrCurrent();
      const ids = filterTopmost(rawIds).filter(Boolean);
  
      if (!ids.length) return false;
  
      const first = findWithParent(root, ids[0]);
      if (!first || !first.parent) return false;
  
      const sourceParentId = first.parent.id;
      const insertAfterId = ids[ids.length - 1];
  
      const items = ids.map((id) => {
        const found = findWithParent(root, id);
        if (!found) return null;
  
        const originalToClipboardId = new Map();
        const nodeClone = cloneNodeDeepWithNewIds(found.node, originalToClipboardId);
  
        const allOriginalIds = Array.from(originalToClipboardId.keys());
        const sideMaps = collectSideMapsForIds(allOriginalIds);
  
        return {
          sourceId: id,
          node: nodeClone,
          originalToClipboardId: Array.from(originalToClipboardId.entries()),
          fmtMap: sideMaps.fmtMap,
          colorFmtMap: sideMaps.colorFmtMap,
          blockBgMap: sideMaps.blockBgMap,
        };
      }).filter(Boolean);
  
      if (!items.length) return false;
  
      clipboard.mode = mode;
      clipboard.items = items;
      clipboard.sourceParentId = sourceParentId;
      clipboard.insertAfterId = insertAfterId;
      clipboard.sourceIds = ids.slice();
  
      return true;
    }
  
    function removeSourceIds(ids) {
      const topmost = filterTopmost(ids).filter((id) => id && id !== root.id);
  
      for (const id of topmost) {
        const found = findWithParent(root, id);
        if (!found || !found.parent) continue;
  
        found.parent.children = (found.parent.children || []).filter((x) => x.id !== id);
  
        try {
          delete window.__fmtMap?.[id];
          delete window.__colorFmtMap?.[id];
          delete window.__blockBgMap?.[id];
        } catch (_) {}
      }
    }
  
    function doCopy() {
      return buildClipboardPayload("copy");
    }
  
    function doCut() {
      const ok = buildClipboardPayload("cut");
      if (!ok) return false;
  
      pushHistory();
      removeSourceIds(clipboard.sourceIds);
  
      selectedId = clipboard.sourceParentId || root.id;
      treeHasFocus = true;
      clearMultiSelectionIfPossible();
      render();
  
      return true;
    }
  
    function doPaste() {
      if (!clipboard.items?.length) return false;
  
      const parentFound = clipboard.sourceParentId
        ? findWithParent(root, clipboard.sourceParentId)
        : null;
  
      const parentNode = parentFound?.node || root;
      parentNode.children ||= [];
  
      let insertIndex = parentNode.children.findIndex((x) => x.id === clipboard.insertAfterId);
      if (insertIndex < 0) insertIndex = parentNode.children.length - 1;
  
      const clones = clipboard.items.map((item) => {
        const newIdMap = new Map();
        const nodeClone = cloneNodeDeepWithNewIds(item.node, newIdMap);
        copySideMapsFromStoredItem(item, newIdMap);
        return nodeClone;
      });
  
      if (!clones.length) return false;
  
      pushHistory();
      parentNode.children.splice(insertIndex + 1, 0, ...clones);
  
      selectedId = clones[0]?.id || selectedId;
      treeHasFocus = true;
      clearMultiSelectionIfPossible();
      render();
  
      if (clipboard.mode === "cut") {
        clearClipboard();
      } else {
        clipboard.insertAfterId = clones[clones.length - 1]?.id || clipboard.insertAfterId;
      }
  
      return true;
    }

    function doDuplicate() {
        const rawIds = getSelectedIdsFromDomOrCurrent();
        const ids = filterTopmost(rawIds).filter(Boolean);
      
        if (!ids.length) return false;
      
        const first = findWithParent(root, ids[0]);
        if (!first || !first.parent) return false;
      
        const parentNode = first.parent;
        parentNode.children ||= [];
      
        // находим индекс последнего выбранного
        const insertAfterId = ids[ids.length - 1];
        let insertIndex = parentNode.children.findIndex(x => x.id === insertAfterId);
        if (insertIndex < 0) insertIndex = parentNode.children.length - 1;
      
        const clones = ids.map((id) => {
          const found = findWithParent(root, id);
          if (!found) return null;
      
          // 1. оригинал -> clipboard clone
          const originalToClipboardId = new Map();
          const nodeClone = cloneNodeDeepWithNewIds(found.node, originalToClipboardId);
      
          const allOriginalIds = Array.from(originalToClipboardId.keys());
          const sideMaps = collectSideMapsForIds(allOriginalIds);
      
          const item = {
            node: nodeClone,
            originalToClipboardId: Array.from(originalToClipboardId.entries()),
            fmtMap: sideMaps.fmtMap,
            colorFmtMap: sideMaps.colorFmtMap,
            blockBgMap: sideMaps.blockBgMap,
          };
      
          // 2. clipboard clone -> финальный clone
          const newIdMap = new Map();
          const finalClone = cloneNodeDeepWithNewIds(item.node, newIdMap);
      
          copySideMapsFromStoredItem(item, newIdMap);
      
          return finalClone;
        }).filter(Boolean);
      
        if (!clones.length) return false;
      
        pushHistory();
      
        parentNode.children.splice(insertIndex + 1, 0, ...clones);
      
        selectedId = clones[0]?.id || selectedId;
        treeHasFocus = true;
        clearMultiSelectionIfPossible();
        render();
      
        return true;
      }
  
    function onKeyDown(e) {
      if (window.hotkeysMode === "custom") return;
      if (isEditingNow()) return;
      if (!treeHasFocus) return;
      if (typeof isHotkey !== "function") return;
  
      if (isHotkey(e, "copy")) {
        if (doCopy()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        }
        return;
      }
  
      if (isHotkey(e, "cut")) {
        if (doCut()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        }
        return;
      }
  
      if (isHotkey(e, "paste")) {
        if (doPaste()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        }
      }

      if (isHotkey(e, "duplicate")) {
        if (doDuplicate()) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        }
        return;
      }
    }
  
    window.addEventListener("keydown", onKeyDown, true);
  
    window.treeClipboardOps = {
      copy: doCopy,
      cut: doCut,
      paste: doPaste,
      clear: clearClipboard,
      debug() {
        return {
          mode: clipboard.mode,
          sourceParentId: clipboard.sourceParentId,
          insertAfterId: clipboard.insertAfterId,
          sourceIds: clipboard.sourceIds.slice(),
          itemsCount: clipboard.items.length,
        };
      }
    };
  })();
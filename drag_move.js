(function () {
  if (typeof window === "undefined") return;

  const DRAG_THRESHOLD = 4;
  const INDENT_TRIGGER_PX = 22;
  const STROKE = "1px dashed #5D5D5D";
  const BRANCH_LEN = 16;

  let dragId = null;
  let dragStart = null;
  let isDragging = false;
  let dropPreview = null;
  let overlay = null;

  function rowFromEvent(e) {
    return e.target?.closest?.(".row") || null;
  }

  function liOfRow(row) {
    return row?.closest?.("li") || null;
  }

  function ulOfRow(row) {
    const li = liOfRow(row);
    return li?.parentElement?.tagName === "UL" ? li.parentElement : null;
  }

  function getDirectChildRows(ul) {
    if (!ul) return [];

    return Array.from(ul.children)
      .filter((el) => el.tagName === "LI")
      .map((li) => li.querySelector(":scope > .row"))
      .filter(Boolean);
  }

  function visibleRows() {
    return Array.from(document.querySelectorAll("#tree .row[data-id]"));
  }

  function visiblePreviousRow(row) {
    const rows = visibleRows();
    const idx = rows.indexOf(row);
    return idx > 0 ? rows[idx - 1] : null;
  }

  function getTrunkXForUl(ul) {
    if (!ul) return 0;

    const rect = ul.getBoundingClientRect();
    const cs = getComputedStyle(ul);
    const trunkX = parseFloat(cs.getPropertyValue("--trunk-x")) || 0;
    const shift = parseFloat(cs.getPropertyValue("--trunk-shift")) || 0;

    return rect.left + trunkX + shift;
  }

  function rowCenterY(row) {
    const rect = row.getBoundingClientRect();
    return rect.top + rect.height / 2;
  }

  function averageLevelGap(rowsInLevel) {
    if (!rowsInLevel || rowsInLevel.length < 2) return 24;

    let sum = 0;
    let count = 0;

    for (let i = 0; i < rowsInLevel.length - 1; i++) {
      const gap = rowCenterY(rowsInLevel[i + 1]) - rowCenterY(rowsInLevel[i]);
      if (gap > 0) {
        sum += gap;
        count++;
      }
    }

    return count ? sum / count : 24;
  }

  function isDescendantId(ancestorId, maybeDescId) {
    if (!ancestorId || !maybeDescId || ancestorId === maybeDescId) return false;

    let cur = maybeDescId;
    while (cur) {
      const p = parentOf(cur);
      if (!p) return false;
      if (p === ancestorId) return true;
      cur = p;
    }

    return false;
  }

  function maxLevelInNode(node) {
    if (!node) return LEVEL.COMPANY;

    if (typeof getMaxLevelInSubtree === "function") {
      return getMaxLevelInSubtree(node);
    }

    let max = node.level;
    for (const ch of node.children || []) {
      max = Math.max(max, maxLevelInNode(ch));
    }
    return max;
  }

  function canPlaceSubtreeAtLevel(dragNode, newRootLevel) {
    if (!dragNode) return false;
    if (newRootLevel < LEVEL.COMPANY || newRootLevel > LEVEL.STEP) return false;

    const delta = newRootLevel - dragNode.level;
    const maxLevel = maxLevelInNode(dragNode);

    if (maxLevel + delta > LEVEL.STEP) return false;
    if (dragNode.level + delta < LEVEL.COMPANY) return false;

    return true;
  }

  function canMoveToChild(dragNode, targetNode) {
    if (!dragNode || !targetNode) return false;
    if (dragNode.id === targetNode.id) return false;
    if (isDescendantId(dragNode.id, targetNode.id)) return false;
    if (typeof canHaveChild === "function" && !canHaveChild(targetNode)) return false;

    return canPlaceSubtreeAtLevel(dragNode, targetNode.level + 1);
  }

  function ensureOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "drop-preview-overlay";
    overlay.innerHTML = `
      <div class="drop-preview-h"></div>
      <div class="drop-preview-v"></div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  function getParts() {
    const o = ensureOverlay();

    return {
      root: o,
      h: o.querySelector(".drop-preview-h"),
      v: o.querySelector(".drop-preview-v"),
    };
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.style.display = "none";
  }

  function renderPreview(preview) {
    if (!preview) {
      hideOverlay();
      return;
    }

    const { root, h, v } = getParts();
    root.style.display = "block";

    h.style.display = "block";
    h.style.left = `${Math.round(preview.horizontalStartX)}px`;
    h.style.top = `${Math.round(preview.lineY)}px`;
    h.style.width = `${BRANCH_LEN}px`;
    h.style.borderTop = STROKE;

    if (preview.showVertical) {
      v.style.display = "block";
      v.style.left = `${Math.round(preview.verticalX)}px`;
      v.style.top = `${Math.round(preview.verticalFromY)}px`;
      v.style.height = `${Math.max(4, Math.round(preview.verticalHeight))}px`;
      v.style.borderLeft = STROKE;
    } else {
      v.style.display = "none";
    }
  }

  function clearDragState() {
    dragId = null;
    dragStart = null;
    isDragging = false;
    dropPreview = null;
    hideOverlay();
  }

  function samePreview(a, b) {
    if (!a || !b) return false;

    return (
      a.kind === b.kind &&
      a.targetId === b.targetId &&
      a.insertMode === b.insertMode &&
      a.parentId === b.parentId
    );
  }

  function buildPreview(row, clientX, clientY) {
    if (!dragId || !row) return null;

    const dragInfo = findWithParent(root, dragId);
    const targetId = row.dataset.id;
    const targetInfo = findWithParent(root, targetId);

    if (!dragInfo || !targetInfo) return null;
    if (dragId === targetId) return null;
    if (isDescendantId(dragId, targetId)) return null;

    const rowRect = row.getBoundingClientRect();
    const ul = ulOfRow(row);
    const li = liOfRow(row);

    if (!ul || !li) return null;

    const rowsInLevel = getDirectChildRows(ul);
    const rowIdx = rowsInLevel.indexOf(row);
    const isLast = rowIdx === rowsInLevel.length - 1;

    const prevSameLevel = rowIdx > 0 ? rowsInLevel[rowIdx - 1] : null;
    const prevVisible = visiblePreviousRow(row);
    const separatedByNested =
      !!prevVisible && !!prevSameLevel && prevVisible !== prevSameLevel;

    averageLevelGap(rowsInLevel);

    const topZone = rowRect.top + rowRect.height * 0.28;
    const lowerHalf = rowRect.top + rowRect.height * 0.5;

    const wantChild =
      clientX >= rowRect.left + INDENT_TRIGGER_PX &&
      canMoveToChild(dragInfo.node, targetInfo.node);

    if (targetId === root.id && !wantChild) return null;

    const hasChildren = !!(
      targetInfo.node.children && targetInfo.node.children.length
    );

    // Для вставки рядом / до / после target корень перемещаемого блока
    // должен стать уровнем target
    if (!canPlaceSubtreeAtLevel(dragInfo.node, targetInfo.node.level)) {
      return null;
    }

    // 5. На новый уровень вложения
    if (wantChild && !hasChildren) {
      const firstLetterEndX = rowRect.left + 8;
      const isRootLevel = ul.dataset.level === "0";
      const lineY = rowRect.bottom + (isRootLevel ? -1 : 2);
      const verticalHeight = Math.max(4, rowRect.height / 4);

      return {
        kind: "first-in-new-child-level",
        dragId,
        targetId,
        parentId: targetId,
        insertMode: "into-first",
        lineY,
        horizontalStartX: firstLetterEndX,
        horizontalEndX: firstLetterEndX + BRANCH_LEN,
        showVertical: true,
        verticalX: firstLetterEndX,
        verticalFromY: lineY - verticalHeight,
        verticalHeight,
      };
    }

    // 4. Первым в уровне вложения
    if (wantChild && hasChildren) {
      const childUl = li.querySelector(":scope > ul");
      const firstChildRow =
        childUl?.querySelector(":scope > li > .row") || null;

      if (!childUl || !firstChildRow) return null;

      const childTrunkX = getTrunkXForUl(childUl);
      const firstChildRect = firstChildRow.getBoundingClientRect();

      return {
        kind: "first-in-existing-child-level",
        dragId,
        targetId,
        parentId: targetId,
        insertMode: "into-first",
        lineY: (rowRect.bottom + firstChildRect.top) / 2,
        horizontalStartX: childTrunkX,
        horizontalEndX: childTrunkX + BRANCH_LEN,
        showVertical: false,
        verticalX: 0,
        verticalFromY: 0,
        verticalHeight: 0,
      };
    }

    // 3. Последним на одном уровне
    if (isLast && clientY >= lowerHalf) {
      const lineX = getTrunkXForUl(ul);
      const lineY = rowRect.bottom + 2;
      const verticalHeight = Math.max(6, rowRect.height / 2);

      return {
        kind: "last-in-level",
        dragId,
        targetId,
        parentId: targetInfo.parent ? targetInfo.parent.id : null,
        insertMode: "after",
        lineY,
        horizontalStartX: lineX,
        horizontalEndX: lineX + BRANCH_LEN,
        showVertical: true,
        verticalX: lineX,
        verticalFromY: lineY - verticalHeight,
        verticalHeight,
      };
    }

    // 2. Между равными блоками, но разделены вложенностью
    if (clientY <= topZone && separatedByNested && prevVisible) {
      const prevVisibleRect = prevVisible.getBoundingClientRect();
      const lineX = getTrunkXForUl(ul);

      return {
        kind: "between-after-nested",
        dragId,
        targetId,
        parentId: targetInfo.parent ? targetInfo.parent.id : null,
        insertMode: "before",
        lineY: (prevVisibleRect.bottom + rowRect.top) / 2,
        horizontalStartX: lineX,
        horizontalEndX: lineX + BRANCH_LEN,
        showVertical: false,
        verticalX: 0,
        verticalFromY: 0,
        verticalHeight: 0,
      };
    }

    // 1. Между равными блоками на одном уровне
    // if (clientY <= topZone && prevSameLevel) {
    //   const prevRect = prevSameLevel.getBoundingClientRect();
    //   const lineX = getTrunkXForUl(ul);

    //   return {
    //     kind: "between-same-level",
    //     dragId,
    //     targetId,
    //     parentId: targetInfo.parent ? targetInfo.parent.id : null,
    //     insertMode: "before",
    //     lineY: (prevRect.bottom + rowRect.top) / 2,
    //     horizontalStartX: lineX,
    //     horizontalEndX: lineX + BRANCH_LEN,
    //     showVertical: false,
    //     verticalX: 0,
    //     verticalFromY: 0,
    //     verticalHeight: 0,
    //   };
    // }

    // fallback для последнего элемента
    if (isLast) {
      const lineX = getTrunkXForUl(ul);
      const lineY = rowRect.bottom + 2;
      const verticalHeight = Math.max(6, rowRect.height / 2);

      return {
        kind: "last-in-level-fallback",
        dragId,
        targetId,
        parentId: targetInfo.parent ? targetInfo.parent.id : null,
        insertMode: "after",
        lineY,
        horizontalStartX: lineX,
        horizontalEndX: lineX + BRANCH_LEN,
        showVertical: true,
        verticalX: lineX,
        verticalFromY: lineY - verticalHeight,
        verticalHeight,
      };
    }

    // Обычная вставка после элемента
    const fallbackLineX = getTrunkXForUl(ul);

    return {
      kind: "after-fallback",
      dragId,
      targetId,
      parentId: targetInfo.parent ? targetInfo.parent.id : null,
      insertMode: "after",
      lineY: rowRect.bottom + (ul.dataset.level === "0" ? -2 : 1),
      horizontalStartX: fallbackLineX,
      horizontalEndX: fallbackLineX + BRANCH_LEN,
      showVertical: false,
      verticalX: 0,
      verticalFromY: 0,
      verticalHeight: 0,
    };
  }

  function moveNodeByPreview(id, preview) {
    if (!id || !preview) return false;

    const movingInfo = findWithParent(root, id);
    const targetInfo = findWithParent(root, preview.targetId);

    if (!movingInfo || !targetInfo) return false;
    if (movingInfo.node.id === root.id) return false;
    if (isDescendantId(id, preview.targetId)) return false;

    const fromParent = movingInfo.parent;
    if (!fromParent) return false;

    const wasDefault =
      String(movingInfo.node.name || "").trim() ===
      String(DEFAULT_NAME[movingInfo.node.level] || "").trim();

    pushHistory();

    fromParent.children = fromParent.children.filter((n) => n.id !== id);

    let destinationParent = null;
    let insertAt = 0;
    let newLevel = movingInfo.node.level;

    if (preview.insertMode === "into-first") {
      const freshTarget = findWithParent(root, preview.targetId);

      if (!freshTarget) {
        undo();
        return false;
      }

      destinationParent = freshTarget.node;
      destinationParent.children ||= [];
      insertAt = 0;
      newLevel = destinationParent.level + 1;
    } else {
      const freshTarget = findWithParent(root, preview.targetId);

      if (!freshTarget || !freshTarget.parent) {
        undo();
        return false;
      }

      destinationParent = freshTarget.parent;
      destinationParent.children ||= [];

      const targetIdx = destinationParent.children.findIndex(
        (n) => n.id === preview.targetId
      );

      if (targetIdx < 0) {
        undo();
        return false;
      }

      insertAt = preview.insertMode === "before" ? targetIdx : targetIdx + 1;
      newLevel = freshTarget.node.level;
    }

    const delta = newLevel - movingInfo.node.level;

    if (delta !== 0) {
      if (typeof shiftSubtreeLevel === "function") {
        const ok = shiftSubtreeLevel(movingInfo.node, delta);
        if (!ok) {
          undo();
          return false;
        }
      } else {
        movingInfo.node.level = newLevel;
      }
    }

    if (wasDefault) {
      const def = DEFAULT_NAME[movingInfo.node.level];
      if (def) movingInfo.node.name = def;
    }

    destinationParent.children.splice(insertAt, 0, movingInfo.node);

    selectedId = id;
    treeHasFocus = true;
    render();
    return true;
  }

  document.addEventListener(
    "mousedown",
    (e) => {
      const row = rowFromEvent(e);
      if (!row) return;
      if (e.button !== 0) return;
      if (e.target?.closest?.(".act")) return;

      dragId = row.dataset.id;
      dragStart = { x: e.clientX, y: e.clientY };
      isDragging = false;
      dropPreview = null;
    },
    true
  );

  document.addEventListener(
    "mousemove",
    (e) => {
      if (!dragId || !dragStart) return;

      if (!isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        isDragging = true;
      }

      const row = rowFromEvent(e);

      if (!row) {
        if (dropPreview) {
          dropPreview = null;
          hideOverlay();
        }
        return;
      }

      const nextPreview = buildPreview(row, e.clientX, e.clientY);

      if (!nextPreview) {
        if (dropPreview) {
          dropPreview = null;
          hideOverlay();
        }
        return;
      }

      if (samePreview(dropPreview, nextPreview)) return;

      dropPreview = nextPreview;
      renderPreview(dropPreview);
    },
    true
  );

  document.addEventListener(
    "mouseup",
    () => {
      if (!dragId) return;

      const preview = dropPreview;
      const draggedId = dragId;
      const wasDragging = isDragging;

      clearDragState();

      if (!wasDragging || !preview) return;
      moveNodeByPreview(draggedId, preview);
    },
    true
  );

  window.addEventListener("blur", clearDragState);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearDragState();
  });
})();
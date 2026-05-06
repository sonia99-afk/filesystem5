(function () {
  if (typeof window === "undefined") return;

  const UNIT_WIDTH = 170;
  const BASE_HEIGHT = 22;
  const CAPTION_LINE_HEIGHT = 12;
  const GAP = -1;

  window.renderIcicleVerticalView = function renderIcicleVerticalView() {
    syncProjectsSidebar();

    const host = document.getElementById("tree");
    if (!host) return;

    host.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "icicle-vertical-view";

    const leafCount = Math.max(1, countLeaves(root));
    const depth = getTreeDepth(root);
    const rowHeights = buildRowHeights(root, depth);

    const canvas = document.createElement("div");
    canvas.className = "icicle-vertical-canvas";
    canvas.style.width = `${leafCount * UNIT_WIDTH + 1}px`;
    canvas.style.height = `${sum(rowHeights)}px`;

    layoutNode(root, [], 0, 0, leafCount, canvas, rowHeights);

    wrap.appendChild(canvas);
    host.appendChild(wrap);

    requestAnimationFrame(() => {
      updateActiveIcicleVerticalEditHeights();
    });

    if (treeHasFocus) {
      const selectedRow = host.querySelector(`.row[data-id="${cssEscape(selectedId)}"]`);
      selectedRow?.focus({ preventScroll: true });
    }
  };

  function countLeaves(node) {
    if (!node.children || !node.children.length) return 1;

    return node.children.reduce((total, child) => {
      return total + countLeaves(child);
    }, 0);
  }

  function getTreeDepth(node) {
    if (!node.children || !node.children.length) return 0;

    return 1 + Math.max(...node.children.map(getTreeDepth));
  }

  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }

  function topForDepth(rowHeights, depthIndex) {
    let top = 0;

    for (let i = 0; i < depthIndex; i++) {
      top += rowHeights[i] || BASE_HEIGHT;
    }

    return top;
  }

  function buildRowHeights(node, maxDepth) {
    const heights = Array.from({ length: maxDepth + 1 }, () => BASE_HEIGHT);

    walk(node, 0);

    return heights;

    function walk(current, depthIndex) {
      heights[depthIndex] = Math.max(
        heights[depthIndex] || BASE_HEIGHT,
        getNodeHeight(current)
      );

      (current.children || []).forEach((child) => {
        walk(child, depthIndex + 1);
      });
    }
  }

  function countCaptionLines(node) {
    if (!showCaptions || !Array.isArray(node.captions) || !node.captions.length) {
      return 0;
    }

    let lines = 0;

    for (const cap of node.captions) {
      const raw =
        cap.text ||
        htmlPlainTextSafe(cap.textHtml || "") ||
        "";

      const lineCount =
        raw
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean).length || 1;

      lines += Math.min(lineCount, 3);
    }

    return lines;
  }

  function htmlPlainTextSafe(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return tmp.textContent || "";
  }

  function getNodeHeight(node) {
    const captionLines = countCaptionLines(node);

    if (!captionLines) {
      return BASE_HEIGHT;
    }

    return BASE_HEIGHT + captionLines * CAPTION_LINE_HEIGHT + 4;
  }

  function layoutNode(node, ordinalPath, depthIndex, startLeaf, leafSpan, canvas, rowHeights) {
    const block = createIcicleVerticalBlock(node, ordinalPath);

    block.style.left = `${startLeaf * UNIT_WIDTH}px`;
    block.style.top = `${topForDepth(rowHeights, depthIndex)}px`;
    if (depthIndex === 0 && node.children?.length) {
      const childrenWidth = node.children.reduce((sum, child) => {
        return sum + (countLeaves(child) * UNIT_WIDTH - GAP);
      }, 0);
    
      block.style.width = `${childrenWidth + 2}px`;
    } else {
      block.style.width = `${leafSpan * UNIT_WIDTH - GAP}px`;
    }
    block.style.height = `${(rowHeights[depthIndex] || BASE_HEIGHT) - GAP}px`;

    canvas.appendChild(block);

    if (!node.children || !node.children.length) return;

    let cursor = startLeaf;

    node.children.forEach((child, index) => {
      const childLeaves = countLeaves(child);

      layoutNode(
        child,
        ordinalPath.concat(index + 1),
        depthIndex + 1,
        cursor,
        childLeaves,
        canvas,
        rowHeights
      );

      cursor += childLeaves;
    });
  }

  function createIcicleVerticalBlock(node, ordinalPath) {
    const row = document.createElement("div");

    row.className =
      "icicle-vertical-node row" +
      ((treeHasFocus && node.id === selectedId) ? " sel" : "");

    row.dataset.id = node.id;
    row.dataset.level = String(node.level);
    row.tabIndex = 0;

    const customBg = window.__blockBgMap?.[node.id];
    if (customBg) row.style.backgroundColor = customBg;

    const main = document.createElement("div");
    main.className = "icicle-vertical-main";

    if (showOrdinals) {
      const badge = buildOrdinalBadge(ordinalPath);
      if (badge) main.appendChild(badge);
    }

    const label = document.createElement("span");
    label.className = "label";

    if (node.nameHtml) label.innerHTML = node.nameHtml;
    else label.textContent = node.name || "";

    main.appendChild(label);
    row.appendChild(main);

    // const act = document.createElement("span");
    // act.className = "act";

    // {
    //   const plus = makeBtn("+", (e) => {
    //     e.stopPropagation();
    //     selectedId = node.id;
    //     addSibling(node.id);
    //   });
    //   act.appendChild(plus);
    // }

    // {
    //   const rename = makeBtn("..", (e) => {
    //     e.stopPropagation();
    //     selectedId = node.id;
    //     treeHasFocus = true;
    //     render();
    //     startRename(node.id);
    //   });
    //   act.appendChild(rename);
    // }

    // if (canHaveChild(node)) {
    //   const child = makeBtn(">", (e) => {
    //     e.stopPropagation();
    //     selectedId = node.id;
    //     addChild(node.id);
    //   });
    //   act.appendChild(child);
    // }

    // if (node.id !== root.id) {
    //   const del = makeBtn("x", (e) => {
    //     e.stopPropagation();
    //     selectedId = node.id;
    //     removeSelected();
    //   });
    //   act.appendChild(del);
    // }

    // row.appendChild(act);

    renderCaptions(node, row);

    row.addEventListener("click", (e) => {
      e.stopPropagation();

      selectedId = node.id;
      treeHasFocus = true;
      row.focus({ preventScroll: true });

      render();
    });

    row.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();

      selectedId = node.id;
      treeHasFocus = true;

      render();

      setTimeout(() => {
        startRename(node.id);
      }, 0);
    });

    row.addEventListener("keydown", (e) => {
      if (isTreeLocked()) return;

      if (isUndoHotkey(e)) {
        e.preventDefault();
        undo();
        return;
      }

      if (isRedoHotkey(e)) {
        e.preventDefault();
        redo();
        return;
      }

      if (isHotkey(e, "navUp")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        moveSelection(-1);
        return;
      }

      if (isHotkey(e, "navDown")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        moveSelection(+1);
        return;
      }

      if (isHotkey(e, "navLeft")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        goParent(node.id);
        return;
      }

      if (isHotkey(e, "navRight")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        goDeeper(node.id);
        return;
      }

      if (isHotkey(e, "moveUp")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        moveByVisibleOrder(-1);
        return;
      }

      if (isHotkey(e, "moveDown")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        moveByVisibleOrder(+1);
        return;
      }

      if (isHotkey(e, "indent")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        indentNode(node.id);
        return;
      }

      if (isHotkey(e, "outdent")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        outdentNode(node.id);
        return;
      }

      if (isHotkey(e, "rename")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        treeHasFocus = true;
        render();
        startRename(node.id);
        return;
      }

      if (isHotkey(e, "delete")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        removeSelected();
        return;
      }

      if (isHotkey(e, "addChild")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        addChild(node.id);
        return;
      }

      if (isHotkey(e, "addSibling")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        addSibling(node.id);
        return;
      }

      if (isHotkey(e, "addCaption")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        addCaption(node.id);
        return;
      }
    });

    return row;
  }

  function updateActiveIcicleVerticalEditHeights() {
    document.querySelectorAll(".icicle-vertical-node").forEach((node) => {
      const edit = node.querySelector(".edit, input, textarea");
      if (!edit) return;

      const main = node.querySelector(".icicle-vertical-main");
      const captions = node.querySelector(".captions");

      const mainHeight = main ? main.offsetHeight : 0;
      const captionsHeight = captions ? captions.scrollHeight : 0;

      const needHeight = mainHeight + captionsHeight + 8;
      const currentHeight = parseFloat(node.style.height) || node.offsetHeight;

      if (needHeight > currentHeight) {
        node.style.height = `${needHeight}px`;
      }
    });
  }
})();
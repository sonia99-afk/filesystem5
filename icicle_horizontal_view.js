(function () {
  if (typeof window === "undefined") return;

  const COL_WIDTH = 170;
  const BASE_HEIGHT = 22;
  const CAPTION_LINE_HEIGHT = 12;
  const GAP = -1;

  window.renderIcicleHorizontalView = function renderIcicleHorizontalView() {
    syncProjectsSidebar();

    const host = document.getElementById("tree");
    if (!host) return;

    host.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "icicle-horizontal-view";

    const depth = getMaxDepth(root);
    const totalHeight = countHeight(root);

    const canvas = document.createElement("div");
    canvas.className = "icicle-horizontal-canvas";
    canvas.style.width = `${(depth + 1) * COL_WIDTH}px`;
    canvas.style.height = `${Math.max(BASE_HEIGHT, totalHeight)}px`;

    layoutNode(root, [], 0, 0, Math.max(BASE_HEIGHT, totalHeight), canvas);

    wrap.appendChild(canvas);
    host.appendChild(wrap);

    if (treeHasFocus) {
      const selectedRow = host.querySelector(`.row[data-id="${cssEscape(selectedId)}"]`);
      selectedRow?.focus({ preventScroll: true });
    }
  };

  function getMaxDepth(node) {
    if (!node.children || !node.children.length) return node.level || 0;

    let max = node.level || 0;

    for (const child of node.children) {
      max = Math.max(max, getMaxDepth(child));
    }

    return max;
  }

  function countCaptionLines(node) {
    if (!showCaptions || !Array.isArray(node.captions) || !node.captions.length) {
      return 0;
    }

    let lines = 0;

    for (const cap of node.captions) {
      const text = cap.text || "";
      const html = cap.textHtml || "";

      const textLines = text ? text.split("\n").length : 1;
      const brLines = (html.match(/<br\s*\/?>/gi) || []).length;

      lines += Math.max(textLines + brLines, 1);
    }

    return lines;
  }

  function getNodeHeight(node) {
    const captionLines = countCaptionLines(node);

    if (!captionLines) {
      return BASE_HEIGHT;
    }

    return BASE_HEIGHT + captionLines * CAPTION_LINE_HEIGHT + 4;
  }

  function countHeight(node) {
    if (!node.children || !node.children.length) {
      return getNodeHeight(node);
    }

    let childrenHeight = 0;

    for (const child of node.children) {
      childrenHeight += countHeight(child);
    }

    return Math.max(getNodeHeight(node), childrenHeight);
  }

  function layoutNode(node, ordinalPath, depthIndex, startY, heightSpan, canvas) {
    const block = createIcicleBlock(node, ordinalPath);

    block.style.left = `${depthIndex * COL_WIDTH}px`;
    block.style.top = `${startY}px`;
    block.style.width = `${COL_WIDTH - GAP}px`;
    block.style.height = `${heightSpan - GAP}px`;

    canvas.appendChild(block);

    if (!node.children || !node.children.length) return;

    let cursor = startY;

    node.children.forEach((child, index) => {
      const childHeight = countHeight(child);

      layoutNode(
        child,
        ordinalPath.concat(index + 1),
        depthIndex + 1,
        cursor,
        childHeight,
        canvas
      );

      cursor += childHeight;
    });
  }

  function createIcicleBlock(node, ordinalPath) {
    const row = document.createElement("div");

    row.className =
      "icicle-horizontal-node row" +
      ((treeHasFocus && node.id === selectedId) ? " sel" : "");

    row.dataset.id = node.id;
    row.tabIndex = 0;

    const main = document.createElement("div");
    main.className = "icicle-horizontal-main";

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

    renderCaptions(node, row);

    row.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedId = node.id;
      treeHasFocus = true;
      row.focus({ preventScroll: true });
      render();
    });

    row.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      selectedId = node.id;
      treeHasFocus = true;
      render();
      startRename(node.id);
    });

    row.addEventListener("keydown", (e) => {
      if (isTreeLocked()) return;

      if (isHotkey(e, "addCaption")) {
        e.preventDefault();
        e.stopPropagation();
        selectedId = node.id;
        treeHasFocus = true;
        addCaption(node.id);
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
    });

    return row;
  }
})();
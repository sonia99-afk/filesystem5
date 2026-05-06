(function () {
  if (typeof window === "undefined") return;

  let hhResizeObserver = null;
  let hhUpdateScheduled = false;

  window.renderHierarchyHorizontalView = function renderHierarchyHorizontalView() {
    syncProjectsSidebar();

    const host = document.getElementById("tree");
    if (!host) return;

    if (hhResizeObserver) {
      hhResizeObserver.disconnect();
      hhResizeObserver = null;
    }

    host.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "hierarchy-horizontal-view";

    wrap.appendChild(renderHHNode(root, []));
    host.appendChild(wrap);

    scheduleHHLineUpdate();
    initHHLineObserver(wrap);

    if (treeHasFocus) {
      const selectedRow = host.querySelector(`.row[data-id="${cssEscape(selectedId)}"]`);
      selectedRow?.focus({ preventScroll: true });
    }
  };

  function renderHHNode(node, ordinalPath = []) {
    const item = document.createElement("div");
    item.className = "hh-item";

    const main = document.createElement("div");
    main.className = "hh-main";

    const row = makeHHRow(node, ordinalPath);
    main.appendChild(row);

    const children = node.children || [];
    const firstChild = children[0] || null;
    const restChildren = children.slice(1);

    if (firstChild) {
      const line = document.createElement("span");
      line.className = "hh-line-to-first";
      main.appendChild(line);
      main.appendChild(renderHHNode(firstChild, ordinalPath.concat(1)));
    }

    item.appendChild(main);

    renderCaptions(node, item);

    if (restChildren.length) {
      const rest = document.createElement("div");
      rest.className = "hh-rest";

      restChildren.forEach((child, index) => {
        const branch = document.createElement("div");
        branch.className = "hh-rest-branch";
        branch.appendChild(renderHHNode(child, ordinalPath.concat(index + 2)));
        rest.appendChild(branch);
      });

      item.appendChild(rest);
    }

    return item;
  }

  function makeHHRow(node, ordinalPath) {
    const row = document.createElement("div");
    row.className =
      "hierarchy-horizontal-node row" +
      ((treeHasFocus && node.id === selectedId) ? " sel" : "");

    row.dataset.id = node.id;
    row.tabIndex = 0;

    if (showOrdinals) {
      const badge = buildOrdinalBadge(ordinalPath);
      if (badge) row.appendChild(badge);
    }

    const label = document.createElement("span");
    label.className = "label";
    if (node.nameHtml) label.innerHTML = node.nameHtml;
    else label.textContent = node.name || "";

    row.appendChild(label);

    row.addEventListener("click", (e) => {
      e.stopPropagation();
    
      const wasSelected = selectedId === node.id;
    
      selectedId = node.id;
      treeHasFocus = true;
      row.focus({ preventScroll: true });
    
      if (wasSelected) return;
    
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
        selectedId = node.id;
        moveSelection(-1);
        return;
      }

      if (isHotkey(e, "navDown")) {
        e.preventDefault();
        selectedId = node.id;
        moveSelection(+1);
        return;
      }

      if (isHotkey(e, "navLeft")) {
        e.preventDefault();
        selectedId = node.id;
        goParent(node.id);
        return;
      }

      if (isHotkey(e, "navRight")) {
        e.preventDefault();
        selectedId = node.id;
        goDeeper(node.id);
        return;
      }

      if (isHotkey(e, "moveUp")) {
        e.preventDefault();
        selectedId = node.id;
        moveByVisibleOrder(-1);
        return;
      }

      if (isHotkey(e, "moveDown")) {
        e.preventDefault();
        selectedId = node.id;
        moveByVisibleOrder(+1);
        return;
      }

      if (isHotkey(e, "indent")) {
        e.preventDefault();
        selectedId = node.id;
        indentNode(node.id);
        return;
      }

      if (isHotkey(e, "outdent")) {
        e.preventDefault();
        selectedId = node.id;
        outdentNode(node.id);
        return;
      }

      if (isHotkey(e, "rename")) {
        e.preventDefault();
        selectedId = node.id;
        treeHasFocus = true;
        render();
        startRename(node.id);
        return;
      }

      if (isHotkey(e, "delete")) {
        e.preventDefault();
        selectedId = node.id;
        removeSelected();
        return;
      }

      if (isHotkey(e, "addChild")) {
        e.preventDefault();
        selectedId = node.id;
        addChild(node.id);
        return;
      }

      if (isHotkey(e, "addSibling")) {
        e.preventDefault();
        selectedId = node.id;
        addSibling(node.id);
        return;
      }

      if (isHotkey(e, "addCaption")) {
        e.preventDefault();
        selectedId = node.id;
        addCaption(node.id);
        return;
      }
    });

    return row;
  }

  function scheduleHHLineUpdate() {
    if (hhUpdateScheduled) return;
    hhUpdateScheduled = true;

    requestAnimationFrame(() => {
      hhUpdateScheduled = false;
      updateHHRestLines();
    });
  }

  function initHHLineObserver(rootEl) {
    if (!window.ResizeObserver || !rootEl) return;

    hhResizeObserver = new ResizeObserver(() => {
      scheduleHHLineUpdate();
    });

    rootEl
      .querySelectorAll(".hh-item, .hh-main, .hh-rest, .captions, .caption, .edit, .hierarchy-horizontal-node")
      .forEach((el) => {
        hhResizeObserver.observe(el);
      });
  }

  function updateHHRestLines() {
    document.querySelectorAll(".hh-rest").forEach((rest) => {
      const branches = Array.from(rest.children).filter((el) =>
        el.classList.contains("hh-rest-branch")
      );

      if (!branches.length) return;

      const parentItem = rest.closest(".hh-item");

      const parentRow = parentItem?.querySelector(
        ":scope > .hh-main > .hierarchy-horizontal-node.row"
      );

      const lastRow = branches[branches.length - 1]?.querySelector(
        ":scope > .hh-item > .hh-main > .hierarchy-horizontal-node.row"
      );

      if (!parentRow || !lastRow) return;

      const parentWidth = Math.ceil(parentRow.getBoundingClientRect().width);
      rest.style.setProperty("--hh-parent-num-shift", `${parentWidth}px`);

      const restBox = rest.getBoundingClientRect();
      const parentBox = parentRow.getBoundingClientRect();
      const lastBox = lastRow.getBoundingClientRect();

      const startY = parentBox.top + parentBox.height / 2 - restBox.top;
      const endY = lastBox.top + lastBox.height / 2 - restBox.top;

      rest.style.setProperty("--hh-line-top", `${startY}px`);
      rest.style.setProperty("--hh-line-height", `${Math.max(0, endY - startY + 2)}px`);
    });
  }
})();
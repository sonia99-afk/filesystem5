(function () {
  if (typeof window === "undefined") return;

  window.renderListView = function renderListView() {
    syncProjectsSidebar();

    const host = document.getElementById("tree");
    if (!host) return;

    host.innerHTML = "";

    const page = document.createElement("div");
    page.className = "leaf-page";

    const wrap = document.createElement("div");
    wrap.className = "list-view leaf-wrap";

    const flow = document.createElement("div");
    flow.className = "leaf-flow";

    const rows = flattenListRows(root);

    rows.forEach((item, index) => {
      flow.appendChild(
        renderListItem(
          item.node,
          item.ordinalPath,
          rows[index - 1]?.node || null
        )
      );
    });

    wrap.appendChild(flow);
    page.appendChild(wrap);
    host.appendChild(page);

    if (treeHasFocus) {
      const selectedRow = host.querySelector(`.row[data-id="${cssEscape(selectedId)}"]`);
      selectedRow?.focus({ preventScroll: true });
    }
  };

  function flattenListRows(node, ordinalPath = [], out = []) {
    out.push({ node, ordinalPath });

    (node.children || []).forEach((child, index) => {
      flattenListRows(child, ordinalPath.concat(index + 1), out);
    });

    return out;
  }

  function getGapClass(node, previousNode) {
    if (!previousNode) return "gap-l";

    const prevLevel = previousNode.level || 0;
    const currLevel = node.level || 0;

    if (currLevel === 1 && prevLevel !== 1) return "gap-m";
    if (currLevel > prevLevel) return "gap-s";
    if (currLevel === 1) return "gap-m";

    return "";
  }

  function renderListItem(node, ordinalPath, previousNode) {
    const item = document.createElement("div");
    item.className =
      "leaf-item list-item " +
      `lvl-${Math.min(node.level || 0, 6)} ` +
      getGapClass(node, previousNode);

    const row = document.createElement("div");
    row.className =
      "leaf-node list-node row" +
      ((treeHasFocus && node.id === selectedId) ? " sel" : "");

    row.dataset.id = node.id;
    row.tabIndex = 0;

    const num = document.createElement("span");
    num.className = "leaf-index list-number";
    num.textContent = ordinalPath.length ? ordinalPath.join(".") : "0";
    row.appendChild(num);

    const label = document.createElement("span");
    label.className = "label leaf-label list-label";

    if (node.nameHtml) label.innerHTML = node.nameHtml;
    else label.textContent = node.name || "";

    row.appendChild(label);

    const act = document.createElement("span");
    act.className = "act";

    {
      const plus = makeBtn("+", (e) => {
        e.stopPropagation();
        selectedId = node.id;
        addSibling(node.id);
      });
      act.appendChild(plus);
    }

    {
      const rename = makeBtn("..", (e) => {
        e.stopPropagation();
        selectedId = node.id;
        treeHasFocus = true;
        render();
        startRename(node.id);
      });
      act.appendChild(rename);
    }

    if (canHaveChild(node)) {
      const child = makeBtn(">", (e) => {
        e.stopPropagation();
        selectedId = node.id;
        addChild(node.id);
      });
      act.appendChild(child);
    }

    if (node.id !== root.id) {
      const del = makeBtn("x", (e) => {
        e.stopPropagation();
        selectedId = node.id;
        removeSelected();
      });
      act.appendChild(del);
    }

    row.appendChild(act);

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

    item.appendChild(row);

    const notes = document.createElement("div");
    notes.className = "leaf-notes";
    renderCaptions(node, notes);

    if (notes.querySelector(".caption")) {
      item.appendChild(notes);
    }

    return item;
  }
})();
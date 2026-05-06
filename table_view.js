(function () {
    if (typeof window === "undefined") return;
  
    window.renderTableView = function renderTableView() {
      syncProjectsSidebar();
  
      const host = document.getElementById("tree");
      if (!host) return;
  
      host.innerHTML = "";
  
      const wrap = document.createElement("div");
      wrap.className = "table-view";
  
      const table = document.createElement("table");
      table.className = "structure-table";
  
      table.innerHTML = `
        <thead>
          <tr>
            <th>ID</th>
            <th>Нумерация</th>
            <th>Уровень</th>
            <th>Название</th>
            <th>Заметки</th>
          </tr>
        </thead>
      `;
  
      const tbody = document.createElement("tbody");
      const rows = flattenTableRows(root);
  
      rows.forEach((item) => {
        tbody.appendChild(renderTableRow(item.node, item.ordinalPath));
      });
  
      table.appendChild(tbody);
      wrap.appendChild(table);
      host.appendChild(wrap);
  
      if (treeHasFocus) {
        const selectedRow = host.querySelector(`.row[data-id="${cssEscape(selectedId)}"]`);
        selectedRow?.focus({ preventScroll: true });
      }
    };
  
    function flattenTableRows(node, ordinalPath = [], out = []) {
      out.push({ node, ordinalPath });
  
      (node.children || []).forEach((child, index) => {
        flattenTableRows(child, ordinalPath.concat(index + 1), out);
      });
  
      return out;
    }
  
    function renderTableRow(node, ordinalPath) {
      const tr = document.createElement("tr");
      tr.className = node.id === selectedId ? "is-selected" : "";
  
      const idTd = document.createElement("td");
      idTd.textContent = "";
  
      const ordTd = document.createElement("td");
      ordTd.textContent = ordinalPath.length ? ordinalPath.join(".") : "0";
  
      const levelTd = document.createElement("td");
      levelTd.textContent = DEFAULT_NAME[node.level] || `Уровень ${node.level}`;
  
      const nameTd = document.createElement("td");
  
      const row = document.createElement("div");
      row.className = "table-name-row row" + ((treeHasFocus && node.id === selectedId) ? " sel" : "");
      row.dataset.id = node.id;
      row.tabIndex = 0;
  
      const label = document.createElement("span");
      label.className = "label";
  
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
  
      nameTd.appendChild(row);
  
      const notesTd = document.createElement("td");
      notesTd.className = "table-notes-cell";
      renderCaptions(node, notesTd);
  
      if (!node.captions || !node.captions.length) {
        notesTd.textContent = "--";
      }
  
      tr.append(idTd, ordTd, levelTd, nameTd, notesTd);
  
      return tr;
    }
  })();
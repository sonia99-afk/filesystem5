(function () {
    if (typeof window === "undefined") return;
  
    window.renderHierarchyView = function renderHierarchyView() {
      syncProjectsSidebar();
  
      const host = document.getElementById("tree");
      if (!host) return;
  
      host.innerHTML = "";
  
      const wrap = document.createElement("div");
      wrap.className = "hierarchy-view";
  
      const ul = document.createElement("ul");
      ul.className = "hierarchy-tree";
  
      ul.appendChild(renderHierarchyNode(root, []));
  
      wrap.appendChild(ul);
      host.appendChild(wrap);
    };
  
    function renderHierarchyNode(node, ordinalPath = []) {
      const li = document.createElement("li");
      li.className = "hierarchy-li";
  
      const row = document.createElement("div");
      row.className = "hierarchy-node row" + ((treeHasFocus && node.id === selectedId) ? " sel" : "");
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
        selectedId = node.id;
        treeHasFocus = true;
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
      });
  
      li.appendChild(row);

      renderCaptions(node, li);
  
      if (node.children && node.children.length) {
        const ul = document.createElement("ul");
        ul.className = "hierarchy-children";
  
        node.children.forEach((child, index) => {
          ul.appendChild(renderHierarchyNode(child, ordinalPath.concat(index + 1)));
        });
  
        li.appendChild(ul);
      }
  
      return li;
    }
  })();
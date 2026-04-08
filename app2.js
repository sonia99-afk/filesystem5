const LEVEL = { COMPANY: 0, PROJECT: 1, DEPT: 2, ROLE: 3, STEP: 20 };

let showOrdinals = true;
let showCaptions = true;

const DEFAULT_NAME = {
  0: 'Уровень 0',
  1: 'Уровень 1',
  2: 'Уровень 2',
  3: 'Уровень 3',
  4: 'Уровень 4',
  5: 'Уровень 5',
  6: 'Уровень 6',
  7: 'Уровень 7',
  8: 'Уровень 8',
  9: 'Уровень 9',
  10: 'Уровень 10',
  11: 'Уровень 11',
  12: 'Уровень 12',
  13: 'Уровень 13',
  14: 'Уровень 14',
  15: 'Уровень 15',
  16: 'Уровень 16',
  17: 'Уровень 17',
  18: 'Уровень 18',
  19: 'Уровень 19',
  20: 'Уровень 20',
};

const uid = () => Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);

function makeNode(level, name) {
  return {
    id: uid(),
    level,
    name: (name || DEFAULT_NAME[level]),
    nameHtml: "",
    captions: [],
    children: []
  };
}

function makeCaption(text = "") {
  return {
    id: uid(),
    text,
    textHtml: ""
  };
}

const root = makeNode(LEVEL.COMPANY, 'Уровень 0');
let selectedId = root.id;
let treeHasFocus = true;

/* =========================
   Undo / Redo
   ========================= */
let undoStack = [];
let redoStack = [];

function snapshot() {
  return JSON.stringify({
    root,
    selectedId,
    treeHasFocus
  });
}

function restore(state) {
  const data = JSON.parse(state);

  window.__suppressCaptionBlurCommit = true;

  root.id = data.root.id;
  root.level = data.root.level;
  root.name = data.root.name;
  root.nameHtml = data.root.nameHtml || "";
  root.captions = data.root.captions || [];
  root.children = data.root.children || [];

  selectedId = data.selectedId || root.id;
  treeHasFocus = (typeof data.treeHasFocus === 'boolean') ? data.treeHasFocus : true;

  if (!findWithParent(root, selectedId)) selectedId = root.id;

  renamingId = null;

  render();

  queueMicrotask(() => {
    window.__suppressCaptionBlurCommit = false;
  });
}

function pushHistory() {
  undoStack.push(snapshot());
  redoStack.length = 0;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  const prev = undoStack.pop();
  restore(prev);
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  const next = redoStack.pop();
  restore(next);
}

// layout-independent hotkeys
function isMod(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey;
}

function isUndoHotkey(e) {
  if (!window.hotkeys?.get) return false;
  return isHotkey(e, "undo");
}

function isRedoHotkey(e) {
  if (!window.hotkeys?.get) return false;
  return isHotkey(e, "redo");
}

/* =========================
   Hotkeys: modifiers + ONE key
   ========================= */

function isTextEditingElement(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return false;
}

function getPlatformInfo() {
  return window.hotkeys?.getPlatformInfo?.() || { isMac: false, primaryToken: "Primary" };
}

function normalizeBaseKeyFromEvent(e) {
  if (!e) return "";

  const k = String(e.key || "");
  if (k === "Shift" || k === "Alt" || k === "Control" || k === "Meta" || k === "OS") return "";

  const code = String(e.code || "");
  if (code.startsWith("Key") && code.length === 4) return code.slice(3).toUpperCase();
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
  if (code.startsWith("Numpad") && code.length === 7 && /[0-9]/.test(code.slice(6))) return code.slice(6);

  if (k === " " || k === "Spacebar") return "Space";
  if (k === "Esc") return "Escape";
  if (k === "+") return "Plus";

  if (k.length === 1) return k.toUpperCase();
  return k;
}

function comboFromKeyEvent(e) {
  const { isMac, primaryToken } = getPlatformInfo();

  const base = normalizeBaseKeyFromEvent(e);
  if (!base) return "";

  const tokens = [];
  const primaryDown = isMac ? !!e.metaKey : !!e.ctrlKey;
  if (primaryDown) tokens.push(primaryToken);
  if (e.altKey) tokens.push("Alt");
  if (e.shiftKey) tokens.push("Shift");
  tokens.push(base);

  if (tokens.length === 2 && tokens.includes("Shift") && tokens.includes("Plus")) return "+";

  return window.hotkeys?.normalizeCombo?.(tokens.join("+")) || tokens.join("+");
}

function isHotkey(e, action) {
  const wantRaw = window.hotkeys?.get?.(action);
  if (!wantRaw) return false;

  if (e.repeat) return false;

  const ae = document.activeElement;
  if (isTextEditingElement(ae)) return false;
  if (ae?.classList?.contains?.("edit")) return false;
  if (ae?.classList?.contains?.("tg-export")) return false;

  const haveRaw = comboFromKeyEvent(e);
  if (!haveRaw) return false;

  const normalize = window.hotkeys?.normalizeCombo;
  const want = normalize ? normalize(wantRaw) : wantRaw;
  const have = normalize ? normalize(haveRaw) : haveRaw;

  // special-case: rename aliases by platform
if (action === "rename") {
  const isMac = !!window.hotkeys?.getPlatformInfo?.().isMac;

  const allowed = isMac
    ? new Set(["Ё", "ё", "\\"])
    : new Set(["Ё", "ё", "`"]);

  const key = String(e.key || "");
  if (allowed.has(key)) return true;
}

  return have === want;
}

function comboFromMouseEvent(e, baseToken) {
  const { isMac, primaryToken } = getPlatformInfo();

  const tokens = [];
  const primaryDown = isMac ? !!e.metaKey : !!e.ctrlKey;
  if (primaryDown) tokens.push(primaryToken);
  if (e.altKey) tokens.push("Alt");
  if (e.shiftKey) tokens.push("Shift");
  tokens.push(baseToken);

  return window.hotkeys?.normalizeCombo?.(tokens.join("+")) || tokens.join("+");
}

function isMouseHotkey(e, action, baseToken) {
  const wantRaw = window.hotkeys?.get?.(action);
  if (!wantRaw) return false;

  const ae = document.activeElement;
  if (isTextEditingElement(ae)) return false;
  if (ae?.classList?.contains?.("edit")) return false;
  if (ae?.classList?.contains?.("tg-export")) return false;

  const haveRaw = comboFromMouseEvent(e, baseToken);
  const normalize = window.hotkeys?.normalizeCombo;
  const want = normalize ? normalize(wantRaw) : wantRaw;
  const have = normalize ? normalize(haveRaw) : haveRaw;

  return have === want;
}

/* ========================= */

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cssEscape(s) {
  const v = String(s);
  if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(v);
  return v.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
}

// ===== ORDINAL INDICATOR =====
function ordinalPathToString(path) {
  return Array.isArray(path) ? path.join(".") : "";
}

function buildOrdinalBadge(path) {
  const s = ordinalPathToString(path);
  if (!s) return null;

  const wrap = document.createElement("span");
  wrap.className = "ordinal-badge";

  const left = document.createElement("span");
  left.textContent = "[";
  left.style.color = "#000";

  const num = document.createElement("span");
  num.textContent = s;
  num.style.color = "#1E06C7";

  const right = document.createElement("span");
  right.textContent = "]";
  right.style.color = "#000";

  wrap.appendChild(left);
  wrap.appendChild(num);
  wrap.appendChild(right);

  return wrap;
}

(function injectOrdinalStyle() {
  const id = "ordinal-style";
  if (document.getElementById(id)) return;

  const st = document.createElement("style");
  st.id = id;
  st.textContent = `
    .ordinal-badge{
      display:inline-block;
      margin-right:6px;
      color:#1E06C7;
      white-space:nowrap;
      flex:0 0 auto;
    }
  `;
  document.head.appendChild(st);
})();

function findWithParent(node, id, parent = null) {
  if (node.id === id) return { node, parent };
  for (const ch of node.children) {
    const r = findWithParent(ch, id, node);
    if (r) return r;
  }
  return null;
}

function canHaveChild(node) {
  return node.level < LEVEL.STEP;
}

function flatten() {
  const out = [];
  (function walk(n) {
    out.push(n.id);
    for (const ch of n.children) walk(ch);
  })(root);
  return out;
}

function flattenWithLevels() {
  const out = [];
  (function walk(n) {
    out.push({ id: n.id, level: n.level });
    for (const ch of n.children) walk(ch);
  })(root);
  return out;
}

function parentOf(id) {
  const r = findWithParent(root, id);
  return r && r.parent ? r.parent.id : null;
}

function firstChildOf(id) {
  const r = findWithParent(root, id);
  if (!r) return null;
  return (r.node.children && r.node.children.length) ? r.node.children[0].id : null;
}

function firstDeeperAfter(id) {
  const flat = flattenWithLevels();
  const idx = flat.findIndex(x => x.id === id);
  if (idx < 0) return null;
  const baseLevel = flat[idx].level;
  for (let i = idx + 1; i < flat.length; i++) {
    if (flat[i].level > baseLevel) return flat[i].id;
  }
  return null;
}

/* ======== Tree mutations (with history) ======== */

function addChild(parentId) {
  const r = findWithParent(root, parentId);
  if (!r) return;
  if (!canHaveChild(r.node)) return;

  pushHistory();

  const child = makeNode(r.node.level + 1);
  r.node.children.push(child);
  selectedId = child.id;
  treeHasFocus = true;
  render();
  setTimeout(() => startRename(child.id), 0);
}

function addCaption(nodeId) {
  const r = findWithParent(root, nodeId);
  if (!r) return;

  pushHistory();

  if (!Array.isArray(r.node.captions)) r.node.captions = [];

  const cap = {
    id: uid(),
    text: "",
    textHtml: ""
  };

  r.node.captions.push(cap);

  selectedId = nodeId;
  treeHasFocus = true;
  render();

  setTimeout(() => startCaptionEdit(nodeId, cap.id, { isNew: true }), 0);
}

function addSibling(targetId) {
  if (targetId === root.id) {
    addChild(root.id);
    return;
  }

  const r = findWithParent(root, targetId);
  if (!r || !r.parent) return;

  pushHistory();

  const parent = r.parent;
  const idx = parent.children.findIndex(x => x.id === targetId);
  const sib = makeNode(r.node.level);

  const insertAt = (idx >= 0) ? idx + 1 : parent.children.length;
  parent.children.splice(insertAt, 0, sib);
  selectedId = sib.id;
  treeHasFocus = true;
  render();
  setTimeout(() => startRename(sib.id), 0);
}

function removeSelected() {
  if (!selectedId) return;
  if (selectedId === root.id) return;

  const r = findWithParent(root, selectedId);
  if (!r || !r.parent) return;

  const parent = r.parent;
  const arr = parent.children;
  const idx = arr.findIndex(x => x.id === selectedId);
  if (idx < 0) return;

  pushHistory();

  let nextSelected = null;

  if (idx + 1 < arr.length) {
    nextSelected = arr[idx + 1].id;
  } else if (idx - 1 >= 0) {
    nextSelected = arr[idx - 1].id;
  } else {
    nextSelected = parent.id;
  }

  parent.children.splice(idx, 1);

  selectedId = nextSelected;
  treeHasFocus = true;
  render();
}

function moveWithinParent(dir) {
  if (!selectedId) return;
  if (selectedId === root.id) return;

  const r = findWithParent(root, selectedId);
  if (!r || !r.parent) return;

  const arr = r.parent.children;
  const idx = arr.findIndex(x => x.id === selectedId);
  if (idx < 0) return;

  const j = idx + dir;
  if (j < 0 || j >= arr.length) return;

  pushHistory();

  const tmp = arr[idx];
  arr[idx] = arr[j];
  arr[j] = tmp;

  render();
}

function indentNode(id) {
  if (!id || id === root.id) return;

  const r = findWithParent(root, id);
  if (!r || !r.parent) return;

  const siblings = r.parent.children;
  const idx = siblings.findIndex(x => x.id === id);
  if (idx <= 0) return;

  const newParent = siblings[idx - 1];
  if (!canHaveChild(newParent)) return;

  const maxL = getMaxLevelInSubtree(r.node);
  if (maxL + 1 > LEVEL.STEP) return;

  pushHistory();

  if (!shiftSubtreeLevel(r.node, +1)) return;

  siblings.splice(idx, 1);
  newParent.children.push(r.node);

  selectedId = id;
  treeHasFocus = true;
  render();
}

function outdentNode(id) {
  if (!id || id === root.id) return;

  const r = findWithParent(root, id);
  if (!r || !r.parent) return;

  const parent = r.parent;
  const gp = findWithParent(root, parent.id)?.parent;
  if (!gp) return;

  pushHistory();

  if (!shiftSubtreeLevel(r.node, -1)) return;

  parent.children = parent.children.filter(x => x.id !== id);

  const pIdx = gp.children.findIndex(x => x.id === parent.id);
  gp.children.splice(pIdx + 1, 0, r.node);

  selectedId = id;
  treeHasFocus = true;
  render();
}

function shiftSubtreeLevel(node, delta) {
  const oldLevel = node.level;
  const newLevel = oldLevel + delta;

  if (newLevel < LEVEL.COMPANY || newLevel > LEVEL.STEP) return false;

  if ((node.name || '').trim() === DEFAULT_NAME[oldLevel]) {
    node.name = DEFAULT_NAME[newLevel];
  }

  node.level = newLevel;

  for (const ch of (node.children || [])) {
    const ok = shiftSubtreeLevel(ch, delta);
    if (!ok) return false;
  }
  return true;
}

function getMaxLevelInSubtree(node) {
  let max = node.level;
  for (const ch of (node.children || [])) {
    max = Math.max(max, getMaxLevelInSubtree(ch));
  }
  return max;
}

/* ======== Navigation ======== */

function moveSelection(dir) {
  const flat = flatten();
  const idx = flat.indexOf(selectedId);
  if (idx < 0) return;
  const next = flat[idx + dir];
  if (!next) return;
  selectedId = next;
  treeHasFocus = true;
  render();
}

function goParent(fromId) {
  const p = parentOf(fromId);
  if (!p) return;
  selectedId = p;
  treeHasFocus = true;
  render();
}

function goDeeper(fromId) {
  const direct = firstChildOf(fromId);
  if (direct) {
    selectedId = direct;
    treeHasFocus = true;
    render();
    return;
  }
  const deeper = firstDeeperAfter(fromId);
  if (!deeper) return;
  selectedId = deeper;
  treeHasFocus = true;
  render();
}

/* ======== Render ======== */

function focusSelectedRow() {
  if (!treeHasFocus) return;
  const host = document.getElementById('tree');
  const r = host.querySelector(`.row[data-id="${cssEscape(selectedId)}"]`);
  if (!r) return;
  r.focus({ preventScroll: true });
}

function syncProjectsSidebar() {
  const firstProjectItem = document.querySelector('.projects-list .project-item');
  if (!firstProjectItem) return;

  const projectTitle = (root?.name || '').trim() || DEFAULT_NAME[LEVEL.COMPANY] || 'Проект';
  firstProjectItem.textContent = projectTitle;
  firstProjectItem.title = projectTitle;
}

function initProjectsSidebar() {
  const addButton = document.querySelector('.project-add');
  const projectsList = document.querySelector('.projects-list');

  if (!addButton || !projectsList) return;
  if (addButton.dataset.bound === '1') return;

  addButton.dataset.bound = '1';
  addButton.addEventListener('click', () => {
    const projectItem = document.createElement('button');
    projectItem.className = 'project-item';
    projectItem.type = 'button';
    projectItem.textContent = 'Новый проект';
    projectItem.title = 'Проект';
    projectsList.appendChild(projectItem);
  });
}

function render() {
  syncProjectsSidebar();
  const host = document.getElementById('tree');
  host.innerHTML = '';

  const ul = document.createElement('ul');
  ul.dataset.level = String(root.level);
  ul.appendChild(renderNode(root, []));
  host.appendChild(ul);

  applyCaptionOrdinalOffsets();
  layoutTrunks();

  if (treeHasFocus) focusSelectedRow();

  const rid = consumeRenameRequest?.();
  if (rid) startRename(rid);
}

function isTreeLocked() {
  return window.hotkeysMode === "custom";
}

function makeBtn(midText, onClick) {
  const b = document.createElement('span');
  b.className = 'btn';

  const l = document.createElement('span');
  l.className = 'br';
  l.textContent = '[';

  const m = document.createElement('span');
  m.className = 'mid';
  m.textContent = midText;

  const r = document.createElement('span');
  r.className = 'br';
  r.textContent = ']';

  b.append(l, m, r);

  b.addEventListener('click', (e) => {
    if (isTreeLocked()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick(e);
  });

  return b;
}



function handleRowMouseHotkeys(e, n, baseToken) {
  if (isTreeLocked()) return false;

  if (isMouseHotkey(e, "redoClick", baseToken)) {
    e.preventDefault();
    e.stopPropagation();
    treeHasFocus = true;
    redo();
    return true;
  }

  if (isMouseHotkey(e, "undoClick", baseToken)) {
    e.preventDefault();
    e.stopPropagation();
    treeHasFocus = true;
    undo();
    return true;
  }

  if (isMouseHotkey(e, "deleteClick", baseToken)) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = n.id;
    treeHasFocus = true;
    removeSelected();
    return true;
  }

  if (isMouseHotkey(e, "addSiblingClick", baseToken)) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = n.id;
    treeHasFocus = true;
    addSibling(n.id);
    return true;
  }

  if (isMouseHotkey(e, "addChildClick", baseToken)) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = n.id;
    treeHasFocus = true;
    addChild(n.id);
    return true;
  }

  if (isMouseHotkey(e, "renameClick", baseToken)) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = n.id;
    treeHasFocus = true;
    render();
    startRename(n.id);
    return true;
  }

  if (isMouseHotkey(e, "navClick", baseToken)) {
    e.preventDefault();
    e.stopPropagation();
    selectedId = n.id;
    treeHasFocus = true;
    render();
    return true;
  }

  return false;
}

function applyCaptionOrdinalOffsets() {
  const tree = document.getElementById("tree");
  if (!tree) return;

  const rows = tree.querySelectorAll(".row[data-id]");

  rows.forEach((row) => {
    const li = row.closest("li");
    if (!li) return;

    const caps = li.querySelector(":scope > .captions");
    if (!caps) return;

    // если нумерация выключена — сбрасываем
    if (!showOrdinals || !document.body.classList.contains("ordinals-on")) {
      caps.style.marginLeft = "0px";
      return;
    }

    const badge = row.querySelector(":scope > .ordinal-badge");
    if (!badge) {
      caps.style.marginLeft = "0px";
      return;
    }

    const badgeBox = badge.getBoundingClientRect();
    const badgeStyle = getComputedStyle(badge);
    const mr = parseFloat(badgeStyle.marginRight) || 0;

    const shift = badgeBox.width + mr;
    caps.style.marginLeft = `${Math.ceil(shift)}px`;
  });
}

function renderNode(n, ordinalPath = []) {
  const li = document.createElement('li');
  if (n.id === root.id) li.classList.add('root');

  const anchor = document.createElement('span');
  anchor.className = 'anchor';
  li.appendChild(anchor);

  

  const row = document.createElement('span');
  row.dataset.id = n.id;
  row.className = 'row' + ((treeHasFocus && n.id === selectedId) ? ' sel' : '');
  row.tabIndex = 0;

  const label = document.createElement('span');
label.className = 'label';

// ← добавили индекс
if (showOrdinals) {
  const ordinalBadge = buildOrdinalBadge(ordinalPath);
  if (ordinalBadge) {
    row.appendChild(ordinalBadge);
  }
}

if (n.nameHtml) label.innerHTML = n.nameHtml;
else label.textContent = n.name || '';

row.appendChild(label);

  const act = document.createElement('span');
  act.className = 'act';

  {
    const plus = makeBtn('+', (e) => {
      e.stopPropagation();
      selectedId = n.id;
      addSibling(n.id);
    });
    act.appendChild(plus);
  }

  {
    const rename = makeBtn('..', (e) => {
      e.stopPropagation();
      selectedId = n.id;
      treeHasFocus = true;
      render();
      startRename(n.id);
    });
    act.appendChild(rename);
  }

  if (canHaveChild(n)) {
    const child = makeBtn('>', (e) => {
      e.stopPropagation();
      selectedId = n.id;
      addChild(n.id);
    });
    act.appendChild(child);
  }

  if (n.id !== root.id) {
    const del = makeBtn('x', (e) => {
      e.stopPropagation();
      selectedId = n.id;
      removeSelected();
    });
    act.appendChild(del);
  } else {
    const lock = document.createElement('span');
    lock.className = 'mut';
    lock.style.marginLeft = '6px';
    act.appendChild(lock);
  }

  row.appendChild(act);

  row.addEventListener('click', (e) => {
    handleRowMouseHotkeys(e, n, "Click");
  });

  row.addEventListener('dblclick', (e) => {
    handleRowMouseHotkeys(e, n, "DblClick");
  });

  row.addEventListener('keydown', (e) => {
    if (isTreeLocked()) {
      return;
    }

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

    if (isHotkey(e, "indent")) {
      e.preventDefault();
      selectedId = n.id;
      indentNode(n.id);
      return;
    }

    if (isHotkey(e, "outdent")) {
      e.preventDefault();
      selectedId = n.id;
      outdentNode(n.id);
      return;
    }

    if (isHotkey(e, "navLeft")) {
      e.preventDefault();
      goParent(n.id);
      return;
    }

    if (isHotkey(e, "navRight")) {
      e.preventDefault();
      goDeeper(n.id);
      return;
    }

    if (isHotkey(e, "navUp")) {
      e.preventDefault();
      selectedId = n.id;
      moveSelection(-1);
      return;
    }

    if (isHotkey(e, "navDown")) {
      e.preventDefault();
      selectedId = n.id;
      moveSelection(+1);
      return;
    }

    if (isHotkey(e, "moveUp")) {
      e.preventDefault();
      selectedId = n.id;
      moveWithinParent(-1);
      return;
    }

    if (isHotkey(e, "moveDown")) {
      e.preventDefault();
      selectedId = n.id;
      moveWithinParent(+1);
      return;
    }

    if (isHotkey(e, "rename")) {
      e.preventDefault();
      selectedId = n.id;
      treeHasFocus = true;
      render();
      startRename(n.id);
      return;
    }

    if (isHotkey(e, "delete")) {
      e.preventDefault();
      selectedId = n.id;
      removeSelected();
      return;
    }

    if (isHotkey(e, "addChild")) {
      e.preventDefault();
      selectedId = n.id;
      addChild(n.id);
      return;
    }

    if (isHotkey(e, "addSibling")) {
      e.preventDefault();
      selectedId = n.id;
      addSibling(n.id);
      return;
    }

    if (isHotkey(e, "addCaption")) {
      e.preventDefault();
      addCaption(selectedId);
      return;
    }
  });

  li.appendChild(row);

  if (showCaptions && Array.isArray(n.captions) && n.captions.length) {
    const caps = document.createElement("div");
    caps.className = "captions";
  
    for (const c of n.captions) {
      const cap = document.createElement("div");

const isMultiline =
  (c.text || "").includes("\n") ||
  (c.textHtml || "").includes("<br>");

cap.className = "caption" + (isMultiline ? " caption-multiline" : "");
      cap.dataset.nodeId = n.id;
      cap.dataset.captionId = c.id;
  
      if (c.textHtml) cap.innerHTML = c.textHtml;
      else cap.textContent = c.text || "";
  
      cap.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        selectedId = n.id;
        treeHasFocus = true;
        startCaptionEdit(n.id, c.id);
      });
  
      caps.appendChild(cap);
    }
  
    li.appendChild(caps);
  }

  if (n.children && n.children.length) {
    const ul = document.createElement('ul');
    ul.dataset.level = String(n.level + 1);
    n.children.forEach((ch, index) => {
      ul.appendChild(renderNode(ch, [...ordinalPath, index + 1]));
    });
    li.appendChild(ul);
  }

  return li;
}

/* ======== layout lines ======== */

function layoutTrunks() {
  const uls = document.querySelectorAll('ul[data-level]');

  // 1) Вертикальные trunk-линии внутри каждого списка уровня
  for (const ul of uls) {
    ul.querySelectorAll(':scope > .trunk').forEach(el => el.remove());

    const lvl = ul.dataset.level;
    if (lvl === '0') continue;

    const items = Array.from(ul.children).filter(el => el.tagName === 'LI');
    if (items.length === 0) continue;

    const first = items[0].querySelector(':scope > .anchor');
    const last = items[items.length - 1].querySelector(':scope > .anchor');
    if (!first || !last) continue;

    const ulBox = ul.getBoundingClientRect();
    const fBox = first.getBoundingClientRect();
    const lBox = last.getBoundingClientRect();

    const top = (fBox.top - ulBox.top);
    const height = (lBox.top - ulBox.top) - top;

    const trunk = document.createElement('div');
    trunk.className = 'trunk';
    trunk.style.top = top + 'px';
    trunk.style.height = Math.max(0, height) + 'px';
    ul.prepend(trunk);
  }

  // 2) Вертикальные plink-линии от родителя к блоку детей
  document.querySelectorAll('.plink').forEach(el => el.remove());

  const lis = document.querySelectorAll('li');

  for (const li of lis) {
    const childUl = li.querySelector(':scope > ul[data-level]');
    if (!childUl) continue;

    const parentAnchor = li.querySelector(':scope > .anchor');
    if (!parentAnchor) continue;

    const items = Array.from(childUl.children).filter(el => el.tagName === 'LI');
    if (items.length === 0) continue;

    const firstChildAnchor = items[0].querySelector(':scope > .anchor');
    if (!firstChildAnchor) continue;

    const liBox = li.getBoundingClientRect();
    const pBox = parentAnchor.getBoundingClientRect();
    const cBox = firstChildAnchor.getBoundingClientRect();
    const ulBox = childUl.getBoundingClientRect();

    const cs = getComputedStyle(childUl);
    const trunkX = parseFloat(cs.getPropertyValue('--trunk-x')) || 0;
    const shift = parseFloat(cs.getPropertyValue('--trunk-shift')) || 0;
    const x = (ulBox.left - liBox.left) + trunkX + shift;

    // 👇 ВОТ ГЛАВНОЕ
let startY;

if (document.body.classList.contains("ordinals-on")) {
  // ✅ НОВОЕ ПОВЕДЕНИЕ (с нумерацией)
  startY = (pBox.top - liBox.top) + 12;
} else {
  // ✅ СТАРОЕ ПОВЕДЕНИЕ (без нумерации)
  const parentStartY = (pBox.top - liBox.top) + 12;

  const caps = li.querySelector(':scope > .captions');

  if (caps) {
    const capsBox = caps.getBoundingClientRect();
    const capsBottomY = capsBox.bottom - liBox.top;
    startY = Math.max(parentStartY, capsBottomY);
  } else {
    startY = parentStartY;
  }
}

// конец линии как был
const endY = cBox.top - liBox.top;

    const plink = document.createElement('div');
    plink.className = 'plink';
    plink.style.left = x + 'px';

    if (endY >= startY) {
      plink.style.top = startY + 'px';
      plink.style.height = Math.max(0, endY - startY) + 'px';
    } else {
      plink.style.top = endY + 'px';
      plink.style.height = Math.max(0, startY - endY) + 'px';
    }

    li.prepend(plink);
  }
}

/* ======== focus / global hotkeys ======== */

document.getElementById('tree').addEventListener('click', (e) => {
  if (e.target.closest('.row')) return;
  treeHasFocus = false;
  const ae = document.activeElement;
  if (ae && ae.classList && ae.classList.contains('row')) ae.blur();
  render();
});

window.addEventListener('keydown', (e) => {
  if (isTreeLocked()) return;

  const active = document.activeElement;
  const isRow = active && active.classList && active.classList.contains('row');
  const isEditing =
    active &&
    active.classList &&
    active.classList.contains('edit') &&
    (active.tagName === 'INPUT' || active.isContentEditable);

  if (isRow || isEditing) return;
  if (!treeHasFocus) return;
  if (!selectedId) return;

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

  if (isHotkey(e, "indent")) {
    e.preventDefault();
    indentNode(selectedId);
    return;
  }

  if (isHotkey(e, "outdent")) {
    e.preventDefault();
    outdentNode(selectedId);
    return;
  }

  if (isHotkey(e, "navLeft")) {
    e.preventDefault();
    goParent(selectedId);
    return;
  }

  if (isHotkey(e, "navRight")) {
    e.preventDefault();
    goDeeper(selectedId);
    return;
  }

  if (isHotkey(e, "navUp")) {
    e.preventDefault();
    moveSelection(-1);
    return;
  }

  if (isHotkey(e, "navDown")) {
    e.preventDefault();
    moveSelection(+1);
    return;
  }

  if (isHotkey(e, "moveUp")) {
    e.preventDefault();
    moveWithinParent(-1);
    return;
  }

  if (isHotkey(e, "moveDown")) {
    e.preventDefault();
    moveWithinParent(+1);
    return;
  }

  if (isHotkey(e, "rename")) {
    e.preventDefault();
    render();
    startRename(selectedId);
    return;
  }

  if (isHotkey(e, "delete")) {
    e.preventDefault();
    removeSelected();
    return;
  }

  if (isHotkey(e, "addChild")) {
    e.preventDefault();
    addChild(selectedId);
    return;
  }

  if (isHotkey(e, "addSibling")) {
    e.preventDefault();
    addSibling(selectedId);
    return;
  }
});

/* ======== tests ======== */

function assert(cond, msg) {
  if (!cond) throw new Error('TEST FAIL: ' + msg);
}

function runTests() {
  const tRoot = makeNode(LEVEL.COMPANY, 'Проект');

  function tFind(id) {
    return findWithParent(tRoot, id);
  }

  function tAddChild(pid) {
    const r = tFind(pid);
    if (!r) return null;
    if (!canHaveChild(r.node)) return null;
    const child = makeNode(r.node.level + 1);
    r.node.children.push(child);
    return child.id;
  }

  function tAddSibling(tid) {
    if (tid === tRoot.id) return tAddChild(tRoot.id);
    const r = tFind(tid);
    if (!r || !r.parent) return null;
    const idx = r.parent.children.findIndex(x => x.id === tid);
    const sib = makeNode(r.node.level);
    r.parent.children.splice(idx + 1, 0, sib);
    return sib.id;
  }

  function tFlattenWL() {
    const out = [];
    (function walk(n) {
      out.push({ id: n.id, level: n.level });
      for (const ch of n.children) walk(ch);
    })(tRoot);
    return out;
  }

  function tFirstDeeperAfter(id) {
    const flat = tFlattenWL();
    const idx = flat.findIndex(x => x.id === id);
    if (idx < 0) return null;
    const base = flat[idx].level;
    for (let i = idx + 1; i < flat.length; i++) {
      if (flat[i].level > base) return flat[i].id;
    }
    return null;
  }

  assert(tRoot.level === LEVEL.COMPANY, 'root is company');

  const p1 = tAddSibling(tRoot.id);
  assert(!!p1, 'project added under root');

  const p2 = tAddSibling(p1);
  assert(!!p2, 'project sibling added');

  const d1 = tAddChild(p1);
  assert(!!d1, 'dept child added');

  const r1 = tAddChild(d1);
  assert(!!r1, 'role child added');

  const before = findWithParent(tRoot, r1).node.children.length;
  const nope = tAddChild(r1);
  assert(nope === null, 'no children under role');
  assert(findWithParent(tRoot, r1).node.children.length === before, 'role still leaf');

  const tRoot2 = makeNode(LEVEL.COMPANY, 'Проект');
  const pA = makeNode(LEVEL.PROJECT, 'P1');
  const pB = makeNode(LEVEL.PROJECT, 'P2');
  const dB = makeNode(LEVEL.DEPT, 'D2');
  pB.children.push(dB);
  tRoot2.children.push(pA, pB);

  function tFlattenWL2() {
    const out = [];
    (function walk(n) {
      out.push({ id: n.id, level: n.level });
      for (const ch of n.children) walk(ch);
    })(tRoot2);
    return out;
  }

  function tFirstDeeperAfter2(id) {
    const flat = tFlattenWL2();
    const idx = flat.findIndex(x => x.id === id);
    if (idx < 0) return null;
    const base = flat[idx].level;
    for (let i = idx + 1; i < flat.length; i++) {
      if (flat[i].level > base) return flat[i].id;
    }
    return null;
  }

  assert(tFirstDeeperAfter2(pA.id) === dB.id, 'arrow right deeper navigation skips to next subtree');
  assert(tFirstDeeperAfter(pA.id) === null, 'firstDeeperAfter is tree-specific');

  console.log('All tests passed');
}

function updateOrdinalButton() {
  const btn = document.getElementById("toggleOrdinals");
  if (!btn) return;

  if (showOrdinals) {
    btn.classList.add("is-active");
  } else {
    btn.classList.remove("is-active");
  }
}

function syncOrdinalsModeClass() {
  document.body.classList.toggle("ordinals-on", !!showOrdinals);
}

function initOrdinalToggle() {
  const btn = document.getElementById("toggleOrdinals");
  if (!btn) return;

  btn.addEventListener("click", () => {
    showOrdinals = !showOrdinals;
    updateOrdinalButton();
    syncOrdinalsModeClass();
    render();
  });

  updateOrdinalButton();
  syncOrdinalsModeClass();
}

function updateCaptionButton() {
  const btn = document.getElementById("toggleCaptions");
  if (!btn) return;

  if (showCaptions) {
    btn.classList.add("is-active");
  } else {
    btn.classList.remove("is-active");
  }
}

function initCaptionToggle() {
  const btn = document.getElementById("toggleCaptions");
  if (!btn) return;

  btn.addEventListener("click", () => {
    showCaptions = !showCaptions;
    updateCaptionButton();
    render();
  });

  updateCaptionButton();
}

initProjectsSidebar();
render();
initOrdinalToggle();
initCaptionToggle();

if (new URLSearchParams(location.search).get('test') === '1') {
  runTests();
}


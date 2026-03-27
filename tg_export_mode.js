// tg_export_mode.js
// Режим Telegram: экспорт ASCII + ручное редактирование + импорт обратно в дерево.
// Подписи экспортируются БЕЗ "-" и при импорте возвращаются в node.captions.

(function () {
  let tgMode = false;
  let lastAscii = '';

  function getCopyBtn() {
    return document.getElementById('tgCopy');
  }

  function getCurrentCopyText() {
    if (tgMode) {
      const ta = document.querySelector('textarea.tg-export');
      if (ta) return ta.value;
    }

    const tree = buildTreeFromDom();
    return tree ? asciiFromTree(tree) : '```\n(дерево не найдено)\n```';
  }

  function installCopyHandler() {
    const copyBtn = getCopyBtn();
    if (!copyBtn || copyBtn.__tgCopyInstalled) return;
    copyBtn.__tgCopyInstalled = true;

    copyBtn.onclick = async () => {
      try {
        const text = getCurrentCopyText();
        await navigator.clipboard.writeText(text);
      } catch (e) {
        alert('Не получилось скопировать.');
      }
    };
  }

  function getNodeLabelFromRow(row) {
    const clone = row.cloneNode(true);
    const act = clone.querySelector('.act');
    if (act) act.remove();
    return (clone.textContent || '').trim();
  }

  function getCaptionText(capEl) {
    return (capEl.textContent || '')
      .replace(/\r/g, '')
      .trim();
  }

  function buildTreeFromDom() {
    const host = document.getElementById('tree');
    if (!host) return null;

    const ul = host.querySelector('ul');
    if (!ul) return null;

    function walkLi(li) {
      const row = li.querySelector(':scope > .row');
      if (!row) return null;

      const node = {
        label: getNodeLabelFromRow(row),
        captions: [],
        children: []
      };

      const caps = li.querySelector(':scope > .captions');
      if (caps) {
        const capEls = Array.from(caps.querySelectorAll(':scope > .caption'));
        for (const capEl of capEls) {
          const txt = getCaptionText(capEl);
          if (txt) node.captions.push(txt);
        }
      }

      const childUl = li.querySelector(':scope > ul');
      if (childUl) {
        const childLis = Array.from(childUl.children).filter(el => el.tagName === 'LI');
        for (const chLi of childLis) {
          const chNode = walkLi(chLi);
          if (chNode) node.children.push(chNode);
        }
      }

      return node;
    }

    const topLi = ul.querySelector(':scope > li') || ul.querySelector('li');
    if (!topLi) return null;

    return walkLi(topLi);
  }

  function dashByLevel(level) {
    if (level <= 0) return '';
    return Array(level).fill('-').join(' ') + ' ';
  }

  function asciiFromTree(tree) {
    const lines = [];
  
    function rec(node, depth) {
      lines.push(dashByLevel(depth) + node.label);
  
      const caps = node.captions || [];
      for (const cap of caps) {
        const parts = String(cap || '')
          .replace(/\r/g, '')
          .split('\n');
  
        parts.forEach((part, index) => {
          if (index === 0) lines.push('* ' + part);
          else lines.push(part);
        });
      }
  
      (node.children || []).forEach(ch => rec(ch, depth + 1));
    }
  
    rec(tree, 0);
    return '```\n' + lines.join('\n') + '\n```';
  }

  function stripCodeFences(s) {
    const t = String(s || '').trim();
    if (t.startsWith('```') && t.endsWith('```')) {
      return t.replace(/^```[\s\r\n]*/, '').replace(/[\s\r\n]*```$/, '');
    }
    return t;
  }

  function treeFromAscii(text) {
    const clean = stripCodeFences(text);
  
    const lines = clean
      .split('\n')
      .map(l => l.replace(/\r/g, '').trimEnd());
  
    const stack = [];
    let newRoot = null;
    let lastNode = null;
  
    let captionBuffer = null;
  
    function makeParsedNode(level, name) {
      return {
        id: Math.random().toString(36).slice(2),
        level,
        name,
        nameHtml: "",
        captions: [],
        children: []
      };
    }
  
    function flushCaptionBuffer() {
      if (!lastNode || !captionBuffer) {
        captionBuffer = null;
        return;
      }
  
      const text = captionBuffer.join('\n').trim();
      captionBuffer = null;
  
      if (!text) return;
  
      if (!Array.isArray(lastNode.captions)) lastNode.captions = [];
      lastNode.captions.push({
        id: Math.random().toString(36).slice(2),
        text,
        textHtml: ""
      });
    }
  
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();
  
      if (!trimmed) {
        if (captionBuffer) {
          captionBuffer.push('');
        }
        continue;
      }
  
      // первая строка без "-" и без "*" = root
      if (!newRoot && !/^\s*-/.test(line) && !/^\s*\*/.test(line)) {
        flushCaptionBuffer();
  
        const rootName = trimmed;
        if (!rootName) continue;
  
        const rootNode = makeParsedNode(0, rootName);
        newRoot = rootNode;
        stack.length = 0;
        stack.push(rootNode);
        lastNode = rootNode;
        continue;
      }
  
      // новая подпись
      const captionMatch = line.match(/^\s*\*\s?(.*)$/);
      if (captionMatch) {
        flushCaptionBuffer();
  
        if (!lastNode) continue;
        captionBuffer = [captionMatch[1] || ''];
        continue;
      }
  
      // обычный узел
      const nodeMatch = line.match(/^((?:-\s*)+)\s*(.+)$/);
      if (nodeMatch) {
        flushCaptionBuffer();
  
        const level = (nodeMatch[1].match(/-/g) || []).length;
        const name = (nodeMatch[2] || '').trim();
        if (!name) continue;
  
        const desiredLevel = Math.max(1, Math.min(LEVEL.STEP, level));
        const node = makeParsedNode(desiredLevel, name);
  
        if (!newRoot) {
          const rootNode = makeParsedNode(0, DEFAULT_NAME?.[0] || 'Уровень 0');
          newRoot = rootNode;
          stack.length = 0;
          stack.push(rootNode);
          lastNode = rootNode;
        }
  
        while (stack.length > node.level) stack.pop();
  
        while (stack.length < node.level) {
          const placeholderLevel = stack.length;
          const placeholder = makeParsedNode(
            placeholderLevel,
            (typeof DEFAULT_NAME !== "undefined" && DEFAULT_NAME[placeholderLevel] != null)
              ? DEFAULT_NAME[placeholderLevel]
              : `Уровень ${placeholderLevel}`
          );
  
          const p = stack[stack.length - 1];
          if (!p) break;
          p.children.push(placeholder);
          stack.push(placeholder);
        }
  
        const parent = stack[stack.length - 1];
        if (!parent) continue;
  
        parent.children.push(node);
        stack.push(node);
        lastNode = node;
        continue;
      }
  
      // продолжение текущей подписи
      if (captionBuffer) {
        captionBuffer.push(trimmed);
        continue;
      }
  
      // если это просто строка без префиксов после узла, считаем началом подписи
      if (lastNode) {
        captionBuffer = [trimmed];
      }
    }
  
    flushCaptionBuffer();
  
    return newRoot;
  }

  function renderTelegramView() {
    const host = document.getElementById('tree');
    if (!host) return;

    const copyBtn = getCopyBtn();
    if (copyBtn) {
      copyBtn.style.display = 'inline-block';
    }

    const tree = buildTreeFromDom();
    lastAscii = tree ? asciiFromTree(tree) : '```\n(дерево не найдено)\n```';

    host.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'tgbar';

    const backBtn = document.createElement('button');
    backBtn.textContent = 'Сохранить';
    backBtn.className = 'btnn';

    const ta = document.createElement('textarea');
    ta.className = 'tg-export';
    ta.value = lastAscii;

    const stop = (e) => e.stopPropagation();

    bar.addEventListener('pointerdown', stop);
    bar.addEventListener('mousedown', stop);
    bar.addEventListener('click', stop);

    ta.addEventListener('pointerdown', stop);
    ta.addEventListener('mousedown', stop);
    ta.addEventListener('click', stop);

    backBtn.onclick = () => {
      const newTree = treeFromAscii(ta.value);
      if (!newTree) {
        alert('Не удалось распознать дерево. Проверь формат.');
        return;
      }

      if (typeof pushHistory === "function") pushHistory();

      root.id = newTree.id;
      root.level = newTree.level;
      root.name = newTree.name;
      root.nameHtml = newTree.nameHtml || "";
      root.captions = newTree.captions || [];
      root.children = newTree.children || [];

      selectedId = root.id;
      treeHasFocus = true;

      if (typeof render === 'function') render();
    };

    bar.append(backBtn);

    host.append(ta);
    bar.style.marginTop = '16px';
    host.append(bar);
  }

  function patchRender() {
    if (typeof window.render !== 'function') return;
    if (window.render.__tgPatched) return;

    const _render = window.render;

    function patchedRender() {
      if (tgMode) {
        _render();
        renderTelegramView();
      } else {
        _render();
      }
    }

    updateToggleBtn();

    patchedRender.__tgPatched = true;
    window.render = patchedRender;
  }

  function updateToggleBtn() {
    const std = document.getElementById('modeStd');
    const txt = document.getElementById('modeText');

    if (std && txt) {
      std.classList.toggle('is-active', !tgMode);
      txt.classList.toggle('is-active', tgMode);
      return;
    }

    const b = document.getElementById('tgToggle');
    if (!b) return;
    b.textContent = tgMode ? 'Стандартный режим' : 'Текстовый режим';
  }

  window.setTelegramMode = function (on) {
    tgMode = !!on;
    updateToggleBtn();
    window.render();
  };

  window.toggleTelegramMode = function () {
    window.setTelegramMode(!tgMode);
  };

  function installTelegramEventTrap() {
    const host = document.getElementById('tree');
    if (!host || host.__tgTrapInstalled) return;
    host.__tgTrapInstalled = true;

    function isTextareaTarget(e) {
      const t = e.target;
      return !!(t && t.closest && t.closest('textarea.tg-export'));
    }

    function trapKey(e) {
      if (!tgMode) return;
      if (!isTextareaTarget(e)) return;

      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    host.addEventListener('keydown', trapKey, true);
  }

  installTelegramEventTrap();
  installCopyHandler();
  patchRender();
})();
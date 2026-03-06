// rename.js
// Вынесено из app.js: состояние renamingId + функция startRename()

let renamingId = null;

// маленькие хелперы, чтобы app.js мог работать с состоянием rename
function requestRename(id) {
  renamingId = id;
}

function consumeRenameRequest() {
  const id = renamingId;
  renamingId = null;
  return id;
}

function startRename(id) {
    
  if (!id) return;
  const r = findWithParent(root, id);
  if (!r) return;

  // запоминаем, что мы в режиме переименования
  requestRename(id);

  const host = document.getElementById('tree');
  const row = host.querySelector(`.row[data-id="${cssEscape(id)}"]`);
  if (!row) return;

//   const cur = r.node.name || '';
//   row.innerHTML = '';

//   const input = document.createElement('input');
//   input.className = 'edit';
//   input.type = 'text';
//   input.value = cur;

//   // чтобы клики по input не триггерили выбор строки/рендер
//   const stopMouse = (e) => e.stopPropagation();
//   input.addEventListener('pointerdown', stopMouse);
//   input.addEventListener('pointerup', stopMouse);
//   input.addEventListener('mousedown', stopMouse);
//   input.addEventListener('mouseup', stopMouse);
//   input.addEventListener('click', stopMouse);
//   input.addEventListener('dblclick', stopMouse);

//   input.style.width = Math.max(120, Math.min(520, (cur.length + 4) * 9)) + 'px';

//   let done = false;

//   function commit() {
//     if (done) return;
//     done = true;
  
//     const t = input.value.trim();
//     if (t && t !== r.node.name) {
//       pushHistory();
//       r.node.name = t;
//     }
//     renamingId = null;
//     render();
//   }
  
//   function cancel() {
//     if (done) return;
//     done = true;
  
//     renamingId = null;
//     render();
//   }

//   input.addEventListener('keydown', (e) => {

//     // 🔒 Главное: не даём событию подняться к .row и app.js
//     stopBackspaceLeak(e);
//     e.stopPropagation();
//     if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  
//     if (e.key === 'Enter') {
//       e.preventDefault();
//       commit();
//       return;
//     }
  
//     if (e.key === 'Escape') {
//       e.preventDefault();
//       cancel();
//       return;
//     }
  
//     // стрелки — пусть работают внутри input
//     if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
//       if (e.shiftKey) {
//         e.preventDefault();
//         const len = input.value.length;
//         const a = input.selectionStart ?? 0;
//         const b = input.selectionEnd ?? 0;
//         const anchor = (input._selAnchor ?? (b > a ? a : a));
//         input._selAnchor = anchor;
  
//         if (e.key === 'ArrowUp') input.setSelectionRange(0, anchor);
//         else input.setSelectionRange(anchor, len);
//       } else {
//         input._selAnchor = null;
//       }
//       return;
//     }

//   }, true);

//   input.addEventListener('blur', () => { commit(); });

//   row.appendChild(input);
//   input.focus({ preventScroll: true });
//   input.select();
// }



// rename.js (внутри startRename)

const curText = r.node.name || '';
const curHtml = r.node.nameHtml || '';

row.innerHTML = '';

const ed = document.createElement('div');
ed.className = 'edit edit-rich';
ed.contentEditable = 'true';
ed.spellcheck = false;

// стартовое содержимое
if (curHtml) ed.innerHTML = curHtml;
else ed.textContent = curText;

// чтобы клики по редактору не триггерили выбор строки/рендер
const stopMouse = (e) => e.stopPropagation();
["pointerdown","pointerup","mousedown","mouseup","click","dblclick"].forEach(ev =>
  ed.addEventListener(ev, stopMouse)
);

// ширина примерно как у input (можешь оставить/убрать)
ed.style.minWidth = '120px';
ed.style.maxWidth = '520px';

let done = false;

function sanitizeRich(html) {
  // Приводим execCommand-HTML к безопасному подмножеству:
  // b/strong -> span.rt-b, i/em -> span.rt-i, u -> span.rt-u, s/strike -> span.rt-s
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const replaceTag = (selector, cls) => {
    tmp.querySelectorAll(selector).forEach(el => {
      const span = document.createElement('span');
      span.className = cls;
      span.innerHTML = el.innerHTML;
      el.replaceWith(span);
    });
  };

  replaceTag('b,strong', 'rt-b');
  replaceTag('i,em',     'rt-i');
  replaceTag('u',        'rt-u');
  replaceTag('s,strike', 'rt-s');

  // Чистка: оставляем только span.rt-* и br и текст
  const walk = (node) => {
    for (const ch of Array.from(node.childNodes)) {
      if (ch.nodeType === Node.ELEMENT_NODE) {
        const tag = ch.tagName.toLowerCase();
        if (tag === 'br') continue;

        if (tag === 'span') {
          const ok = ['rt-b','rt-i','rt-u','rt-s'].some(c => ch.classList.contains(c));
          if (!ok) {
            ch.replaceWith(...Array.from(ch.childNodes));
            continue;
          }
        } else {
          ch.replaceWith(...Array.from(ch.childNodes));
          continue;
        }
        walk(ch);
      }
    }
  };
  walk(tmp);

  const hasFmt = !!tmp.querySelector('span.rt-b,span.rt-i,span.rt-u,span.rt-s');
  return { html: hasFmt ? tmp.innerHTML : '', text: tmp.textContent || '' };
}

function commit() {
  if (done) return;
  done = true;

  const { html, text } = sanitizeRich(ed.innerHTML);
  const t = (text || '').trim();

  if (t && (t !== r.node.name || html !== (r.node.nameHtml || ''))) {
    pushHistory();
    r.node.name = t;
    r.node.nameHtml = html; // '' если нет форматирования
  }

  renamingId = null;
  render();
}

function cancel() {
  if (done) return;
  done = true;
  renamingId = null;
  render();
}

ed.addEventListener('keydown', (e) => {
  // не даём событию подняться к .row и app.js
  stopBackspaceLeak(e);
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();

  if (e.key === 'Enter') { e.preventDefault(); commit(); return; }
  if (e.key === 'Escape') { e.preventDefault(); cancel(); return; }
}, true);

ed.addEventListener('blur', () => commit());

row.appendChild(ed);
ed.focus({ preventScroll: true });

// select all
const sel = window.getSelection();
const range = document.createRange();
range.selectNodeContents(ed);
sel.removeAllRanges();
sel.addRange(range);
}

// ===== MODAL LOCK while renaming =====
// Полностью блокирует работу "основной программы", пока активен input.edit.
// Реализовано один раз через capture event-trap.

(function installRenameModalLock() {
    if (typeof window === "undefined") return;
    if (window.__renameModalLockInstalled) return;
    window.__renameModalLockInstalled = true;
  
    // Какие события гасим
    const EVENTS = [
      "keydown",
      "keyup",
      "keypress",
      "pointerdown",
      "mousedown",
      "mouseup",
      "click",
      "dblclick",
      "contextmenu",
      "wheel",
      "touchstart",
      "touchend",
    ];
  
    // function activeEditInput() {
    //   const ae = document.activeElement;
    //   if (ae && ae.tagName === "INPUT" && ae.classList && ae.classList.contains("edit")) return ae;
    //   return null;
    // }

    function activeEditInput() {
      const ae = document.activeElement;
      if (!ae) return null;
    
      // разрешаем и input.edit, и contenteditable.edit
      if (ae.classList?.contains("edit") && (ae.tagName === "INPUT" || ae.isContentEditable)) return ae;
    
      return null;
    }


  
    function isRenamingActive() {
      // renamingId — локальная переменная этого файла
      return !!renamingId || !!activeEditInput();
    }
  
    // function isAllowedTarget(e) {
    //   const t = e.target;
    //   if (!t || !t.closest) return false;
  
    //   // Разрешаем взаимодействие с самим инпутом (и только с ним)
    //   return !!t.closest("input.edit");
    // }
    function isAllowedTarget(e) {
      const t = e.target;
      if (!t || !t.closest) return false;
    
      // 1) сам редактор (input или contenteditable)
      if (t.closest(".edit")) return true;
    
      // 2) кнопки форматирования (иначе modal-lock их “гасит” и делает blur)
      if (t.closest("#fmtBold,#fmtItalic,#fmtUnderline,#fmtStrike")) return true;
    
      return false;
    }



  
    function trap(e) {
      if (!isRenamingActive()) return;
    
      const inp = activeEditInput();
    
      // ✅ КЛИК ВНЕ input: коммитим через blur
      const isPointer =
        e.type === "pointerdown" || e.type === "mousedown" || e.type === "touchstart";
    
      if (isPointer && inp && !isAllowedTarget(e)) {
        // запускаем blur -> commit()
        inp.blur();
    
        // и гасим клик, чтобы он не выбрал строку и не нажал кнопки
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        return;
      }
    
      // ✅ Внутри input — пропускаем
      if (isAllowedTarget(e)) return;
    
      // 🔒 Всё остальное как было: блокируем
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
  
    // Важно: capture=true, чтобы перехватить РАНЬШЕ обработчиков приложения
    for (const ev of EVENTS) {
      window.addEventListener(ev, trap, true);
      document.addEventListener(ev, trap, true);
    }
  })();
  
  // Дополнительно: чтобы Backspace точно не удалял узел через hotkey delete=Backspace
  // (это "мягкая" страховка, даже при modal lock не помешает)
  function stopBackspaceLeak(e) {
    if (e.key === "Backspace") {
      e.stopPropagation();
      // preventDefault НЕ делаем: иначе символ не удалится в input
    }
  }
  
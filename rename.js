// rename.js

let renamingId = null;

function requestRename(id) {
  renamingId = id;
}

function consumeRenameRequest() {
  const id = renamingId;
  renamingId = null;
  return id;
}

function relayoutTreeLines() {
  if (typeof layoutTrunks !== "function") return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      layoutTrunks();
    });
  });
}

function startRename(id) {
  if (!id) return;

  const found = findWithParent(root, id);
  if (!found) return;
  const node = found.node;

  const seedFmt =
    window.__fmtSync?.getWholeFmtForNode
      ? window.__fmtSync.getWholeFmtForNode(node)
      : { b: false, i: false, u: false, s: false };

  window.__renameFmtSession = {
    nodeId: node.id,
    seedFmt: { ...seedFmt },
  };

  const initialFmt =
    window.__fmtSync?.getFmt
      ? window.__fmtSync.getFmt(node.id)
      : { b: false, i: false, u: false, s: false };

  const hadAnyInitialFmt =
    !!node.nameHtml ||
    !!initialFmt.b || !!initialFmt.i || !!initialFmt.u || !!initialFmt.s;

  requestRename(id);

  const tree = document.getElementById("tree");
  const row = tree?.querySelector(`.row[data-id="${cssEscape(id)}"]`);
  if (!row) return;

  const oldLabel = row.querySelector(":scope > .label");
  const act = row.querySelector(":scope > .act");

  if (oldLabel) oldLabel.remove();

  const ed = document.createElement("div");
  ed.className = "edit edit-rich";
  ed.contentEditable = "true";
  ed.spellcheck = false;
  ed.style.minWidth = "120px";
  ed.style.maxWidth = "520px";

  ed.__seedFmt = { ...seedFmt };
  ed.__nodeId = node.id;

  const initialHtml =
    window.__fmtSync?.buildRichHtmlFromNode?.(node) ||
    node.nameHtml ||
    "";

  if (initialHtml) ed.innerHTML = initialHtml;
  else ed.textContent = node.name || "";

  const stopMouse = (e) => e.stopPropagation();
  ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick"].forEach((ev) => {
    ed.addEventListener(ev, stopMouse);
  });

  let done = false;

  function getNormalizedValue() {
    if (window.__fmtSync?.normalizeRichHtml) {
      return window.__fmtSync.normalizeRichHtml(ed.innerHTML);
    }
    return {
      html: ed.innerHTML || "",
      text: ed.textContent || "",
    };
  }

  function commit() {
    if (done) return;
    done = true;

    const next = getNormalizedValue();
    const nextText = (next.text || "").trim();
    const prevText = node.name || "";
    const prevHtml = node.nameHtml || "";

    if (!nextText) {
      renamingId = null;
      window.__renameFmtSession = null;
      render();
      return;
    }

    const htmlChanged = (next.html || "") !== prevHtml;
    const textChanged = nextText !== prevText;

    const formattingClearedFromSeededState =
      hadAnyInitialFmt && !next.html;

    const shouldCommit =
      textChanged ||
      htmlChanged ||
      formattingClearedFromSeededState;

    if (shouldCommit) {
      if (typeof pushHistory === "function") pushHistory();

      node.name = nextText;
      node.nameHtml = next.html || "";

      if (
        window.__fmtSync?.getFmtCoverageFromHtml &&
        window.__fmtSync?.setFmt
      ) {
        const seed = ed.__seedFmt || { b: false, i: false, u: false, s: false };

        const coverage = window.__fmtSync.getFmtCoverageFromHtml(
          node.nameHtml || "",
          node.name || ""
        );

        const nextButtonFmt = {
          b: seed.b ? coverage.b !== "none" : coverage.b === "all",
          i: seed.i ? coverage.i !== "none" : coverage.i === "all",
          u: seed.u ? coverage.u !== "none" : coverage.u === "all",
          s: seed.s ? coverage.s !== "none" : coverage.s === "all",
        };

        window.__fmtSync.setFmt(node.id, nextButtonFmt);
      }
    }

    renamingId = null;
    window.__renameFmtSession = null;
    render();
  }

  function cancel() {
    if (done) return;
    done = true;
    renamingId = null;
    window.__renameFmtSession = null;
    render();
  }

  ed.addEventListener("keydown", (e) => {
    stopBackspaceLeak(e);
    e.stopPropagation();
    e.stopImmediatePropagation?.();

    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }

    const isCaptionLineBreakHotkey =
      typeof window.isHotkey === "function" &&
      window.hotkeysMode !== "custom" &&
      window.isHotkey(e, "addCaptionLineBreak");

    if (isCaptionLineBreakHotkey) {
      e.preventDefault();
      document.execCommand("insertLineBreak");

      requestAnimationFrame(() => {
        autosizeCaptionEditorHeight();
        relayoutTreeLines();
      });

      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
  }, true);

  const syncBtns = () => {
    if (typeof window.syncFmtButtons === "function") window.syncFmtButtons();
  };

  ed.addEventListener("keyup", syncBtns);
  ed.addEventListener("mouseup", syncBtns);
  ed.addEventListener("input", syncBtns);
  ed.addEventListener("blur", () => commit());

  if (act) row.insertBefore(ed, act);
  else row.appendChild(ed);

  ed.focus({ preventScroll: true });

  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(ed);
  sel.removeAllRanges();
  sel.addRange(range);

  syncBtns();
}

(function installRenameModalLock() {
  if (typeof window === "undefined") return;
  if (window.__renameModalLockInstalled) return;
  window.__renameModalLockInstalled = true;

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

  function activeEditInput() {
    const ae = document.activeElement;
    if (!ae) return null;

    if (ae.classList?.contains("edit") && (ae.tagName === "INPUT" || ae.isContentEditable)) {
      return ae;
    }

    return null;
  }

  function isRenamingActive() {
    return !!renamingId || !!activeEditInput();
  }

  function isAllowedTarget(e) {
    const t = e.target;
    if (!t || !t.closest) return false;

    if (t.closest(".edit")) return true;
    if (t.closest("#fmtBold,#fmtItalic,#fmtUnderline,#fmtStrike")) return true;

    return false;
  }

  function trap(e) {
    if (!isRenamingActive()) return;

    const inp = activeEditInput();
    const isPointer =
      e.type === "pointerdown" || e.type === "mousedown" || e.type === "touchstart";

    if (isPointer && inp && !isAllowedTarget(e)) {
      inp.blur();
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      return;
    }

    if (isAllowedTarget(e)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  }

  for (const ev of EVENTS) {
    window.addEventListener(ev, trap, true);
    document.addEventListener(ev, trap, true);
  }
})();

function stopBackspaceLeak(e) {
  if (e.key === "Backspace") {
    e.stopPropagation();
  }
}

function startCaptionEdit(nodeId, captionId, opts = {}) {
  const r = findWithParent(root, nodeId);
  if (!r || !Array.isArray(r.node.captions)) return;

  const capData = r.node.captions.find(x => x.id === captionId);
  if (!capData) return;

  const isNew = !!opts.isNew;

  renamingId = `caption:${nodeId}:${captionId}`;

  const el = document.querySelector(
    `.caption[data-node-id="${cssEscape(nodeId)}"][data-caption-id="${cssEscape(captionId)}"]`
  );
  if (!el) return;

  const curText = capData.text || "";
  const curHtml = capData.textHtml || "";

  el.innerHTML = "";

  const ed = document.createElement("div");
  ed.className = "edit edit-rich edit-caption";
  ed.contentEditable = "true";
  ed.spellcheck = false;
  ed.style.display = "inline-block";
  ed.style.minWidth = "220px";
  ed.style.maxWidth = "900px";
  ed.style.whiteSpace = "pre-wrap";
  ed.style.overflowWrap = "break-word";
  ed.style.wordBreak = "break-word";
  ed.style.verticalAlign = "top";
  ed.style.height = "auto";
  ed.style.minHeight = "1.3em";
  ed.style.lineHeight = "1.3em";

  function updateCaptionEditorTypography() {
     const html = ed.innerHTML || "";
   	    const text = ed.textContent || "";
   	
   	    const isMultiline =
   	      html.includes("<br>") ||
   	      html.includes("<div>") ||
   	      html.includes("</div>") ||
   	      text.includes("\n");
   	
   	    if (isMultiline) {
   	      ed.style.lineHeight = "1.05em";
   	    } else {
   	      ed.style.lineHeight = "1.3em";
   	    }
   	  }

  if (curHtml) ed.innerHTML = curHtml;
  else ed.textContent = curText;

  updateCaptionEditorTypography();

  const stopMouse = (e) => e.stopPropagation();
  ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick"].forEach(ev =>
    ed.addEventListener(ev, stopMouse)
  );

  let done = false;

  function autosizeCaptionEditorHeight() {
    ed.style.height = "auto";
    ed.style.height = ed.scrollHeight + "px";
  }

  function sanitizeCaption(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;

    const replaceTag = (selector, cls) => {
      tmp.querySelectorAll(selector).forEach(el => {
        const span = document.createElement("span");
        span.className = cls;
        span.innerHTML = el.innerHTML;
        el.replaceWith(span);
      });
    };

    replaceTag("b,strong", "rt-b");
    replaceTag("i,em", "rt-i");
    replaceTag("u", "rt-u");
    replaceTag("s,strike", "rt-s");

    const walk = (node) => {
      for (const ch of Array.from(node.childNodes)) {
        if (ch.nodeType === Node.ELEMENT_NODE) {
          const tag = ch.tagName.toLowerCase();
          if (tag === "br") continue;

          if (tag === "div") {
            ch.before(...Array.from(ch.childNodes), document.createElement("br"));
            ch.remove();
            continue;
          }

          if (tag === "span") {
            const ok = ["rt-b", "rt-i", "rt-u", "rt-s"].some(c => ch.classList.contains(c));
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

    while (tmp.lastChild && tmp.lastChild.nodeName === "BR") {
      tmp.removeChild(tmp.lastChild);
    }

    const hasFmt = !!tmp.querySelector("span.rt-b,span.rt-i,span.rt-u,span.rt-s");
    return {
      html: hasFmt ? tmp.innerHTML : "",
      text: (tmp.textContent || "").trim()
    };
  }

  function finishRender() {
    renamingId = null;
    render();
  }

  function commit() {
    if (done) return;
    done = true;

    if (window.__suppressCaptionBlurCommit) {
      finishRender();
      return;
    }

    const { html, text } = sanitizeCaption(ed.innerHTML);
    const prevText = capData.text || "";
    const prevHtml = capData.textHtml || "";
    const nextEmpty = !text && !html;
    const changed = text !== prevText || html !== prevHtml;

    if (isNew) {
      if (nextEmpty) {
        r.node.captions = r.node.captions.filter(x => x.id !== captionId);
      } else {
        capData.text = text;
        capData.textHtml = html;
      }
      finishRender();
      return;
    }

    if (nextEmpty) {
      if (typeof pushHistory === "function") pushHistory();
      r.node.captions = r.node.captions.filter(x => x.id !== captionId);
      finishRender();
      return;
    }

    if (changed) {
      if (typeof pushHistory === "function") pushHistory();
      capData.text = text;
      capData.textHtml = html;
    }

    finishRender();
  }

  function cancel() {
    if (done) return;
    done = true;

    if (isNew) {
      r.node.captions = r.node.captions.filter(x => x.id !== captionId);
    }

    renamingId = null;
    render();
  }

  ed.addEventListener("keydown", (e) => {
    stopBackspaceLeak(e);
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
  
    if (window.hotkeysMode === "custom") return;
  
    const normalize = window.hotkeys?.normalizeCombo;
  
    const haveRaw =
      typeof comboFromKeyEvent === "function"
        ? comboFromKeyEvent(e)
        : "";
  
    const have = normalize ? normalize(haveRaw) : haveRaw;
  
    const wantLineBreakRaw = window.hotkeys?.get?.("addCaptionLineBreak") || "";
    const wantLineBreak = normalize ? normalize(wantLineBreakRaw) : wantLineBreakRaw;
  
    if (have && wantLineBreak && have === wantLineBreak) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
  
      requestAnimationFrame(() => {
        autosizeCaptionEditorHeight();
        relayoutTreeLines();
      });
  
      return;
    }
  
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
  }, true);

  ed.addEventListener("blur", () => {
    if (window.__suppressCaptionBlurCommit) return;
    commit();
  });

  ed.addEventListener("input", () => {
    updateCaptionEditorTypography();
    autosizeCaptionEditorHeight();
    relayoutTreeLines();
  });

  ed.addEventListener("keyup", () => {
    updateCaptionEditorTypography();
    autosizeCaptionEditorHeight();
    relayoutTreeLines();
  });

  el.appendChild(ed);
  ed.focus({ preventScroll: true });

  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(ed);
  sel.removeAllRanges();
  sel.addRange(range);

  autosizeCaptionEditorHeight();
  relayoutTreeLines();
}
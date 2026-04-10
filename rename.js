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

function normalizeRichHtmlKeepingColorLocal(html) {
  if (window.__colorFmtSync?.normalizeRichHtmlKeepingColor) {
    return window.__colorFmtSync.normalizeRichHtmlKeepingColor(html || "");
  }

  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";

  function sanitizeElement(el) {
    const tag = (el.tagName || "").toLowerCase();

    if (tag === "span") {
      const keep =
        el.classList.contains("rt-b") ||
        el.classList.contains("rt-i") ||
        el.classList.contains("rt-u") ||
        el.classList.contains("rt-s") ||
        el.classList.contains("rt-color") ||
        el.classList.contains("rt-bg");

      if (!keep) {
        el.replaceWith(...Array.from(el.childNodes));
        return;
      }

      const styleParts = [];
      if (el.classList.contains("rt-color")) {
        const color = el.style.getPropertyValue("--rt-color") || "";
        if (color) styleParts.push(`--rt-color:${color}`);
      }
      if (el.classList.contains("rt-bg")) {
        const bg = el.style.getPropertyValue("--rt-bg") || "";
        if (bg) styleParts.push(`--rt-bg:${bg}`);
      }

      if (styleParts.length) {
        el.setAttribute("style", styleParts.join(";"));
      } else {
        el.removeAttribute("style");
      }
      return;
    }

    if (tag === "br") return;
    if (
      tag === "b" || tag === "strong" ||
      tag === "i" || tag === "em" ||
      tag === "u" ||
      tag === "s" || tag === "strike" || tag === "del"
    ) {
      return;
    }

    el.replaceWith(...Array.from(el.childNodes));
  }

  function walk(node) {
    for (const ch of Array.from(node.childNodes)) {
      if (ch.nodeType === Node.ELEMENT_NODE) {
        walk(ch);
        sanitizeElement(ch);
      }
    }
  }

  walk(tmp);
  return tmp.innerHTML;
}

function detectWholeNodeColorFmtFromHtmlLocal(html, text) {
  if (window.__colorFmtSync?.detectWholeNodeColorFmtFromHtml) {
    return window.__colorFmtSync.detectWholeNodeColorFmtFromHtml(html || "", text || "");
  }

  const tmp = document.createElement("div");
  tmp.innerHTML = normalizeRichHtmlKeepingColorLocal(html || "");

  function collectCoverage(kindClass, cssVarName) {
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
    let total = 0;
    let covered = 0;
    const values = new Set();

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue || "";
      if (!value) continue;

      total += value.length;

      let p = node.parentNode;
      let matched = false;
      while (p && p !== tmp) {
        if (p.nodeType === 1 && p.classList?.contains(kindClass)) {
          const v = p.style?.getPropertyValue(cssVarName)?.trim() || "";
          values.add(v);
          covered += value.length;
          matched = true;
          break;
        }
        p = p.parentNode;
      }

      if (!matched) values.add("");
    }

    if (total === 0) return "";
    if (values.size === 1) return Array.from(values)[0] || "";
    return "__mixed__";
  }

  return {
    text: collectCoverage("rt-color", "--rt-color"),
    bg: collectCoverage("rt-bg", "--rt-bg"),
  };
}

function updateNodeColorMapFromHtml(node) {
  if (!node?.id) return;

  if (!window.__colorFmtMap) {
    window.__colorFmtMap = Object.create(null);
  }

  const detected = detectWholeNodeColorFmtFromHtmlLocal(node.nameHtml || "", node.name || "");
  const next = {
    text: detected.text === "__mixed__" ? "" : (detected.text || ""),
    bg: detected.bg === "__mixed__" ? "" : (detected.bg || ""),
  };

  window.__colorFmtMap[node.id] = next;
}

function startRename(id) {
  if (!id) return;

  const found = findWithParent(root, id);
  if (!found) return;
  const node = found.node;

  const initialFmt =
    window.__fmtSync?.getFmt
      ? window.__fmtSync.getFmt(node.id)
      : { b: false, i: false, u: false, s: false };

  const seedFmt = { ...initialFmt };

  window.__renameFmtSession = {
    nodeId: node.id,
    seedFmt: { ...seedFmt },
  };

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
    const html = normalizeRichHtmlKeepingColorLocal(ed.innerHTML);
    return {
      html: html || "",
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

      updateNodeColorMapFromHtml(node);
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
      ed.style.fontSize = "11px";
      ed.style.lineHeight = "1.05em";
    } else {
      ed.style.fontSize = "";
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
            const ok = ["rt-b", "rt-i", "rt-u", "rt-s", "rt-color", "rt-bg"]
              .some(c => ch.classList.contains(c));

            if (!ok) {
              ch.replaceWith(...Array.from(ch.childNodes));
              continue;
            }

            const styleParts = [];
            if (ch.classList.contains("rt-color")) {
              const color = ch.style?.getPropertyValue("--rt-color") || "";
              if (color) styleParts.push(`--rt-color:${color}`);
            }
            if (ch.classList.contains("rt-bg")) {
              const bg = ch.style?.getPropertyValue("--rt-bg") || "";
              if (bg) styleParts.push(`--rt-bg:${bg}`);
            }

            if (styleParts.length) {
              ch.setAttribute("style", styleParts.join(";"));
            } else {
              ch.removeAttribute("style");
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

    const hasFmt = !!tmp.querySelector(
      "span.rt-b,span.rt-i,span.rt-u,span.rt-s,span.rt-color,span.rt-bg"
    );

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
        updateCaptionEditorTypography();
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
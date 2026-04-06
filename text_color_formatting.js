// text_color_formatting.js
(function () {
    if (typeof window === "undefined") return;
  
    const EMPTY_COLOR_FMT = { text: "", bg: "" };
  
    const TEXT_PRESETS = {
      textColor1: "#000000",
      textColor2: "#6E6E6E",
      textColor3: "#B5B5B5",
      textColor4: "#D0021B",
      textColor5: "#F5A623",
      textColor6: "#F8E71C",
      textColor7: "#7ED321",
      textColor8: "#4A90E2",
      textColor9: "#1E06C7",
      textColor0: ""
    };
  
    const BG_PRESETS = {
      bgColor1: "#000000",
      bgColor2: "#6E6E6E",
      bgColor3: "#B5B5B5",
      bgColor4: "#F6D6D6",
      bgColor5: "#F8E0C2",
      bgColor6: "#F8EDAF",
      bgColor7: "#DDECCB",
      bgColor8: "#D7E8F6",
      bgColor9: "#D9E4F7",
      bgColor0: ""
    };
  
    const TEXT_ACTIONS = Object.keys(TEXT_PRESETS);
    const BG_ACTIONS = Object.keys(BG_PRESETS);
  
    window.__colorFmtMap = window.__colorFmtMap || Object.create(null);
  
    function host() {
      return document.getElementById("tree");
    }
  
    function getNodeById(id) {
      if (!id || typeof findWithParent !== "function" || typeof root === "undefined") return null;
      const found = findWithParent(root, id);
      return found ? found.node : null;
    }
  
    function isEditingNow() {
      const ae = document.activeElement;
      if (!ae) return false;
      if (ae.tagName === "INPUT" && ae.classList?.contains("edit")) return true;
      if (ae.tagName === "TEXTAREA" && ae.classList?.contains("tg-export")) return true;
      if (ae.isContentEditable) return true;
      return false;
    }
  
    function activeRichEditor() {
      const ae = document.activeElement;
      if (ae && ae.classList?.contains("edit-rich") && ae.isContentEditable) return ae;
      return null;
    }
  
    function getTargetRows() {
      const h = host();
      if (!h) return [];
  
      const multi = Array.from(h.querySelectorAll(".row.multi"));
      if (multi.length) return multi;
  
      const sel = h.querySelector(".row.sel");
      return sel ? [sel] : [];
    }
  
    function cloneColorFmt(fmt) {
      return {
        text: fmt?.text || "",
        bg: fmt?.bg || "",
      };
    }
  
    function getColorFmt(id) {
      return cloneColorFmt(window.__colorFmtMap[id] || EMPTY_COLOR_FMT);
    }
  
    function setColorFmt(id, fmt) {
      window.__colorFmtMap[id] = cloneColorFmt(fmt || EMPTY_COLOR_FMT);
      return window.__colorFmtMap[id];
    }
  
    function emptyColorFmt() {
      return { text: "", bg: "" };
    }
  
    function escapeHtml(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
  
    function ensureColorStyle() {
      const id = "text-color-formatting-style";
      if (document.getElementById(id)) return;
  
      const st = document.createElement("style");
      st.id = id;
      st.textContent = `
        .rt-color{
          color: var(--rt-color);
        }
        .rt-bg{
          background-color: var(--rt-bg);
          border-radius: 2px;
          padding: 0 1px;
        }
      `;
      document.head.appendChild(st);
    }
  
    function wrapWholeTextWithColorFmt(text, fmt) {
      let html = escapeHtml(text || "");
      if (!html) return "";
  
      if (fmt.bg) {
        html = `<span class="rt-bg" style="--rt-bg:${fmt.bg};">${html}</span>`;
      }
      if (fmt.text) {
        html = `<span class="rt-color" style="--rt-color:${fmt.text};">${html}</span>`;
      }
      return html;
    }
  
    function normalizeRichHtmlKeepingColor(html) {
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
        if (tag === "b" || tag === "strong" || tag === "i" || tag === "em" || tag === "u" || tag === "s" || tag === "strike" || tag === "del") return;
  
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
  
    function detectWholeNodeColorFmtFromHtml(html, text) {
      const tmp = document.createElement("div");
      tmp.innerHTML = normalizeRichHtmlKeepingColor(html || escapeHtml(text || ""));
  
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
  
    function getWholeColorFmtForNode(node) {
      if (!node) return emptyColorFmt();
  
      if (node.nameHtml) {
        const fmt = detectWholeNodeColorFmtFromHtml(node.nameHtml, node.name || "");
        return {
          text: fmt.text === "__mixed__" ? "" : fmt.text,
          bg: fmt.bg === "__mixed__" ? "" : fmt.bg,
        };
      }
  
      return getColorFmt(node.id);
    }
  
    function applyColorToWholeNode(node, kind, color) {
      if (!node) return false;
  
      const curFmt = getWholeColorFmtForNode(node);
      const nextFmt = {
        text: kind === "text" ? (color || "") : (curFmt.text || ""),
        bg: kind === "bg" ? (color || "") : (curFmt.bg || ""),
      };
  
      const nextHtml = wrapWholeTextWithColorFmt(node.name || "", nextFmt);
  
      node.nameHtml = nextHtml || "";
      setColorFmt(node.id, nextFmt);
      return true;
    }
  
    function getSelectionOffsetsInEditor(ed) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
  
      const range = sel.getRangeAt(0);
      if (!ed.contains(range.startContainer) || !ed.contains(range.endContainer)) return null;
  
      function countNodeLength(node) {
        if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || "").length;
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") return 1;
  
        let len = 0;
        for (const ch of Array.from(node.childNodes || [])) len += countNodeLength(ch);
        return len;
      }
  
      function offsetFromRoot(container, offset) {
        let total = 0;
        let found = false;
  
        function walk(node) {
          if (found) return;
  
          if (node === container) {
            if (node.nodeType === Node.TEXT_NODE) {
              total += offset;
            } else {
              const kids = Array.from(node.childNodes || []);
              for (let i = 0; i < Math.min(offset, kids.length); i++) {
                total += countNodeLength(kids[i]);
              }
            }
            found = true;
            return;
          }
  
          if (node.nodeType === Node.TEXT_NODE) {
            total += (node.nodeValue || "").length;
            return;
          }
  
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
            total += 1;
            return;
          }
  
          for (const ch of Array.from(node.childNodes || [])) {
            walk(ch);
            if (found) return;
          }
        }
  
        walk(ed);
        return total;
      }
  
      const start = offsetFromRoot(range.startContainer, range.startOffset);
      const end = offsetFromRoot(range.endContainer, range.endOffset);
  
      return {
        start: Math.min(start, end),
        end: Math.max(start, end),
      };
    }
  
    function setSelectionOffsetsInEditor(ed, start, end) {
      const sel = window.getSelection();
      if (!sel) return;
  
      const range = document.createRange();
      let pos = 0;
      let startSet = false;
      let endSet = false;
  
      function walk(node) {
        if (endSet) return;
  
        if (node.nodeType === Node.TEXT_NODE) {
          const len = (node.nodeValue || "").length;
  
          if (!startSet && start <= pos + len) {
            range.setStart(node, Math.max(0, start - pos));
            startSet = true;
          }
          if (!endSet && end <= pos + len) {
            range.setEnd(node, Math.max(0, end - pos));
            endSet = true;
          }
  
          pos += len;
          return;
        }
  
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
          if (!startSet && start <= pos + 1) {
            range.setStartBefore(node);
            startSet = true;
          }
          if (!endSet && end <= pos + 1) {
            range.setEndBefore(node);
            endSet = true;
          }
          pos += 1;
          return;
        }
  
        for (const ch of Array.from(node.childNodes || [])) {
          walk(ch);
          if (endSet) return;
        }
      }
  
      walk(ed);
  
      if (!startSet || !endSet) {
        range.selectNodeContents(ed);
        range.collapse(false);
      }
  
      sel.removeAllRanges();
      sel.addRange(range);
    }
  
    function textNodesIn(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const out = [];
      while (walker.nextNode()) out.push(walker.currentNode);
      return out;
    }
  
    function wrapRangeInTextNode(textNode, start, end, makeWrapper) {
      const text = textNode.nodeValue || "";
      const left = text.slice(0, start);
      const mid = text.slice(start, end);
      const right = text.slice(end);
  
      const frag = document.createDocumentFragment();
      if (left) frag.appendChild(document.createTextNode(left));
  
      if (mid) {
        const wrap = makeWrapper();
        wrap.textContent = mid;
        frag.appendChild(wrap);
      }
  
      if (right) frag.appendChild(document.createTextNode(right));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  
    function applyColorToSelectionInEditor(ed, kind, color) {
      const sel = getSelectionOffsetsInEditor(ed);
      if (!sel) return false;
      if (sel.start === sel.end) return false;
  
      const normalized = normalizeRichHtmlKeepingColor(ed.innerHTML || "");
      ed.innerHTML = normalized || ed.innerHTML || "";
  
      const nodes = textNodesIn(ed);
      let pos = 0;
  
      for (const node of nodes) {
        const len = (node.nodeValue || "").length;
        const from = Math.max(pos, sel.start);
        const to = Math.min(pos + len, sel.end);
  
        if (from < to) {
          const localStart = from - pos;
          const localEnd = to - pos;
  
          wrapRangeInTextNode(node, localStart, localEnd, () => {
            const span = document.createElement("span");
            if (kind === "text") {
              span.className = "rt-color";
              if (color) span.style.setProperty("--rt-color", color);
            } else {
              span.className = "rt-bg";
              if (color) span.style.setProperty("--rt-bg", color);
            }
            return span;
          });
        }
  
        pos += len;
      }
  
      ed.innerHTML = normalizeRichHtmlKeepingColor(ed.innerHTML || "");
      setSelectionOffsetsInEditor(ed, sel.start, sel.end);
      return true;
    }
  
    function applyColorToTargets(kind, color) {
      const ed = activeRichEditor();
      if (ed) {
        const changed = applyColorToSelectionInEditor(ed, kind, color);
        if (!changed) {
          if (!ed.__pendingColorFmt) ed.__pendingColorFmt = { text: "", bg: "" };
          ed.__pendingColorFmt[kind] = color || "";
        }
        syncToolbarFromContext();
        return;
      }
  
      if (window.hotkeysMode === "custom") return;
      if (isEditingNow()) return;
  
      const rows = getTargetRows();
      if (!rows.length) return;
  
      let pushed = false;
      let changed = false;
  
      for (const row of rows) {
        const id = row.dataset?.id;
        if (!id) continue;
  
        const node = getNodeById(id);
        if (!node) continue;
  
        if (!pushed && typeof pushHistory === "function") {
          pushHistory();
          pushed = true;
        }
  
        changed = applyColorToWholeNode(node, kind, color) || changed;
      }
  
      if (changed && typeof render === "function") {
        render();
      }
  
      syncToolbarFromContext();
    }
  
    function getActiveNodeColorContext() {
      const rows = getTargetRows();
      const row = rows[0];
      const id = row?.dataset?.id;
      if (!id) return emptyColorFmt();
  
      const node = getNodeById(id);
      return getWholeColorFmtForNode(node);
    }
  
    function syncToolbarFromContext() {
      const ed = activeRichEditor();
      if (ed) {
        const pending = ed.__pendingColorFmt || {};
        const richFmt = detectWholeNodeColorFmtFromHtml(ed.innerHTML || "", ed.textContent || "");
  
        const text = pending.text != null && pending.text !== "" ? pending.text : (richFmt.text === "__mixed__" ? "" : richFmt.text);
        const bg = pending.bg != null && pending.bg !== "" ? pending.bg : (richFmt.bg === "__mixed__" ? "" : richFmt.bg);
  
        window.colorToolsUI?.setTextColor?.(text || "default", false);
        window.colorToolsUI?.setBgColor?.(bg || "transparent", false);
        return;
      }
  
      const ctx = getActiveNodeColorContext();
      window.colorToolsUI?.setTextColor?.(ctx.text || "default", false);
      window.colorToolsUI?.setBgColor?.(ctx.bg || "transparent", false);
    }
  
    function bindToolbarEvents() {
      if (window.__colorFormattingToolbarBound) return;
      window.__colorFormattingToolbarBound = true;
  
      window.addEventListener("color-tools-change", (e) => {
        const detail = e.detail || {};
        if (!detail.kind) return;
  
        if (detail.kind === "text") {
          const v = detail.value === "default" ? "" : detail.value || "";
          applyColorToTargets("text", v);
          return;
        }
  
        if (detail.kind === "bg") {
          const v = detail.value === "transparent" ? "" : detail.value || "";
          applyColorToTargets("bg", v);
        }
      });
    }
  
    function colorByAction(action) {
      if (Object.prototype.hasOwnProperty.call(TEXT_PRESETS, action)) return { kind: "text", color: TEXT_PRESETS[action] };
      if (Object.prototype.hasOwnProperty.call(BG_PRESETS, action)) return { kind: "bg", color: BG_PRESETS[action] };
      return null;
    }
  
    function matchColorHotkeyAction(e) {
      if (typeof window.isHotkey !== "function") return null;
  
      for (const action of TEXT_ACTIONS) {
        if (window.isHotkey(e, action)) return action;
      }
  
      for (const action of BG_ACTIONS) {
        if (window.isHotkey(e, action)) return action;
      }
  
      return null;
    }
  
    function installConfigDrivenHotkeys() {
      if (window.__colorFormattingHotkeysInstalled) return;
      window.__colorFormattingHotkeysInstalled = true;
  
      window.addEventListener("keydown", (e) => {
        if (window.hotkeysMode === "custom") return;
  
        const ae = document.activeElement;
        const rich = activeRichEditor();
  
        if (typeof isTextEditingElement === "function") {
          if (ae && !rich && isTextEditingElement(ae)) return;
        }
  
        const action = matchColorHotkeyAction(e);
        if (!action) return;
  
        const matched = colorByAction(action);
        if (!matched) return;
  
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
  
        if (matched.kind === "text") {
          window.colorToolsUI?.setTextColor?.(matched.color || "default", true);
        } else {
          window.colorToolsUI?.setBgColor?.(matched.color || "transparent", true);
        }
      }, true);
    }
  
    function patchRenderSync() {
      if (typeof window.render !== "function") return;
      if (window.render.__colorFmtPatched) return;
  
      const originalRender = window.render;
      window.render = function patchedRenderColorFmt() {
        originalRender();
        try {
          syncToolbarFromContext();
        } catch (_) {}
      };
      window.render.__colorFmtPatched = true;
    }
  
    function patchHistoryOnce() {
      if (typeof window.snapshot !== "function") return;
      if (typeof window.restore !== "function") return;
      if (window.snapshot.__colorFmtPatched) return;
  
      const originalSnapshot = window.snapshot;
      const originalRestore = window.restore;
  
      window.snapshot = function snapshotWithColorFmt() {
        const base = JSON.parse(originalSnapshot());
        base.__colorFmtMap = window.__colorFmtMap || {};
        return JSON.stringify(base);
      };
      window.snapshot.__colorFmtPatched = true;
  
      window.restore = function restoreWithColorFmt(state) {
        const data = JSON.parse(state);
        window.__colorFmtMap = data.__colorFmtMap || Object.create(null);
        return originalRestore(JSON.stringify(data));
      };
    }
  
    function init() {
      ensureColorStyle();
      bindToolbarEvents();
      installConfigDrivenHotkeys();
      patchRenderSync();
      patchHistoryOnce();
  
      const sync = () => {
        try {
          syncToolbarFromContext();
        } catch (_) {}
      };
  
      document.addEventListener("selectionchange", () => {
        const ed = activeRichEditor();
        if (!ed) return;
        sync();
      });
  
      window.addEventListener("focus", sync, true);
      document.addEventListener("click", sync, true);
      document.addEventListener("keyup", sync, true);
  
      sync();
    }
  
    window.colorFormatting = {
      setTextColor(color) {
        applyColorToTargets("text", color || "");
      },
      setBgColor(color) {
        applyColorToTargets("bg", color || "");
      },
      syncToolbar: syncToolbarFromContext,
      matchColorHotkeyAction,
      presets: {
        text: { ...TEXT_PRESETS },
        bg: { ...BG_PRESETS },
      },
    };
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
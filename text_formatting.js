// text_formatting.js
(function () {
  if (typeof window === "undefined") return;

  window.__fmtMap = window.__fmtMap || Object.create(null);

  const EMPTY_FMT = { b: false, i: false, u: false, s: false };
  const KEY_TO_CLASS = { b: "rt-b", i: "rt-i", u: "rt-u", s: "rt-s" };

  function cloneFmt(fmt) {
    return {
      b: !!fmt?.b,
      i: !!fmt?.i,
      u: !!fmt?.u,
      s: !!fmt?.s,
    };
  }

  function emptyFmt() {
    return { b: false, i: false, u: false, s: false };
  }

  function getFmt(id) {
    return cloneFmt(window.__fmtMap[id] || EMPTY_FMT);
  }

  function setFmt(id, fmt) {
    window.__fmtMap[id] = cloneFmt(fmt);
    return window.__fmtMap[id];
  }

  function toggleFmtFlag(id, key) {
    const cur = getFmt(id);
    cur[key] = !cur[key];
    return setFmt(id, cur);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function host() {
    return document.getElementById("tree");
  }

  function getNodeById(id) {
    if (!id || typeof findWithParent !== "function" || typeof root === "undefined") return null;
    const found = findWithParent(root, id);
    return found ? found.node : null;
  }

  function getTargetRows() {
    const h = host();
    if (!h) return [];

    const multi = Array.from(h.querySelectorAll(".row.multi"));
    if (multi.length) return multi;

    const sel = h.querySelector(".row.sel");
    return sel ? [sel] : [];
  }

  function isTreeActive() {
    const h = host();
    return !!h?.querySelector(".row.sel");
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
    if (!ae) return null;
  
    if (ae.classList?.contains("edit-rich")) return ae;
  
    // 🔥 ДОБАВИТЬ ЭТО
    if (ae.classList?.contains("edit-caption")) return ae;
  
    return null;
  }

  function ensureLabelSpan(row) {
    if (!row) return null;

    let label = row.querySelector(":scope > .label");
    if (label) return label;

    const act = row.querySelector(":scope > .act");
    const nodes = [];
    for (const n of Array.from(row.childNodes)) {
      if (act && n === act) break;
      nodes.push(n);
    }

    label = document.createElement("span");
    label.className = "label";
    for (const n of nodes) label.appendChild(n);

    if (act) row.insertBefore(label, act);
    else row.appendChild(label);

    return label;
  }

  function wrapWholeTextWithFmt(text, fmt) {
    let html = escapeHtml(text || "");
    if (!html) return "";

    if (fmt.s) html = `<span class="rt-s">${html}</span>`;
    if (fmt.u) html = `<span class="rt-u">${html}</span>`;
    if (fmt.i) html = `<span class="rt-i">${html}</span>`;
    if (fmt.b) html = `<span class="rt-b">${html}</span>`;
    return html;
  }

  function buildRichHtmlFromNode(node) {
    if (!node) return "";
    if (node.nameHtml) return node.nameHtml;
    return wrapWholeTextWithFmt(node.name || "", getFmt(node.id));
  }

  function normalizeRichHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";

    const SEG_BR = { __br: true };

    function escapeText(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function cloneLocalFmt(fmt) {
      return {
        b: !!fmt.b,
        i: !!fmt.i,
        u: !!fmt.u,
        s: !!fmt.s,
      };
    }

    function sameFmt(a, b) {
      return !!a && !!b &&
        !!a.b === !!b.b &&
        !!a.i === !!b.i &&
        !!a.u === !!b.u &&
        !!a.s === !!b.s;
    }

    function applyElementFmt(el, parentFmt) {
      const fmt = cloneLocalFmt(parentFmt);
      const tag = (el.tagName || "").toLowerCase();

      if (tag === "b" || tag === "strong") fmt.b = true;
      if (tag === "i" || tag === "em") fmt.i = true;
      if (tag === "u") fmt.u = true;
      if (tag === "s" || tag === "strike" || tag === "del") fmt.s = true;

      if (el.classList?.contains("rt-b")) fmt.b = true;
      if (el.classList?.contains("rt-i")) fmt.i = true;
      if (el.classList?.contains("rt-u")) fmt.u = true;
      if (el.classList?.contains("rt-s")) fmt.s = true;

      const style = String(el.getAttribute("style") || "").toLowerCase();

      if (/font-weight\s*:\s*(normal|400)\b/.test(style)) fmt.b = false;
      if (/font-weight\s*:\s*(bold|[5-9]00)\b/.test(style)) fmt.b = true;

      if (/font-style\s*:\s*normal\b/.test(style)) fmt.i = false;
      if (/font-style\s*:\s*(italic|oblique)\b/.test(style)) fmt.i = true;

      if (/text-decoration(-line)?\s*:\s*none\b/.test(style)) {
        fmt.u = false;
        fmt.s = false;
      }

      if (/text-decoration[^:]*:\s*[^;]*underline/.test(style)) fmt.u = true;
      if (/text-decoration[^:]*:\s*[^;]*(line-through|strike)/.test(style)) fmt.s = true;

      if (/text-decoration[^:]*:\s*[^;]*\bno-underline\b/.test(style)) fmt.u = false;
      if (/text-decoration[^:]*:\s*[^;]*\bno-line-through\b/.test(style)) fmt.s = false;

      return fmt;
    }

    const segments = [];

    function pushText(text, fmt) {
      if (!text) return;
      const prev = segments[segments.length - 1];
      if (prev && !prev.__br && sameFmt(prev.fmt, fmt)) {
        prev.text += text;
      } else {
        segments.push({ text, fmt: cloneLocalFmt(fmt) });
      }
    }

    function walk(node, inheritedFmt) {
      for (const ch of Array.from(node.childNodes)) {
        if (ch.nodeType === Node.TEXT_NODE) {
          pushText(ch.nodeValue || "", inheritedFmt);
          continue;
        }

        if (ch.nodeType !== Node.ELEMENT_NODE) continue;

        const tag = ch.tagName.toLowerCase();

        if (tag === "br") {
          segments.push(SEG_BR);
          continue;
        }

        const nextFmt = applyElementFmt(ch, inheritedFmt);
        walk(ch, nextFmt);
      }
    }

    walk(tmp, { b: false, i: false, u: false, s: false });

    function wrapTextByFmt(text, fmt) {
      let html = escapeText(text);
      if (!html) return "";

      if (fmt.s) html = `<span class="rt-s">${html}</span>`;
      if (fmt.u) html = `<span class="rt-u">${html}</span>`;
      if (fmt.i) html = `<span class="rt-i">${html}</span>`;
      if (fmt.b) html = `<span class="rt-b">${html}</span>`;
      return html;
    }

    let out = "";
    let plain = "";

    for (const seg of segments) {
      if (seg.__br) {
        out += "<br>";
        plain += "\n";
        continue;
      }

      out += wrapTextByFmt(seg.text, seg.fmt);
      plain += seg.text;
    }

    const hasFmt = /class="rt-[bius]"/.test(out);
    return {
      html: hasFmt ? out : "",
      text: plain,
    };
  }

  function cloneFmtObject(fmt) {
    return {
      b: !!fmt?.b,
      i: !!fmt?.i,
      u: !!fmt?.u,
      s: !!fmt?.s,
    };
  }

  function sameFmtObject(a, b) {
    return !!a && !!b &&
      !!a.b === !!b.b &&
      !!a.i === !!b.i &&
      !!a.u === !!b.u &&
      !!a.s === !!b.s;
  }

  function htmlToSegments(html) {
    const normalized = normalizeRichHtml(html || "");
    const tmp = document.createElement("div");
    tmp.innerHTML = normalized.html || escapeHtml(normalized.text || "");

    const segments = [];

    function applyElementFmt(el, parentFmt) {
      const fmt = cloneFmtObject(parentFmt);
      const tag = (el.tagName || "").toLowerCase();

      if (tag === "b" || tag === "strong") fmt.b = true;
      if (tag === "i" || tag === "em") fmt.i = true;
      if (tag === "u") fmt.u = true;
      if (tag === "s" || tag === "strike" || tag === "del") fmt.s = true;

      if (el.classList?.contains("rt-b")) fmt.b = true;
      if (el.classList?.contains("rt-i")) fmt.i = true;
      if (el.classList?.contains("rt-u")) fmt.u = true;
      if (el.classList?.contains("rt-s")) fmt.s = true;

      const style = String(el.getAttribute("style") || "").toLowerCase();

      if (/font-weight\s*:\s*(normal|400)\b/.test(style)) fmt.b = false;
      if (/font-weight\s*:\s*(bold|[5-9]00)\b/.test(style)) fmt.b = true;

      if (/font-style\s*:\s*normal\b/.test(style)) fmt.i = false;
      if (/font-style\s*:\s*(italic|oblique)\b/.test(style)) fmt.i = true;

      if (/text-decoration(-line)?\s*:\s*none\b/.test(style)) {
        fmt.u = false;
        fmt.s = false;
      }

      if (/text-decoration[^:]*:\s*[^;]*underline/.test(style)) fmt.u = true;
      if (/text-decoration[^:]*:\s*[^;]*(line-through|strike)/.test(style)) fmt.s = true;

      return fmt;
    }

    function pushText(text, fmt) {
      if (!text) return;
      const prev = segments[segments.length - 1];
      if (prev && !prev.br && sameFmtObject(prev.fmt, fmt)) {
        prev.text += text;
      } else {
        segments.push({
          text,
          fmt: cloneFmtObject(fmt),
        });
      }
    }

    function walk(node, inheritedFmt) {
      for (const ch of Array.from(node.childNodes)) {
        if (ch.nodeType === Node.TEXT_NODE) {
          pushText(ch.nodeValue || "", inheritedFmt);
          continue;
        }

        if (ch.nodeType !== Node.ELEMENT_NODE) continue;

        const tag = ch.tagName.toLowerCase();
        if (tag === "br") {
          segments.push({ br: true });
          continue;
        }

        const nextFmt = applyElementFmt(ch, inheritedFmt);
        walk(ch, nextFmt);
      }
    }

    walk(tmp, { b: false, i: false, u: false, s: false });
    return segments;
  }

  function segmentsToHtml(segments) {
    const compact = [];

    for (const seg of segments) {
      if (seg.br) {
        compact.push({ br: true });
        continue;
      }
      if (!seg.text) continue;

      const prev = compact[compact.length - 1];
      if (prev && !prev.br && sameFmtObject(prev.fmt, seg.fmt)) {
        prev.text += seg.text;
      } else {
        compact.push({
          text: seg.text,
          fmt: cloneFmtObject(seg.fmt),
        });
      }
    }

    function wrapTextByFmt(text, fmt) {
      let html = escapeHtml(text || "");
      if (!html) return "";

      if (fmt.s) html = `<span class="rt-s">${html}</span>`;
      if (fmt.u) html = `<span class="rt-u">${html}</span>`;
      if (fmt.i) html = `<span class="rt-i">${html}</span>`;
      if (fmt.b) html = `<span class="rt-b">${html}</span>`;
      return html;
    }

    let out = "";
    for (const seg of compact) {
      if (seg.br) out += "<br>";
      else out += wrapTextByFmt(seg.text, seg.fmt);
    }

    return normalizeRichHtml(out).html || "";
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
      for (const ch of Array.from(node.childNodes || [])) {
        len += countNodeLength(ch);
      }
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

  function toggleInlineFmtBySegments(ed, key) {
    const sel = getSelectionOffsetsInEditor(ed);
    if (!sel) return;
    if (sel.start === sel.end) return;
  
    const current = normalizeRichHtml(ed.innerHTML || "");
    const segments = htmlToSegments(current.html || escapeHtml(current.text || ""));
  
    let pos = 0;
    let hasSelectedText = false;
    let selectedHasOn = false;
    let selectedHasOff = false;
  
    for (const seg of segments) {
      if (seg.br) {
        pos += 1;
        continue;
      }
  
      const text = seg.text || "";
      const len = text.length;
      const segStart = pos;
      const segEnd = pos + len;
  
      const from = Math.max(segStart, sel.start);
      const to = Math.min(segEnd, sel.end);
  
      if (from < to) {
        hasSelectedText = true;
  
        if (seg.fmt?.[key]) {
          selectedHasOn = true;
        } else {
          selectedHasOff = true;
        }
  
        if (selectedHasOn && selectedHasOff) break;
      }
  
      pos = segEnd;
    }
  
    if (!hasSelectedText) return;
  
    // none  -> включаем
    // all   -> снимаем
    // mixed -> тоже снимаем
    const turnOn = !selectedHasOn;
  
    const next = [];
    pos = 0;
  
    for (const seg of segments) {
      if (seg.br) {
        next.push({ br: true });
        pos += 1;
        continue;
      }
  
      const text = seg.text || "";
      const len = text.length;
      const segStart = pos;
      const segEnd = pos + len;
  
      const from = Math.max(segStart, sel.start);
      const to = Math.min(segEnd, sel.end);
  
      if (from >= to) {
        next.push({
          text,
          fmt: cloneFmtObject(seg.fmt),
        });
        pos = segEnd;
        continue;
      }
  
      const leftLen = from - segStart;
      const midLen = to - from;
      const rightLen = segEnd - to;
  
      if (leftLen > 0) {
        next.push({
          text: text.slice(0, leftLen),
          fmt: cloneFmtObject(seg.fmt),
        });
      }
  
      if (midLen > 0) {
        const midFmt = cloneFmtObject(seg.fmt);
        midFmt[key] = turnOn;
  
        next.push({
          text: text.slice(leftLen, leftLen + midLen),
          fmt: midFmt,
        });
      }
  
      if (rightLen > 0) {
        next.push({
          text: text.slice(len - rightLen),
          fmt: cloneFmtObject(seg.fmt),
        });
      }
  
      pos = segEnd;
    }
  
    const nextHtml = segmentsToHtml(next) || escapeHtml(current.text || "");
    ed.innerHTML = nextHtml;
    setSelectionOffsetsInEditor(ed, sel.start, sel.end);
  }

  function isTextNodeCoveredByClass(textNode, rootEl, cls) {
    let p = textNode.parentNode;
    while (p && p !== rootEl) {
      if (p.nodeType === 1 && p.classList?.contains(cls)) return true;
      p = p.parentNode;
    }
    return false;
  }

  function detectWholeNodeFmtFromHtml(html, text) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || escapeHtml(text || "");

    function covered(cls) {
      const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
      let total = 0;
      let on = 0;

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const value = node.nodeValue || "";
        if (!value) continue;
        total += value.length;
        if (isTextNodeCoveredByClass(node, tmp, cls)) on += value.length;
      }

      return total > 0 && on === total;
    }

    return {
      b: covered("rt-b"),
      i: covered("rt-i"),
      u: covered("rt-u"),
      s: covered("rt-s"),
    };
  }

  function getFmtCoverageFromHtml(html, text) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || escapeHtml(text || "");

    function coverageForClass(cls) {
      const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
      let total = 0;
      let covered = 0;

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const value = node.nodeValue || "";
        if (!value) continue;

        total += value.length;

        let p = node.parentNode;
        let ok = false;
        while (p && p !== tmp) {
          if (p.nodeType === 1 && p.classList?.contains(cls)) {
            ok = true;
            break;
          }
          p = p.parentNode;
        }

        if (ok) covered += value.length;
      }

      if (total === 0 || covered === 0) return "none";
      if (covered === total) return "all";
      return "some";
    }

    return {
      b: coverageForClass("rt-b"),
      i: coverageForClass("rt-i"),
      u: coverageForClass("rt-u"),
      s: coverageForClass("rt-s"),
    };
  }

  function getWholeFmtForNode(node) {
    if (!node) return emptyFmt();
    if (node.nameHtml) {
      return detectWholeNodeFmtFromHtml(node.nameHtml, node.name || "");
    }
    return getFmt(node.id);
  }

  function getVisualWholeFmtForNode(node, id) {
    if (node?.nameHtml) {
      return detectWholeNodeFmtFromHtml(node.nameHtml, node.name || "");
    }
    return getFmt(id);
  }

  function syncFmtMapFromNode(node) {
    if (!node?.id) return emptyFmt();

    if (node.nameHtml) {
      const fmt = detectWholeNodeFmtFromHtml(node.nameHtml, node.name || "");
      setFmt(node.id, fmt);
      return fmt;
    }

    const fmt = emptyFmt();
    setFmt(node.id, fmt);
    return fmt;
  }

  function unwrapEverywhere(rootEl, cls) {
    rootEl.querySelectorAll(`span.${cls}`).forEach((el) => {
      el.classList.remove(cls);

      const stillHasFmt =
        el.classList.contains("rt-b") ||
        el.classList.contains("rt-i") ||
        el.classList.contains("rt-u") ||
        el.classList.contains("rt-s");

      if (!stillHasFmt) {
        el.replaceWith(...Array.from(el.childNodes));
      }
    });
  }

  function toggleWholeHtmlFmt(html, text, key) {
    const cls = KEY_TO_CLASS[key];
    if (!cls) return normalizeRichHtml(html || escapeHtml(text || ""));

    const normalized = normalizeRichHtml(html || escapeHtml(text || ""));
    const whole = detectWholeNodeFmtFromHtml(normalized.html, normalized.text);
    const turnOn = !whole[key];

    const tmp = document.createElement("div");
    tmp.innerHTML = normalized.html || escapeHtml(text || "");

    if (turnOn) {
      tmp.innerHTML = `<span class="${cls}">${tmp.innerHTML}</span>`;
    } else {
      unwrapEverywhere(tmp, cls);
    }

    return normalizeRichHtml(tmp.innerHTML);
  }

  function getEffectiveFmt(node, id) {
    if (node?.nameHtml) return detectWholeNodeFmtFromHtml(node.nameHtml, node.name || "");
    return getFmt(id);
  }

  function applyFmtToRow(row) {
    if (!row) return;
    const id = row.dataset?.id;
    if (!id) return;

    ensureLabelSpan(row);

    const node = getNodeById(id);
    const fmt = getVisualWholeFmtForNode(node, id);

    row.classList.toggle("fmt-b", !!fmt.b);
    row.classList.toggle("fmt-i", !!fmt.i);
    row.classList.toggle("fmt-u", !!fmt.u);
    row.classList.toggle("fmt-s", !!fmt.s);
  }

  function applyFmtToAllRows() {
    const h = host();
    if (!h) return;
    h.querySelectorAll(".row[data-id]").forEach(applyFmtToRow);
  }

  function syncButtons() {
    const ids = [
      ["fmtBold", "b"],
      ["fmtItalic", "i"],
      ["fmtUnderline", "u"],
      ["fmtStrike", "s"],
    ];
  
    const rich = activeRichEditor();
  
    if (rich) {
      const sel = getSelectionOffsetsInEditor(rich);
      const normalized = normalizeRichHtml(rich.innerHTML || "");
      const segments = htmlToSegments(
        normalized.html || escapeHtml(normalized.text || "")
      );
  
      const stateByKey = {
        b: "none",
        i: "none",
        u: "none",
        s: "none",
      };
  
      if (sel && sel.start !== sel.end) {
        let pos = 0;
  
        const acc = {
          b: { on: false, off: false },
          i: { on: false, off: false },
          u: { on: false, off: false },
          s: { on: false, off: false },
        };
  
        for (const seg of segments) {
          if (seg.br) {
            pos += 1;
            continue;
          }
  
          const text = seg.text || "";
          const len = text.length;
          const segStart = pos;
          const segEnd = pos + len;
  
          const from = Math.max(segStart, sel.start);
          const to = Math.min(segEnd, sel.end);
  
          if (from < to) {
            for (const key of ["b", "i", "u", "s"]) {
              if (seg.fmt?.[key]) acc[key].on = true;
              else acc[key].off = true;
            }
          }
  
          pos = segEnd;
        }
  
        for (const key of ["b", "i", "u", "s"]) {
          if (acc[key].on && acc[key].off) stateByKey[key] = "some";
          else if (acc[key].on) stateByKey[key] = "all";
          else stateByKey[key] = "none";
        }
      } else {
        const coverage = getFmtCoverageFromHtml(
          normalized.html || escapeHtml(normalized.text || ""),
          normalized.text || ""
        );
  
        for (const key of ["b", "i", "u", "s"]) {
          stateByKey[key] = coverage[key];
        }
      }
  
      for (const [btnId, key] of ids) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;
  
        // Кнопка активна только для своего собственного состояния.
        // "some" тоже считаем активным, но только у этой кнопки.
        const active = stateByKey[key] === "all" || stateByKey[key] === "some";
        btn.classList.toggle("active", active);
      }
  
      return;
    }
  
    const rows = getTargetRows();
    const row = rows[0];
    const id = row?.dataset?.id;
    const fmt = id ? getFmt(id) : emptyFmt();
  
    for (const [btnId, key] of ids) {
      const btn = document.getElementById(btnId);
      if (!btn) continue;
      btn.classList.toggle("active", !!fmt[key]);
    }
  }

  function applyInlineFmt(key) {
    const ed = activeRichEditor();
    if (!ed) return;

    toggleInlineFmtBySegments(ed, key);
    syncButtons();
  }

  function toggleOnTargets(key) {
    if (window.hotkeysMode === "custom") return;
    if (isEditingNow()) return;
    if (!isTreeActive()) return;

    const rows = getTargetRows();
    if (!rows.length) return;

    let changed = false;
    let pushed = false;

    for (const row of rows) {
      const id = row.dataset?.id;
      if (!id) continue;

      const node = getNodeById(id);
      if (!node) continue;

      if (node.nameHtml) {
        const next = toggleWholeHtmlFmt(node.nameHtml, node.name || "", key);
        const changedHtml = (next.html || "") !== (node.nameHtml || "");
        const changedText = (next.text || "") !== (node.name || "");

        if (changedHtml || changedText) {
          if (!pushed && typeof pushHistory === "function") {
            pushHistory();
            pushed = true;
          }

          node.nameHtml = next.html || "";
          node.name = next.text || node.name || "";

          if (node.nameHtml) {
            syncFmtMapFromNode(node);
          } else {
            setFmt(node.id, emptyFmt());
          }

          changed = true;
        }
      } else {
        if (!pushed && typeof pushHistory === "function") {
          pushHistory();
          pushed = true;
        }
        toggleFmtFlag(id, key);
        changed = true;
      }
    }

    if (changed && typeof render === "function") {
      render();
      return;
    }

    syncButtons();
  }

  function bindButton(id, key) {
    const btn = document.getElementById(id);
    if (!btn || btn.__fmtBound) return;
    btn.__fmtBound = true;

    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("pointerdown", (e) => e.preventDefault());

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (activeRichEditor()) {
        applyInlineFmt(key);
        return;
      }

      toggleOnTargets(key);
    });
  }

  function handleHotkeys(e) {
    if (window.hotkeysMode === "custom") return;
  
    const rich = activeRichEditor();
    const inRich = !!rich;
  
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    };
  
    // В режиме переименования / редактирования подписи
    // НЕ используем window.isHotkey(), потому что он отключается в contentEditable
    if (inRich) {
      const normalize = window.hotkeys?.normalizeCombo;
  
      const haveRaw =
        typeof comboFromKeyEvent === "function"
          ? comboFromKeyEvent(e)
          : "";
  
      const have = normalize ? normalize(haveRaw) : haveRaw;
      if (!have) return;
  
      const matches = (action) => {
        const wantRaw = window.hotkeys?.get?.(action) || "";
        const want = normalize ? normalize(wantRaw) : wantRaw;
        return !!want && have === want;
      };
  
      if (matches("bold")) {
        stop();
        applyInlineFmt("b");
        return;
      }
  
      if (matches("italic")) {
        stop();
        applyInlineFmt("i");
        return;
      }
  
      if (matches("underline")) {
        stop();
        applyInlineFmt("u");
        return;
      }
  
      if (matches("strike")) {
        stop();
        applyInlineFmt("s");
        return;
      }
  
      return;
    }
  
    // В обычном режиме оставляем старую логику дерева
    if (typeof window.isHotkey !== "function") return;
  
    if (window.isHotkey(e, "bold")) {
      stop();
      toggleOnTargets("b");
      return;
    }
  
    if (window.isHotkey(e, "italic")) {
      stop();
      toggleOnTargets("i");
      return;
    }
  
    if (window.isHotkey(e, "underline")) {
      stop();
      toggleOnTargets("u");
      return;
    }
  
    if (window.isHotkey(e, "strike")) {
      stop();
      toggleOnTargets("s");
      return;
    }
  }

  (function injectStyle() {
    const id = "text-formatting-style";
    if (document.getElementById(id)) return;

    const st = document.createElement("style");
    st.id = id;
    st.textContent = `
      .row .label { display:inline; }
      .row.fmt-b .label { font-weight:700; }
      .row.fmt-i .label { font-style:italic; }
      .row.fmt-u .label { text-decoration:underline; }
      .row.fmt-s .label { text-decoration:line-through; }
      .row.fmt-u.fmt-s .label { text-decoration: underline line-through; }

      .rt-b { font-weight:700; }
      .rt-i { font-style:italic; }
      .rt-u { text-decoration:underline; }
      .rt-s { text-decoration:line-through; }
      .rt-u.rt-s, .rt-s.rt-u { text-decoration: underline line-through; }

      .fmt-btn.active {
        outline: 1px solid #000 !important;
      }
    `;
    document.head.appendChild(st);
  })();

  


  bindButton("fmtBold", "b");
  bindButton("fmtItalic", "i");
  bindButton("fmtUnderline", "u");
  bindButton("fmtStrike", "s");

  window.syncFmtButtons = syncButtons;
  window.__fmtSync = {
    getFmt,
    setFmt,
    getWholeFmtForNode,
    buildRichHtmlFromNode,
    normalizeRichHtml,
    detectWholeNodeFmtFromHtml,
    getFmtCoverageFromHtml,
    syncFmtMapFromNode,
    toggleWholeHtmlFmt,
  };

  window.addEventListener("keydown", handleHotkeys, true);

  (function patchRenderOnce() {
    if (typeof window.render !== "function") return;
    if (window.render.__fmtPatched) return;

    const originalRender = window.render;
    window.render = function patchedRenderFmt() {
      originalRender();
      try {
        applyFmtToAllRows();
        syncButtons();
      } catch (_) {}
    };
    window.render.__fmtPatched = true;
  })();

  (function patchHistoryOnce() {
    if (typeof window.snapshot !== "function") return;
    if (typeof window.restore !== "function") return;
    if (window.snapshot.__fmtPatched) return;

    const originalSnapshot = window.snapshot;
    window.snapshot = function patchedSnapshotFmt() {
      const base = originalSnapshot();
      try {
        const obj = JSON.parse(base);
        obj.__fmtMap = window.__fmtMap || {};
        return JSON.stringify(obj);
      } catch (_) {
        return base;
      }
    };
    window.snapshot.__fmtPatched = true;

    const originalRestore = window.restore;
    window.restore = function patchedRestoreFmt(state) {
      try {
        const obj = JSON.parse(state);
        if (obj && obj.__fmtMap && typeof obj.__fmtMap === "object") {
          window.__fmtMap = obj.__fmtMap || Object.create(null);
        }
      } catch (_) {}
      originalRestore(state);
    };
  })();

  try {
    applyFmtToAllRows();
    syncButtons();
  } catch (_) {}
})();
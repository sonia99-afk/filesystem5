// color_tools_ui.js
// Только UI-логика верхнего бара:
// - выбор активного цвета текста
// - выбор активного цвета подложки
// - активные состояния кружков
// - API наружу без вмешательства в рендер дерева

(function () {
  if (typeof window === "undefined") return;

  const DEFAULT_TEXT_COLOR = "default";
  const DEFAULT_BG_COLOR = "transparent";
  const DEFAULT_BLOCK_BG_COLOR = "transparent";

  const state = {
    text: DEFAULT_TEXT_COLOR,
    bg: DEFAULT_BG_COLOR,
    block: DEFAULT_BLOCK_BG_COLOR,
  };

  const customState = {
    text: [],
    bg: [],
    block: [],
  };

  function normalizeHex(color) {
    const s = String(color || "").trim();
    if (!s) return "";
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
    return "";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function customListEl(kind) {
    if (kind === "text") return byId("textCustomColors");
    if (kind === "bg") return byId("bgCustomColors");
    if (kind === "block") return byId("blockCustomColors");
    return null;
  }

  function customInputEl(kind) {
    if (kind === "text") return byId("textCustomColorInput");
    if (kind === "bg") return byId("bgCustomColorInput");
    if (kind === "block") return byId("blockCustomColorInput");
    return null;
  }

  function currentValueByKind(kind) {
    if (kind === "text") return state.text;
    if (kind === "bg") return state.bg;
    if (kind === "block") return state.block;
    return "";
  }

  function applyKindColor(kind, color) {
    if (kind === "text") return setTextColor(color, true);
    if (kind === "bg") return setBgColor(color, true);
    if (kind === "block") return setBlockColor(color, true);
  }

  function addCustomColor(kind, color) {
    const hex = normalizeHex(color);
    if (!hex) return;

    if (!Array.isArray(customState[kind])) {
      customState[kind] = [];
    }

    const arr = customState[kind];
    const last = arr[arr.length - 1] || "";

    if (last === hex) return;

    arr.push(hex);
    customState[kind] = arr.slice(-12);

    renderCustomColors(kind);
  }

  function removeCustomColor(kind, index) {
    if (!Array.isArray(customState[kind])) return;
    if (index < 0 || index >= customState[kind].length) return;

    customState[kind].splice(index, 1);
    renderCustomColors(kind);
  }

  function removeDeleteMenu() {
    const menu = document.querySelector(".color-delete-menu");
    if (menu) menu.remove();
  }

  function showDeleteMenu(x, y, colorEl) {
    removeDeleteMenu();

    const menu = document.createElement("div");
    menu.className = "color-delete-menu";
    menu.style.position = "absolute";
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.style.zIndex = "9999";

    menu.innerHTML = `
      <button class="delete-btn" type="button">
      <img src="icons/Union.png" class="color-icon-bg-img" /> Удалить цвет из палитры</button>
    `;

    document.body.appendChild(menu);

    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    
    menu.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });

    const btn = menu.querySelector(".delete-btn");
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
      
        const kind = colorEl.dataset.kind;
        const index = Number(colorEl.dataset.index);
      
        removeCustomColor(kind, index);
        removeDeleteMenu();
      };
    }

    setTimeout(() => {
      document.addEventListener("click", removeDeleteMenu, { once: true });
    });
  }

  document.addEventListener("contextmenu", function (e) {
    const colorEl = e.target.closest(".custom-color-chip");
    if (!colorEl) return;

    e.preventDefault();
    e.stopPropagation();

    showDeleteMenu(e.pageX, e.pageY, colorEl);
  });

  function renderCustomColors(kind) {
    const host = customListEl(kind);
    if (!host) return;

    host.innerHTML = "";

    const current = String(currentValueByKind(kind) || "").toUpperCase();
    const colors = Array.isArray(customState[kind]) ? customState[kind] : [];

    colors.forEach((hex, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "custom-color-chip";
      btn.title = hex;
      btn.dataset.kind = kind;
      btn.dataset.color = hex;
      btn.dataset.index = String(index);
      btn.style.background = hex;

      if (current === hex) {
        btn.classList.add("is-active");
      }

      stopPressSteal(btn);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyKindColor(kind, hex);
        renderAllCustomColors();
      });

      host.appendChild(btn);
    });
  }

  function renderAllCustomColors() {
    renderCustomColors("text");
    renderCustomColors("bg");
    renderCustomColors("block");
  }

  function getRoot() {
    return byId("colorTools");
  }

  function getTextMainBtn() {
    return byId("textColorBtn");
  }

  function getBgMainBtn() {
    return byId("bgColorBtn");
  }

  function getTextDots() {
    return Array.from(
      document.querySelectorAll('#textColorSwatches .color-dot[data-kind="text"]')
    );
  }

  function getBgDots() {
    return Array.from(
      document.querySelectorAll('#bgColorSwatches .color-dot[data-kind="bg"]')
    );
  }

  function getBlockMainBtn() {
    return byId("blockBgBtn");
  }

  function getBlockDots() {
    return Array.from(
      document.querySelectorAll('#blockBgSwatches .color-dot[data-kind="block"]')
    );
  }

  function stopPressSteal(btn) {
    if (!btn || btn.__colorUiStopBound) return;
    btn.__colorUiStopBound = true;

    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("pointerdown", (e) => e.preventDefault());
  }

  function setActiveDot(dots, value) {
    dots.forEach((dot) => {
      const isActive = String(dot.dataset.color || "") === String(value || "");
      dot.classList.toggle("is-active", isActive);
    });
  }

  function emitChange(kind, value) {
    const root = getRoot();
    const detail = {
      kind,
      value,
      state: {
        text: state.text,
        bg: state.bg,
        block: state.block,
      },
    };

    window.dispatchEvent(new CustomEvent("color-tools-change", { detail }));
    if (root) root.dispatchEvent(new CustomEvent("color-tools-change", { detail }));
  }

  function syncMainButtons() {
    const textBtn = getTextMainBtn();
    const bgBtn = getBgMainBtn();
    const blockBtn = getBlockMainBtn();

    if (blockBtn) {
      blockBtn.dataset.currentColor = state.block;
    }

    if (textBtn) {
      textBtn.dataset.currentColor = state.text;

      const bar = textBtn.querySelector(".color-icon-text-bar");
      if (bar) {
        bar.style.background = state.text === DEFAULT_TEXT_COLOR ? "#000" : state.text;
      }
    }

    if (bgBtn) {
      bgBtn.dataset.currentColor = state.bg;

      const bar = bgBtn.querySelector(".color-icon-bg-bar");
      if (bar) {
        if (state.bg === DEFAULT_BG_COLOR) {
          bar.style.background = "#e8e8e8";
          bar.style.borderColor = "#d8d8d8";
        } else {
          bar.style.background = state.bg;
          bar.style.borderColor = state.bg;
        }
      }
    }
  }

  function syncDots() {
    setActiveDot(getTextDots(), state.text);
    setActiveDot(getBgDots(), state.bg);
    setActiveDot(getBlockDots(), state.block);
    syncMainButtons();
    renderAllCustomColors();
  }

  function setTextColor(color, emit = true) {
    state.text = color || DEFAULT_TEXT_COLOR;
    syncDots();
    if (emit) emitChange("text", state.text);
  }

  function setBgColor(color, emit = true) {
    state.bg = color || DEFAULT_BG_COLOR;
    syncDots();
    if (emit) emitChange("bg", state.bg);
  }

  function setBlockColor(color, emit = true) {
    state.block = color || DEFAULT_BLOCK_BG_COLOR;
    syncDots();
    if (emit) emitChange("block", state.block);
  }

  function resetBlockColor(emit = true) {
    setBlockColor(DEFAULT_BLOCK_BG_COLOR, emit);
  }

  function resetTextColor(emit = true) {
    setTextColor(DEFAULT_TEXT_COLOR, emit);
  }

  function resetBgColor(emit = true) {
    setBgColor(DEFAULT_BG_COLOR, emit);
  }

  function bindDots() {
    const textDots = getTextDots();
    const bgDots = getBgDots();

    textDots.forEach((dot) => {
      stopPressSteal(dot);

      if (dot.__colorUiBound) return;
      dot.__colorUiBound = true;

      dot.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const color = dot.dataset.color || DEFAULT_TEXT_COLOR;
        setTextColor(color, true);
      });
    });

    bgDots.forEach((dot) => {
      stopPressSteal(dot);

      if (dot.__colorUiBound) return;
      dot.__colorUiBound = true;

      dot.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const color = dot.dataset.color || DEFAULT_BG_COLOR;
        setBgColor(color, true);
      });
    });

    const blockDots = getBlockDots();

    blockDots.forEach((dot) => {
      stopPressSteal(dot);

      if (dot.__colorUiBound) return;
      dot.__colorUiBound = true;

      dot.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const color = dot.dataset.color || DEFAULT_BLOCK_BG_COLOR;
        setBlockColor(color, true);
      });
    });
  }

  function closeAllSwatches() {
    const textWrap = document.getElementById("textColorSwatches");
    const bgWrap = document.getElementById("bgColorSwatches");
    const blockWrap = document.getElementById("blockBgSwatches");
  
    textWrap?.classList.remove("is-open");
    bgWrap?.classList.remove("is-open");
    blockWrap?.classList.remove("is-open");
  
    getTextMainBtn()?.classList.remove("is-active");
    getBgMainBtn()?.classList.remove("is-active");
    getBlockMainBtn()?.classList.remove("is-active");
  }

  function toggleSwatches(kind) {
    const textWrap = document.getElementById("textColorSwatches");
    const bgWrap = document.getElementById("bgColorSwatches");
    const blockWrap = document.getElementById("blockBgSwatches");
  
    const textBtn = getTextMainBtn();
    const bgBtn = getBgMainBtn();
    const blockBtn = getBlockMainBtn();
  
    if (kind === "block") {
      const willOpen = blockWrap && !blockWrap.classList.contains("is-open");
      closeAllSwatches();
      if (willOpen) {
        blockWrap.classList.add("is-open");
        blockBtn?.classList.add("is-active");
      }
      return;
    }
  
    if (kind === "text") {
      const willOpen = textWrap && !textWrap.classList.contains("is-open");
      closeAllSwatches();
      if (willOpen) {
        textWrap.classList.add("is-open");
        textBtn?.classList.add("is-active");
      }
      return;
    }
  
    if (kind === "bg") {
      const willOpen = bgWrap && !bgWrap.classList.contains("is-open");
      closeAllSwatches();
      if (willOpen) {
        bgWrap.classList.add("is-open");
        bgBtn?.classList.add("is-active");
      }
    }
  }

  function bindMainButtons() {
    const textBtn = getTextMainBtn();
    const bgBtn = getBgMainBtn();
    const blockBtn = getBlockMainBtn();

    stopPressSteal(textBtn);
    stopPressSteal(bgBtn);
    stopPressSteal(blockBtn);

    if (blockBtn && !blockBtn.__colorUiBound) {
      blockBtn.__colorUiBound = true;
      blockBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSwatches("block");
      });
    }

    if (textBtn && !textBtn.__colorUiBound) {
      textBtn.__colorUiBound = true;
      textBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSwatches("text");
      });
    }

    if (bgBtn && !bgBtn.__colorUiBound) {
      bgBtn.__colorUiBound = true;
      bgBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSwatches("bg");
      });
    }

    if (!document.__colorUiOutsideBound) {
      document.__colorUiOutsideBound = true;

      document.addEventListener("click", (e) => {
        const root = getRoot();
        const deleteMenu = document.querySelector(".color-delete-menu");
      
        if (root && root.contains(e.target)) return;
        if (deleteMenu && deleteMenu.contains(e.target)) return;
      
        closeAllSwatches();
        removeDeleteMenu();
      });
    }
  }

  function bindCustomColorAdders() {
    document.querySelectorAll(".custom-color-add").forEach((btn) => {
      if (btn.__customColorBound) return;
      btn.__customColorBound = true;

      stopPressSteal(btn);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const kind = btn.dataset.kind || "";
        const input = customInputEl(kind);
        if (!input) return;

        const cur = currentValueByKind(kind);
        const normalized =
          kind === "text"
            ? normalizeHex(cur) || "#000000"
            : normalizeHex(cur) || "#D9E4F7";

        input.value = normalized;
        input.click();
      });
    });

    document.querySelectorAll(".custom-color-input").forEach((input) => {
      if (input.__customColorBound) return;
      input.__customColorBound = true;

      input.addEventListener("change", (e) => {
        const kind = e.target.id.startsWith("text")
          ? "text"
          : e.target.id.startsWith("bg")
          ? "bg"
          : "block";

        const hex = normalizeHex(e.target.value);
        if (!hex) return;

        addCustomColor(kind, hex);
        applyKindColor(kind, hex);
        renderAllCustomColors();
      });
    });
  }

  function init() {
    const root = getRoot();
    if (!root) return;

    bindDots();
    bindMainButtons();
    bindCustomColorAdders();
    syncDots();
    renderAllCustomColors();
  }

  window.colorToolsUI = {
    getState() {
      return {
        text: state.text,
        bg: state.bg,
        block: state.block,
      };
    },
    getTextColor() {
      return state.text;
    },
    getBgColor() {
      return state.bg;
    },
    getBlockColor() {
      return state.block;
    },
    setTextColor,
    setBgColor,
    setBlockColor,
    resetTextColor,
    resetBgColor,
    resetBlockColor,
    sync: syncDots,
    init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
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
  
    function byId(id) {
      return document.getElementById(id);
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
      return Array.from(document.querySelectorAll('#textColorSwatches .color-dot[data-kind="text"]'));
    }
  
    function getBgDots() {
      return Array.from(document.querySelectorAll('#bgColorSwatches .color-dot[data-kind="bg"]'));
    }

    function getBlockMainBtn() {
      return byId("blockBgBtn");
    }
    
    function getBlockDots() {
      return Array.from(document.querySelectorAll('#blockBgSwatches .color-dot[data-kind="block"]'));
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
          blockBtn.classList.toggle("is-active", state.block !== DEFAULT_BLOCK_BG_COLOR);
          blockBtn.dataset.currentColor = state.block;
          blockBtn.title =
            state.block === DEFAULT_BLOCK_BG_COLOR
              ? "Фон блока"
              : `Фон блока: ${state.block}`;
        }
      
        if (textBtn) {
          textBtn.classList.toggle("is-active", state.text !== DEFAULT_TEXT_COLOR);
          textBtn.dataset.currentColor = state.text;
          textBtn.title =
            state.text === DEFAULT_TEXT_COLOR
              ? "Цвет текста"
              : `Цвет текста: ${state.text}`;
      
          const bar = textBtn.querySelector(".color-icon-text-bar");
          if (bar) {
            bar.style.background = state.text === DEFAULT_TEXT_COLOR ? "#000" : state.text;
          }
        }
      
        if (bgBtn) {
          bgBtn.classList.toggle("is-active", state.bg !== DEFAULT_BG_COLOR);
          bgBtn.dataset.currentColor = state.bg;
          bgBtn.title =
            state.bg === DEFAULT_BG_COLOR
              ? "Цвет подложки"
              : `Цвет подложки: ${state.bg}`;
      
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
    
      textWrap?.classList.remove("is-open");
      bgWrap?.classList.remove("is-open");

      const blockWrap = document.getElementById("blockBgSwatches");
blockWrap?.classList.remove("is-open");
    }
    
    function toggleSwatches(kind) {
      const textWrap = document.getElementById("textColorSwatches");
      const bgWrap = document.getElementById("bgColorSwatches");

      if (kind === "block") {
        const blockWrap = document.getElementById("blockBgSwatches");
        const willOpen = blockWrap && !blockWrap.classList.contains("is-open");
        closeAllSwatches();
        if (willOpen) blockWrap.classList.add("is-open");
        return;
      }
    
      if (kind === "text") {
        const willOpen = textWrap && !textWrap.classList.contains("is-open");
        closeAllSwatches();
        if (willOpen) textWrap.classList.add("is-open");
        return;
      }
    
      if (kind === "bg") {
        const willOpen = bgWrap && !bgWrap.classList.contains("is-open");
        closeAllSwatches();
        if (willOpen) bgWrap.classList.add("is-open");
      }
    }
    
    function bindMainButtons() {
      const textBtn = getTextMainBtn();
      const bgBtn = getBgMainBtn();
    
      stopPressSteal(textBtn);
      stopPressSteal(bgBtn);

      const blockBtn = getBlockMainBtn();
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
          if (root && root.contains(e.target)) return;
          closeAllSwatches();
        });
      }
    }
  
    function init() {
      const root = getRoot();
      if (!root) return;
  
      bindDots();
      bindMainButtons();
      syncDots();
    }
  
    window.colorToolsUI = {
      getState() {
        return {
          text: state.text,
          bg: state.bg,
        };
      },
      getTextColor() {
        return state.text;
      },
      getBgColor() {
        return state.bg;
      },
      setTextColor,
      setBgColor,
      resetTextColor,
      resetBgColor,
      sync: syncDots,
      init,
    };
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
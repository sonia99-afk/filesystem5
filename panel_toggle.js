(function () {
    if (typeof window === "undefined") return;
  
    const LEFT_KEY = "org_ui_left_collapsed";
    const RIGHT_KEY = "org_ui_right_collapsed";
  
    function applySavedState() {
      try {
        if (localStorage.getItem(LEFT_KEY) === "1") {
          document.body.classList.add("left-collapsed");
        }
        if (localStorage.getItem(RIGHT_KEY) === "1") {
          document.body.classList.add("right-collapsed");
        }
      } catch (_) {}
      syncButtons();
    }
  
    function syncButtons() {
        const leftBtn = document.querySelector(".toggle-left");
        const rightBtn = document.querySelector(".toggle-right");
      
        if (leftBtn) {
          leftBtn.title = document.body.classList.contains("left-collapsed")
            ? "Развернуть левую панель"
            : "Свернуть левую панель";
        }
      
        if (rightBtn) {
          rightBtn.title = document.body.classList.contains("right-collapsed")
            ? "Развернуть правую панель"
            : "Свернуть правую панель";
        }
      }
  
    function toggleLeft(e) {
      e?.preventDefault?.();
      e?.stopPropagation?.();
  
      document.body.classList.toggle("left-collapsed");
  
      try {
        localStorage.setItem(
          LEFT_KEY,
          document.body.classList.contains("left-collapsed") ? "1" : "0"
        );
      } catch (_) {}
  
      syncButtons();
    }
  
    function toggleRight(e) {
      e?.preventDefault?.();
      e?.stopPropagation?.();
  
      document.body.classList.toggle("right-collapsed");
  
      try {
        localStorage.setItem(
          RIGHT_KEY,
          document.body.classList.contains("right-collapsed") ? "1" : "0"
        );
      } catch (_) {}
  
      syncButtons();
    }
  
    function init() {
      const leftBtn = document.querySelector(".toggle-left");
      const rightBtn = document.querySelector(".toggle-right");
  
      if (leftBtn && !leftBtn.__panelToggleBound) {
        leftBtn.__panelToggleBound = true;
        leftBtn.addEventListener("click", toggleLeft);
      }
  
      if (rightBtn && !rightBtn.__panelToggleBound) {
        rightBtn.__panelToggleBound = true;
        rightBtn.addEventListener("click", toggleRight);
      }
  
      applySavedState();
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
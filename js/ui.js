/* ============================================================
   split — iconos, helpers de DOM, sheets arrastrables, toasts
   Expone window.UI
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     Iconos — trazo de 1.7px, 24x24, currentColor
     ============================================================ */

  var PATHS = {
    home:     '<path d="M3 10.5 12 3.5l9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-5.5h5V20"/>',
    list:     '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/>',
    chart:    '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    piggy:    '<path d="M4 12c0-3.3 3.1-6 7-6h1.5l3-2.2V7A6.4 6.4 0 0 1 19 12v1.5l2 .8v3.2h-3l-1 2h-3l-.6-1.4h-2L10 19.5H7l-1-2.4A6 6 0 0 1 4 12Z"/><circle cx="8.5" cy="11" r=".9" fill="currentColor" stroke="none"/>',
    gear:     '<circle cx="12" cy="12" r="3"/><path d="M19.1 14.9a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 0 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3.7a1.9 1.9 0 0 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3.7a1.9 1.9 0 0 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 0 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    plus:     '<path d="M12 5.5v13M5.5 12h13"/>',
    cart:     '<path d="M3 4h2.2l2.3 11h9.6l2-7.5H6.4"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    car:      '<path d="M5 16.5h14"/><path d="M4.5 16.5v2.2h2.6v-2.2"/><path d="M16.9 16.5v2.2h2.6v-2.2"/><path d="M3.6 16.5v-4l1.9-4.6A2 2 0 0 1 7.3 6.7h9.4a2 2 0 0 1 1.8 1.2l1.9 4.6v4"/><path d="M4 12.4h16"/>',
    sparkle:  '<path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6 10.1 12.8 4.3 10.9 10.1 9Z"/><path d="M18.4 4v3M19.9 5.5h-3"/>',
    bag:      '<path d="M5 8h14l-1.1 11.2H6.1Z"/><path d="M8.8 8V6.5a3.2 3.2 0 0 1 6.4 0V8"/>',
    heart:    '<path d="M12 19.6S4 14.9 4 9.9a4.1 4.1 0 0 1 8-1.4 4.1 4.1 0 0 1 8 1.4c0 5-8 9.7-8 9.7Z"/>',
    repeat:   '<path d="M4 9.5A4.5 4.5 0 0 1 8.5 5H18"/><path d="m15.5 2.5 3 2.5-3 2.5"/><path d="M20 14.5A4.5 4.5 0 0 1 15.5 19H6"/><path d="m8.5 21.5-3-2.5 3-2.5"/>',
    dots:     '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    wallet:   '<path d="M4 7.5A2 2 0 0 1 6 5.5h11a1.5 1.5 0 0 1 1.5 1.5v1.5"/><path d="M4 7.5v9A2.5 2.5 0 0 0 6.5 19h12A1.5 1.5 0 0 0 20 17.5v-7A1.5 1.5 0 0 0 18.5 9H6"/><circle cx="16.2" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
    clock:    '<circle cx="12" cy="12" r="8.3"/><path d="M12 7.4V12l3 1.8"/>',
    cash:     '<path d="M2.8 6.5h18.4v11H2.8Z"/><circle cx="12" cy="12" r="2.6"/><path d="M6.2 12h.01M17.8 12h.01"/>',
    gift:     '<path d="M4 11h16v8.5H4Z"/><path d="M3.2 7.6h17.6V11H3.2Z"/><path d="M12 7.6v11.9"/><path d="M12 7.6S10.8 4 8.9 4a2 2 0 0 0 0 3.6Z"/><path d="M12 7.6S13.2 4 15.1 4a2 2 0 0 1 0 3.6Z"/>',
    search:   '<circle cx="11" cy="11" r="6.4"/><path d="m20 20-4.4-4.4"/>',
    close:    '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    chevron:  '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
    chevDown: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
    arrowUp:  '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    arrowDown:'<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    trend:    '<path d="m3 16 5.5-5.5 3.5 3.5L21 5"/><path d="M15.5 5H21v5.5"/>',
    trendUp:  '<path d="m3 16.5 6-6 3.5 3.5L21 6"/><path d="M15.2 6H21v5.8"/>',
    trendDown:'<path d="m3 7.5 6 6 3.5-3.5L21 18"/><path d="M15.2 18H21v-5.8"/>',
    minus:    '<path d="M5.5 12h13"/>',
    user:     '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
    swap:     '<path d="M4 8.5h13"/><path d="m14 5.5 3 3-3 3"/><path d="M20 15.5H7"/><path d="m10 12.5-3 3 3 3"/>',
    bell:     '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.6 5.6 1.6 5.6H4.9S6.5 14 6.5 10Z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/>',
    pause:    '<path d="M9.5 5.5v13M14.5 5.5v13"/>',
    play:     '<path d="M8 5.4 18.5 12 8 18.6Z"/>',
    sliders:  '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    chevLeft: '<path d="m15 5.5-6.5 6.5L15 18.5"/>',
    backspace:'<path d="M9.4 5.5H20a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.4L3 12Z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>',
    sun:      '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M21.4 12H19M5 12H2.6M18.4 5.6 16.7 7.3M7.3 16.7 5.6 18.4M18.4 18.4 16.7 16.7M7.3 7.3 5.6 5.6"/>',
    moon:     '<path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"/>',
    target:   '<circle cx="12" cy="12" r="8.3"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
    download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/>',
    upload:   '<path d="M12 19.5v-11"/><path d="M7.5 13 12 8.5l4.5 4.5"/><path d="M4.5 4.5h15"/>',
    trash:    '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.5 6.5 7.4 20h9.2l.9-13.5"/>',
    edit:     '<path d="M4 20h4L19.2 8.8a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16Z"/>',
    info:     '<circle cx="12" cy="12" r="8.3"/><path d="M12 11v5.2"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>',
    check:    '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    warning:  '<path d="M12 4.2 2.8 20h18.4Z"/><path d="M12 10v4.4"/><circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none"/>',
    filter:   '<path d="M3.5 5.5h17l-6.6 7.6v5.6l-3.8 1.8v-7.4Z"/>',
    calendar: '<path d="M4 6.5h16V20H4Z"/><path d="M4 10.5h16"/><path d="M8.5 3.5v3M15.5 3.5v3"/>'
  };

  function icon(name, size, strokeWidth) {
    var d = PATHS[name] || PATHS.dots;
    var s = size || 22;
    return '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
           'fill="none" stroke="currentColor" stroke-width="' + (strokeWidth || 1.7) + '" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
           d + '</svg>';
  }

  /* ============================================================
     Helpers de DOM
     ============================================================ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ============================================================
     Feedback háptico (donde el navegador lo permita)
     ============================================================ */

  var hapticsOn = true;

  function haptic(kind) {
    if (!hapticsOn || !navigator.vibrate) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var p = kind === "heavy" ? 18 : kind === "success" ? [10, 40, 14] : 8;
    try { navigator.vibrate(p); } catch (e) {}
  }

  function setHaptics(on) { hapticsOn = !!on; }

  /* ============================================================
     Toasts
     ============================================================ */

  var toastStack = null;

  function toast(message, opts) {
    opts = opts || {};
    if (!toastStack) toastStack = $(".toast-stack");
    if (!toastStack) return;

    var node = el("div", { class: "toast", role: "status" });
    node.innerHTML = (opts.icon ? icon(opts.icon, 17) : "") + "<span>" + esc(message) + "</span>";

    if (opts.actionLabel && typeof opts.onAction === "function") {
      var btn = el("button", {
        type: "button",
        style: "margin-left:6px;color:inherit;font-weight:700;text-decoration:underline;pointer-events:auto"
      }, esc(opts.actionLabel));
      btn.addEventListener("click", function () {
        opts.onAction();
        dismiss();
      });
      node.appendChild(btn);
      node.style.pointerEvents = "auto";
    }

    toastStack.appendChild(node);

    var timer = setTimeout(dismiss, opts.duration || 3200);

    function dismiss() {
      clearTimeout(timer);
      if (!node.parentNode) return;
      node.setAttribute("data-leaving", "true");
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }

    return dismiss;
  }

  /* ============================================================
     Sheet arrastrable — sigue el dedo y cierra por velocidad o
     por umbral de recorrido, como una hoja modal de iOS
     ============================================================ */

  function Sheet(rootEl, scrimEl) {
    this.root = rootEl;
    this.scrim = scrimEl;
    this.open = false;
    this.onClose = null;
    this._lastFocus = null;
    this._bind();
  }

  Sheet.prototype._bind = function () {
    var self = this;
    var grabber = $(".sheet__grabber", this.root);
    var startY = 0, startT = 0, lastY = 0, lastT = 0, height = 0, dragging = false;

    function down(e) {
      if (!self.open) return;
      dragging = true;
      height = self.root.getBoundingClientRect().height;
      startY = lastY = e.clientY;
      startT = lastT = performance.now();
      self.root.setAttribute("data-dragging", "true");
      grabber.setPointerCapture(e.pointerId);
    }

    function move(e) {
      if (!dragging) return;
      var dy = Math.max(0, e.clientY - startY);
      /* resistencia al arrastrar hacia arriba */
      lastY = e.clientY;
      lastT = performance.now();
      self.root.style.transform = "translate3d(0," + dy + "px,0)";
      self.scrim.style.opacity = String(Math.max(0, 1 - dy / height));
    }

    function up(e) {
      if (!dragging) return;
      dragging = false;
      self.root.removeAttribute("data-dragging");
      self.root.style.transform = "";
      self.scrim.style.opacity = "";

      var dy = Math.max(0, e.clientY - startY);
      var dt = Math.max(1, performance.now() - lastT + 1);
      var velocity = (e.clientY - lastY) / dt;   /* px por ms */

      if (dy > height * 0.32 || velocity > 0.5) self.close();
    }

    grabber.addEventListener("pointerdown", down);
    grabber.addEventListener("pointermove", move);
    grabber.addEventListener("pointerup", up);
    grabber.addEventListener("pointercancel", up);

    this.scrim.addEventListener("click", function () { self.close(); });

    this.root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); self.close(); }
      if (e.key === "Tab") self._trapFocus(e);
    });

    $$("[data-sheet-close]", this.root).forEach(function (b) {
      b.addEventListener("click", function () { self.close(); });
    });
  };

  Sheet.prototype._focusables = function () {
    return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', this.root)
      .filter(function (n) { return n.offsetParent !== null && !n.disabled; });
  };

  Sheet.prototype._trapFocus = function (e) {
    var list = this._focusables();
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  Sheet.prototype.show = function () {
    this._lastFocus = document.activeElement;
    this.open = true;
    this.root.setAttribute("data-open", "true");
    this.root.setAttribute("aria-hidden", "false");
    this.scrim.setAttribute("data-open", "true");
    haptic("light");
    var list = this._focusables();
    if (list.length) setTimeout(function () { list[0].focus(); }, 60);
  };

  Sheet.prototype.close = function () {
    if (!this.open) return;
    this.open = false;
    this.root.setAttribute("data-open", "false");
    this.root.setAttribute("aria-hidden", "true");
    this.scrim.setAttribute("data-open", "false");
    if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus();
    if (typeof this.onClose === "function") this.onClose();
  };

  /* ============================================================
     Indicador deslizante (tab bar y segmented control)
     ============================================================ */

  function slideIndicator(container, thumb, activeBtn) {
    if (!activeBtn || !thumb) return;
    var cRect = container.getBoundingClientRect();
    var bRect = activeBtn.getBoundingClientRect();
    if (!bRect.width) return;
    thumb.style.width = bRect.width + "px";
    thumb.style.transform = "translateX(" + (bRect.left - cRect.left) + "px)";
  }

  /* ============================================================
     Contador animado — interpola el valor mostrado
     ============================================================ */

  function countTo(node, to, format, duration) {
    var reduce = window.matchMedia &&
                 window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var from = parseFloat(node.getAttribute("data-value")) || 0;
    node.setAttribute("data-value", String(to));

    if (reduce || from === to) { node.innerHTML = format(to); return; }

    var dur = duration || 620;
    var t0 = performance.now();

    function frame(now) {
      var p = Math.min(1, (now - t0) / dur);
      /* easing de salida, sin rebote sobre cifras */
      var e = 1 - Math.pow(1 - p, 3);
      node.innerHTML = format(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
     Vista tabla — la gemela accesible de cada gráfico
     ============================================================ */

  function tableView(id, columns, rows) {
    var head = columns.map(function (c) { return "<th scope=\"col\">" + esc(c) + "</th>"; }).join("");
    var body = rows.map(function (r) {
      return "<tr>" + r.map(function (cell, i) {
        return i === 0 ? "<th scope=\"row\">" + esc(cell) + "</th>" : "<td>" + esc(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("");

    return '' +
      '<button type="button" class="table-toggle" aria-expanded="false" aria-controls="' + id + '">' +
        '<span class="table-toggle__chev">' + icon("chevDown", 14) + '</span>' +
        '<span>Ver los datos en tabla</span>' +
      '</button>' +
      '<div class="data-table-wrap" id="' + id + '" data-open="false">' +
        '<table class="data-table"><thead><tr>' + head + '</tr></thead>' +
        '<tbody>' + body + '</tbody></table>' +
      '</div>';
  }

  /* delegación: cualquier .table-toggle abre su tabla */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".table-toggle");
    if (!btn) return;
    var wrap = document.getElementById(btn.getAttribute("aria-controls"));
    if (!wrap) return;
    var open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    wrap.setAttribute("data-open", String(!open));
  });

  /* ============================================================
     API pública
     ============================================================ */

  window.UI = {
    icon: icon,
    $: $, $$: $$, el: el, esc: esc,
    haptic: haptic, setHaptics: setHaptics,
    toast: toast,
    Sheet: Sheet,
    slideIndicator: slideIndicator,
    countTo: countTo,
    tableView: tableView
  };
})();

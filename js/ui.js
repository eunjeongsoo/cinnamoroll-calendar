/* ui.js — 바텀시트, 확인창, 토스트, 아이콘 같은 공용 화면 부품 */
(function () {
  "use strict";

  /* ---------- 인라인 SVG 아이콘 ---------- */
  function svg(path, extra) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' + (extra || "") + ">" + path + "</svg>";
  }
  var ICON = {
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
    gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.3 2.7-.7.7 2.7 2.4 1.5-1.2 2.5 1.2 2.5-2.4 1.5-.7 2.7-2.7-.7L12 21.2l-1.6-2.4-2.7.7-.7-2.7-2.4-1.5 1.2-2.5-1.2-2.5 2.4-1.5.7-2.7 2.7.7z"/>'),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'),
    people: svg('<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 20c.7-3.6 3.2-5.6 6.2-5.6s5.5 2 6.2 5.6"/><circle cx="17.2" cy="9.5" r="2.6"/><path d="M16.6 14.6c2.6.2 4.3 2 4.8 5"/>'),
    trash: svg('<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    bell: svg('<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 004 0"/>'),
    download: svg('<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>'),
    upload: svg('<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15"/>'),
    today: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="12" cy="15" r="2" fill="currentColor"/>'),
    repeat: svg('<path d="M4 11V9a3 3 0 013-3h12M16 3l3 3-3 3M20 13v2a3 3 0 01-3 3H5M8 21l-3-3 3-3"/>'),
    plusCircle: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
    chevronDown: svg('<path d="M6 9l6 6 6-6"/>', 'class="chev"'),
    heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor"/>'),
    cloud: '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M18 36h30a12 12 0 000-24 15 15 0 00-28-3A12 12 0 0018 36z" fill="currentColor"/></svg>'
  };

  function h(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ---------- 바텀시트 (뒤로가기 버튼/기기 뒤로가기와 연동) ---------- */
  var layer = null;
  var stack = [];
  var popWaiters = [];

  function ensureLayer() {
    if (!layer) layer = document.getElementById("sheet-layer");
    return layer;
  }

  function lockScroll() {
    document.body.classList.toggle("sheet-open", stack.length > 0);
  }

  /**
   * opts: { title, left:{label,icon,onClick}|false, right:{label,onClick,primary,icon}|null,
   *         render(body, sheet), onRefresh(sheet), tall, className }
   */
  function openSheet(opts) {
    ensureLayer();
    var sheet = { opts: opts, id: "s" + Date.now() + Math.random().toString(36).slice(2, 6) };
    var el = h(
      '<div class="sheet-wrap ' + (opts.className || "") + '">' +
        '<div class="sheet-backdrop"></div>' +
        '<section class="sheet ' + (opts.tall ? "sheet-tall" : "") + '" role="dialog" aria-modal="true">' +
          '<div class="sheet-grip" aria-hidden="true"></div>' +
          '<header class="sheet-head"><div class="sh-left"></div><h2 class="sh-title"></h2><div class="sh-right"></div></header>' +
          '<div class="sheet-body"></div>' +
        "</section>" +
      "</div>"
    );
    sheet.el = el;
    sheet.body = el.querySelector(".sheet-body");
    sheet.panel = el.querySelector(".sheet");
    el.querySelector(".sh-title").textContent = opts.title || "";

    var left = el.querySelector(".sh-left");
    if (opts.left !== false) {
      var l = opts.left || {};
      var lb = h('<button type="button" class="head-btn ghost">' + (l.icon || ICON.back) + "<span>" + U.esc(l.label || "뒤로가기") + "</span></button>");
      lb.addEventListener("click", function () { (l.onClick || back)(); });
      left.appendChild(lb);
    }
    var right = el.querySelector(".sh-right");
    if (opts.right) {
      var rb = h('<button type="button" class="head-btn ' + (opts.right.primary === false ? "soft" : "primary") + '">' +
        (opts.right.icon || "") + "<span>" + U.esc(opts.right.label) + "</span></button>");
      rb.addEventListener("click", function () { opts.right.onClick(sheet); });
      right.appendChild(rb);
      sheet.rightBtn = rb;
    }
    el.querySelector(".sheet-backdrop").addEventListener("click", function () {
      if (stack[stack.length - 1] === sheet) back();
    });

    sheet.setTitle = function (t) { el.querySelector(".sh-title").textContent = t; };
    sheet.setRightBusy = function (busy, label) {
      if (!sheet.rightBtn) return;
      sheet.rightBtn.disabled = !!busy;
      sheet.rightBtn.querySelector("span").textContent = busy ? (label || "저장중..") : opts.right.label;
    };
    sheet.refresh = function () {
      if (opts.onRefresh) opts.onRefresh(sheet);
    };
    sheet.close = back;

    opts.render(sheet.body, sheet);
    layer.appendChild(el);
    stack.push(sheet);
    lockScroll();
    history.pushState({ sheetDepth: stack.length }, "");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add("open"); });
    });
    // 이전 시트는 살짝 뒤로
    if (stack.length > 1) stack[stack.length - 2].el.classList.add("behind");
    return sheet;
  }

  function removeTop() {
    var s = stack.pop();
    if (!s) return;
    var el = s.el;
    el.classList.remove("open");
    el.classList.add("closing");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    if (stack.length) stack[stack.length - 1].el.classList.remove("behind");
    if (s.opts.onClose) s.opts.onClose();
    lockScroll();
  }

  function onPopState(e) {
    closeDialog(null);
    var depth = (e.state && e.state.sheetDepth) || 0;
    while (stack.length > depth) removeTop();
    var waiters = popWaiters;
    popWaiters = [];
    waiters.forEach(function (fn) { fn(); });
  }

  function back() {
    if (stack.length) history.back();
  }

  /** 모든 시트를 닫고 메인으로 (Promise) */
  function closeAll() {
    return new Promise(function (resolve) {
      if (!stack.length) return resolve();
      popWaiters.push(function () { setTimeout(resolve, 10); });
      history.go(-stack.length);
    });
  }

  /** 맨 위 시트 하나 닫기 (Promise) */
  function closeTop() {
    return new Promise(function (resolve) {
      if (!stack.length) return resolve();
      popWaiters.push(function () { setTimeout(resolve, 10); });
      history.back();
    });
  }

  function refreshSheets() {
    stack.forEach(function (s) { s.refresh(); });
  }

  function topSheet() { return stack[stack.length - 1] || null; }

  /* ---------- 확인창 / 선택창 ---------- */
  var dialogEl = null;
  var dialogResolve = null;

  function closeDialog(value) {
    if (!dialogEl) return;
    var el = dialogEl;
    var res = dialogResolve;
    dialogEl = null;
    dialogResolve = null;
    el.classList.remove("open");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    if (res) res(value);
  }

  /** options: [{label, value, danger, primary}] → 선택한 value, 취소/바깥 탭 시 null */
  function choose(o) {
    closeDialog(null);
    return new Promise(function (resolve) {
      var btns = (o.options || []).map(function (op, i) {
        return '<button type="button" class="dlg-btn ' + (op.danger ? "danger" : op.primary ? "primary" : "") + '" data-i="' + i + '">' + U.esc(op.label) + "</button>";
      }).join("");
      var el = h(
        '<div class="dialog-wrap">' +
          '<div class="dialog-backdrop"></div>' +
          '<div class="dialog" role="alertdialog" aria-modal="true">' +
            '<img class="dlg-img" src="' + (o.img || U.IMG + "face.png") + '" alt="">' +
            (o.title ? '<h3 class="dlg-title">' + U.esc(o.title) + "</h3>" : "") +
            (o.message ? '<p class="dlg-msg">' + U.esc(o.message).replace(/\n/g, "<br>") + "</p>" : "") +
            '<div class="dlg-actions ' + ((o.options || []).length > 2 ? "stack" : "") + '">' + btns + "</div>" +
          "</div>" +
        "</div>"
      );
      el.querySelectorAll(".dlg-btn").forEach(function (b) {
        b.addEventListener("click", function () {
          var op = o.options[Number(b.getAttribute("data-i"))];
          closeDialog(op.value === undefined ? null : op.value);
        });
      });
      el.querySelector(".dialog-backdrop").addEventListener("click", function () { closeDialog(null); });
      document.body.appendChild(el);
      dialogEl = el;
      dialogResolve = resolve;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.classList.add("open"); });
      });
    });
  }

  function confirm(o) {
    return choose({
      title: o.title,
      message: o.message,
      img: o.img,
      options: [
        { label: o.cancelText || "아니요", value: false },
        { label: o.okText || "좋아요", value: true, danger: !!o.danger, primary: !o.danger }
      ]
    }).then(function (v) { return v === true; });
  }

  function alert(o) {
    return choose({ title: o.title, message: o.message, img: o.img, options: [{ label: o.okText || "알겠어요", value: true, primary: true }] });
  }

  /* ---------- 토스트 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2000);
  }

  /* ---------- 폼 도우미 ---------- */
  function setError(root, name, msg) {
    var p = root.querySelector('[data-err="' + name + '"]');
    if (!p) return;
    p.textContent = msg || "";
    p.classList.toggle("show", !!msg);
    var field = p.closest(".field");
    if (field) field.classList.toggle("has-err", !!msg);
  }
  function clearErrors(root) {
    root.querySelectorAll("[data-err]").forEach(function (p) {
      p.textContent = "";
      p.classList.remove("show");
      var f = p.closest(".field");
      if (f) f.classList.remove("has-err");
    });
  }
  function scrollToFirstError(root) {
    var first = root.querySelector(".err.show");
    if (first) {
      var field = first.closest(".field") || first;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      field.classList.remove("shake");
      void field.offsetWidth;
      field.classList.add("shake");
    }
  }

  function chips(name, items, selected) {
    return '<div class="chips" data-chips="' + name + '" role="radiogroup">' +
      items.map(function (it) {
        var on = it.value === selected;
        return '<button type="button" class="chip ' + (on ? "on" : "") + '" role="radio" aria-checked="' + on + '" data-value="' + U.esc(it.value) + '">' +
          (it.img ? '<img src="' + it.img + '" alt="">' : "") + "<span>" + U.esc(it.label) + "</span></button>";
      }).join("") + "</div>";
  }
  function bindChips(root, name, onChange) {
    var wrap = root.querySelector('[data-chips="' + name + '"]');
    wrap.addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      setChip(root, name, b.getAttribute("data-value"));
      onChange(b.getAttribute("data-value"));
    });
  }
  function setChip(root, name, value) {
    root.querySelectorAll('[data-chips="' + name + '"] .chip').forEach(function (c) {
      var on = c.getAttribute("data-value") === value;
      c.classList.toggle("on", on);
      c.setAttribute("aria-checked", on);
    });
  }

  window.addEventListener("popstate", onPopState);
  // 새로고침 시 남아 있던 시트 기록 정리
  if (history.state && history.state.sheetDepth) history.replaceState(null, "");

  window.UI = {
    ICON: ICON,
    h: h,
    openSheet: openSheet,
    back: back,
    closeAll: closeAll,
    closeTop: closeTop,
    refreshSheets: refreshSheets,
    topSheet: topSheet,
    choose: choose,
    confirm: confirm,
    alert: alert,
    toast: toast,
    setError: setError,
    clearErrors: clearErrors,
    scrollToFirstError: scrollToFirstError,
    chips: chips,
    bindChips: bindChips,
    setChip: setChip
  };
})();

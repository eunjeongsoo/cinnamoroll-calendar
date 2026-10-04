/* calendar.js — 세로 스크롤(스냅) 월 달력 */
(function () {
  "use strict";

  var RANGE = 12; // 앞뒤로 미리 그려두는 달 수
  var scroller, titleEl;
  var months = []; // [{y, m, el}]
  var monthH = 0;
  var currentIdx = 0;
  var scrollTimer = null;
  var rafPending = false;
  var adjusting = false;

  function ymKey(y, m) { return y + "-" + U.pad(m + 1); }
  function shift(y, m, n) {
    var d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  function buildMonth(y, m) {
    var first = new Date(y, m, 1);
    var days = new Date(y, m + 1, 0).getDate();
    var lead = first.getDay();
    var weeks = Math.ceil((lead + days) / 7);
    var el = document.createElement("section");
    el.className = "month";
    el.setAttribute("data-ym", ymKey(y, m));
    var html = '<div class="month-label"><span>' + (m === 0 ? y + "년 " : "") + (m + 1) + '월</span></div>' +
      '<div class="month-grid" style="grid-template-rows:repeat(' + weeks + ',1fr)">';
    for (var i = 0; i < weeks * 7; i++) {
      var d = i - lead + 1;
      if (d < 1 || d > days) {
        html += '<div class="cell empty" aria-hidden="true"></div>';
        continue;
      }
      var key = y + "-" + U.pad(m + 1) + "-" + U.pad(d);
      var dow = i % 7;
      html += '<button type="button" class="cell' + (dow === 0 ? " sun" : dow === 6 ? " sat" : "") + '" data-date="' + key + '">' +
        '<span class="num">' + d + '</span><span class="mark"></span></button>';
    }
    html += "</div>";
    el.innerHTML = html;
    return el;
  }

  /** 바 안 글자: 수업은 "수업", 나머지는 일정 제목 */
  function barText(ev) {
    return ev.category === "lesson" ? "수업" : ev.title;
  }

  /** 칸 높이에 들어가는 바 개수 */
  function capacity(mo) {
    var c = mo.el.querySelector(".cell[data-date]");
    var h = c ? c.clientHeight : 0;
    if (!h) return 3;
    return Math.max(1, Math.floor((h - 28) / 17));
  }

  function paintCell(cell, idx, today, cap) {
    var key = cell.getAttribute("data-date");
    var list = idx[key] || []; // 하루 종일 → 시간순으로 정렬돼 있어요
    cell.classList.toggle("today", key === today);
    cell.classList.toggle("has", list.length > 0);
    var mark = cell.querySelector(".mark");
    var label = key.slice(5).replace("-", "월 ") + "일";
    if (!list.length) {
      if (mark.innerHTML) mark.innerHTML = "";
      cell.setAttribute("aria-label", label + ", 일정 없음");
      return;
    }
    var shown = list.length > cap ? list.slice(0, Math.max(cap - 1, 1)) : list;
    var html = shown.map(function (ev) {
      var cat = U.CAT_MAP[ev.category] ? ev.category : "normal";
      return '<span class="bar bar-' + cat + (ev.done ? " done" : "") + '">' + U.esc(barText(ev)) + "</span>";
    }).join("");
    if (shown.length < list.length) html += '<span class="bar-more">+' + (list.length - shown.length) + "</span>";
    mark.innerHTML = html;
    cell.setAttribute("aria-label", label + ", 일정 " + list.length + "개: " + list.map(barText).join(", "));
  }

  function paintMonth(mo) {
    var idx = App.state.dayIndex;
    var today = U.todayKey();
    var cap = capacity(mo);
    mo.el.querySelectorAll(".cell[data-date]").forEach(function (c) { paintCell(c, idx, today, cap); });
  }

  function refresh() {
    months.forEach(paintMonth);
  }

  function measure() {
    var h = scroller.clientHeight;
    if (h && h !== monthH) {
      monthH = h;
      scroller.style.setProperty("--month-h", h + "px");
    }
  }

  function renderAround(y, m) {
    months = [];
    scroller.innerHTML = "";
    var frag = document.createDocumentFragment();
    for (var i = -RANGE; i <= RANGE; i++) {
      var s = shift(y, m, i);
      var el = buildMonth(s.y, s.m);
      months.push({ y: s.y, m: s.m, el: el });
      frag.appendChild(el);
    }
    scroller.appendChild(frag);
    refresh();
  }

  function indexOf(y, m) {
    for (var i = 0; i < months.length; i++) if (months[i].y === y && months[i].m === m) return i;
    return -1;
  }

  function setTitle(i) {
    var mo = months[i];
    if (!mo) return;
    currentIdx = i;
    titleEl.textContent = mo.y + "년 " + (mo.m + 1) + "월";
  }

  function goTo(y, m, smooth) {
    measure();
    var i = indexOf(y, m);
    if (i < 0 || i < 2 || i > months.length - 3) {
      renderAround(y, m);
      i = indexOf(y, m);
      smooth = false;
    }
    adjusting = true;
    if (smooth && "scrollBehavior" in document.documentElement.style) {
      scroller.scrollTo({ top: i * monthH, behavior: "smooth" });
    } else {
      scroller.scrollTop = i * monthH;
    }
    setTitle(i);
    setTimeout(function () { adjusting = false; }, smooth ? 600 : 50);
  }

  function goToday(smooth) {
    var d = new Date();
    goTo(d.getFullYear(), d.getMonth(), smooth);
  }

  function extendIfNeeded() {
    if (!monthH) return;
    var i = Math.round(scroller.scrollTop / monthH);
    if (i < 3) {
      var first = months[0];
      var frag = document.createDocumentFragment();
      var added = [];
      for (var k = RANGE; k >= 1; k--) {
        var s = shift(first.y, first.m, -k);
        var el = buildMonth(s.y, s.m);
        added.push({ y: s.y, m: s.m, el: el });
        frag.appendChild(el);
      }
      scroller.insertBefore(frag, scroller.firstChild);
      months = added.concat(months);
      added.forEach(paintMonth);
      scroller.scrollTop += RANGE * monthH;
    } else if (i > months.length - 4) {
      var last = months[months.length - 1];
      for (var j = 1; j <= RANGE; j++) {
        var t = shift(last.y, last.m, j);
        var el2 = buildMonth(t.y, t.m);
        var mo = { y: t.y, m: t.m, el: el2 };
        months.push(mo);
        scroller.appendChild(el2);
        paintMonth(mo);
      }
    }
  }

  function onScroll() {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        if (!monthH) return;
        setTitle(Math.min(months.length - 1, Math.max(0, Math.round(scroller.scrollTop / monthH))));
      });
    }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { if (!adjusting) extendIfNeeded(); }, 180);
  }

  /** 저장 직후 해당 날짜를 반짝 */
  function flashDate(key) {
    var d = U.parseKey(key);
    var mo = months[currentIdx];
    if (!mo || mo.y !== d.getFullYear() || mo.m !== d.getMonth()) goTo(d.getFullYear(), d.getMonth(), true);
    setTimeout(function () {
      var cell = scroller.querySelector('.cell[data-date="' + key + '"]');
      if (!cell) return;
      cell.classList.remove("pop");
      void cell.offsetWidth;
      cell.classList.add("pop");
    }, 120);
  }

  function currentYM() {
    var mo = months[currentIdx];
    return mo ? { y: mo.y, m: mo.m } : { y: new Date().getFullYear(), m: new Date().getMonth() };
  }

  /* ---------- 년/월 선택 피커 ---------- */
  function openPicker() {
    var cur = currentYM();
    var year = cur.y;
    UI.openSheet({
      title: "언제로 갈까요?",
      className: "picker-sheet",
      render: function (body) {
        function draw() {
          var html = '<div class="picker-year">' +
            '<button type="button" class="round-btn" data-act="prev" aria-label="이전 해">' + UI.ICON.back + "</button>" +
            '<strong>' + year + "년</strong>" +
            '<button type="button" class="round-btn flip" data-act="next" aria-label="다음 해">' + UI.ICON.back + "</button>" +
            "</div><div class=\"picker-months\">";
          var now = new Date();
          for (var i = 0; i < 12; i++) {
            var cls = (year === cur.y && i === cur.m ? " on" : "") + (year === now.getFullYear() && i === now.getMonth() ? " now" : "");
            html += '<button type="button" class="pm' + cls + '" data-m="' + i + '">' + (i + 1) + "월</button>";
          }
          html += '</div><button type="button" class="btn soft block" data-act="today">' + UI.ICON.today + "<span>오늘로 돌아가기</span></button>";
          body.innerHTML = html;
        }
        draw();
        body.addEventListener("click", function (e) {
          var b = e.target.closest("button");
          if (!b) return;
          var act = b.getAttribute("data-act");
          if (act === "prev") { year--; draw(); return; }
          if (act === "next") { year++; draw(); return; }
          if (act === "today") { UI.closeAll().then(function () { goToday(true); }); return; }
          var m = b.getAttribute("data-m");
          if (m != null) UI.closeAll().then(function () { goTo(year, Number(m), true); });
        });
      }
    });
  }

  function init() {
    scroller = document.getElementById("cal-scroll");
    titleEl = document.getElementById("cal-title");
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("click", function (e) {
      var cell = e.target.closest(".cell[data-date]");
      if (cell) App.openDay(cell.getAttribute("data-date"));
    });
    document.getElementById("cal-title-btn").addEventListener("click", openPicker);

    var lastH = 0;
    var keepMonth = function () {
      var before = currentYM();
      measure();
      if (monthH !== lastH) {
        lastH = monthH;
        var i = indexOf(before.y, before.m);
        if (i >= 0) scroller.scrollTop = i * monthH;
        refresh();
      }
    };
    window.addEventListener("resize", keepMonth);
    if (window.ResizeObserver) new ResizeObserver(keepMonth).observe(scroller);

    measure();
    lastH = monthH;
    var d = new Date();
    renderAround(d.getFullYear(), d.getMonth());
    goToday(false);

    // 자정이 지나면 오늘 표시 갱신
    var lastDay = U.todayKey();
    setInterval(function () {
      if (U.todayKey() !== lastDay) { lastDay = U.todayKey(); refresh(); }
    }, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && U.todayKey() !== lastDay) { lastDay = U.todayKey(); refresh(); }
    });
  }

  // 탭 전환으로 숨겨졌다 다시 보일 때 보던 달 유지
  var savedIdx = null;
  function onHide() { savedIdx = currentIdx; }
  function onShow() {
    measure();
    if (savedIdx != null && months[savedIdx]) {
      adjusting = true;
      scroller.scrollTop = savedIdx * monthH;
      setTitle(savedIdx);
      setTimeout(function () { adjusting = false; }, 80);
    }
    savedIdx = null;
    refresh(); // 숨겨져 있던 동안 바뀐 일정/칸 높이 반영
  }

  window.Calendar = {
    init: init,
    onHide: onHide,
    onShow: onShow,
    refresh: refresh,
    goTo: goTo,
    goToday: goToday,
    flashDate: flashDate,
    openPicker: openPicker,
    currentYM: currentYM,
    measure: measure
  };
})();

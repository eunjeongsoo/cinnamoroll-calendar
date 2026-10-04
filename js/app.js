/* app.js — 앱 시작, 상태 관리, 탭 전환, 새해 안내, 서비스워커 */
(function () {
  "use strict";

  var state = {
    events: [],
    members: [],
    memberMap: {},
    dayIndex: {}
  };
  var currentTab = "calendar";

  function reload() {
    return Promise.all([Store.getEvents(), Store.getMembers()]).then(function (r) {
      state.events = r[0] || [];
      state.members = r[1] || [];
      state.memberMap = {};
      state.members.forEach(function (m) { state.memberMap[m.id] = m; });
      state.dayIndex = U.buildDayIndex(state.events);
      Calendar.refresh();
      Members.renderList();
      UI.refreshSheets();
    });
  }

  function fail(err) {
    console.error(err);
    UI.alert({
      title: "앗, 문제가 생겼어요",
      message: "잠시 후 다시 시도해 줄래요?\n(" + ((err && err.message) || "알 수 없는 오류") + ")",
      img: U.IMG + "peek.png"
    });
  }

  function switchTab(tab) {
    if (tab === currentTab) {
      if (tab === "calendar") Calendar.goToday(true);
      return;
    }
    if (currentTab === "calendar") Calendar.onHide();
    currentTab = tab;
    document.querySelectorAll(".view").forEach(function (v) {
      v.hidden = v.getAttribute("data-view") !== tab;
    });
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.getAttribute("data-tab") === tab;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", on);
    });
    document.getElementById("home-fab").hidden = tab !== "calendar";
    if (tab === "calendar") Calendar.onShow();
  }

  function openMore() {
    UI.openSheet({
      title: "더보기",
      className: "more-sheet",
      render: function (body) {
        body.innerHTML =
          '<ul class="menu-list">' +
            '<li><button type="button" data-act="today">' + UI.ICON.today + "<span>오늘로 이동</span></button></li>" +
            '<li><button type="button" data-act="add">' + UI.ICON.plus + "<span>오늘 일정 추가</span></button></li>" +
            '<li><button type="button" data-act="members">' + UI.ICON.people + "<span>회원 관리</span></button></li>" +
            '<li><button type="button" data-act="settings">' + UI.ICON.gear + "<span>설정 · 백업</span></button></li>" +
          "</ul>" +
          '<div class="legend"><p class="mini-lbl">일정 바 색깔 안내</p><div class="legend-row">' +
            ["lesson", "important", "duty", "off", "normal"].map(function (k) {
              var c = U.CAT_MAP[k];
              return '<span class="legend-item"><span class="bar bar-' + k + ' legend-bar">' + (k === "lesson" ? "회원명" : "제목") + "</span>" + c.label + "</span>";
            }).join("") +
          "</div></div>";
        body.addEventListener("click", function (e) {
          var b = e.target.closest("button[data-act]");
          if (!b) return;
          var act = b.getAttribute("data-act");
          if (act === "add") {
            UI.closeTop().then(function () { Events.openForm({ date: U.todayKey() }); });
            return;
          }
          if (act === "settings") {
            UI.closeTop().then(function () { Settings.open(); });
            return;
          }
          UI.closeAll().then(function () {
            if (act === "today") Calendar.goToday(true);
            else if (act === "members") switchTab("members");
          });
        });
      }
    });
  }

  /* ---------- 새해 나이 안내 (연 1회) ---------- */
  function checkNewYear() {
    var cy = U.currentYear();
    return Store.getMeta("ageNoticeYear").then(function (last) {
      if (last == null) return Store.setMeta("ageNoticeYear", cy);
      if (Number(last) >= cy) return;
      return Store.setMeta("ageNoticeYear", cy).then(function () {
        if (!state.members.length) return;
        showNewYear(Number(last));
      });
    });
  }

  function showNewYear(lastYear) {
    var diff = U.currentYear() - lastYear;
    var list = state.members.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "ko"); });
    UI.openSheet({
      title: "🎉 새해 복 많이 받아요",
      left: false,
      tall: true,
      className: "newyear-sheet",
      right: { label: "확인", onClick: function () { UI.back(); } },
      render: function (body) {
        body.innerHTML =
          '<div class="ny-hero"><img src="' + U.IMG + 'hat.png" alt=""><p><b>새해가 됐어요!</b><br>회원들 나이가 한 살씩 올랐어요</p></div>' +
          '<ul class="ny-list">' + list.map(function (m) {
            var now = U.ageOf(m);
            return "<li><strong>" + U.esc(m.name) + "</strong><span>" + (now - diff) + "세</span><i>→</i><b>" + now + "세</b></li>";
          }).join("") + "</ul>" +
          '<button type="button" class="btn primary block" data-act="ok">확인했어요</button>';
        body.querySelector('[data-act="ok"]').addEventListener("click", function () { UI.back(); });
      }
    });
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.warn("[SW] 등록 실패:", err && err.message);
      });
    });
  }

  function init() {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.getAttribute("data-tab")); });
    });
    document.getElementById("more-btn").addEventListener("click", openMore);
    document.getElementById("settings-btn").addEventListener("click", function () { Settings.open(); });

    Calendar.init();
    Members.init();
    Fun.init();

    Store.init()
      .then(reload)
      .then(checkNewYear)
      .then(function () {
        document.body.classList.add("ready");
        // 앱을 켜둔 채로 해가 바뀌어도 다시 볼 때 안내
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden) checkNewYear().then(function () { Members.renderList(); }).catch(function () {});
        });
      })
      .catch(fail);
    registerSW();
  }

  window.App = {
    state: state,
    reload: reload,
    fail: fail,
    switchTab: switchTab,
    openDay: function (key) { Events.openDay(key); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

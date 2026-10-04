/* events.js — 날짜별 일정 목록 시트, 일정 입력/수정 시트, 진행완료 */
(function () {
  "use strict";

  var REPEATS = [
    { value: "none", label: "반복 안 함" },
    { value: "daily", label: "매일" },
    { value: "weekly", label: "매주" },
    { value: "biweekly", label: "2주마다" },
    { value: "monthly", label: "매월" }
  ];
  var REPEAT_LABEL = { daily: "매일", weekly: "매주", biweekly: "2주마다", monthly: "매월" };
  var MAX_REPEAT = 100;

  function catOf(ev) { return U.CAT_MAP[ev.category] || U.CAT_MAP.normal; }

  /* ---------- 일정 카드 HTML (목록/회원 상세 공용) ---------- */
  function lessonMember(ev) {
    var m = ev.memberId ? App.state.memberMap[ev.memberId] : null;
    return m;
  }

  /** 수업 제목은 "OOO 회원 (오후 3시)"까지만 (예전에 저장된 끝의 "수업"은 빼고 보여줘요) */
  function displayTitle(ev) {
    return ev.category === "lesson" ? ev.title.replace(/\)\s*수업$/, ")") : ev.title;
  }

  function eventCard(ev) {
    var c = catOf(ev);
    var isLesson = ev.category === "lesson";
    var html = '<li class="ev-card cat-line-' + c.key + (ev.done ? " is-done" : "") + '" data-id="' + ev.id + '" role="button" tabindex="0">' +
      '<span class="cat-badge lg cat-' + c.key + (ev.done ? " done" : "") + '"><img src="' + c.img + '" alt=""></span>' +
      '<div class="ev-main">' +
        '<div class="ev-top"><span class="cat-tag cat-' + c.key + '">' + c.label + "</span>" +
          (ev.seriesId ? '<span class="rep-tag" title="반복 일정">' + UI.ICON.repeat + "</span>" : "") +
          '<span class="ev-time">' + U.esc(U.fmtEventTime(ev)) + "</span></div>" +
        '<p class="ev-title">' + U.esc(displayTitle(ev)) + "</p>" +
        (ev.memo ? '<p class="ev-memo">' + U.esc(ev.memo) + "</p>" : "") +
      "</div>" +
      (isLesson
        ? '<button type="button" class="done-btn ' + (ev.done ? "on" : "") + '" data-done="' + ev.id + '">' +
            (ev.done ? UI.ICON.check + "<span>완료!</span>" : "<span>진행 완료</span>") + "</button>"
        : "") +
      "</li>";
    return html;
  }

  /* ---------- 날짜 탭 ---------- */
  function openDay(key) {
    var list = App.state.dayIndex[key] || [];
    if (!list.length) {
      openForm({ date: key });
      return;
    }
    var d = U.parseKey(key);
    UI.openSheet({
      title: U.fmtDateKo(d),
      className: "day-sheet",
      right: { label: "일정 추가", icon: UI.ICON.plus, onClick: function () { openForm({ date: key }); } },
      render: function (body, sheet) {
        draw(body);
        body.addEventListener("click", function (e) {
          var done = e.target.closest("[data-done]");
          if (done) {
            e.stopPropagation();
            var ev = findEvent(done.getAttribute("data-done"));
            if (ev) toggleDone(ev);
            return;
          }
          var card = e.target.closest(".ev-card");
          if (card) {
            var ev2 = findEvent(card.getAttribute("data-id"));
            if (ev2) openForm({ event: ev2 });
          }
        });
        body.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && e.target.classList.contains("ev-card")) e.target.click();
        });
      },
      onRefresh: function (sheet) {
        var now = App.state.dayIndex[key] || [];
        if (!now.length && UI.topSheet() === sheet) { UI.back(); return; }
        draw(sheet.body);
      }
    });

    function draw(body) {
      var items = App.state.dayIndex[key] || [];
      body.innerHTML = '<p class="day-count">일정 <b>' + items.length + "</b>개가 있어요</p>" +
        '<ul class="ev-list">' + items.map(eventCard).join("") + "</ul>" +
        '<img class="sheet-deco" src="' + U.IMG + 'peek.png" alt="">';
    }
  }

  function findEvent(id) {
    return App.state.events.filter(function (e) { return e.id === id; })[0] || null;
  }

  /* ---------- 진행 완료 ---------- */
  function toggleDone(ev) {
    var m = lessonMember(ev);
    if (!ev.done) {
      var updated = Object.assign({}, ev, { done: true, doneAt: new Date().toISOString() });
      return Store.saveEvent(updated).then(App.reload).then(function () {
        var mm = m ? App.state.memberMap[m.id] : null;
        var rest = mm ? U.remainingCount(mm, App.state.events) : null;
        Fun.cheer(mm ? mm.name + " 회원 남은 횟수 " + rest + "회" : "");
      }).catch(App.fail);
    }
    return UI.confirm({
      title: "진행 완료를 취소할까요?",
      message: (m ? m.name + " 회원의 " : "") + "남은 횟수가 1회 다시 늘어나요.",
      okText: "취소할래요",
      cancelText: "그대로 둘래요",
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var updated = Object.assign({}, ev, { done: false, doneAt: null });
      return Store.saveEvent(updated).then(App.reload).then(function () { UI.toast("진행 완료를 취소했어요"); });
    }).catch(App.fail);
  }

  /* ---------- 일정 입력/수정 ---------- */
  function defaultStart(dateKey) {
    var now = new Date();
    var h = Math.min(Math.max(now.getHours() + 1, 6), 22);
    return U.parseKey(dateKey, U.pad(h) + ":00");
  }

  function lessonTitle(m, start) {
    return m.name + " 회원 (" + U.fmtTimeKo(start) + ")";
  }

  /**
   * opts: { date: 'YYYY-MM-DD' } 새 일정 / { event } 수정
   */
  function openForm(opts) {
    var editing = !!opts.event;
    var src = opts.event || null;
    var start, end;
    if (editing) {
      start = U.parseDT(src.start);
      end = U.parseDT(src.end) || new Date(start.getTime() + 3600000);
    } else {
      start = defaultStart(opts.date || U.todayKey());
      end = new Date(start.getTime() + 3600000);
    }
    var st = {
      category: editing ? src.category : (opts.category || "normal"),
      memberId: editing ? src.memberId || null : opts.memberId || null,
      allDay: editing ? !!src.allDay : false,
      repeat: "none",
      repeatCount: 4,
      autoTitle: "",
      memberQuery: ""
    };
    if (!editing && (st.category === "duty" || st.category === "off")) st.allDay = true;

    UI.openSheet({
      title: editing ? "일정 확인" : "새 일정",
      tall: true,
      className: "form-sheet",
      right: { label: "저장", onClick: function (sheet) { save(sheet); } },
      render: function (body) {
        var catItems = U.CATEGORIES.map(function (c) { return { value: c.key, label: c.label, img: c.img }; });
        var sDate = U.dateKey(start), sTime = U.timeStr(start), eDate = U.dateKey(end), eTime = U.timeStr(end);
        var series = editing && src.seriesId ? App.state.events.filter(function (e) { return e.seriesId === src.seriesId; }) : [];
        body.innerHTML =
          '<form class="form" novalidate autocomplete="off">' +
            '<div class="field" data-field="category"><label class="lbl">분류</label>' +
              UI.chips("category", catItems, st.category) +
              '<p class="err" data-err="category"></p></div>' +

            '<div class="field member-field" data-field="member" hidden>' +
              '<label class="lbl" for="f-msearch">회원</label>' +
              '<div class="member-pick"></div>' +
              '<p class="err" data-err="member"></p></div>' +

            '<div class="field" data-field="title"><label class="lbl" for="f-title">제목</label>' +
              '<input id="f-title" class="input" name="title" maxlength="60" placeholder="어떤 일정인가요?" value="' + U.esc(editing ? src.title : "") + '">' +
              '<p class="err" data-err="title"></p></div>' +

            '<div class="field toggle-field"><label class="switch-row" for="f-allday"><span class="lbl-inline">하루 종일</span>' +
              '<input type="checkbox" id="f-allday" class="switch"' + (st.allDay ? " checked" : "") + "></label></div>" +

            '<div class="field" data-field="start"><label class="lbl">시작</label>' +
              '<div class="dt-row"><input type="date" class="input" id="f-sdate" value="' + sDate + '" aria-label="시작 날짜">' +
              timePickHtml("f-stime", sTime, "시작") + "</div>" +
              '<p class="err" data-err="start"></p></div>' +

            '<div class="field" data-field="end"><label class="lbl">끝</label>' +
              '<div class="dt-row"><input type="date" class="input" id="f-edate" value="' + eDate + '" aria-label="끝 날짜">' +
              timePickHtml("f-etime", eTime, "끝") + "</div>" +
              '<p class="err" data-err="end"></p></div>' +

            (editing
              ? (src.seriesId
                  ? '<div class="info-box">' + UI.ICON.repeat + '<span>반복 일정이에요 (' + (series.length) + "개 중 하나)</span></div>"
                  : "")
              : '<div class="field" data-field="repeat"><label class="lbl">반복</label>' +
                  UI.chips("repeat", REPEATS, "none") +
                  '<div class="repeat-more" hidden>' +
                    '<div class="stepper-row"><span>총</span>' +
                      '<button type="button" class="round-btn sm" data-step="-1" aria-label="횟수 줄이기">−</button>' +
                      '<input type="number" inputmode="numeric" class="input num-input" id="f-rcount" min="2" max="' + MAX_REPEAT + '" value="4" aria-label="반복 횟수">' +
                      '<button type="button" class="round-btn sm" data-step="1" aria-label="횟수 늘리기">+</button><span>번</span></div>' +
                    '<p class="hint repeat-preview"></p>' +
                  "</div>" +
                  '<p class="err" data-err="repeat"></p></div>') +

            '<div class="field"><label class="lbl" for="f-memo">메모 <small>(선택)</small></label>' +
              '<textarea id="f-memo" class="input" rows="3" maxlength="500" placeholder="잊지 말아야 할 것을 적어둬요">' + U.esc(editing ? src.memo || "" : "") + "</textarea></div>" +

            (editing
              ? '<div class="form-bottom">' +
                  (src.category === "lesson"
                    ? '<button type="button" class="btn ' + (src.done ? "soft" : "primary") + ' block" data-act="done">' + UI.ICON.check + "<span>" + (src.done ? "진행 완료 취소하기" : "진행 완료하기") + "</span></button>"
                    : "") +
                  '<button type="button" class="btn danger-soft block" data-act="delete">' + UI.ICON.trash + "<span>일정 삭제</span></button></div>"
              : "") +
          "</form>";

        bindForm(body);
      }
    });

    function q(body, sel) { return body.querySelector(sel); }

    function bindForm(body) {
      var form = q(body, "form");
      var titleIn = q(body, "#f-title");
      var allDayIn = q(body, "#f-allday");
      var sDate = q(body, "#f-sdate"), sTime = q(body, "#f-stime"), eDate = q(body, "#f-edate"), eTime = q(body, "#f-etime");
      var durationMs = end - start;

      form.addEventListener("submit", function (e) { e.preventDefault(); });

      bindTimePick(q(body, "#f-stime-wrap"));
      bindTimePick(q(body, "#f-etime-wrap"));

      // 수정할 때: 자동으로 들어갔던 제목이면 계속 자동으로 따라가게
      if (editing && src.category === "lesson" && src.memberId) {
        var m0 = App.state.memberMap[src.memberId];
        if (m0 && (titleIn.value === lessonTitle(m0, start) || titleIn.value === lessonTitle(m0, start) + " 수업")) {
          titleIn.value = lessonTitle(m0, start);
          st.autoTitle = titleIn.value;
        }
      }
      if (editing && (src.category === "duty" || src.category === "off") && titleIn.value === U.CAT_MAP[src.category].label) {
        st.autoTitle = titleIn.value;
      }

      function readStart() { return sDate.value ? U.parseKey(sDate.value, allDayIn.checked ? "00:00" : sTime.value || "00:00") : null; }
      function readEnd() { return eDate.value ? U.parseKey(eDate.value, allDayIn.checked ? "00:00" : eTime.value || "00:00") : null; }

      function applyAllDay() {
        form.classList.toggle("all-day", allDayIn.checked);
        q(body, "#f-stime-wrap").hidden = allDayIn.checked;
        q(body, "#f-etime-wrap").hidden = allDayIn.checked;
      }
      applyAllDay();

      /** 자동 제목: 수업 = "OOO 회원 (몇시) 수업", 당직/휴무 = 분류명 */
      function autoTitleFor() {
        if (st.category === "lesson" && st.memberId) {
          var m = App.state.memberMap[st.memberId];
          return m ? lessonTitle(m, readStart() || start) : "";
        }
        if (st.category === "duty" || st.category === "off") return U.CAT_MAP[st.category].label;
        return "";
      }
      function updateAutoTitle() {
        var t = autoTitleFor();
        // 사용자가 직접 고친 제목이면 건드리지 않아요 (그 제목 그대로 캘린더에 떠요)
        if (!titleIn.value.trim() || titleIn.value === st.autoTitle) {
          titleIn.value = t;
          if (t) UI.setError(body, "title", "");
        }
        st.autoTitle = t;
      }

      function syncEndFromStart() {
        var s = readStart();
        if (!s) return;
        var e = new Date(s.getTime() + Math.max(durationMs, 0));
        eDate.value = U.dateKey(e);
        if (!allDayIn.checked) setTimeVal(eTime, U.timeStr(e));
        UI.setError(body, "end", "");
      }
      function remember() {
        var s = readStart(), e = readEnd();
        if (s && e && e >= s) durationMs = e - s;
      }

      [sDate, sTime].forEach(function (inp) {
        inp.addEventListener("change", function () {
          UI.setError(body, "start", "");
          syncEndFromStart();
          updateAutoTitle();
          updateRepeatPreview();
        });
      });
      [eDate, eTime].forEach(function (inp) {
        inp.addEventListener("change", function () { UI.setError(body, "end", ""); remember(); });
      });
      allDayIn.addEventListener("change", function () {
        applyAllDay();
        if (allDayIn.checked) {
          durationMs = Math.max(0, U.startOfDay(readEnd() || start) - U.startOfDay(readStart() || start));
        } else {
          if (!sTime.value) setTimeVal(sTime, U.timeStr(defaultStart(sDate.value || U.todayKey())));
          var s = readStart();
          var e = readEnd();
          if (s && e && e <= s) {
            var ne = new Date(s.getTime() + 3600000);
            eDate.value = U.dateKey(ne);
            setTimeVal(eTime, U.timeStr(ne));
          }
          remember();
        }
        UI.setError(body, "end", "");
      });
      titleIn.addEventListener("input", function () { UI.setError(body, "title", ""); });

      UI.bindChips(body, "category", function (v) {
        var prev = st.category;
        st.category = v;
        UI.setError(body, "category", "");
        if (!editing || prev !== v) {
          var wantAllDay = v === "duty" || v === "off";
          var prevAllDay = prev === "duty" || prev === "off";
          if (wantAllDay !== prevAllDay && allDayIn.checked !== wantAllDay) {
            allDayIn.checked = wantAllDay;
            allDayIn.dispatchEvent(new Event("change"));
          }
        }
        renderMember();
        updateAutoTitle();
      });

      /* 반복 */
      var rCount = q(body, "#f-rcount");
      function updateRepeatPreview() {
        if (editing || !rCount) return;
        var more = q(body, ".repeat-more");
        more.hidden = st.repeat === "none";
        if (st.repeat === "none") return;
        var n = clampCount(rCount.value);
        var s = readStart();
        if (!s) { q(body, ".repeat-preview").textContent = ""; return; }
        var last = occurrenceStart(s, st.repeat, n - 1);
        q(body, ".repeat-preview").innerHTML = REPEAT_LABEL[st.repeat] + " 총 <b>" + n + "번</b>, 마지막 일정은 <b>" + U.fmtDateKo(last, last.getFullYear() !== s.getFullYear()) + "</b>이에요";
      }
      if (!editing) {
        UI.bindChips(body, "repeat", function (v) {
          st.repeat = v;
          if (v !== "none" && st.category === "lesson" && st.memberId && !rCount.dataset.touched) {
            var m = App.state.memberMap[st.memberId];
            var rest = m ? U.remainingCount(m, App.state.events) : 0;
            if (rest >= 2) rCount.value = Math.min(rest, MAX_REPEAT);
          }
          updateRepeatPreview();
        });
        rCount.addEventListener("input", function () { rCount.dataset.touched = "1"; updateRepeatPreview(); });
        rCount.addEventListener("blur", function () { rCount.value = clampCount(rCount.value); updateRepeatPreview(); });
        body.querySelectorAll("[data-step]").forEach(function (b) {
          b.addEventListener("click", function () {
            rCount.dataset.touched = "1";
            rCount.value = clampCount(Number(rCount.value || 0) + Number(b.getAttribute("data-step")));
            updateRepeatPreview();
          });
        });
      }

      /* 회원 선택 */
      function renderMember() {
        var field = q(body, ".member-field");
        var isLesson = st.category === "lesson";
        field.hidden = !isLesson;
        if (!isLesson) return;
        var box = q(body, ".member-pick");
        var members = App.state.members;
        if (!members.length) {
          box.innerHTML = '<div class="empty-mini"><img src="' + U.IMG + 'peek.png" alt=""><p>아직 등록된 회원이 없어요</p>' +
            '<button type="button" class="btn primary" data-act="goMember">' + UI.ICON.plus + "<span>회원 먼저 등록하기</span></button></div>";
          return;
        }
        var sel = st.memberId ? App.state.memberMap[st.memberId] : null;
        if (sel) {
          var rest = U.remainingCount(sel, App.state.events);
          box.innerHTML =
            '<div class="member-picked">' +
              '<div class="mp-head">' + Members.avatar(sel) + '<div><strong>' + U.esc(U.memberLabel(sel)) + "</strong>" +
                '<span class="muted">' + U.esc([sel.gender, goalText(sel)].filter(Boolean).join(" · ")) + "</span></div>" +
                '<button type="button" class="btn soft sm" data-act="changeMember">바꾸기</button></div>' +
              '<div class="mp-rest ' + (rest <= 0 ? "zero" : rest <= 3 ? "low" : "") + '">남은 횟수 <b>' + rest + "회</b></div>" +
              (rest <= 0 ? '<p class="warn">⚠️ 남은 횟수가 0회예요! 재등록이 필요한지 확인해 주세요. (저장은 할 수 있어요)</p>' : "") +
              '<div class="mp-note"><span class="mini-lbl">특이사항</span><p>' + (sel.note ? U.esc(sel.note) : '<span class="muted">적어둔 특이사항이 없어요</span>') + "</p></div>" +
            "</div>";
          return;
        }
        box.innerHTML =
          '<div class="search-box">' + UI.ICON.search +
            '<input id="f-msearch" class="input" type="search" placeholder="이름으로 찾기 (초성도 돼요)" value="' + U.esc(st.memberQuery) + '"></div>' +
          '<ul class="member-results"></ul>';
        var input = q(body, "#f-msearch");
        input.addEventListener("input", function () { st.memberQuery = input.value; drawResults(); });
        drawResults();
      }
      function drawResults() {
        var ul = q(body, ".member-results");
        if (!ul) return;
        var found = U.searchMembers(App.state.members, st.memberQuery.trim());
        if (!found.length) {
          ul.innerHTML = '<li class="no-result">"' + U.esc(st.memberQuery) + '"와(과) 비슷한 회원이 없어요</li>';
          return;
        }
        ul.innerHTML = found.map(function (m) {
          var rest = U.remainingCount(m, App.state.events);
          return '<li><button type="button" class="mr-item" data-mid="' + m.id + '">' +
            "<strong>" + U.esc(U.memberLabel(m)) + "</strong>" +
            '<span class="muted">' + U.esc(m.gender || "") + "</span>" +
            '<span class="rest-pill ' + (rest <= 0 ? "zero" : rest <= 3 ? "low" : "") + '">' + rest + "회 남음</span></button></li>";
        }).join("");
      }

      body.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var mid = b.getAttribute("data-mid");
        if (mid) {
          st.memberId = mid;
          UI.setError(body, "member", "");
          renderMember();
          updateAutoTitle();
          return;
        }
        var act = b.getAttribute("data-act");
        if (act === "changeMember") {
          st.memberId = null;
          st.memberQuery = "";
          renderMember();
          var si = q(body, "#f-msearch");
          if (si) si.focus();
        } else if (act === "goMember") {
          UI.closeAll().then(function () {
            App.switchTab("members");
            Members.openForm();
          });
        } else if (act === "delete") {
          removeEvent(src);
        } else if (act === "done") {
          var cur = findEvent(src.id);
          if (cur) toggleDone(cur).then(function () {
            var after = findEvent(src.id);
            if (after && !!after.done !== !!cur.done) UI.closeTop();
          });
        }
      });

      renderMember();
      updateRepeatPreview();
      if (!editing) updateAutoTitle();

      body._read = function () {
        return {
          title: titleIn.value.trim(),
          category: st.category,
          memberId: st.category === "lesson" ? st.memberId : null,
          allDay: allDayIn.checked,
          sDate: sDate.value, sTime: sTime.value, eDate: eDate.value, eTime: eTime.value,
          memo: q(body, "#f-memo").value.trim(),
          repeat: editing ? "none" : st.repeat,
          repeatCount: rCount ? clampCount(rCount.value) : 1
        };
      };
    }

    function validate(body, v) {
      UI.clearErrors(body);
      var ok = true;
      if (!v.category) { UI.setError(body, "category", "분류를 골라줘야 저장할 수 있어요"); ok = false; }
      if (v.category === "lesson" && !v.memberId) {
        UI.setError(body, "member", App.state.members.length ? "수업은 회원을 골라줘야 저장할 수 있어요" : "회원을 먼저 등록해야 수업을 저장할 수 있어요");
        ok = false;
      }
      if (!v.title) { UI.setError(body, "title", "제목을 적어줘야 저장할 수 있어요"); ok = false; }
      if (!v.sDate || (!v.allDay && !v.sTime)) { UI.setError(body, "start", "시작 날짜와 시간을 정해줘야 저장할 수 있어요"); ok = false; }
      if (!v.eDate || (!v.allDay && !v.eTime)) { UI.setError(body, "end", "끝 날짜와 시간을 정해줘야 저장할 수 있어요"); ok = false; }
      if (ok) {
        var s = U.parseKey(v.sDate, v.allDay ? "00:00" : v.sTime);
        var e = U.parseKey(v.eDate, v.allDay ? "00:00" : v.eTime);
        if (e < s) { UI.setError(body, "end", "끝나는 때가 시작보다 빨라요! 다시 확인해 줄래요?"); ok = false; }
      }
      return ok;
    }

    function save(sheet) {
      var body = sheet.body;
      var v = body._read();
      if (!validate(body, v)) { UI.scrollToFirstError(body); return; }
      sheet.setRightBusy(true, "저장중..");

      var startStr = v.sDate + "T" + (v.allDay ? "00:00" : v.sTime);
      var endStr = v.eDate + "T" + (v.allDay ? "23:59" : v.eTime);
      var base = {
        title: v.title,
        category: v.category,
        memberId: v.memberId,
        allDay: v.allDay,
        start: startStr,
        end: endStr,
        memo: v.memo
      };

      var job;
      if (!editing) {
        base.done = false;
        if (v.repeat === "none") {
          job = Store.saveEvent(base);
        } else {
          var seriesId = Store.newId("sr");
          var s0 = U.parseDT(startStr), e0 = U.parseDT(endStr);
          var dur = e0 - s0;
          var list = [];
          for (var i = 0; i < v.repeatCount; i++) {
            var si = occurrenceStart(s0, v.repeat, i);
            var ei = new Date(si.getTime() + dur);
            list.push(Object.assign({}, base, {
              start: U.toDT(si),
              end: v.allDay ? U.dateKey(ei) + "T23:59" : U.toDT(ei),
              seriesId: seriesId,
              seriesIndex: i + 1,
              repeat: { freq: v.repeat, count: v.repeatCount }
            }));
          }
          job = Store.saveEvents(list);
        }
      } else {
        job = saveEdit(base);
      }

      Promise.resolve(job)
        .then(function (res) {
          if (res === "cancel") { sheet.setRightBusy(false); return; }
          return App.reload().then(function () { return UI.closeAll(); }).then(function () {
            UI.toast(editing ? "수정했어요! ☁️" : "일정을 저장했어요! ☁️");
            Calendar.flashDate(v.sDate);
          });
        })
        .catch(function (err) {
          sheet.setRightBusy(false);
          App.fail(err);
        });
    }

    /** 수정 저장 — 반복 일정이면 이후 일정까지 바꿀지 물어봐요 */
    function saveEdit(base) {
      var cur = findEvent(src.id) || src;
      var later = cur.seriesId
        ? App.state.events.filter(function (e) { return e.seriesId === cur.seriesId && e.id !== cur.id && e.start > cur.start; })
        : [];
      var ask = later.length
        ? UI.choose({
            title: "반복 일정이에요",
            message: "이후에 등록된 일정 " + later.length + "개도 같이 바꿀까요?",
            options: [
              { label: "이 일정만 바꾸기", value: "one", primary: true },
              { label: "이 일정과 이후 일정 모두 바꾸기", value: "after" },
              { label: "취소", value: null }
            ]
          })
        : Promise.resolve("one");
      return ask.then(function (mode) {
        if (!mode) return "cancel";
        var updated = Object.assign({}, cur, base);
        if (mode === "one") return Store.saveEvent(updated);
        // 이후 일정: 시작 이동량과 길이를 똑같이 적용, 진행 여부는 유지
        var oldS = U.parseDT(cur.start);
        var newS = U.parseDT(updated.start);
        var dayShift = Math.round((U.startOfDay(newS) - U.startOfDay(oldS)) / 86400000);
        var dur = U.parseDT(updated.end) - newS;
        var list = [updated].concat(later.map(function (e) {
          var es = U.parseDT(e.start);
          var ns = U.addDays(new Date(es.getFullYear(), es.getMonth(), es.getDate(), newS.getHours(), newS.getMinutes()), dayShift);
          var ne = new Date(ns.getTime() + dur);
          var title = base.title;
          if (base.category === "lesson" && base.memberId) {
            var m = App.state.memberMap[base.memberId];
            if (m && base.title === lessonTitle(m, newS)) title = lessonTitle(m, ns);
          }
          return Object.assign({}, e, {
            title: title,
            category: base.category,
            memberId: base.memberId,
            allDay: base.allDay,
            memo: base.memo,
            start: U.toDT(ns),
            end: base.allDay ? U.dateKey(ne) + "T23:59" : U.toDT(ne)
          });
        }));
        return Store.saveEvents(list);
      });
    }
  }

  /* ---------- 시간 선택 (5분 단위) ---------- */
  function hourLabel(h) {
    return (h < 12 ? "오전 " : "오후 ") + (h % 12 === 0 ? 12 : h % 12) + "시";
  }
  function timePickHtml(id, value, label) {
    var hours = "";
    for (var h = 0; h < 24; h++) hours += '<option value="' + h + '">' + hourLabel(h) + "</option>";
    var mins = "";
    for (var m = 0; m < 60; m += 5) mins += '<option value="' + m + '">' + U.pad(m) + "분</option>";
    return '<div class="time-pick" id="' + id + '-wrap">' +
      '<select class="input tp-h" aria-label="' + label + ' 시">' + hours + "</select>" +
      '<select class="input tp-m" aria-label="' + label + ' 분">' + mins + "</select>" +
      '<input type="hidden" id="' + id + '" value="' + U.esc(value) + '"></div>';
  }
  /** 숨은 값(HH:mm)을 바꾸고 선택 상자도 맞춰요 */
  function setTimeVal(hidden, v) {
    hidden.value = v;
    var wrap = hidden.parentNode;
    var p = (v || "00:00").split(":").map(Number);
    var mSel = wrap.querySelector(".tp-m");
    // 예전에 저장된 5분 단위가 아닌 시간도 그대로 보여줘요
    if (!mSel.querySelector('option[value="' + p[1] + '"]')) {
      var o = document.createElement("option");
      o.value = p[1];
      o.textContent = U.pad(p[1]) + "분";
      var after = Array.prototype.find.call(mSel.options, function (x) { return Number(x.value) > p[1]; });
      mSel.insertBefore(o, after || null);
    }
    wrap.querySelector(".tp-h").value = String(p[0]);
    mSel.value = String(p[1]);
  }
  function bindTimePick(wrap) {
    var hidden = wrap.querySelector('input[type="hidden"]');
    setTimeVal(hidden, hidden.value);
    wrap.addEventListener("change", function (e) {
      if (e.target === hidden) return;
      hidden.value = U.pad(Number(wrap.querySelector(".tp-h").value)) + ":" + U.pad(Number(wrap.querySelector(".tp-m").value));
      hidden.dispatchEvent(new Event("change"));
    });
  }

  function clampCount(v) {
    var n = Math.round(Number(v));
    if (!isFinite(n) || n < 2) n = 2;
    if (n > MAX_REPEAT) n = MAX_REPEAT;
    return n;
  }

  function occurrenceStart(s0, freq, i) {
    if (freq === "daily") return U.addDays(s0, i);
    if (freq === "weekly") return U.addDays(s0, i * 7);
    if (freq === "biweekly") return U.addDays(s0, i * 14);
    if (freq === "monthly") return U.addMonthsClamp(s0, i);
    return s0;
  }

  function goalText(m) {
    if (!m.goal) return "";
    return m.goal === "기타" ? (m.goalEtc || "기타") : m.goal;
  }

  /* ---------- 삭제 ---------- */
  function removeEvent(ev) {
    var cur = findEvent(ev.id) || ev;
    var series = cur.seriesId ? App.state.events.filter(function (e) { return e.seriesId === cur.seriesId; }) : [];
    var later = series.filter(function (e) { return e.id !== cur.id && e.start > cur.start; });
    var ask;
    if (series.length > 1) {
      var opts = [{ label: "이 일정만 삭제", value: "one", danger: true }];
      if (later.length) opts.push({ label: "이 일정과 이후 일정 " + later.length + "개 삭제", value: "after", danger: true });
      opts.push({ label: "반복 일정 전체(" + series.length + "개) 삭제", value: "all", danger: true });
      opts.push({ label: "취소", value: null });
      ask = UI.choose({
        title: "반복 일정을 삭제할까요?",
        message: "이후에 등록된 일정은 어떻게 할까요?",
        img: U.IMG + "lying.png",
        options: opts
      });
    } else {
      ask = UI.confirm({
        title: "일정을 삭제할까요?",
        message: "\"" + cur.title + "\"\n삭제하면 되돌릴 수 없어요.",
        okText: "삭제할래요",
        cancelText: "아니요",
        danger: true,
        img: U.IMG + "lying.png"
      }).then(function (ok) { return ok ? "one" : null; });
    }
    return ask.then(function (mode) {
      if (!mode) return;
      var ids = mode === "one" ? [cur.id]
        : mode === "after" ? [cur.id].concat(later.map(function (e) { return e.id; }))
        : series.map(function (e) { return e.id; });
      var hadDone = series.length
        ? series.filter(function (e) { return ids.indexOf(e.id) >= 0 && e.done; }).length
        : (cur.done ? 1 : 0);
      return Store.deleteEvents(ids).then(App.reload).then(function () { return UI.closeAll(); }).then(function () {
        UI.toast(ids.length > 1 ? "일정 " + ids.length + "개를 삭제했어요" : "일정을 삭제했어요");
        if (hadDone) setTimeout(function () { UI.toast("완료했던 수업이 지워져서 남은 횟수가 다시 계산됐어요"); }, 2100);
      });
    }).catch(App.fail);
  }

  window.Events = {
    openDay: openDay,
    openForm: openForm,
    toggleDone: toggleDone,
    eventCard: eventCard,
    findEvent: findEvent,
    goalText: goalText
  };
})();

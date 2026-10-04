/* members.js — 회원 목록, 등록/수정, 상세(횟수 추가·수업 이력), 삭제 */
(function () {
  "use strict";

  var query = "";
  var listEl, searchEl;

  function restClass(rest) { return rest <= 0 ? "zero" : rest <= 3 ? "low" : ""; }

  /* ---------- 시나모롤 프로필 (여: 리본 / 남: 나비넥타이) ---------- */
  var RIBBON =
    '<svg class="acc ribbon" viewBox="0 0 40 32" aria-hidden="true">' +
      '<path d="M18 17l-5 12 4-1.5 2 3.5 2-12z" fill="#FFB7CC" stroke="#8E6A4C" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M22 17l5 12-4-1.5-2 3.5-2-12z" fill="#FFB7CC" stroke="#8E6A4C" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M20 14C14 2 2 3 3 12s12 8 17 4z" fill="#FFC9D9" stroke="#8E6A4C" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M20 14C26 2 38 3 37 12s-12 8-17 4z" fill="#FFC9D9" stroke="#8E6A4C" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M8 10c2-2 5-2 7 0M25 10c2-2 5-2 7 0" fill="none" stroke="#FF9FBA" stroke-width="1.4" stroke-linecap="round"/>' +
      '<ellipse cx="20" cy="15" rx="4.2" ry="4.6" fill="#FF9FBA" stroke="#8E6A4C" stroke-width="1.6"/>' +
    "</svg>";
  var BOWTIE =
    '<svg class="acc bowtie" viewBox="0 0 40 22" aria-hidden="true">' +
      '<path d="M18 11L5 3.5Q1.5 11 5 18.5z" fill="#9CCDF2" stroke="#6B5440" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M22 11L35 3.5Q38.5 11 35 18.5z" fill="#9CCDF2" stroke="#6B5440" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<rect x="16.5" y="6.5" width="7" height="9" rx="3" fill="#7DB9E8" stroke="#6B5440" stroke-width="1.6"/>' +
      '<circle cx="8.5" cy="9" r="1.2" fill="#fff"/><circle cx="31.5" cy="13" r="1.2" fill="#fff"/>' +
    "</svg>";

  function avatar(m, size) {
    var g = m && m.gender === "여" ? "girl" : m && m.gender === "남" ? "boy" : "";
    return '<span class="cin-avatar ' + g + " " + (size || "") + '" aria-hidden="true">' +
      '<img src="' + U.IMG + 'face.png" alt="">' + (g === "girl" ? RIBBON : g === "boy" ? BOWTIE : "") + "</span>";
  }

  /* ---------- 목록 ---------- */
  function renderList() {
    if (!listEl) return;
    var members = App.state.members.slice();
    var events = App.state.events;
    var shown = query.trim()
      ? U.searchMembers(members, query.trim())
      : members.sort(function (a, b) { return a.name.localeCompare(b.name, "ko") || a.birthYear - b.birthYear; });

    document.getElementById("member-count").textContent = members.length ? "총 " + members.length + "명" : "";

    if (!members.length) {
      listEl.innerHTML =
        '<li class="empty-state"><img src="' + U.IMG + 'lying.png" alt="">' +
        "<p><b>아직 등록된 회원이 없어요</b><br>첫 회원을 등록해 볼까요?</p>" +
        '<button type="button" class="btn primary" data-act="new">' + UI.ICON.plus + "<span>회원 등록하기</span></button></li>";
      return;
    }
    if (!shown.length) {
      listEl.innerHTML = '<li class="empty-state small"><img src="' + U.IMG + 'peek.png" alt=""><p>"' + U.esc(query) + '"와(과) 비슷한 회원이 없어요</p></li>';
      return;
    }
    listEl.innerHTML = shown.map(function (m) {
      var rest = U.remainingCount(m, events);
      return '<li><button type="button" class="member-card ' + (rest <= 3 ? "alert" : "") + '" data-mid="' + m.id + '">' +
        avatar(m) +
        '<span class="mc-main"><strong>' + U.esc(U.memberLabel(m)) + "</strong>" +
          '<span class="muted">' + U.esc([m.gender || "성별 미입력", Events.goalText(m)].filter(Boolean).join(" · ")) + "</span></span>" +
        '<span class="rest-pill ' + restClass(rest) + '">' + (rest <= 3 ? "⚠️ " : "") + "남은 <b>" + rest + "</b>회</span>" +
        "</button></li>";
    }).join("");
  }

  /* ---------- 등록/수정 ---------- */
  function openForm(member) {
    var editing = !!member;
    var m = member || {};
    var goal = m.goal || "";
    var gender = m.gender || "";
    var firstPkg = editing && m.packages && m.packages[0] ? m.packages[0] : null;
    var initialAge = editing ? U.ageOf(m) : "";

    UI.openSheet({
      title: editing ? "회원 정보 수정" : "회원 등록",
      tall: true,
      className: "form-sheet",
      right: { label: "저장", onClick: save },
      render: function (body) {
        body.innerHTML =
          '<form class="form" novalidate autocomplete="off">' +
            (editing ? "" : '<div class="form-hello"><img src="' + U.IMG + 'ears.png" alt=""><p>새 회원님을 소개해 주세요!</p></div>') +
            '<div class="field"><label class="lbl" for="m-name">이름 <em>*</em></label>' +
              '<input id="m-name" class="input" maxlength="20" placeholder="예: 김민지" value="' + U.esc(m.name || "") + '">' +
              '<p class="err" data-err="name"></p><p class="hint same-name" hidden></p></div>' +
            '<div class="field"><label class="lbl">성별</label>' +
              UI.chips("gender", [{ value: "여", label: "여" }, { value: "남", label: "남" }], gender) + "</div>" +
            '<div class="row2">' +
              '<div class="field"><label class="lbl" for="m-age">나이 <em>*</em></label>' +
                '<div class="unit-input"><input id="m-age" class="input" type="number" inputmode="numeric" min="1" max="120" placeholder="30" value="' + initialAge + '"><span>세</span></div>' +
                '<p class="err" data-err="age"></p></div>' +
              '<div class="field"><label class="lbl" for="m-count">' + (editing ? "처음 등록 횟수" : "등록 횟수") + ' <em>*</em></label>' +
                '<div class="unit-input"><input id="m-count" class="input" type="number" inputmode="numeric" min="' + (editing ? 0 : 1) + '" max="999" placeholder="10" value="' + (firstPkg ? firstPkg.count : "") + '"><span>회</span></div>' +
                '<p class="err" data-err="count"></p></div>' +
            "</div>" +
            (editing && m.packages && m.packages.length > 1 ? '<p class="hint">추가한 횟수는 회원 상세에서 확인할 수 있어요</p>' : "") +
            '<div class="field"><label class="lbl">운동 목적</label>' +
              UI.chips("goal", U.GOALS.map(function (g) { return { value: g, label: g }; }), goal) +
              '<input id="m-goal-etc" class="input goal-etc" maxlength="30" placeholder="어떤 목적인지 적어주세요" value="' + U.esc(m.goalEtc || "") + '"' + (goal === "기타" ? "" : " hidden") + "></div>" +
            '<div class="field"><label class="lbl" for="m-note">특이사항</label>' +
              '<textarea id="m-note" class="input" rows="3" maxlength="500" placeholder="부상, 통증, 주의할 점 등">' + U.esc(m.note || "") + "</textarea></div>" +
            '<div class="field"><label class="lbl" for="m-memo">메모</label>' +
              '<textarea id="m-memo" class="input" rows="3" maxlength="500" placeholder="자유롭게 적어두세요">' + U.esc(m.memo || "") + "</textarea></div>" +
          "</form>";

        var nameIn = body.querySelector("#m-name");
        var sameHint = body.querySelector(".same-name");
        body.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); });
        nameIn.addEventListener("input", function () {
          UI.setError(body, "name", "");
          var n = nameIn.value.trim();
          var same = App.state.members.filter(function (x) { return x.name === n && x.id !== m.id; });
          sameHint.hidden = !same.length;
          if (same.length) {
            sameHint.textContent = "같은 이름의 회원이 있어요: " + same.map(U.memberLabel).join(", ") + " — 나이로 구분해서 보여드릴게요!";
          }
        });
        body.querySelector("#m-age").addEventListener("input", function () { UI.setError(body, "age", ""); });
        body.querySelector("#m-count").addEventListener("input", function () { UI.setError(body, "count", ""); });
        UI.bindChips(body, "gender", function (v) {
          if (gender === v) { gender = ""; UI.setChip(body, "gender", ""); } else gender = v;
        });
        UI.bindChips(body, "goal", function (v) {
          if (goal === v) { goal = ""; UI.setChip(body, "goal", ""); } else goal = v;
          var etc = body.querySelector("#m-goal-etc");
          etc.hidden = goal !== "기타";
          if (!etc.hidden) etc.focus();
        });
      }
    });

    function save(sheet) {
      var body = sheet.body;
      UI.clearErrors(body);
      var name = body.querySelector("#m-name").value.trim();
      var ageRaw = body.querySelector("#m-age").value.trim();
      var countRaw = body.querySelector("#m-count").value.trim();
      var age = Number(ageRaw);
      var count = Number(countRaw);
      var ok = true;
      if (!name) { UI.setError(body, "name", "이름을 적어줘야 저장할 수 있어요"); ok = false; }
      if (!ageRaw) { UI.setError(body, "age", "나이를 적어줘야 저장할 수 있어요"); ok = false; }
      else if (!Number.isInteger(age) || age < 1 || age > 120) { UI.setError(body, "age", "나이를 다시 확인해 줄래요? (1~120)"); ok = false; }
      if (!countRaw) { UI.setError(body, "count", "등록 횟수를 적어줘야 저장할 수 있어요"); ok = false; }
      else if (!Number.isInteger(count) || count < (editing ? 0 : 1) || count > 999) {
        UI.setError(body, "count", editing ? "0~999 사이 숫자로 적어주세요" : "1~999 사이 숫자로 적어주세요");
        ok = false;
      }
      if (!ok) { UI.scrollToFirstError(body); return; }

      sheet.setRightBusy(true, "저장중..");
      var data = Object.assign({}, m, {
        name: name,
        gender: gender,
        goal: goal,
        goalEtc: goal === "기타" ? body.querySelector("#m-goal-etc").value.trim() : "",
        note: body.querySelector("#m-note").value.trim(),
        memo: body.querySelector("#m-memo").value.trim()
      });
      // 나이 → 출생연도 (나이를 바꾼 경우에만 다시 계산)
      if (!editing || age !== initialAge) data.birthYear = U.birthYearFromAge(age);
      var pkgs = (m.packages || []).map(function (p) { return Object.assign({}, p); });
      if (!pkgs.length) pkgs.push({ id: Store.newId("pk"), count: count, date: U.todayKey(), note: "처음 등록" });
      else pkgs[0].count = count;
      data.packages = pkgs;

      Store.saveMember(data)
        .then(function (saved) {
          return App.reload().then(function () { return UI.closeTop(); }).then(function () {
            UI.toast(editing ? "회원 정보를 수정했어요" : saved.name + " 회원을 등록했어요! 🐾");
          });
        })
        .catch(function (err) { sheet.setRightBusy(false); App.fail(err); });
    }
  }

  /* ---------- 상세 ---------- */
  function openDetail(id) {
    var m0 = App.state.memberMap[id];
    if (!m0) return;
    UI.openSheet({
      title: m0.name + " 회원",
      tall: true,
      className: "detail-sheet",
      right: { label: "수정", icon: UI.ICON.edit, primary: false, onClick: function () {
        var cur = App.state.memberMap[id];
        if (cur) openForm(cur);
      } },
      render: function (body, sheet) {
        draw(sheet);
        body.addEventListener("click", function (e) {
          var b = e.target.closest("button");
          if (!b) return;
          var act = b.getAttribute("data-act");
          var mm = App.state.memberMap[id];
          if (!mm) return;
          if (act === "addCount") openAddCount(mm);
          else if (act === "delete") removeMember(mm);
          else if (act === "addLesson") Events.openForm({ date: U.todayKey(), category: "lesson", memberId: mm.id });
          else if (b.hasAttribute("data-done")) {
            var ev = Events.findEvent(b.getAttribute("data-done"));
            if (ev) Events.toggleDone(ev);
          } else if (b.hasAttribute("data-open")) {
            var ev2 = Events.findEvent(b.getAttribute("data-open"));
            if (ev2) Events.openForm({ event: ev2 });
          } else if (b.hasAttribute("data-filter")) {
            sheet._filter = b.getAttribute("data-filter");
            draw(sheet);
          }
        });
      },
      onRefresh: function (sheet) {
        if (!App.state.memberMap[id]) return;
        draw(sheet);
      }
    });

    function draw(sheet) {
      var m = App.state.memberMap[id];
      if (!m) return;
      sheet.setTitle(m.name + " 회원");
      var events = App.state.events;
      var total = U.totalCount(m);
      var done = U.doneCount(m, events);
      var rest = total - done;
      var now = new Date();
      var lessons = events
        .filter(function (e) { return e.category === "lesson" && e.memberId === m.id; })
        .sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
      var counts = { all: lessons.length, planned: 0, done: 0, unchecked: 0 };
      lessons.forEach(function (e) { counts[U.lessonStatus(e, now)]++; });
      var filter = sheet._filter || "all";
      var shown = filter === "all" ? lessons : lessons.filter(function (e) { return U.lessonStatus(e, now) === filter; });
      var STATUS = { done: "완료", planned: "예정", unchecked: "미체크" };

      var pkgs = (m.packages || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });

      sheet.body.innerHTML =
        '<div class="profile">' +
          avatar(m, "lg") +
          '<div><h3>' + U.esc(U.memberLabel(m)) + "</h3>" +
          '<p class="muted">' + U.esc([m.gender, Events.goalText(m) ? "목적: " + Events.goalText(m) : ""].filter(Boolean).join(" · ") || "추가 정보 없음") + "</p>" +
          '<p class="muted tiny">' + m.birthYear + "년생</p></div>" +
        "</div>" +
        '<div class="stats">' +
          '<div><span>총 등록</span><b>' + total + "</b></div>" +
          '<div><span>진행</span><b>' + done + "</b></div>" +
          '<div class="' + restClass(rest) + '"><span>남은 횟수</span><b>' + rest + "</b></div>" +
        "</div>" +
        (rest <= 0 ? '<p class="warn">⚠️ 남은 횟수가 없어요! 재등록하면 [횟수 추가]를 눌러주세요.</p>'
          : rest <= 3 ? '<p class="warn soft">남은 횟수가 ' + rest + "회밖에 안 남았어요. 재등록 이야기를 해볼까요?</p>" : "") +
        '<div class="btn-row">' +
          '<button type="button" class="btn primary" data-act="addCount">' + UI.ICON.plusCircle + "<span>횟수 추가</span></button>" +
          '<button type="button" class="btn soft" data-act="addLesson">' + UI.ICON.calendar + "<span>수업 잡기</span></button>" +
        "</div>" +

        (m.note ? '<div class="note-box"><span class="mini-lbl">특이사항</span><p>' + U.esc(m.note) + "</p></div>" : "") +
        (m.memo ? '<div class="note-box memo"><span class="mini-lbl">메모</span><p>' + U.esc(m.memo) + "</p></div>" : "") +

        '<h4 class="sec-title">등록 이력</h4>' +
        '<ul class="pkg-list">' + pkgs.map(function (p, i) {
          return "<li><span>" + U.fmtShortDate(U.parseKey(p.date)) + "</span><b>+" + p.count + "회</b><span class=\"muted\">" +
            U.esc(p.note || (i === 0 ? "처음 등록" : "재등록")) + "</span></li>";
        }).join("") + "</ul>" +

        '<h4 class="sec-title">수업 이력 <small>' + lessons.length + "개</small></h4>" +
        '<div class="filter-chips">' +
          [["all", "전체"], ["planned", "예정"], ["unchecked", "미체크"], ["done", "완료"]].map(function (f) {
            return '<button type="button" class="fchip ' + (filter === f[0] ? "on" : "") + '" data-filter="' + f[0] + '">' + f[1] + " " + counts[f[0]] + "</button>";
          }).join("") +
        "</div>" +
        (shown.length
          ? '<ul class="lesson-list">' + shown.map(function (e) {
              var s = U.parseDT(e.start);
              var stt = U.lessonStatus(e, now);
              return '<li class="lesson st-' + stt + '">' +
                '<button type="button" class="ls-main" data-open="' + e.id + '">' +
                  '<span class="ls-date">' + U.fmtDateKo(s, s.getFullYear() !== now.getFullYear()) + "</span>" +
                  '<span class="ls-time">' + (e.allDay ? "하루 종일" : U.timeStr(s)) + "</span>" +
                  '<span class="st-tag ' + stt + '">' + STATUS[stt] + "</span>" +
                "</button>" +
                '<button type="button" class="check-btn ' + (e.done ? "on" : "") + '" data-done="' + e.id + '" aria-label="' + (e.done ? "진행 완료 취소" : "진행 완료") + '">' + UI.ICON.check + "</button>" +
              "</li>";
            }).join("") + "</ul>"
          : '<div class="empty-mini"><img src="' + U.IMG + 'peek.png" alt=""><p>' + (lessons.length ? "해당하는 수업이 없어요" : "아직 잡힌 수업이 없어요") + "</p></div>") +

        '<button type="button" class="btn danger-soft block mt" data-act="delete">' + UI.ICON.trash + "<span>회원 삭제</span></button>";
    }
  }

  /* ---------- 횟수 추가 ---------- */
  function openAddCount(m) {
    UI.openSheet({
      title: "횟수 추가",
      right: { label: "추가", onClick: function (sheet) {
        var body = sheet.body;
        UI.clearErrors(body);
        var raw = body.querySelector("#a-count").value.trim();
        var n = Number(raw);
        var date = body.querySelector("#a-date").value;
        var ok = true;
        if (!raw) { UI.setError(body, "count", "추가할 횟수를 적어줘야 저장할 수 있어요"); ok = false; }
        else if (!Number.isInteger(n) || n < 1 || n > 999) { UI.setError(body, "count", "1~999 사이 숫자로 적어주세요"); ok = false; }
        if (!date) { UI.setError(body, "date", "날짜를 정해줘야 저장할 수 있어요"); ok = false; }
        if (!ok) { UI.scrollToFirstError(body); return; }
        sheet.setRightBusy(true, "저장중..");
        var cur = App.state.memberMap[m.id] || m;
        var data = Object.assign({}, cur, {
          packages: (cur.packages || []).concat([{ id: Store.newId("pk"), count: n, date: date, note: body.querySelector("#a-note").value.trim() || "재등록" }])
        });
        Store.saveMember(data).then(App.reload).then(function () { return UI.closeTop(); }).then(function () {
          UI.toast(n + "회 추가했어요! 남은 횟수 " + U.remainingCount(App.state.memberMap[m.id], App.state.events) + "회");
        }).catch(function (err) { sheet.setRightBusy(false); App.fail(err); });
      } },
      render: function (body) {
        body.innerHTML =
          '<form class="form" novalidate>' +
            '<div class="form-hello"><img src="' + U.IMG + 'wave.png" alt=""><p>' + U.esc(m.name) + " 회원 재등록 축하해요!</p></div>" +
            '<div class="quick-counts">' + [5, 10, 20, 30].map(function (n) {
              return '<button type="button" class="fchip" data-q="' + n + '">' + n + "회</button>";
            }).join("") + "</div>" +
            '<div class="row2">' +
              '<div class="field"><label class="lbl" for="a-count">추가 횟수 <em>*</em></label>' +
                '<div class="unit-input"><input id="a-count" class="input" type="number" inputmode="numeric" min="1" max="999" value="10"><span>회</span></div>' +
                '<p class="err" data-err="count"></p></div>' +
              '<div class="field"><label class="lbl" for="a-date">날짜 <em>*</em></label>' +
                '<input id="a-date" class="input" type="date" value="' + U.todayKey() + '">' +
                '<p class="err" data-err="date"></p></div>' +
            "</div>" +
            '<div class="field"><label class="lbl" for="a-note">메모 <small>(선택)</small></label>' +
              '<input id="a-note" class="input" maxlength="40" placeholder="예: 10회 재등록"></div>' +
          "</form>";
        body.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); });
        body.querySelectorAll("[data-q]").forEach(function (b) {
          b.addEventListener("click", function () {
            body.querySelector("#a-count").value = b.getAttribute("data-q");
            UI.setError(body, "count", "");
          });
        });
      }
    });
  }

  /* ---------- 삭제 ---------- */
  function removeMember(m) {
    var linked = App.state.events.filter(function (e) { return e.memberId === m.id; });
    var ask;
    if (linked.length) {
      ask = UI.choose({
        title: m.name + " 회원을 삭제할까요?",
        message: "연결된 수업 일정이 " + linked.length + "개 있어요.\n수업 일정은 어떻게 할까요?",
        img: U.IMG + "lying.png",
        options: [
          { label: "수업 일정도 함께 삭제", value: "withEvents", danger: true },
          { label: "일정은 남기고 일반 일정으로 바꾸기", value: "keepEvents" },
          { label: "취소", value: null }
        ]
      });
    } else {
      ask = UI.confirm({
        title: m.name + " 회원을 삭제할까요?",
        message: "삭제하면 되돌릴 수 없어요.",
        okText: "삭제할래요",
        danger: true,
        img: U.IMG + "lying.png"
      }).then(function (ok) { return ok ? "only" : null; });
    }
    ask.then(function (mode) {
      if (!mode) return;
      var job;
      if (mode === "withEvents") {
        job = Store.deleteEvents(linked.map(function (e) { return e.id; }));
      } else if (mode === "keepEvents") {
        job = Store.saveEvents(linked.map(function (e) {
          return Object.assign({}, e, {
            category: "normal",
            memberId: null,
            memo: [e.memo, "(삭제된 회원: " + U.memberLabel(m) + ")"].filter(Boolean).join("\n")
          });
        }));
      } else job = Promise.resolve();
      return job.then(function () { return Store.deleteMember(m.id); })
        .then(App.reload)
        .then(function () { return UI.closeAll(); })
        .then(function () { UI.toast(m.name + " 회원을 삭제했어요"); });
    }).catch(App.fail);
  }

  function init() {
    listEl = document.getElementById("member-list");
    searchEl = document.getElementById("member-search");
    searchEl.addEventListener("input", function () { query = searchEl.value; renderList(); });
    document.getElementById("member-add").addEventListener("click", function () { openForm(); });
    listEl.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.getAttribute("data-act") === "new") { openForm(); return; }
      var mid = b.getAttribute("data-mid");
      if (mid) openDetail(mid);
    });
  }

  window.Members = {
    init: init,
    renderList: renderList,
    openForm: openForm,
    openDetail: openDetail,
    avatar: avatar
  };
})();

/* utils.js — 날짜/나이/분류/검색 같은 순수 계산 함수 모음 (저장은 하지 않아요) */
(function () {
  "use strict";

  var IMG = "icons/app/";

  // 우선순위: 숫자가 클수록 높음 (중요 > 수업 > 당직 > 휴무 > 일반)
  var CATEGORIES = [
    { key: "normal", label: "일반", img: IMG + "face.png", color: "var(--cat-normal)", priority: 1 },
    { key: "important", label: "중요", img: IMG + "important.png", color: "var(--cat-important)", priority: 5 },
    { key: "lesson", label: "수업", img: IMG + "lesson.png", color: "var(--cat-lesson)", priority: 4 },
    { key: "duty", label: "당직", img: IMG + "duty.png", color: "var(--cat-duty)", priority: 3 },
    { key: "off", label: "휴무", img: IMG + "off.png", color: "var(--cat-off)", priority: 2 }
  ];
  var CAT_MAP = {};
  CATEGORIES.forEach(function (c) { CAT_MAP[c.key] = c; });

  var GOALS = ["다이어트", "건강", "대회준비", "재활", "기타"];
  var WEEK = ["일", "월", "화", "수", "목", "금", "토"];

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /** Date → 'YYYY-MM-DD' (로컬 기준) */
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  /** Date → 'HH:mm' */
  function timeStr(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  /** 'YYYY-MM-DD' (+ 'HH:mm') → Date (로컬) */
  function parseKey(key, time) {
    var p = key.split("-").map(Number);
    var t = (time || "00:00").split(":").map(Number);
    return new Date(p[0], p[1] - 1, p[2], t[0] || 0, t[1] || 0, 0, 0);
  }
  /** 'YYYY-MM-DDTHH:mm' → Date */
  function parseDT(s) {
    if (!s) return null;
    var parts = s.split("T");
    return parseKey(parts[0], parts[1]);
  }
  function toDT(d) { return dateKey(d) + "T" + timeStr(d); }
  function todayKey() { return dateKey(new Date()); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function addMonthsClamp(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
    var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(d.getDate(), last));
    return x;
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /** 'M월 D일 (요일)' */
  function fmtDateKo(d, withYear) {
    var s = (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + WEEK[d.getDay()] + ")";
    if (withYear) s = d.getFullYear() + "년 " + s;
    return s;
  }
  /** '오후 3시' / '오전 10시 30분' */
  function fmtTimeKo(d) {
    var h = d.getHours();
    var m = d.getMinutes();
    var ap = h < 12 ? "오전" : "오후";
    var hh = h % 12 === 0 ? 12 : h % 12;
    return ap + " " + hh + "시" + (m ? " " + m + "분" : "");
  }
  function fmtShortDate(d) { return d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()); }

  /* ---------- 일정 ---------- */
  /** 일정이 걸쳐 있는 날짜 키 목록 (여러 날 일정 대응) */
  function eventDayKeys(ev) {
    var s = parseDT(ev.start);
    var e = parseDT(ev.end) || s;
    if (!s) return [];
    if (e < s) e = s;
    var last = startOfDay(e);
    // 시간 일정이 다음날 00:00 에 끝나면 그 날은 포함하지 않아요
    if (!ev.allDay && e.getHours() === 0 && e.getMinutes() === 0 && last > startOfDay(s)) last = addDays(last, -1);
    var keys = [];
    var cur = startOfDay(s);
    var guard = 0;
    while (cur <= last && guard < 400) {
      keys.push(dateKey(cur));
      cur = addDays(cur, 1);
      guard++;
    }
    return keys;
  }

  /** 날짜키 → 일정 배열 인덱스 */
  function buildDayIndex(events) {
    var idx = {};
    events.forEach(function (ev) {
      eventDayKeys(ev).forEach(function (k) {
        (idx[k] = idx[k] || []).push(ev);
      });
    });
    Object.keys(idx).forEach(function (k) { idx[k].sort(compareEvents); });
    return idx;
  }

  function compareEvents(a, b) {
    if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return (CAT_MAP[b.category] || CAT_MAP.normal).priority - (CAT_MAP[a.category] || CAT_MAP.normal).priority;
  }

  function topCategory(events) {
    var best = null;
    events.forEach(function (ev) {
      var c = CAT_MAP[ev.category] || CAT_MAP.normal;
      if (!best || c.priority > best.priority) best = c;
    });
    return best;
  }

  /** 일정 시간 표시 문자열 */
  function fmtEventTime(ev) {
    var s = parseDT(ev.start);
    var e = parseDT(ev.end) || s;
    var sameDay = dateKey(s) === dateKey(e);
    var md = function (d) { return (d.getMonth() + 1) + "/" + d.getDate(); };
    if (ev.allDay) return sameDay ? "하루 종일" : md(s) + " ~ " + md(e) + " 하루 종일";
    if (sameDay) return timeStr(s) + " ~ " + timeStr(e);
    return md(s) + " " + timeStr(s) + " ~ " + md(e) + " " + timeStr(e);
  }

  /** 수업 상태: done / planned / unchecked */
  function lessonStatus(ev, now) {
    if (ev.done) return "done";
    var s = parseDT(ev.start);
    return s > (now || new Date()) ? "planned" : "unchecked";
  }

  /* ---------- 회원 ---------- */
  function currentYear() { return new Date().getFullYear(); }
  /** 등록 시 입력한 나이 → 출생연도 (등록 연도 - 나이) */
  function birthYearFromAge(age, year) { return (year || currentYear()) - Number(age); }
  /** 표시 나이 = 현재 연도 - 출생연도 (매년 1월 1일 자동 +1) */
  function ageOf(member) { return currentYear() - Number(member.birthYear); }
  function memberLabel(member) { return member.name + " (" + ageOf(member) + "세)"; }
  function totalCount(member) {
    return (member.packages || []).reduce(function (s, p) { return s + (Number(p.count) || 0); }, 0);
  }
  function doneCount(member, events) {
    return events.filter(function (e) { return e.category === "lesson" && e.memberId === member.id && e.done; }).length;
  }
  /** 남은 횟수 = 총 등록 횟수 합계 - 진행완료 수업 수 (저장하지 않고 계산) */
  function remainingCount(member, events) { return totalCount(member) - doneCount(member, events); }

  /* ---------- 한글 검색 (초성/부분일치/비슷한 이름) ---------- */
  var CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function chosung(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i) - 0xac00;
      out += code >= 0 && code <= 11171 ? CHO[Math.floor(code / 588)] : str[i];
    }
    return out;
  }
  function isChosungOnly(q) { return /^[ㄱ-ㅎ]+$/.test(q); }
  /** 0이면 불일치, 클수록 비슷 */
  function nameScore(name, q) {
    name = (name || "").replace(/\s/g, "").toLowerCase();
    q = (q || "").replace(/\s/g, "").toLowerCase();
    if (!q) return 1;
    if (name === q) return 100;
    if (name.indexOf(q) === 0) return 80;
    if (name.indexOf(q) > 0) return 60;
    if (isChosungOnly(q) && chosung(name).indexOf(q) >= 0) return 50;
    // 글자 겹침 (비슷한 이름)
    var hit = 0;
    for (var i = 0; i < q.length; i++) if (name.indexOf(q[i]) >= 0) hit++;
    if (q.length >= 2 && hit >= Math.ceil(q.length / 2)) return 10 + hit;
    return 0;
  }
  function searchMembers(members, q) {
    return members
      .map(function (m) { return { m: m, s: nameScore(m.name, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.m.name.localeCompare(b.m.name, "ko"); })
      .map(function (x) { return x.m; });
  }

  /* ---------- 기타 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  /** 직전 값과 겹치지 않는 랜덤 선택 */
  function pickNoRepeat(list, last) {
    if (list.length < 2) return list[0];
    var v;
    do { v = list[Math.floor(Math.random() * list.length)]; } while (v === last);
    return v;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.U = {
    IMG: IMG,
    CATEGORIES: CATEGORIES,
    CAT_MAP: CAT_MAP,
    GOALS: GOALS,
    WEEK: WEEK,
    pad: pad,
    dateKey: dateKey,
    timeStr: timeStr,
    parseKey: parseKey,
    parseDT: parseDT,
    toDT: toDT,
    todayKey: todayKey,
    addDays: addDays,
    addMonthsClamp: addMonthsClamp,
    startOfDay: startOfDay,
    fmtDateKo: fmtDateKo,
    fmtTimeKo: fmtTimeKo,
    fmtShortDate: fmtShortDate,
    eventDayKeys: eventDayKeys,
    buildDayIndex: buildDayIndex,
    compareEvents: compareEvents,
    topCategory: topCategory,
    fmtEventTime: fmtEventTime,
    lessonStatus: lessonStatus,
    currentYear: currentYear,
    birthYearFromAge: birthYearFromAge,
    ageOf: ageOf,
    memberLabel: memberLabel,
    totalCount: totalCount,
    doneCount: doneCount,
    remainingCount: remainingCount,
    searchMembers: searchMembers,
    esc: esc,
    pickNoRepeat: pickNoRepeat,
    wait: wait
  };
})();

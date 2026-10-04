/* fun.js — 진행완료 응원 팝업, "집가고 싶다" 둥실둥실 시나모롤 */
(function () {
  "use strict";

  var CHEERS = [
    "주현이 징짜 고생많았오!",
    "오늘도 해냈다 주현이 최고야!",
    "한 타임 끝! 물 한 잔 마시자",
    "수업 완료! 주현이 목소리 짱짱했어",
    "회원님 땀 흘린 만큼 주현이도 반짝반짝 빛났어!",
    "우와 또 해냈다! 박수 짝짝짝",
    "주현이 덕분에 회원님 근육이 웃고 있어",
    "잘했오 잘했오~ 어깨 한 번 쭉 펴자!",
    "오늘의 주현이도 프로 그 자체!",
    "한 걸음 더 퇴근에 가까워졌어!",
    "수업 하나 클리어! 간식 먹을 자격 충분해",
    "주현이 체력 무엇… 진짜 멋져!",
    "고생했어! 잠깐 스트레칭하고 쉬자",
    "시나모롤이 꼬옥 안아줄게, 수고했오!",
    "이 구역 최고 트레이너는 주현이야!",
    "끝! 숨 한 번 크게 쉬고 다음 타임도 화이팅",
    "주현이 카운트 세는 목소리 너무 든든해!",
    "오늘도 회원님 인생 바꾸는 중! 대단해"
  ];

  var COMFORTS = [
    "조금만 더 버티면 퇴근이야!",
    "집에 가면 따뜻한 이불이 기다리고 있어",
    "오늘 진짜 많이 애썼어, 주현이 최고",
    "퇴근길에 맛있는 거 사 먹자!",
    "시계야 빨리 가라~ 얍!",
    "집 가고 싶은 마음 백 번 이해해… 꼬옥 안아줄게",
    "지금 이 순간도 지나간다! 버티는 주현이 멋져",
    "퇴근하면 발 쭉 뻗고 누워 있자",
    "힘들면 잠깐 숨 고르기~ 후우 하아",
    "주현이는 오늘도 충분히 잘하고 있어",
    "집에 도착하면 시나모롤이 마중 나갈게!",
    "조금만 더! 귀 펄럭펄럭 응원 중이야",
    "퇴근까지 카운트다운 시작! 3, 2, 1… 아직이네 헤헤"
  ];

  var CHEER_IMGS = ["wave.png", "hat.png", "ears.png"];
  var HOME_IMGS = ["fy.png", "lying.png", "toast.png", "fy.png"];

  var lastCheer = null;
  var lastComfort = null;
  var lastHomeImg = null;
  var cheerEl = null;
  var cheerTimer = null;

  /* ---------- 진행완료 응원 ---------- */
  function cheer(sub) {
    closeCheer(true);
    var msg = U.pickNoRepeat(CHEERS, lastCheer);
    lastCheer = msg;
    var img = CHEER_IMGS[Math.floor(Math.random() * CHEER_IMGS.length)];
    var confetti = "";
    for (var i = 0; i < 12; i++) {
      var left = Math.round(5 + Math.random() * 90);
      var delay = (Math.random() * 0.5).toFixed(2);
      var kind = i % 3 === 0 ? "heart" : i % 3 === 1 ? "cloud" : "star";
      confetti += '<i class="cf ' + kind + '" style="left:' + left + "%;animation-delay:" + delay + 's"></i>';
    }
    var el = UI.h(
      '<div class="cheer-wrap" role="status" aria-live="polite">' +
        '<div class="confetti">' + confetti + "</div>" +
        '<div class="cheer-card">' +
          '<img class="cheer-img" src="' + U.IMG + img + '" alt="시나모롤">' +
          '<p class="cheer-msg">' + U.esc(msg) + "</p>" +
          (sub ? '<p class="cheer-sub">' + U.esc(sub) + "</p>" : "") +
          '<p class="cheer-tap">화면을 누르면 닫혀요</p>' +
        "</div>" +
      "</div>"
    );
    el.addEventListener("click", function () { closeCheer(); });
    document.body.appendChild(el);
    cheerEl = el;
    requestAnimationFrame(function () { el.classList.add("show"); });
    cheerTimer = setTimeout(closeCheer, 3200);
  }

  function closeCheer(immediate) {
    clearTimeout(cheerTimer);
    if (!cheerEl) return;
    var el = cheerEl;
    cheerEl = null;
    if (immediate) { el.remove(); return; }
    el.classList.remove("show");
    el.classList.add("hide");
    setTimeout(function () { el.remove(); }, 300);
  }

  /* ---------- 집가고 싶다 ---------- */
  var homeEl = null;

  function goHome() {
    if (homeEl) { nextComfort(); return; }
    var img = U.pickNoRepeat(HOME_IMGS, lastHomeImg);
    lastHomeImg = img;
    var el = UI.h(
      '<div class="home-wrap" role="dialog" aria-label="집가고 싶다">' +
        '<div class="home-sky"></div>' +
        '<button type="button" class="home-close" aria-label="닫기">' + UI.ICON.x + "</button>" +
        '<div class="home-rise">' +
          '<div class="home-drift">' +
            '<div class="home-float">' +
              '<div class="bubble"><p></p></div>' +
              '<img class="home-img" src="' + U.IMG + img + '" alt="둥실둥실 시나모롤">' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<span class="mini-cloud c1">' + UI.ICON.cloud + "</span>" +
        '<span class="mini-cloud c2">' + UI.ICON.cloud + "</span>" +
        '<span class="mini-cloud c3">' + UI.ICON.cloud + "</span>" +
        '<p class="home-hint">시나모롤을 누르면 다른 말을 해줘요</p>' +
      "</div>"
    );
    homeEl = el;
    nextComfort();
    el.querySelector(".home-close").addEventListener("click", closeHome);
    el.querySelector(".home-float").addEventListener("click", function () {
      nextComfort();
      var f = el.querySelector(".home-img");
      f.classList.remove("boing");
      void f.offsetWidth;
      f.classList.add("boing");
    });
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add("show"); });
    });
  }

  function nextComfort() {
    if (!homeEl) return;
    var msg = U.pickNoRepeat(COMFORTS, lastComfort);
    lastComfort = msg;
    var p = homeEl.querySelector(".bubble p");
    var bubble = homeEl.querySelector(".bubble");
    p.textContent = msg;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
  }

  function closeHome() {
    if (!homeEl) return;
    var el = homeEl;
    homeEl = null;
    el.classList.remove("show");
    el.classList.add("leave");
    setTimeout(function () { el.remove(); }, 650);
  }

  function init() {
    document.getElementById("home-fab").addEventListener("click", goHome);
  }

  window.Fun = {
    init: init,
    cheer: cheer,
    goHome: goHome,
    closeHome: closeHome,
    CHEERS: CHEERS,
    COMFORTS: COMFORTS
  };
})();

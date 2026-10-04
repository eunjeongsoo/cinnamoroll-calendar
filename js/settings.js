/* settings.js — 설정 메뉴: 백업 내보내기/불러오기, 알림 권한 */
(function () {
  "use strict";

  function fmtDateTime(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d)) return null;
    return U.fmtShortDate(d) + " " + U.timeStr(d);
  }

  function notifState() {
    if (!("Notification" in window)) return { key: "unsupported", label: "이 브라우저는 알림을 지원하지 않아요" };
    var p = Notification.permission;
    if (p === "granted") return { key: "granted", label: "알림 허용됨 🔔" };
    if (p === "denied") return { key: "denied", label: "알림이 차단돼 있어요" };
    return { key: "default", label: "아직 알림 권한을 물어보지 않았어요" };
  }

  function open() {
    UI.openSheet({
      title: "설정",
      tall: true,
      className: "settings-sheet",
      render: function (body, sheet) {
        draw(sheet);
        body.addEventListener("click", function (e) {
          var b = e.target.closest("button");
          if (!b) return;
          var act = b.getAttribute("data-act");
          if (act === "export") exportBackup(sheet);
          else if (act === "import") body.querySelector("#import-file").click();
          else if (act === "notif") requestNotif(sheet);
        });
        body.addEventListener("change", function (e) {
          if (e.target.id === "import-file") {
            var f = e.target.files && e.target.files[0];
            e.target.value = "";
            if (f) importBackup(f, sheet);
          }
        });
      },
      onRefresh: function (sheet) { draw(sheet); }
    });
  }

  function draw(sheet) {
    Store.getMeta("lastBackupAt").then(function (last) {
      var n = notifState();
      sheet.body.innerHTML =
        '<div class="settings-hero"><img src="' + U.IMG + 'stickers.png" alt=""><div>' +
          "<strong>시나모롤 캘린더</strong><span>주현언니꼬! ☁️</span></div></div>" +

        '<section class="set-card">' +
          '<h4>' + UI.ICON.download + "<span>백업</span></h4>" +
          '<p class="muted">모든 데이터는 이 폰 안에만 저장돼요. 폰을 바꾸거나 앱을 지우기 전에 백업 파일을 꼭 챙겨주세요!</p>' +
          '<p class="last-backup">마지막 백업: <b>' + (fmtDateTime(last) || "아직 백업한 적이 없어요") + "</b></p>" +
          '<button type="button" class="btn primary block" data-act="export">' + UI.ICON.download + "<span>백업 파일 내보내기</span></button>" +
          '<button type="button" class="btn soft block" data-act="import">' + UI.ICON.upload + "<span>백업 파일 불러오기</span></button>" +
          '<input type="file" id="import-file" accept=".json,application/json" hidden>' +
        "</section>" +

        '<section class="set-card">' +
          '<h4>' + UI.ICON.bell + "<span>알림</span></h4>" +
          '<p class="notif-state ' + n.key + '">' + n.label + "</p>" +
          (n.key === "denied" ? '<p class="muted">브라우저(또는 폰) 설정 → 사이트/앱 설정에서 알림을 허용으로 바꿔주세요.</p>' : "") +
          (n.key !== "unsupported" && n.key !== "granted"
            ? '<button type="button" class="btn soft block" data-act="notif">' + UI.ICON.bell + "<span>알림 권한 " + (n.key === "denied" ? "다시 " : "") + "요청하기</span></button>"
            : "") +
          '<p class="muted tiny">새해가 되면 회원 나이가 한 살씩 올랐다고 알려드려요.</p>' +
        "</section>" +

        '<section class="set-card">' +
          "<h4>" + UI.ICON.heart + "<span>정보</span></h4>" +
          '<ul class="info-list">' +
            "<li><span>회원</span><b>" + App.state.members.length + "명</b></li>" +
            "<li><span>일정</span><b>" + App.state.events.length + "개</b></li>" +
            "<li><span>저장 방식</span><b>" + (Store.backendName === "indexedDB" ? "기기 내부 저장소" : "브라우저 저장소") + "</b></li>" +
          "</ul>" +
        "</section>";
    });
  }

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function exportBackup(sheet) {
    Store.exportAll().then(function (data) {
      var json = JSON.stringify(data, null, 2);
      var name = "시나모롤캘린더_백업_" + U.todayKey() + ".json";
      var blob = new Blob([json], { type: "application/json" });
      var file = null;
      try { file = new File([blob], name, { type: "application/json" }); } catch (e) { file = null; }

      var share = (isIOS() && file && navigator.canShare && navigator.canShare({ files: [file] }))
        ? navigator.share({ files: [file], title: "시나모롤 캘린더 백업" })
        : null;

      var done = share
        ? share.then(function () { return true; }, function (err) {
            if (err && err.name === "AbortError") return false;
            download(blob, name);
            return true;
          })
        : Promise.resolve(download(blob, name));

      return done.then(function (ok) {
        if (!ok) return;
        return Store.setMeta("lastBackupAt", new Date().toISOString()).then(function () {
          draw(sheet);
          UI.toast("백업 파일을 저장했어요! 📦");
        });
      });
    }).catch(App.fail);
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return true;
  }

  function importBackup(file, sheet) {
    var reader = new FileReader();
    reader.onerror = function () { UI.alert({ title: "앗!", message: "파일을 읽지 못했어요. 다시 시도해 줄래요?" }); };
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); } catch (e) { data = null; }
      var err = Store.validateBackup(data);
      if (err) { UI.alert({ title: "불러올 수 없어요", message: err, img: U.IMG + "peek.png" }); return; }
      var when = fmtDateTime(data.exportedAt);
      UI.confirm({
        title: "백업으로 덮어쓸까요?",
        message: "지금 데이터(회원 " + App.state.members.length + "명, 일정 " + App.state.events.length + "개)가 지워지고\n" +
          "백업 파일 내용(회원 " + data.members.length + "명, 일정 " + data.events.length + "개)으로 바뀌어요." +
          (when ? "\n\n백업한 때: " + when : ""),
        okText: "덮어쓰기",
        cancelText: "그만두기",
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        return Store.importAll(data).then(App.reload).then(function () {
          draw(sheet);
          UI.toast("백업을 불러왔어요! 데이터가 복구됐어요 ☁️");
        });
      }).catch(App.fail);
    };
    reader.readAsText(file);
  }

  function requestNotif(sheet) {
    if (!("Notification" in window)) return;
    try {
      var r = Notification.requestPermission(function () { draw(sheet); });
      if (r && r.then) r.then(function (p) {
        draw(sheet);
        if (p === "granted") UI.toast("알림이 켜졌어요! 🔔");
        else if (p === "denied") UI.toast("알림이 차단돼 있어요. 설정에서 바꿔주세요");
      });
    } catch (e) {
      draw(sheet);
    }
  }

  window.Settings = { open: open };
})();

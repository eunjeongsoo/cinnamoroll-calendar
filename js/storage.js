/*
 * storage.js — 데이터 읽기/쓰기는 전부 이 파일에서만 해요.
 * 다른 파일은 window.Store 의 함수만 호출합니다. (모두 Promise 반환)
 * 나중에 서버(Supabase 등)로 옮길 때는 이 파일의 backend 만 바꾸면 돼요.
 *
 *  Store.init()
 *  Store.getEvents() / getEvent(id) / saveEvent(ev) / saveEvents(list) / deleteEvent(id) / deleteEvents(ids)
 *  Store.getMembers() / getMember(id) / saveMember(m) / deleteMember(id)
 *  Store.getMeta(key) / setMeta(key, value)
 *  Store.exportAll() / importAll(data)
 *  Store.backendName  ("indexedDB" | "localStorage")
 */
(function () {
  "use strict";

  var DB_NAME = "cinnamo-calendar";
  var DB_VERSION = 1;
  var STORES = { events: "id", members: "id", meta: "key" };
  var BACKUP_APP = "cinnamoroll-calendar";
  var BACKUP_VERSION = 1;

  function clone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  /* ---------- IndexedDB backend ---------- */
  function createIdbBackend() {
    return new Promise(function (resolve, reject) {
      if (!("indexedDB" in window) || !window.indexedDB) return reject(new Error("no indexedDB"));
      var req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return reject(e);
      }
      var timer = setTimeout(function () { reject(new Error("indexedDB open timeout")); }, 4000);
      req.onupgradeneeded = function () {
        var db = req.result;
        Object.keys(STORES).forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: STORES[name] });
        });
      };
      req.onerror = function () { clearTimeout(timer); reject(req.error || new Error("indexedDB error")); };
      req.onblocked = function () { clearTimeout(timer); reject(new Error("indexedDB blocked")); };
      req.onsuccess = function () {
        clearTimeout(timer);
        var db = req.result;

        function tx(names, mode, work) {
          return new Promise(function (res, rej) {
            var t = db.transaction(names, mode);
            var out;
            t.oncomplete = function () { res(out); };
            t.onerror = function () { rej(t.error); };
            t.onabort = function () { rej(t.error || new Error("aborted")); };
            out = work(t);
          });
        }
        function reqP(r) {
          return new Promise(function (res, rej) {
            r.onsuccess = function () { res(r.result); };
            r.onerror = function () { rej(r.error); };
          });
        }

        resolve({
          name: "indexedDB",
          all: function (store) {
            return new Promise(function (res, rej) {
              var r = db.transaction(store, "readonly").objectStore(store).getAll();
              r.onsuccess = function () { res(r.result || []); };
              r.onerror = function () { rej(r.error); };
            });
          },
          get: function (store, key) {
            return reqP(db.transaction(store, "readonly").objectStore(store).get(key)).then(function (v) {
              return v == null ? null : v;
            });
          },
          putMany: function (store, items) {
            return tx(store, "readwrite", function (t) {
              var os = t.objectStore(store);
              items.forEach(function (it) { os.put(it); });
            });
          },
          removeMany: function (store, keys) {
            return tx(store, "readwrite", function (t) {
              var os = t.objectStore(store);
              keys.forEach(function (k) { os.delete(k); });
            });
          },
          replaceAll: function (data) {
            var names = Object.keys(STORES);
            return tx(names, "readwrite", function (t) {
              names.forEach(function (name) {
                var os = t.objectStore(name);
                os.clear();
                (data[name] || []).forEach(function (it) { os.put(it); });
              });
            });
          }
        });
      };
    });
  }

  /* ---------- localStorage backend (IndexedDB 실패 시) ---------- */
  function createLocalBackend() {
    var PREFIX = DB_NAME + ":";
    function read(store) {
      try {
        return JSON.parse(localStorage.getItem(PREFIX + store) || "[]");
      } catch (e) {
        return [];
      }
    }
    function write(store, list) {
      localStorage.setItem(PREFIX + store, JSON.stringify(list));
    }
    function keyOf(store) { return STORES[store]; }
    return Promise.resolve({
      name: "localStorage",
      all: function (store) { return Promise.resolve(read(store)); },
      get: function (store, key) {
        var k = keyOf(store);
        var found = read(store).filter(function (it) { return it[k] === key; })[0];
        return Promise.resolve(found || null);
      },
      putMany: function (store, items) {
        var k = keyOf(store);
        var list = read(store);
        items.forEach(function (it) {
          var i = list.findIndex(function (x) { return x[k] === it[k]; });
          if (i >= 0) list[i] = it; else list.push(it);
        });
        write(store, list);
        return Promise.resolve();
      },
      removeMany: function (store, keys) {
        var k = keyOf(store);
        write(store, read(store).filter(function (x) { return keys.indexOf(x[k]) < 0; }));
        return Promise.resolve();
      },
      replaceAll: function (data) {
        Object.keys(STORES).forEach(function (name) { write(name, data[name] || []); });
        return Promise.resolve();
      }
    });
  }

  var backend = null;
  var ready = null;

  function init() {
    if (ready) return ready;
    ready = createIdbBackend()
      .catch(function (err) {
        console.warn("[Store] IndexedDB 사용 불가, localStorage로 전환:", err && err.message);
        return createLocalBackend();
      })
      .then(function (b) {
        backend = b;
        Store.backendName = b.name;
        // 브라우저가 데이터를 함부로 지우지 않도록 요청 (지원 시)
        try {
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        } catch (e) { /* 무시 */ }
        return b;
      });
    return ready;
  }

  function withBackend(fn) {
    return init().then(fn);
  }

  function newId(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  var Store = {
    backendName: null,
    init: init,
    newId: newId,

    /* 일정 */
    getEvents: function () { return withBackend(function (b) { return b.all("events"); }).then(clone); },
    getEvent: function (id) { return withBackend(function (b) { return b.get("events", id); }).then(clone); },
    saveEvent: function (ev) {
      var item = clone(ev);
      if (!item.id) item.id = newId("ev");
      item.updatedAt = new Date().toISOString();
      if (!item.createdAt) item.createdAt = item.updatedAt;
      return withBackend(function (b) { return b.putMany("events", [item]); }).then(function () { return clone(item); });
    },
    saveEvents: function (list) {
      var now = new Date().toISOString();
      var items = clone(list).map(function (it) {
        if (!it.id) it.id = newId("ev");
        it.updatedAt = now;
        if (!it.createdAt) it.createdAt = now;
        return it;
      });
      return withBackend(function (b) { return b.putMany("events", items); }).then(function () { return clone(items); });
    },
    deleteEvent: function (id) { return withBackend(function (b) { return b.removeMany("events", [id]); }); },
    deleteEvents: function (ids) { return withBackend(function (b) { return b.removeMany("events", ids.slice()); }); },

    /* 회원 */
    getMembers: function () { return withBackend(function (b) { return b.all("members"); }).then(clone); },
    getMember: function (id) { return withBackend(function (b) { return b.get("members", id); }).then(clone); },
    saveMember: function (m) {
      var item = clone(m);
      if (!item.id) item.id = newId("mb");
      item.updatedAt = new Date().toISOString();
      if (!item.createdAt) item.createdAt = item.updatedAt;
      return withBackend(function (b) { return b.putMany("members", [item]); }).then(function () { return clone(item); });
    },
    deleteMember: function (id) { return withBackend(function (b) { return b.removeMany("members", [id]); }); },

    /* 기타 설정값 */
    getMeta: function (key) {
      return withBackend(function (b) { return b.get("meta", key); }).then(function (row) { return row ? clone(row.value) : null; });
    },
    setMeta: function (key, value) {
      return withBackend(function (b) { return b.putMany("meta", [{ key: key, value: clone(value) }]); });
    },

    /* 백업 */
    exportAll: function () {
      return withBackend(function (b) {
        return Promise.all([b.all("events"), b.all("members"), b.all("meta")]).then(function (r) {
          return {
            app: BACKUP_APP,
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            events: r[0],
            members: r[1],
            meta: r[2].filter(function (m) { return m.key !== "lastBackupAt"; })
          };
        });
      }).then(clone);
    },
    validateBackup: function (data) {
      if (!data || typeof data !== "object") return "파일 내용을 읽을 수 없어요";
      if (data.app !== BACKUP_APP) return "시나모롤 캘린더 백업 파일이 아닌 것 같아요";
      if (!Array.isArray(data.events) || !Array.isArray(data.members)) return "백업 파일이 손상된 것 같아요";
      return null;
    },
    importAll: function (data) {
      var err = Store.validateBackup(data);
      if (err) return Promise.reject(new Error(err));
      return withBackend(function (b) {
        return b.get("meta", "lastBackupAt").then(function (lastBackup) {
          var meta = (Array.isArray(data.meta) ? data.meta : []).filter(function (m) { return m && m.key; });
          if (lastBackup) meta.push(lastBackup);
          return b.replaceAll({ events: data.events, members: data.members, meta: meta });
        });
      });
    }
  };

  window.Store = Store;
})();

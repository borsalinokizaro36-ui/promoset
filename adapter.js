/* Промосеть: связь интерфейса с Supabase (данные, фото, вход).
   Реализует тот же интерфейс claude.use("db") / claude.use("assets"), что и версия в Claude,
   поэтому код самого приложения не меняется. */
(function () {
  "use strict";
  const CFG = window.PROMOSET_CONFIG || {};
  const COLS = ["projects", "points", "promoters", "shifts", "photos"];
  const configured = typeof supabase !== "undefined" && CFG.supabaseUrl && /^https:\/\//.test(CFG.supabaseUrl) && CFG.supabaseKey && !/ВАШ/.test(CFG.supabaseUrl + CFG.supabaseKey);
  const sb = configured ? supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

  window.blobUrl = id => sb ? `${CFG.supabaseUrl}/storage/v1/object/public/photos/${encodeURIComponent(id)}` : "";

  // ---------- вход ----------
  const css = `#ps-login{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:#0E2A47;padding:16px;font:15px/1.4 system-ui,'Segoe UI',Arial,sans-serif}
#ps-login form{background:#fff;color:#0E2A47;border-radius:16px;padding:28px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:12px;box-shadow:0 10px 40px rgba(0,0,0,.3)}
#ps-login h1{margin:0 0 4px;font-size:22px}#ps-login label{font-size:13px;color:#4A5F73}
#ps-login input{font:inherit;padding:10px 12px;border:1px solid #D5E1DE;border-radius:10px}
#ps-login button{font:inherit;font-weight:600;padding:11px;border:0;border-radius:10px;background:#0F8C80;color:#fff;cursor:pointer}
#ps-login .e{color:#C2352B;font-size:13px;min-height:1em}#ps-login p{margin:0;font-size:13px;color:#4A5F73}`;
  function showLogin(msg) {
    return new Promise(resolve => {
      const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      const box = document.createElement("div"); box.id = "ps-login";
      box.innerHTML = configured
        ? `<form><h1>Промосеть</h1><label for="ps-email">Электронная почта</label><input id="ps-email" type="email" autocomplete="username" required>
           <label for="ps-pass">Пароль</label><input id="ps-pass" type="password" autocomplete="current-password" required><div class="e">${msg || ""}</div><button type="submit">Войти</button></form>`
        : `<form><h1>Промосеть</h1><p>Сайт ещё не подключён к базе. Откройте файл <b>config.js</b> и впишите адрес и ключ проекта Supabase (см. инструкцию).</p></form>`;
      const mount = () => document.body.appendChild(box);
      document.body ? mount() : document.addEventListener("DOMContentLoaded", mount);
      if (!configured) return;
      box.querySelector("form").addEventListener("submit", async e => {
        e.preventDefault();
        const err = box.querySelector(".e"); err.textContent = "";
        const btn = box.querySelector("button"); btn.disabled = true; btn.textContent = "Входим…";
        const { error } = await sb.auth.signInWithPassword({ email: box.querySelector("#ps-email").value.trim(), password: box.querySelector("#ps-pass").value });
        btn.disabled = false; btn.textContent = "Войти";
        if (error) { err.textContent = /invalid/i.test(error.message) ? "Неверная почта или пароль." : "Не получилось войти: " + error.message; return; }
        box.remove(); resolve();
      });
    });
  }
  const ready = (async () => {
    if (!sb) { await showLogin(); return false; }
    const { data } = await sb.auth.getSession();
    if (!data.session) await showLogin();
    return true;
  })();

  // ---------- данные ----------
  const listeners = {}, cache = {}, pending = {};
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62]).join("");
  const fail = e => ({ code: e && /permission|policy|JWT/i.test(e.message || "") ? "invalid_argument" : "unavailable", message: e && e.message });
  const snap = docs => ({
    docs: docs.map(d => { const { id, ...rest } = d; return { id, exists: true, data: () => rest, metadata: { fromCache: false, hasPendingWrites: false } }; }),
    size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false },
  });
  function refresh(col) {
    if (pending[col]) return pending[col];
    pending[col] = (async () => {
      const all = []; let from = 0;
      for (;;) {
        const { data, error } = await sb.from("docs").select("id,data").eq("col", col).range(from, from + 999);
        if (error) { console.error(error); return; }
        all.push(...data.map(r => Object.assign({ id: r.id }, r.data))); if (data.length < 1000) break; from += 1000;
      }
      cache[col] = all; (listeners[col] || new Set()).forEach(l => l.next(snap(all)));
    })().finally(() => { delete pending[col]; });
    return pending[col];
  }
  function doc(pathStr) {
    const [col, id] = pathStr.split("/");
    return {
      id, path: pathStr,
      async get() { const { data } = await sb.from("docs").select("data").eq("col", col).eq("id", id).maybeSingle(); return data ? { id, exists: true, data: () => data.data } : { id, exists: false, data: () => undefined }; },
      async set(d) { const { error } = await sb.from("docs").upsert({ col, id, data: d, updated_at: new Date().toISOString() }); if (error) throw fail(error); await refresh(col); },
      async update(d) { const { error } = await sb.rpc("merge_doc", { p_col: col, p_id: id, p_patch: d }); if (error) throw fail(error); await refresh(col); },
      async delete() { const { error } = await sb.from("docs").delete().eq("col", col).eq("id", id); if (error) throw fail(error); await refresh(col); },
      onSnapshot: () => () => {},
    };
  }
  function collection(col) {
    return {
      path: col,
      onSnapshot(next, error) {
        (listeners[col] = listeners[col] || new Set()); const l = { next, error }; listeners[col].add(l);
        if (cache[col]) setTimeout(() => next(snap(cache[col]))); refresh(col);
        return () => listeners[col].delete(l);
      },
      async add(data) { const id = rid(); const { error } = await sb.from("docs").insert({ col, id, data }); if (error) throw fail(error); await refresh(col); return doc(col + "/" + id); },
      doc: id => doc(col + "/" + (id || rid())),
      async get() { await refresh(col); return snap(cache[col] || []); },
    };
  }
  const DB = Object.freeze({ collection, doc });

  // ---------- фото ----------
  const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
  const ASSETS = Object.freeze({
    async upload(blob, opts) {
      const type = (opts && opts.type) || blob.type || "image/jpeg";
      if (!EXT[type]) throw { code: "unsupported_type" };
      if (blob.size > 20 * 1024 * 1024) throw { code: "too_large" };
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("") + EXT[type];
      const { error } = await sb.storage.from("photos").upload(id, blob, { contentType: type, upsert: false });
      if (error) throw { code: /size/i.test(error.message) ? "too_large" : "upstream_error", message: error.message };
      return { id, url: window.blobUrl(id), sizeBytes: blob.size, contentType: type };
    },
    async list() { return { assets: [], usage: {} }; },
    async delete() { return { deleted: false }; },
  });

  // ---------- живые обновления ----------
  ready.then(ok => {
    if (!ok) return;
    sb.channel("docs-changes").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, p => {
      const col = (p.new && p.new.col) || (p.old && p.old.col);
      (col ? [col] : COLS).forEach(c => { if (listeners[c] && listeners[c].size) refresh(c); });
    }).subscribe();
    setInterval(() => { for (const c in listeners) if (listeners[c].size) refresh(c); }, 60000);
    // кнопка «Выйти»
    const add = () => { const c = document.querySelector(".top .ctrls"); if (!c || c.querySelector(".ps-out")) return;
      const b = document.createElement("button"); b.className = "ps-out"; b.textContent = "Выйти";
      b.style.cssText = "color:inherit;background:none;opacity:.8;border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:7px 12px;font:inherit;font-size:14px;cursor:pointer";
      b.onclick = async () => { await sb.auth.signOut(); location.reload(); }; c.appendChild(b); };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
  });

  window.claude = Object.freeze({
    use: async name => { const ok = await ready; if (!ok) return null; return name === "db" ? DB : name === "assets" ? ASSETS : null; },
  });
})();

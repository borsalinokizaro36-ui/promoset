/* Промосеть: связь интерфейса с Supabase (данные, фото, вход, регистрация, роли).
   Реализует тот же интерфейс claude.use("db") / claude.use("assets"), что и версия в Claude,
   поэтому код самого приложения почти не меняется. */
(function () {
  "use strict";
  const CFG = window.PROMOSET_CONFIG || {};
  const COLS = ["projects", "points", "promoters", "shifts", "photos"];
  const configured = typeof supabase !== "undefined" && CFG.supabaseUrl && /^https:\/\//.test(CFG.supabaseUrl) && CFG.supabaseKey && !/ВАШ/.test(CFG.supabaseUrl + CFG.supabaseKey);
  const sb = configured ? supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  const SITE = location.origin + location.pathname;
  const ROLE_L = { owner: "владелец", admin: "администратор", staff: "сотрудник", pending: "ждёт одобрения" };
  const escH = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  window.blobUrl = id => sb ? `${CFG.supabaseUrl}/storage/v1/object/public/photos/${encodeURIComponent(id)}` : "";

  // ---------- экраны входа ----------
  const css = `#ps-login{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:#17181C;padding:16px;font:15px/1.45 'Onest',system-ui,'Segoe UI',Arial,sans-serif;overflow:auto}
#ps-login form,#ps-login .card{background:#fff;color:#17181C;border-radius:18px;padding:28px;width:100%;max-width:380px;display:flex;flex-direction:column;gap:12px}
#ps-login .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;margin-bottom:4px}
#ps-login .brand i{width:32px;height:32px;border-radius:9px;background:#D4F04C}
#ps-login h1{margin:0;font-size:18px}
#ps-login label{font-size:13px;color:#55575E;margin-bottom:-6px}
#ps-login input{font:inherit;padding:11px 12px;border:1px solid #E3E1DB;border-radius:10px;background:#F6F5F1;color:#17181C}
#ps-login input:focus{outline:2px solid #17181C;outline-offset:1px}
#ps-login button.main{font:inherit;font-weight:600;padding:12px;border:0;border-radius:10px;background:#17181C;color:#fff;cursor:pointer}
#ps-login button.main:disabled{opacity:.6}
#ps-login .links{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
#ps-login .links button{border:0;background:none;padding:0;font:inherit;font-size:13.5px;color:#55575E;text-decoration:underline;cursor:pointer}
#ps-login .e{color:#E0442F;font-size:13.5px;min-height:1em}
#ps-login .ok{color:#23945A;font-size:13.5px}
#ps-login p{margin:0;font-size:14px;color:#55575E}
#ps-modal{position:fixed;inset:0;z-index:2100;display:grid;place-items:center;background:rgba(23,24,28,.55);padding:16px;font:15px/1.45 'Onest',system-ui,sans-serif}
#ps-modal form{background:#fff;color:#17181C;border-radius:18px;padding:24px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:10px}
#ps-modal h2{margin:0 0 4px;font-size:18px}
#ps-modal label{font-size:13px;color:#55575E}
#ps-modal input{font:inherit;padding:10px 12px;border:1px solid #E3E1DB;border-radius:10px;background:#F6F5F1}
#ps-modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}
#ps-modal button{font:inherit;font-weight:600;padding:10px 14px;border-radius:10px;border:1px solid #E3E1DB;background:#fff;cursor:pointer}
#ps-modal button.main{background:#17181C;color:#fff;border-color:#17181C}
#ps-modal .e{color:#E0442F;font-size:13.5px;min-height:1em}
.ps-me{font-size:12.5px;color:#9FA1A8;padding:0 6px 6px;overflow-wrap:anywhere}
.ps-me b{display:block;color:#F2F1EC;font-weight:600;font-size:13px}
.ps-act{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;opacity:.65;padding:7px 6px;font:inherit;font-size:14px;cursor:pointer;border-radius:8px}
.ps-act:hover{opacity:1;background:rgba(255,255,255,.07)}
.pw{position:relative;display:block}
.pw input{width:100%;box-sizing:border-box;padding-right:46px!important}
#ps-login .pw button.eye,#ps-modal .pw button.eye{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:36px;height:36px;padding:0;border:0;border-radius:8px;background:none;color:#55575E;cursor:pointer;display:grid;place-items:center}
#ps-login .pw button.eye:hover,#ps-modal .pw button.eye:hover{background:rgba(23,24,28,.07);color:#17181C}
#ps-login .pw button.eye:focus-visible,#ps-modal .pw button.eye:focus-visible{outline:2px solid #17181C}
#ps-modal .pm-pw{font:600 24px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;padding:14px;border-radius:10px;background:#F6F5F1;border:1px solid #E3E1DB;text-align:center;user-select:all;overflow-wrap:anywhere}
#ps-modal .pm-t{margin:0;font-size:14px;color:#55575E}`;
  let box = null;
  const addCss = () => { if (!document.getElementById("ps-css")) { const st = document.createElement("style"); st.id = "ps-css"; st.textContent = css; document.head.appendChild(st); } };
  addCss();
  function ensureBox() {
    addCss();
    if (!box) { box = document.createElement("div"); box.id = "ps-login"; }
    if (!box.isConnected) { const mount = () => document.body.appendChild(box); document.body ? mount() : document.addEventListener("DOMContentLoaded", mount); }
    return box;
  }
  const EYE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>`;
  function addEyes(root) {
    root.querySelectorAll("input[type=password]").forEach(i => {
      if (i.parentNode.classList.contains("pw")) return;
      const w = document.createElement("span"); w.className = "pw"; i.parentNode.insertBefore(w, i); w.appendChild(i);
      const t = document.createElement("button"); t.type = "button"; t.className = "eye"; t.innerHTML = EYE;
      t.setAttribute("aria-label", "Показать пароль"); t.setAttribute("aria-pressed", "false"); t.title = "Показать пароль";
      t.addEventListener("click", () => {
        const show = i.type === "password"; i.type = show ? "text" : "password"; t.innerHTML = show ? EYE_OFF : EYE;
        const l = show ? "Скрыть пароль" : "Показать пароль"; t.setAttribute("aria-label", l); t.title = l; t.setAttribute("aria-pressed", String(show));
        i.focus(); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (_) {}
      });
      w.appendChild(t);
    });
  }
  const brand = `<div class="brand"><i aria-hidden="true"></i>Промосеть</div>`;
  const ruErr = m => /invalid login/i.test(m) ? "Неверная почта или пароль." : /email not confirmed/i.test(m) ? "Почта ещё не подтверждена. Откройте письмо от Supabase и нажмите ссылку." : /already registered|already exists/i.test(m) ? "Эта почта уже зарегистрирована. Войдите или восстановите пароль." : /password should be at least|weak/i.test(m) ? "Пароль слишком короткий: нужно не меньше 6 символов." : /rate limit|too many/i.test(m) ? "Слишком много попыток. Подождите несколько минут." : /signups not allowed|signup is disabled/i.test(m) ? "Регистрация сейчас закрыта. Попросите владельца добавить вас." : m;

  let resolveAuth;
  const authed = new Promise(r => { resolveAuth = r; });

  function screen(mode, msg) {
    const b = ensureBox();
    if (!configured) { b.innerHTML = `<div class="card">${brand}<p>Сайт ещё не подключён к базе. Откройте файл <b>config.js</b> и впишите адрес и ключ проекта Supabase (см. инструкцию).</p></div>`; return; }
    const V = {
      login: `<form data-m="login">${brand}<h1>Вход</h1>
        <label for="ps-email">Электронная почта</label><input id="ps-email" type="email" autocomplete="username" required>
        <label for="ps-pass">Пароль</label><input id="ps-pass" type="password" autocomplete="current-password" required>
        <div class="e">${msg || ""}</div><button class="main" type="submit">Войти</button>
        <div class="links"><button type="button" data-go="signup">Регистрация</button><button type="button" data-go="reset">Забыли пароль?</button></div></form>`,
      signup: `<form data-m="signup">${brand}<h1>Регистрация</h1>
        <label for="ps-name">Имя и фамилия</label><input id="ps-name" autocomplete="name" required>
        <label for="ps-email">Электронная почта</label><input id="ps-email" type="email" autocomplete="username" required>
        <label for="ps-pass">Пароль, не меньше 6 символов</label><input id="ps-pass" type="password" autocomplete="new-password" minlength="6" required>
        <div class="e">${msg || ""}</div><button class="main" type="submit">Зарегистрироваться</button>
        <p>После регистрации владелец агентства откроет вам доступ.</p>
        <div class="links"><button type="button" data-go="login">У меня уже есть вход</button></div></form>`,
      reset: `<form data-m="reset">${brand}<h1>Восстановление пароля</h1>
        <p>Пришлём на почту ссылку, по ней вы зададите новый пароль.</p>
        <label for="ps-email">Электронная почта</label><input id="ps-email" type="email" autocomplete="username" required>
        <div class="e">${msg || ""}</div><button class="main" type="submit">Отправить ссылку</button>
        <div class="links"><button type="button" data-go="login">Вернуться ко входу</button></div></form>`,
      newpass: `<form data-m="newpass">${brand}<h1>Новый пароль</h1>${msg ? `<p>${msg}</p>` : ""}
        <label for="ps-pass">Новый пароль, не меньше 6 символов</label><input id="ps-pass" type="password" autocomplete="new-password" minlength="6" required>
        <label for="ps-pass2">Повторите пароль</label><input id="ps-pass2" type="password" autocomplete="new-password" minlength="6" required>
        <div class="e"></div><button class="main" type="submit">Сохранить пароль</button></form>`,
      sent: `<div class="card">${brand}<h1>Проверьте почту</h1><p>${msg || ""}</p><div class="links"><button type="button" data-go="login">Ко входу</button></div></div>`,
      pending: `<div class="card">${brand}<h1>Заявка отправлена</h1><p>${msg || "Владелец агентства ещё не открыл вам доступ. Как только откроет, обновите страницу."}</p><div class="links"><button type="button" data-go="reload">Обновить</button><button type="button" data-go="logout">Выйти</button></div></div>`,
    };
    b.innerHTML = V[mode]; addEyes(b);
    const f = b.querySelector("input"); if (f) setTimeout(() => f.focus(), 30);
  }

  document.addEventListener("click", async e => {
    const g = e.target.closest && e.target.closest("#ps-login [data-go]"); if (!g) return;
    const go = g.dataset.go;
    if (go === "reload") return location.reload();
    if (go === "logout") { await sb.auth.signOut(); return screen("login"); }
    screen(go);
  });
  document.addEventListener("submit", async e => {
    const fm = e.target.closest && e.target.closest("#ps-login form[data-m]"); if (!fm) return;
    e.preventDefault();
    const m = fm.dataset.m, v = id => (fm.querySelector("#" + id) || {}).value || "";
    const err = fm.querySelector(".e"), btn = fm.querySelector("button.main");
    err.textContent = ""; btn.disabled = true;
    try {
      if (m === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: v("ps-email").trim(), password: v("ps-pass") });
        if (error) throw error; await afterSignIn();
      } else if (m === "signup") {
        const email = v("ps-email").trim();
        const { data, error } = await sb.auth.signUp({ email, password: v("ps-pass"), options: { data: { name: v("ps-name").trim() }, emailRedirectTo: SITE } });
        if (error) throw error;
        if (data && data.session) await afterSignIn();
        else screen("sent", `Мы отправили письмо на ${escH(email)}. Нажмите в нём ссылку, чтобы подтвердить почту, затем войдите. Доступ откроет владелец агентства.`);
      } else if (m === "reset") {
        const email = v("ps-email").trim();
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE });
        if (error) throw error;
        screen("sent", `Если почта ${escH(email)} зарегистрирована, на неё придёт письмо со ссылкой. Откройте ссылку на этом устройстве и задайте новый пароль.`);
      } else if (m === "newpass") {
        if (v("ps-pass") !== v("ps-pass2")) throw { message: "Пароли не совпадают." };
        const { error } = await sb.auth.updateUser({ password: v("ps-pass") });
        if (error) throw error;
        try { await sb.rpc("clear_must_change"); } catch (_) {}
        try { history.replaceState(null, "", SITE); } catch (_) {}
        await afterSignIn("Пароль сохранён.");
      }
    } catch (x) { if (err.isConnected) err.textContent = ruErr((x && x.message) || "Не получилось. Попробуйте ещё раз."); }
    finally { if (btn.isConnected) btn.disabled = false; }
  });

  // ---------- роль ----------
  const me = { user: null, role: null, name: "" };
  async function loadRole() {
    const { data: u } = await sb.auth.getUser(); me.user = u && u.user;
    if (!me.user) return null;
    const { data, error } = await sb.from("members").select("role,name,email,must_change").eq("user_id", me.user.id).maybeSingle();
    if (error) { console.error(error); return "error"; }
    me.role = data ? data.role : "pending"; me.must = !!(data && data.must_change); me.name = (data && data.name) || (me.user.user_metadata && me.user.user_metadata.name) || "";
    window.PS_ROLE = me.role; window.PS_ME = { email: me.user.email, name: me.name, role: me.role, id: me.user.id };
    return me.role;
  }
  let toastMsg = "";
  async function afterSignIn(note) {
    const role = await loadRole();
    if (role === "error") return screen("pending", "Не удалось проверить доступ. Обновите страницу через минуту.");
    if (!role || role === "pending") return screen("pending");
    if (me.must && !note) return screen("newpass", "Вы вошли по временному паролю. Придумайте свой: его будете знать только вы.");
    toastMsg = note || "";
    if (box) box.remove();
    resolveAuth(true);
  }

  let recovering = false;
  if (sb) sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") { recovering = true; screen("newpass"); } });

  (async () => {
    if (!sb) { screen("login"); return; }
    const isRecovery = /type=recovery/.test(location.hash + location.search);
    const { data } = await sb.auth.getSession();
    if (isRecovery || recovering) { recovering = true; screen("newpass"); return; }
    if (!data.session) { screen("login"); return; }
    await afterSignIn();
  })();
  const ready = authed;

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

  // ---------- участники (для вкладки «Доступ») ----------
  window.psMembers = Object.freeze({
    async list() { const { data, error } = await sb.from("members").select("user_id,email,name,role,created_at").order("created_at"); if (error) throw error; return data; },
    async setRole(id, role) { const { error } = await sb.from("members").update({ role }).eq("user_id", id); if (error) throw error; },
    async remove(id) { const { error } = await sb.from("members").delete().eq("user_id", id); if (error) throw error; },
    roleLabel: r => ROLE_L[r] || r,
    async tempPassword(id, email) {
      const A = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let pw;
      do { pw = Array.from(crypto.getRandomValues(new Uint32Array(10)), n => A[n % A.length]).join(""); } while (!/\d/.test(pw) || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw));
      const { error } = await sb.rpc("set_temp_password", { p_user: id, p_password: pw });
      if (error) throw error;
      showTemp(email, pw);
    },
  });

  // ---------- смена пароля изнутри ----------
  function changePassword() {
    const m = document.createElement("div"); m.id = "ps-modal";
    m.innerHTML = `<form><h2>Сменить пароль</h2><label for="pm-1">Новый пароль, не меньше 6 символов</label><input id="pm-1" type="password" autocomplete="new-password" minlength="6" required>
      <label for="pm-2">Повторите пароль</label><input id="pm-2" type="password" autocomplete="new-password" minlength="6" required><div class="e"></div>
      <div class="row"><button type="button" data-x>Отмена</button><button class="main" type="submit">Сохранить</button></div></form>`;
    document.body.appendChild(m); addEyes(m); m.querySelector("#pm-1").focus();
    m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-x]")) m.remove(); });
    m.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault(); const a = m.querySelector("#pm-1").value, b = m.querySelector("#pm-2").value, er = m.querySelector(".e");
      if (a !== b) { er.textContent = "Пароли не совпадают."; return; }
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) { er.textContent = ruErr(error.message); return; }
      try { await sb.rpc("clear_must_change"); } catch (_) {}
      m.remove(); showToast("Пароль изменён");
    });
  }
  function showTemp(email, pw) {
    const m = document.createElement("div"); m.id = "ps-modal";
    m.innerHTML = `<form><h2>Временный пароль</h2><p class="pm-t">Для ${escH(email)}</p><div class="pm-pw">${escH(pw)}</div>
      <p class="pm-t">Отправьте пароль человеку. Старый пароль больше не работает. При первом входе сайт попросит придумать свой.</p>
      <div class="row"><button type="button" data-copy>Скопировать</button><button class="main" type="submit">Готово</button></div></form>`;
    document.body.appendChild(m);
    const cp = m.querySelector("[data-copy]");
    cp.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(pw); cp.textContent = "Скопировано"; }
      catch (_) { const r = document.createRange(); r.selectNodeContents(m.querySelector(".pm-pw")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent = "Выделено, нажмите Ctrl+C"; }
    });
    m.querySelector("form").addEventListener("submit", e => { e.preventDefault(); m.remove(); });
    cp.focus();
  }
  function showToast(t) { const el = document.getElementById("toast"); if (!el) return; el.textContent = t; el.hidden = false; setTimeout(() => { el.hidden = true; }, 3500); }

  // ---------- живые обновления и блок пользователя ----------
  ready.then(() => {
    sb.channel("docs-changes").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, p => {
      const col = (p.new && p.new.col) || (p.old && p.old.col);
      (col ? [col] : COLS).forEach(c => { if (listeners[c] && listeners[c].size) refresh(c); });
    }).subscribe();
    setInterval(() => { for (const c in listeners) if (listeners[c].size) refresh(c); }, 60000);
    const add = () => {
      const c = document.querySelector(".top .ctrls"); if (!c || c.querySelector(".ps-out")) return;
      c.insertAdjacentHTML("beforeend", `<div class="ps-me"><b>${escH(me.name || me.user.email)}</b>${escH(ROLE_L[me.role] || "")}</div>
        <button class="ps-act ps-pass" type="button">Сменить пароль</button><button class="ps-act ps-out" type="button">Выйти</button>`);
      c.querySelector(".ps-pass").onclick = changePassword;
      c.querySelector(".ps-out").onclick = async () => { await sb.auth.signOut(); location.reload(); };
      if (toastMsg) setTimeout(() => showToast(toastMsg), 600);
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
  });

  window.claude = Object.freeze({
    use: async name => { await ready; return name === "db" ? DB : name === "assets" ? ASSETS : null; },
  });
})();

/* Alga Play KZ — core: store, i18n runtime, router, tasks, profile */
const App = (() => {
  const LS_KEY = "algaplay_kz_v1";
  const RANK_STEP = 5; // wins per rank

  const defaultState = () => ({
    lang: "kk",
    name: "",
    beans: 1000,
    stats: { games: 0, wins: 0 },
    tasks: { date: "", play: 0, wins: 0, claimed: {} },
    relief: { date: "", used: false },   // daily relief beans (救济豆)
    freeFirst: {},                        // per-game first-game-free used (首局免入场)
  });

  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* fresh start */ }
    return defaultState();
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- i18n ---------- */
  function t(key, vars) {
    let s = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]);
    return s;
  }
  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    document.documentElement.lang = S.lang;
  }
  function setLang(lang) {
    S.lang = lang; save();
    applyI18n(); renderTasks(); renderProfile();
    document.dispatchEvent(new CustomEvent("alga:lang"));
  }

  /* ---------- router ---------- */
  const views = ["lobby", "belka", "togyz", "durak", "asyq"];
  function go(view) {
    if (!views.includes(view)) view = "lobby";
    views.forEach(v => {
      document.getElementById("view-" + v).hidden = v !== view;
    });
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    document.dispatchEvent(new CustomEvent("alga:view", { detail: view }));
    window.scrollTo(0, 0);
  }

  /* ---------- beans / results ---------- */
  function beans() { return S.beans; }
  function addBeans(n) {
    S.beans = Math.max(0, S.beans + n); save();
    document.getElementById("beans-balance").textContent = S.beans;
  }
  function canAfford(n) {
    if (S.beans >= n) return true;
    toast(t("not_enough"));
    return false;
  }

  /* ---------- bankruptcy protection (破产保护): always a zero-cost path, never ads ---------- */
  const BREAK_LINE = 100;   // §9: 破产判定线
  const RELIEF = 100;       // §9: 救济豆 100/day ×1 (假设值)
  function reliefAvailable() {
    if (S.relief.date !== today()) { S.relief = { date: today(), used: false }; }
    return !S.relief.used;
  }
  function claimRelief() {
    if (!reliefAvailable()) return false;
    S.relief.used = true;
    addBeans(RELIEF); save();
    toast(t("toast_beans", { n: RELIEF }));
    return true;
  }
  // Games call this instead of canAfford: gates the stake, applies 首局免入场,
  // or opens the guided bankruptcy modal (never a dead toast, never ads).
  function tryStake(gameId, stake, onStart) {
    if (S.beans >= stake) { onStart(); return; }
    if (!S.freeFirst[gameId]) {              // 首局免入场: per-game first game is free
      S.freeFirst[gameId] = true; save();
      toast(t("first_free")); onStart(); return;
    }
    bankruptModal(gameId, stake, onStart);
  }
  function bankruptModal(gameId, stake, onStart) {
    const reliefBtn = reliefAvailable()
      ? `<button class="btn-primary" id="bk-relief">${t("bk_relief_btn", { n: RELIEF })}</button>`
      : `<div class="bk-note muted">${t("bk_relief_gone")}</div>`;
    openModal(t("bk_title"),
      `<p class="muted">${t("bk_sub")}</p>` +
      `<div class="bk-routes">` +
        `<button class="btn-ghost" id="bk-asyq">${t("bk_asyq_btn")}</button>` +
        reliefBtn +
      `</div>`);
    const asyq = document.getElementById("bk-asyq");
    if (asyq) asyq.onclick = () => { closeModal(); go("asyq"); };   // free Асық deep link (#asyq)
    const rb = document.getElementById("bk-relief");
    if (rb) rb.onclick = () => {
      claimRelief(); closeModal();
      if (S.beans >= stake) onStart();   // enough now → straight into the game
    };
  }
  // Lightweight analytics landing point (V1④ formalizes the real pipeline & schema).
  function track(event, props) {
    try {
      const rec = { event, ...props, t: Date.now() };
      (window.__algaEvents = window.__algaEvents || []).push(rec);
      if (window.__algaEvents.length > 200) window.__algaEvents.shift();
    } catch (e) { /* never block gameplay on analytics */ }
  }

  // Every game reports through here: outcome "win" | "lose" | "draw", beansDelta already net
  function reportGame(outcome, beansDelta) {
    S.stats.games++;
    if (outcome === "win") S.stats.wins++;
    touchTasks();
    S.tasks.play++;
    if (outcome === "win") S.tasks.wins++;
    addBeans(beansDelta);
    save();
    renderTasks(); renderProfile();
    track("game_end", { outcome });
    // win high moment: the one place we ask for install (PWA module decides how)
    if (outcome === "win") document.dispatchEvent(new CustomEvent("alga:gamewin"));
  }

  /* ---------- daily tasks ---------- */
  const TASKS = [
    { id: "play1", label: "task_play1", goal: 1, field: "play", reward: 50 },
    { id: "win1",  label: "task_win1",  goal: 1, field: "wins", reward: 80 },
    { id: "play3", label: "task_play3", goal: 3, field: "play", reward: 120 },
  ];
  function today() { return new Date().toISOString().slice(0, 10); }
  function touchTasks() {
    if (S.tasks.date !== today()) S.tasks = { date: today(), play: 0, wins: 0, claimed: {} };
  }
  function renderTasks() {
    touchTasks();
    const box = document.getElementById("tasks-list");
    box.innerHTML = "";
    TASKS.forEach(task => {
      const cur = Math.min(S.tasks[task.field], task.goal);
      const claimed = !!S.tasks.claimed[task.id];
      const row = document.createElement("div");
      row.className = "task-row";
      row.innerHTML =
        `<div><div class="task-name">${t(task.label)}</div>` +
        `<div class="task-progress">${cur}/${task.goal} · +${task.reward} 🫘</div></div>`;
      if (claimed) {
        row.insertAdjacentHTML("beforeend", `<span class="task-done">${t("done")}</span>`);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn-claim";
        btn.textContent = t("claim");
        btn.disabled = cur < task.goal;
        btn.onclick = () => {
          S.tasks.claimed[task.id] = true;
          addBeans(task.reward); save();
          toast(t("toast_beans", { n: task.reward }));
          renderTasks();
        };
        row.appendChild(btn);
      }
      box.appendChild(row);
    });
  }

  /* ---------- profile ---------- */
  function displayName() { return S.name || t("you"); }
  function renderProfile() {
    const name = displayName();
    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-avatar").textContent = name.slice(0, 1).toUpperCase();
    const ranks = t("rank_names");
    const ri = Math.min(ranks.length - 1, Math.floor(S.stats.wins / RANK_STEP));
    document.getElementById("profile-rank").textContent =
      `${t("rank")}: ${ranks[ri]} · ${S.stats.wins}/${Math.min(ranks.length - 1, ri + 1) * RANK_STEP}`;
    const wr = S.stats.games ? Math.round(100 * S.stats.wins / S.stats.games) : 0;
    document.getElementById("profile-stats").innerHTML =
      `<div class="stat-box"><b>${S.stats.games}</b><span>${t("stat_games")}</span></div>` +
      `<div class="stat-box"><b>${S.stats.wins}</b><span>${t("stat_wins")}</span></div>` +
      `<div class="stat-box"><b>${wr}%</b><span>${t("stat_winrate")}</span></div>`;
    document.getElementById("beans-balance").textContent = S.beans;
  }
  function editName() {
    openModal(t("nickname_title"),
      `<p class="muted">${t("nickname_sub")}</p>` +
      `<input id="nick-input" maxlength="16" value="${escapeHtml(S.name)}">` +
      `<button class="btn-primary" id="nick-save">${t("save")}</button>`);
    document.getElementById("nick-save").onclick = () => {
      S.name = document.getElementById("nick-input").value.trim().slice(0, 16);
      save(); renderProfile(); closeModal(); toast(t("toast_saved"));
    };
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- modal & toast ---------- */
  function openModal(title, html) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = html;
    document.getElementById("modal-backdrop").hidden = false;
  }
  function closeModal() { document.getElementById("modal-backdrop").hidden = true; }
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /* ---------- shared helpers for games ---------- */
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function init() {
    document.getElementById("lang-select").value = S.lang;
    document.getElementById("lang-select").onchange = e => setLang(e.target.value);
    document.getElementById("btn-edit-name").onclick = editName;
    document.getElementById("modal-backdrop").addEventListener("click", e => {
      if (e.target.id === "modal-backdrop") closeModal();
    });
    applyI18n(); renderTasks(); renderProfile();
    go((location.hash || "#lobby").slice(1));
  }

  return {
    init, go, t, setLang, lang: () => S.lang,
    beans, addBeans, canAfford, tryStake, reportGame, track,
    displayName, openModal, closeModal, toast,
    el, shuffle, sleep, escapeHtml,
  };
})();

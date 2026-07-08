/* Тоғызқұмалақ — Kazakh national mancala. Player = side 0 (pits 0-8), AI = side 1 (pits 9-17). */
const GameTogyz = (() => {
  const STAKE = 100;
  const AI_DEPTH = 5;
  let root = null;
  let st = null;        // {b:[18], kaz:[2], tuz:[2], turn, over, winner, lastIdx}
  let busy = false;
  let statusMsg = "";

  /* ---------- engine ---------- */
  function newState() {
    return { b: Array(18).fill(9), kaz: [0, 0], tuz: [-1, -1], turn: 0, over: false, winner: null, lastIdx: -1 };
  }
  function ownPits(side) { return side === 0 ? [0,1,2,3,4,5,6,7,8] : [9,10,11,12,13,14,15,16,17]; }
  function onSide(idx, side) { return side === 0 ? idx < 9 : idx >= 9; }
  function pitNum(idx) { return idx < 9 ? idx + 1 : idx - 9 + 1; } // 1..9 within its row
  function legalMoves(s, side) { return ownPits(side).filter(i => s.b[i] > 0); }
  function clone(s) {
    return { b: s.b.slice(), kaz: s.kaz.slice(), tuz: s.tuz.slice(), turn: s.turn, over: s.over, winner: s.winner, lastIdx: s.lastIdx };
  }

  // Apply move; returns events {captured, tuzMade}
  function applyMove(s, pit) {
    const me = s.turn, opp = 1 - me;
    const ev = { captured: 0, tuzMade: false };
    let n = s.b[pit];
    let idx = pit;
    if (n === 1) {
      s.b[pit] = 0;
      idx = (pit + 1) % 18;
      drop(s, idx);
    } else {
      s.b[pit] = 1;
      let toSow = n - 1;
      while (toSow > 0) {
        idx = (idx + 1) % 18;
        drop(s, idx);
        toSow--;
      }
    }
    s.lastIdx = idx;
    // last-stone effects only if it landed in a normal pit on opponent side
    if (idx !== s.tuz[0] && idx !== s.tuz[1] && onSide(idx, opp)) {
      if (s.b[idx] === 3 && s.tuz[me] === -1 &&
          pitNum(idx) !== 9 &&
          (s.tuz[opp] === -1 || pitNum(s.tuz[opp]) !== pitNum(idx))) {
        s.tuz[me] = idx;
        s.kaz[me] += 3;
        s.b[idx] = 0;
        ev.tuzMade = true;
      } else if (s.b[idx] % 2 === 0) {
        ev.captured = s.b[idx];
        s.kaz[me] += s.b[idx];
        s.b[idx] = 0;
      }
    }
    s.turn = opp;
    checkEnd(s);
    return ev;
  }
  function drop(s, idx) {
    if (idx === s.tuz[0]) s.kaz[0]++;
    else if (idx === s.tuz[1]) s.kaz[1]++;
    else s.b[idx]++;
  }
  function checkEnd(s) {
    if (s.kaz[0] >= 82) { s.over = true; s.winner = 0; return; }
    if (s.kaz[1] >= 82) { s.over = true; s.winner = 1; return; }
    if (s.kaz[0] === 81 && s.kaz[1] === 81) { s.over = true; s.winner = -1; return; }
    if (legalMoves(s, s.turn).length === 0) {
      // player to move is starved: opponent sweeps their own remaining stones
      const opp = 1 - s.turn;
      ownPits(opp).forEach(i => { s.kaz[opp] += s.b[i]; s.b[i] = 0; });
      s.over = true;
      s.winner = s.kaz[0] > s.kaz[1] ? 0 : s.kaz[1] > s.kaz[0] ? 1 : -1;
    }
  }

  /* ---------- AI: minimax + alpha-beta (side 1 maximizes) ---------- */
  function evalState(s) {
    let v = (s.kaz[1] - s.kaz[0]) * 10;
    if (s.tuz[1] !== -1) v += 25;
    if (s.tuz[0] !== -1) v -= 25;
    // small mobility/material term
    let mat = 0;
    for (let i = 0; i < 9; i++) mat -= s.b[i];
    for (let i = 9; i < 18; i++) mat += s.b[i];
    return v + mat * 0.1;
  }
  function minimax(s, depth, alpha, beta) {
    if (s.over) {
      if (s.winner === 1) return 10000 + depth;
      if (s.winner === 0) return -10000 - depth;
      return 0;
    }
    if (depth === 0) return evalState(s);
    const moves = legalMoves(s, s.turn);
    if (s.turn === 1) {
      let best = -Infinity;
      for (const m of moves) {
        const ns = clone(s); applyMove(ns, m);
        best = Math.max(best, minimax(ns, depth - 1, alpha, beta));
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        const ns = clone(s); applyMove(ns, m);
        best = Math.min(best, minimax(ns, depth - 1, alpha, beta));
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    }
  }
  function aiBestMove(s) {
    const moves = legalMoves(s, 1);
    let best = moves[0], bestVal = -Infinity;
    for (const m of moves) {
      const ns = clone(s); applyMove(ns, m);
      const v = minimax(ns, AI_DEPTH - 1, -Infinity, Infinity);
      if (v > bestVal) { bestVal = v; best = m; }
    }
    return best;
  }

  /* ---------- UI ---------- */
  const t = (k, v) => App.t(k, v);

  function startScreen() {
    root.innerHTML = "";
    const box = App.el("div", "start-screen");
    box.appendChild(App.el("div", null, "<span style='font-size:56px'>⚫</span>"));
    box.appendChild(App.el("p", null, t("togyz_start_sub")));
    const btn = App.el("button", "btn-primary", t("play"));
    btn.onclick = () => App.tryStake("togyz", STAKE, startGame);
    box.appendChild(btn);
    root.appendChild(box);
  }

  function startGame() {
    st = newState();
    busy = false;
    statusMsg = t("togyz_pick");
    render();
  }

  function render() {
    if (!st) { startScreen(); return; }
    root.innerHTML = "";
    const wrap = App.el("div", "togyz-wrap");

    const board = App.el("div", "togyz-board");
    // top row: AI pits displayed 17..9 (counter-clockwise layout)
    const top = App.el("div", "togyz-row");
    for (let i = 17; i >= 9; i--) top.appendChild(pitEl(i, false));
    board.appendChild(top);

    const mid = App.el("div", "togyz-mid");
    const kazAi = App.el("div", "kazan",
      `<span class="kz-name">${t("bot")} · ${t("score")}</span><span class="kz-count">${st.kaz[1]}</span>`);
    const kazMe = App.el("div", "kazan",
      `<span class="kz-count">${st.kaz[0]}</span><span class="kz-name">${App.escapeHtml(App.displayName())} · ${t("score")}</span>`);
    mid.appendChild(kazAi); mid.appendChild(kazMe);
    board.appendChild(mid);

    const bottom = App.el("div", "togyz-row");
    for (let i = 0; i <= 8; i++) bottom.appendChild(pitEl(i, true));
    board.appendChild(bottom);
    wrap.appendChild(board);

    wrap.appendChild(App.el("div", "game-status", statusMsg));

    if (st.over) wrap.appendChild(resultBanner());
    root.appendChild(wrap);
  }

  function pitEl(i, mine) {
    const isTuz = st.tuz[0] === i || st.tuz[1] === i;
    const cls = ["pit"];
    if (isTuz) cls.push("tuz");
    if (mine && !isTuz && st.b[i] > 0 && !st.over && st.turn === 0 && !busy) cls.push("mine");
    if (mine && (st.b[i] === 0 || isTuz)) cls.push("empty");
    if (st.lastIdx === i) cls.push("last-move");
    const p = App.el("div", cls.join(" "));
    const balls = Math.min(st.b[i], 18);
    let dots = "";
    for (let d = 0; d < balls; d++) dots += "<span class='ball'></span>";
    p.innerHTML =
      `<span class="pit-num">${pitNum(i)}</span>` +
      `<span class="pit-count">${st.b[i]}</span>` +
      `<span class="pit-balls">${dots}</span>`;
    if (cls.includes("mine")) p.onclick = () => playerMove(i);
    return p;
  }

  async function playerMove(i) {
    if (busy || st.over || st.turn !== 0) return;
    busy = true;
    const ev = applyMove(st, i);
    announce(ev, 0);
    render();
    if (!st.over) {
      statusMsg = t("ai_thinking");
      render();
      await App.sleep(500);
      const m = aiBestMove(st);
      const ev2 = applyMove(st, m);
      announce(ev2, 1);
      if (!st.over && !statusMsg) statusMsg = t("togyz_pick");
    }
    if (st.over) finish();
    busy = false;
    render();
  }

  function announce(ev, side) {
    if (ev.tuzMade) statusMsg = t(side === 0 ? "togyz_tuz_you" : "togyz_tuz_ai");
    else if (ev.captured > 0 && side === 0) statusMsg = t("togyz_capture", { n: ev.captured });
    else statusMsg = st.turn === 0 ? t("togyz_pick") : t("ai_thinking");
  }

  function finish() {
    if (st.winner === 0) {
      statusMsg = t("togyz_win", { n: STAKE });
      App.reportGame("win", STAKE);
    } else if (st.winner === 1) {
      statusMsg = t("togyz_lose", { n: STAKE });
      App.reportGame("lose", -STAKE);
    } else {
      statusMsg = t("togyz_draw");
      App.reportGame("draw", 0);
    }
  }

  function resultBanner() {
    const b = App.el("div", "result-banner");
    const cls = st.winner === 0 ? "win" : st.winner === 1 ? "lose" : "";
    const title = st.winner === 0 ? t("win") : st.winner === 1 ? t("lose") : t("draw");
    b.innerHTML = `<h3 class="${cls}">${title}</h3><div>${st.kaz[0]} : ${st.kaz[1]}</div>`;
    const acts = App.el("div", "actions");
    const again = App.el("button", "btn-primary", t("play_again"));
    again.onclick = () => { st = null; startScreen(); App.tryStake("togyz", STAKE, startGame); };
    const back = App.el("button", "btn-ghost", t("to_lobby"));
    back.onclick = () => { st = null; App.go("lobby"); };
    acts.appendChild(again); acts.appendChild(back);
    b.appendChild(acts);
    return b;
  }

  function open() {
    root = document.getElementById("togyz-root");
    if (!st) startScreen(); else render();
  }
  function onLang() { if (root) { if (st && !st.over) statusMsg = st.turn === 0 ? t("togyz_pick") : t("ai_thinking"); open(); } }
  function rules() { App.openModal("Тоғызқұмалақ — " + t("rules"), t("togyz_rules_html")); }

  return { open, onLang, rules };
})();

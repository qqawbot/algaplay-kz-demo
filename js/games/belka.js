/* Белка — 2v2 trick-taking card game, 32 cards. Seats: 0=you(S), 1=E, 2=partner(N), 3=W. Teams: 0/2 vs 1/3. */
const GameBelka = (() => {
  const STAKE = 100;
  const ROUNDS_TO_WIN = 3;
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["7", "8", "9", "J", "Q", "K", "10", "A"]; // ascending strength
  const POINTS = { A: 11, "10": 10, K: 4, Q: 3, J: 2, "9": 0, "8": 0, "7": 0 };

  let root = null;
  let st = null; // {hands, trick, leader, turn, trump, roundPts, tricksWon, eggs, phase, msg, lastTrickWinner}
  let busy = false;

  const t = (k, v) => App.t(k, v);
  const isRed = s => s === "♥" || s === "♦";
  const strength = c => RANKS.indexOf(c.r);
  const teamOf = seat => seat % 2; // 0 = you+partner, 1 = opponents

  function deck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ s, r });
    return App.shuffle(d);
  }

  function seatName(seat) {
    if (seat === 0) return App.displayName();
    if (seat === 2) return t("partner");
    return t("opp") + " " + (seat === 1 ? "A" : "B");
  }

  /* ---------- flow ---------- */
  function startScreen() {
    root.innerHTML = "";
    const box = App.el("div", "start-screen");
    box.appendChild(App.el("div", null, "<span style='font-size:56px'>🐿️</span>"));
    box.appendChild(App.el("p", null, t("belka_start_sub")));
    const btn = App.el("button", "btn-primary", t("play"));
    btn.onclick = () => App.tryStake("belka", STAKE, startMatch);
    box.appendChild(btn);
    root.appendChild(box);
  }

  function startMatch() {
    st = { eggs: [0, 0], phase: "playing", msg: "" };
    startRound(Math.floor(Math.random() * 4));
    render();
    pump();
  }

  function startRound(leader) {
    const d = deck();
    st.hands = [[], [], [], []];
    for (let i = 0; i < 32; i++) st.hands[i % 4].push(d[i]);
    st.hands.forEach(h => h.sort((a, b) => a.s === b.s ? strength(b) - strength(a) : SUITS.indexOf(a.s) - SUITS.indexOf(b.s)));
    st.trump = SUITS[Math.floor(Math.random() * 4)];
    st.trick = [];
    st.leader = leader;
    st.turn = leader;
    st.roundPts = [0, 0];
    st.tricksTaken = 0;
    st.msg = st.turn === 0 ? t("belka_lead") : t("ai_thinking");
  }

  async function pump() {
    // drive bot turns until it's the player's turn or round/match pauses
    while (st && st.phase === "playing" && st.turn !== 0) {
      busy = true;
      render();
      await App.sleep(650);
      if (!st || st.phase !== "playing") break;
      const card = botPick(st.turn);
      await playCard(st.turn, card);
    }
    busy = false;
    if (st) render();
  }

  function legalCards(seat) {
    const hand = st.hands[seat];
    if (st.trick.length === 0) return hand.slice();
    const led = st.trick[0].card.s;
    const follow = hand.filter(c => c.s === led);
    return follow.length ? follow : hand.slice();
  }

  function trickWinner() {
    let best = 0;
    for (let i = 1; i < st.trick.length; i++) {
      const a = st.trick[best].card, b = st.trick[i].card;
      const led = st.trick[0].card.s;
      const av = (a.s === st.trump ? 100 : a.s === led ? 50 : 0) + strength(a);
      const bv = (b.s === st.trump ? 100 : b.s === led ? 50 : 0) + strength(b);
      if (bv > av) best = i;
    }
    return st.trick[best].seat;
  }

  async function playCard(seat, card) {
    const hand = st.hands[seat];
    hand.splice(hand.findIndex(c => c.s === card.s && c.r === card.r), 1);
    st.trick.push({ seat, card });
    render();

    if (st.trick.length === 4) {
      await App.sleep(900);
      const winner = trickWinner();
      const pts = st.trick.reduce((sum, p) => sum + POINTS[p.card.r], 0);
      st.roundPts[teamOf(winner)] += pts;
      st.tricksTaken++;
      if (st.tricksTaken === 8) st.roundPts[teamOf(winner)] += 10; // last trick bonus
      st.trick = [];
      st.leader = winner;
      st.turn = winner;
      st.msg = t("belka_trick_won", { name: seatName(winner) });
      render();
      await App.sleep(650);
      if (st.tricksTaken === 8) { endRound(); return; }
      st.msg = st.turn === 0 ? t("belka_lead") : t("ai_thinking");
    } else {
      st.turn = (st.turn + 1) % 4;
      if (st.turn === 0) st.msg = st.trick.length ? t("belka_follow") : t("belka_lead");
    }
    render();
  }

  function endRound() {
    const [my, their] = st.roundPts;
    if (my === their) { // 65:65 — replay, nobody scores
      st.msg = `${my} : ${their}`;
      st.phase = "round-over";
      st.roundWinner = -1;
    } else {
      const w = my > their ? 0 : 1;
      st.eggs[w]++;
      st.roundWinner = w;
      st.msg = w === 0 ? t("belka_round_win", { a: my, b: their }) : t("belka_round_lose", { a: my, b: their });
      if (st.eggs[w] >= ROUNDS_TO_WIN) {
        st.phase = "match-over";
        if (w === 0) { st.msg = t("belka_match_win", { n: STAKE }); App.reportGame("win", STAKE); }
        else { st.msg = t("belka_match_lose", { n: STAKE }); App.reportGame("lose", -STAKE); }
        render();
        return;
      }
      st.phase = "round-over";
    }
    render();
  }

  function nextRound() {
    st.phase = "playing";
    startRound((st.leader + 1) % 4);
    render();
    pump();
  }

  /* ---------- bot ---------- */
  function botPick(seat) {
    const legal = legalCards(seat);
    if (st.trick.length === 0) {
      // lead: ace first, else lowest non-trump, else lowest
      const ace = legal.find(c => c.r === "A" && c.s !== st.trump);
      if (ace) return ace;
      const nonTrump = legal.filter(c => c.s !== st.trump);
      const pool = nonTrump.length ? nonTrump : legal;
      return pool.reduce((m, c) => strength(c) < strength(m) ? c : m);
    }
    const winSeat = trickWinner();
    const partnerWinning = teamOf(winSeat) === teamOf(seat);
    const beats = c => {
      const probe = { seat, card: c };
      st.trick.push(probe);
      const w = trickWinner();
      st.trick.pop();
      return w === seat;
    };
    const winning = legal.filter(beats);
    if (partnerWinning || winning.length === 0) {
      // dump: lowest points, prefer non-trump
      const pool = legal.filter(c => c.s !== st.trump);
      const src = pool.length ? pool : legal;
      return src.reduce((m, c) => (POINTS[c.r] - strength(c) * 0.01) < (POINTS[m.r] - strength(m) * 0.01) ? c : m);
    }
    // win as cheaply as possible
    return winning.reduce((m, c) => (POINTS[c.r] * 10 + strength(c)) < (POINTS[m.r] * 10 + strength(m)) ? c : m);
  }

  /* ---------- render ---------- */
  function cardEl(card, opts = {}) {
    const el = App.el("div", "pcard" + (isRed(card.s) ? " red" : "") + (opts.cls || ""));
    el.innerHTML = `<span>${card.r}<span style="font-size:11px">${card.s}</span></span><span class="suit-b">${card.s}</span>`;
    return el;
  }
  function backEl() { return App.el("div", "pcard back"); }

  function render() {
    if (!st) { startScreen(); return; }
    root.innerHTML = "";
    const felt = App.el("div", "table-felt");

    // score strip
    const strip = App.el("div", "score-strip",
      `<span>${t("round")}: <b>${st.eggs[0]}</b> : <b>${st.eggs[1]}</b></span>` +
      `<span>${t("score")}: <b>${st.roundPts[0]}</b> : <b>${st.roundPts[1]}</b></span>` +
      `<span class="trump-chip">${t("trump")}: <span style="font-size:17px;${isRed(st.trump) ? "color:#ff8a8a" : ""}">${st.trump}</span></span>`);
    felt.appendChild(strip);

    // seats
    const seats = [
      { seat: 2, style: "top:44px;left:50%;transform:translateX(-50%)" },
      { seat: 3, style: "left:14px;top:42%;transform:translateY(-50%)" },
      { seat: 1, style: "right:14px;top:42%;transform:translateY(-50%)" },
    ];
    for (const { seat, style } of seats) {
      const s = App.el("div", "seat");
      s.style.cssText = style;
      const lbl = App.el("div", "seat-label" + (st.turn === seat && st.phase === "playing" ? " active" : ""), App.escapeHtml(seatName(seat)));
      s.appendChild(lbl);
      s.appendChild(App.el("div", "seat-cards", "🂠 × " + st.hands[seat].length));
      felt.appendChild(s);
    }

    // trick area
    const trick = App.el("div", "trick-area");
    const pos = { 0: "left:84px;top:88px", 1: "left:150px;top:46px", 2: "left:84px;top:4px", 3: "left:18px;top:46px" };
    for (const p of st.trick) {
      const c = cardEl(p.card);
      c.classList.add("trick-card");
      c.style.cssText += pos[p.seat];
      trick.appendChild(c);
    }
    felt.appendChild(trick);

    // status
    const status = App.el("div", "game-status", st.msg);
    status.style.cssText = "position:absolute;left:50%;bottom:116px;transform:translateX(-50%);margin:0;white-space:nowrap";
    felt.appendChild(status);

    // your hand
    const handRow = App.el("div", "hand-row");
    const myTurn = st.phase === "playing" && st.turn === 0 && !busy;
    const legal = myTurn ? legalCards(0) : [];
    const youLbl = App.el("div", "seat-label" + (st.turn === 0 && st.phase === "playing" ? " active" : ""), App.escapeHtml(seatName(0)));
    youLbl.style.cssText = "align-self:center;margin-top:auto;margin-bottom:2px";
    felt.appendChild(youLbl);
    for (const c of st.hands[0]) {
      const el = cardEl(c);
      const ok = legal.some(l => l.s === c.s && l.r === c.r);
      if (myTurn && ok) {
        el.classList.add("clickable");
        el.onclick = async () => {
          if (busy || st.turn !== 0 || st.phase !== "playing") return;
          busy = true;
          await playCard(0, c);
          busy = false;
          pump();
        };
      } else if (myTurn) {
        el.classList.add("disabled");
      }
      handRow.appendChild(el);
    }
    felt.appendChild(handRow);
    root.appendChild(felt);

    // round / match banners
    if (st.phase === "round-over") {
      const b = App.el("div", "result-banner");
      b.innerHTML = `<h3 class="${st.roundWinner === 0 ? "win" : st.roundWinner === 1 ? "lose" : ""}">${st.msg}</h3>`;
      const acts = App.el("div", "actions");
      const btn = App.el("button", "btn-primary", t("play") + " ▶");
      btn.onclick = nextRound;
      acts.appendChild(btn);
      b.appendChild(acts);
      root.appendChild(b);
    } else if (st.phase === "match-over") {
      const won = st.eggs[0] > st.eggs[1];
      const b = App.el("div", "result-banner");
      b.innerHTML = `<h3 class="${won ? "win" : "lose"}">${won ? t("win") : t("lose")}</h3><div>${st.msg}</div>`;
      const acts = App.el("div", "actions");
      const again = App.el("button", "btn-primary", t("play_again"));
      again.onclick = () => { st = null; startScreen(); App.tryStake("belka", STAKE, startMatch); };
      const back = App.el("button", "btn-ghost", t("to_lobby"));
      back.onclick = () => { st = null; App.go("lobby"); };
      acts.appendChild(again); acts.appendChild(back);
      b.appendChild(acts);
      root.appendChild(b);
    }
  }

  function open() {
    root = document.getElementById("belka-root");
    if (!st) startScreen(); else render();
  }
  function onLang() { if (root) open(); }
  function rules() { App.openModal("Белка — " + t("rules"), t("belka_rules_html")); }

  return { open, onLang, rules };
})();

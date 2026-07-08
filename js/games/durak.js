/* Дурак (подкидной) — heads-up vs AI. 36 cards. Player = 0, AI = 1. One undefended attack at a time. */
const GameDurak = (() => {
  const STAKE = 100;
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  let root = null;
  let st = null;
  let busy = false;

  const t = (k, v) => App.t(k, v);
  const isRed = s => s === "♥" || s === "♦";
  const rk = c => RANKS.indexOf(c.r);

  function deck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ s, r });
    return App.shuffle(d);
  }

  function beats(d, a) {
    if (d.s === a.s) return rk(d) > rk(a);
    return d.s === st.trump && a.s !== st.trump;
  }
  function tableRanks() {
    const set = new Set();
    st.table.forEach(p => { set.add(p.a.r); if (p.d) set.add(p.d.r); });
    return set;
  }
  function undefended() { return st.table.find(p => !p.d) || null; }
  function sortHand(h) {
    h.sort((a, b) => {
      const at = a.s === st.trump, bt = b.s === st.trump;
      if (at !== bt) return at ? 1 : -1;
      if (a.s !== b.s) return SUITS.indexOf(a.s) - SUITS.indexOf(b.s);
      return rk(a) - rk(b);
    });
  }

  /* ---------- flow ---------- */
  function startScreen() {
    root.innerHTML = "";
    const box = App.el("div", "start-screen");
    box.appendChild(App.el("div", null, "<span style='font-size:56px'>🃏</span>"));
    box.appendChild(App.el("p", null, t("durak_start_sub")));
    const btn = App.el("button", "btn-primary", t("play"));
    btn.onclick = () => App.tryStake("durak", STAKE, startGame);
    box.appendChild(btn);
    root.appendChild(box);
  }

  function startGame() {
    const d = deck();
    st = {
      deck: d,
      trumpCard: d[0],           // bottom of the deck, drawn last
      trump: d[0].s,
      hands: [[], []],
      table: [],
      attacker: 0,
      boutLimit: 6,
      aiTaking: false,
      over: false,
      winner: null,
      msg: "",
    };
    for (let i = 0; i < 6; i++) { st.hands[0].push(d.pop()); st.hands[1].push(d.pop()); }
    sortHand(st.hands[0]); sortHand(st.hands[1]);
    // lowest trump attacks first
    const low = side => st.hands[side].filter(c => c.s === st.trump).reduce((m, c) => m === null || rk(c) < rk(m) ? c : m, null);
    const l0 = low(0), l1 = low(1);
    st.attacker = (l1 && (!l0 || rk(l1) < rk(l0))) ? 1 : 0;
    st.boutLimit = 6;
    st.msg = st.attacker === 0 ? t("durak_attack") : t("ai_thinking");
    render();
    if (st.attacker === 1) aiAttackLoop();
  }

  function draw() {
    // attacker draws first, then defender
    const order = [st.attacker, 1 - st.attacker];
    for (const side of order) {
      while (st.hands[side].length < 6 && st.deck.length > 0) st.hands[side].push(st.deck.pop());
      sortHand(st.hands[side]);
    }
  }

  function checkEnd() {
    if (st.deck.length > 0) return false;
    const e0 = st.hands[0].length === 0, e1 = st.hands[1].length === 0;
    if (!e0 && !e1) return false;
    st.over = true;
    st.winner = e0 && e1 ? -1 : e0 ? 0 : 1;
    if (st.winner === 0) { st.msg = t("durak_win", { n: STAKE }); App.reportGame("win", STAKE, "durak"); }
    else if (st.winner === 1) { st.msg = t("durak_lose", { n: STAKE }); App.reportGame("lose", -STAKE, "durak"); }
    else { st.msg = t("draw"); App.reportGame("draw", 0, "durak"); }
    return true;
  }

  function endBout(defenderTook) {
    if (defenderTook) {
      const defender = 1 - st.attacker;
      st.table.forEach(p => { st.hands[defender].push(p.a); if (p.d) st.hands[defender].push(p.d); });
      sortHand(st.hands[defender]);
      st.table = [];
      draw();
      // attacker keeps the attack
    } else {
      st.table = [];
      draw();
      st.attacker = 1 - st.attacker;
    }
    st.aiTaking = false;
    st.boutLimit = Math.min(6, st.hands[1 - st.attacker].length);
    if (checkEnd()) { render(); return; }
    st.msg = st.attacker === 0 ? t("durak_attack") : t("ai_thinking");
    render();
    if (st.attacker === 1) aiAttackLoop();
  }

  /* ---------- AI ---------- */
  function aiCheapestDefense(a) {
    const opts = st.hands[1].filter(c => beats(c, a));
    if (!opts.length) return null;
    opts.sort((x, y) => (x.s === st.trump ? 100 + rk(x) : rk(x)) - (y.s === st.trump ? 100 + rk(y) : rk(y)));
    const best = opts[0];
    // don't burn a big trump on a small non-trump card early
    if (best.s === st.trump && a.s !== st.trump && rk(best) >= RANKS.indexOf("K") && st.deck.length > 4 && rk(a) < RANKS.indexOf("10")) return null;
    return best;
  }
  function aiAttackCard() {
    const h = st.hands[1];
    if (!h.length) return null;
    if (st.table.length === 0) {
      const nonTrump = h.filter(c => c.s !== st.trump);
      const pool = nonTrump.length ? nonTrump : h;
      return pool.reduce((m, c) => rk(c) < rk(m) ? c : m);
    }
    if (st.table.length >= st.boutLimit || st.hands[0].length === 0) return null;
    const ranks = tableRanks();
    const opts = h.filter(c => ranks.has(c.r) && c.s !== st.trump && rk(c) <= RANKS.indexOf("Q"));
    if (!opts.length) return null;
    return opts.reduce((m, c) => rk(c) < rk(m) ? c : m);
  }

  async function aiAttackLoop() {
    busy = true;
    await App.sleep(700);
    if (!st || st.over) { busy = false; return; }
    const card = aiAttackCard();
    if (!card) { busy = false; endBout(false); return; } // nothing to attack with -> бито
    st.hands[1].splice(st.hands[1].indexOf(card), 1);
    st.table.push({ a: card, d: null });
    st.msg = t("durak_defend");
    busy = false;
    render();
  }

  /* ---------- player actions ---------- */
  async function playerClick(card) {
    if (busy || !st || st.over) return;
    const me = st.hands[0];
    if (st.attacker === 0) {
      // attacking / adding
      if (undefended()) return;
      if (st.table.length >= st.boutLimit || st.hands[1].length === 0) return;
      if (st.table.length > 0 && !tableRanks().has(card.r)) return;
      me.splice(me.indexOf(card), 1);
      st.table.push({ a: card, d: null });
      render();
      if (st.aiTaking) { st.msg = t("durak_add_or_done"); render(); return; }
      // AI defends
      busy = true;
      await App.sleep(650);
      const def = aiCheapestDefense(card);
      if (def) {
        st.hands[1].splice(st.hands[1].indexOf(def), 1);
        undefended().d = def;
        st.msg = t("durak_add_or_done");
      } else {
        st.aiTaking = true;
        st.msg = t("durak_ai_took") + " · " + t("durak_add_or_done");
      }
      busy = false;
      render();
    } else {
      // defending
      const u = undefended();
      if (!u || !beats(card, u.a)) return;
      me.splice(me.indexOf(card), 1);
      u.d = card;
      render();
      if (st.hands[0].length === 0 || st.table.length >= st.boutLimit) {
        // defender out of cards or bout full -> бито
        busy = true;
        await App.sleep(600);
        busy = false;
        endBout(false);
        return;
      }
      st.msg = t("ai_thinking");
      aiAttackLoop();
    }
  }

  function playerTake() {
    if (busy || !st || st.over || st.attacker !== 1 || !undefended()) return;
    st.msg = t("durak_you_took");
    endBout(true);
  }
  function playerDone() {
    if (busy || !st || st.over || st.attacker !== 0 || st.table.length === 0) return;
    if (st.aiTaking) { endBout(true); return; }
    if (undefended()) return;
    endBout(false);
  }

  /* ---------- render ---------- */
  function cardEl(card, cls) {
    const el = App.el("div", "pcard" + (isRed(card.s) ? " red" : "") + (cls ? " " + cls : ""));
    el.innerHTML = `<span>${card.r}<span style="font-size:11px">${card.s}</span></span><span class="suit-b">${card.s}</span>`;
    return el;
  }

  function canPlayerUse(card) {
    if (st.over || busy) return false;
    if (st.attacker === 0) {
      if (undefended() && !st.aiTaking) return false;
      if (st.table.length >= st.boutLimit || st.hands[1].length === 0) return false;
      return st.table.length === 0 || tableRanks().has(card.r);
    }
    const u = undefended();
    return !!u && beats(card, u.a);
  }

  function render() {
    if (!st) { startScreen(); return; }
    root.innerHTML = "";
    const felt = App.el("div", "table-felt");

    // AI seat
    const seat = App.el("div", "seat");
    seat.style.cssText = "top:14px;left:50%;transform:translateX(-50%)";
    seat.appendChild(App.el("div", "seat-label" + (st.attacker === 1 && !st.over ? " active" : ""), t("bot")));
    seat.appendChild(App.el("div", "seat-cards", "🂠 × " + st.hands[1].length));
    felt.appendChild(seat);

    // deck info
    const di = App.el("div", "durak-deckinfo");
    if (st.deck.length > 0) {
      const tc = cardEl(st.trumpCard);
      tc.style.transform = "rotate(90deg)";
      di.appendChild(tc);
      di.appendChild(App.el("div", "cnt", "🂠 " + st.deck.length));
    } else {
      di.appendChild(App.el("div", "trump-chip", t("trump") + " " + st.trump));
    }
    felt.appendChild(di);

    // field
    const field = App.el("div", "durak-field");
    field.style.marginTop = "56px";
    for (const p of st.table) {
      const pair = App.el("div", "durak-pair");
      pair.appendChild(cardEl(p.a));
      if (p.d) { const d = cardEl(p.d, "defend"); pair.appendChild(d); }
      field.appendChild(pair);
    }
    felt.appendChild(field);

    felt.appendChild(App.el("div", "game-status", st.msg));

    // actions
    const acts = App.el("div", "durak-actions");
    if (!st.over) {
      if (st.attacker === 1 && undefended()) {
        const take = App.el("button", "btn-ghost", t("durak_take"));
        take.onclick = playerTake;
        acts.appendChild(take);
      }
      if (st.attacker === 0 && st.table.length > 0 && (st.aiTaking || !undefended())) {
        const done = App.el("button", "btn-primary", t("durak_done"));
        done.onclick = playerDone;
        acts.appendChild(done);
      }
    }
    felt.appendChild(acts);

    // hand
    const youLbl = App.el("div", "seat-label" + (st.attacker === 0 && !st.over ? " active" : ""), App.escapeHtml(App.displayName()));
    youLbl.style.cssText = "align-self:center;margin-bottom:2px";
    felt.appendChild(youLbl);
    const handRow = App.el("div", "hand-row");
    for (const c of st.hands[0]) {
      const el = cardEl(c);
      if (canPlayerUse(c)) {
        el.classList.add("clickable");
        el.onclick = () => playerClick(c);
      } else if (!st.over) {
        el.classList.add("disabled");
      }
      handRow.appendChild(el);
    }
    felt.appendChild(handRow);
    root.appendChild(felt);

    if (st.over) {
      const b = App.el("div", "result-banner");
      const cls = st.winner === 0 ? "win" : st.winner === 1 ? "lose" : "";
      b.innerHTML = `<h3 class="${cls}">${st.msg}</h3>`;
      const acts2 = App.el("div", "actions");
      const again = App.el("button", "btn-primary", t("play_again"));
      again.onclick = () => { st = null; startScreen(); App.tryStake("durak", STAKE, startGame); };
      const back = App.el("button", "btn-ghost", t("to_lobby"));
      back.onclick = () => { st = null; App.go("lobby"); };
      acts2.appendChild(again); acts2.appendChild(back);
      b.appendChild(acts2);
      root.appendChild(b);
    }
  }

  function open() {
    root = document.getElementById("durak-root");
    if (!st) startScreen(); else render();
  }
  function onLang() { if (root) open(); }
  function rules() { App.openModal("Дурак — " + t("rules"), t("durak_rules_html")); }

  return { open, onLang, rules };
})();

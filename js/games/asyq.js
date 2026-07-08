/* Асық ату — flick the saqa (shooter) to knock asyqs out of the circle. Canvas physics. */
const GameAsyq = (() => {
  const W = 680, H = 460;
  const CIRCLE = { x: W / 2, y: 185, r: 130 };
  const SAQA_START = { x: W / 2, y: 400 };
  const MAX_SHOTS = 7;
  const TARGETS = 5;
  const BEAN_PER_HIT = 5;
  const FRICTION = 0.985;
  const MIN_SPEED = 0.06;

  let root = null, canvas = null, ctx = null;
  let st = null; // {saqa, asyqs[], shots, hits, phase: aim|moving|over, drag}
  let raf = 0;

  const t = (k, v) => App.t(k, v);

  function startScreen() {
    cancelAnimationFrame(raf);
    root.innerHTML = "";
    const box = App.el("div", "start-screen");
    box.appendChild(App.el("div", null, "<span style='font-size:56px'>🦴</span>"));
    box.appendChild(App.el("p", null, t("asyq_start_sub")));
    const btn = App.el("button", "btn-primary", t("play"));
    btn.onclick = startGame;
    box.appendChild(btn);
    root.appendChild(box);
  }

  function startGame() {
    st = {
      saqa: { x: SAQA_START.x, y: SAQA_START.y, vx: 0, vy: 0, r: 16 },
      asyqs: [],
      shots: MAX_SHOTS,
      hits: 0,
      phase: "aim",
      drag: null,
    };
    // scatter targets inside the circle
    for (let i = 0; i < TARGETS; i++) {
      const ang = (i / TARGETS) * Math.PI * 2 + 0.4;
      const dist = i === 0 ? 0 : 62;
      st.asyqs.push({
        x: CIRCLE.x + Math.cos(ang) * dist,
        y: CIRCLE.y + Math.sin(ang) * dist * 0.8,
        vx: 0, vy: 0, r: 11, out: false,
      });
    }
    buildDom();
    loop();
  }

  function buildDom() {
    root.innerHTML = "";
    const wrap = App.el("div", "asyq-wrap");
    const hud = App.el("div", "asyq-hud");
    hud.id = "asyq-hud";
    wrap.appendChild(hud);
    canvas = document.createElement("canvas");
    canvas.id = "asyq-canvas";
    canvas.width = W; canvas.height = H;
    wrap.appendChild(canvas);
    wrap.appendChild(App.el("div", "game-status", t("asyq_aim")));
    root.appendChild(wrap);
    ctx = canvas.getContext("2d");
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    updateHud();
  }

  function updateHud() {
    const hud = document.getElementById("asyq-hud");
    if (hud) hud.innerHTML =
      `<span>${t("asyq_shots")}: <b>${st.shots}</b></span>` +
      `<span>${t("asyq_hits")}: <b>${st.hits}/${TARGETS}</b></span>` +
      `<span>${t("asyq_score")}: <b>${st.hits * BEAN_PER_HIT}</b> 🫘</span>`;
  }

  function evPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
  }
  function onDown(e) {
    if (!st || st.phase !== "aim") return;
    const p = evPos(e);
    const dx = p.x - st.saqa.x, dy = p.y - st.saqa.y;
    if (dx * dx + dy * dy < 45 * 45) { st.drag = p; canvas.setPointerCapture(e.pointerId); }
  }
  function onMove(e) {
    if (st && st.drag) st.drag = evPos(e);
  }
  function onUp() {
    if (!st || !st.drag || st.phase !== "aim") { if (st) st.drag = null; return; }
    const dx = st.saqa.x - st.drag.x, dy = st.saqa.y - st.drag.y;
    const len = Math.hypot(dx, dy);
    st.drag = null;
    if (len < 12) return; // too weak, not a shot
    const power = Math.min(len, 190) / 190 * 17;
    st.saqa.vx = (dx / len) * power;
    st.saqa.vy = (dy / len) * power;
    st.shots--;
    st.phase = "moving";
    updateHud();
  }

  /* ---------- physics ---------- */
  function bodies() { return [st.saqa, ...st.asyqs.filter(a => !a.out)]; }
  function step() {
    if (st.phase !== "moving") return;
    const bs = bodies();
    for (const b of bs) {
      b.x += b.vx; b.y += b.vy;
      b.vx *= FRICTION; b.vy *= FRICTION;
      if (Math.hypot(b.vx, b.vy) < MIN_SPEED) { b.vx = 0; b.vy = 0; }
      // walls
      if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * 0.7; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * 0.7; }
      if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * 0.7; }
      if (b.y > H - b.r) { b.y = H - b.r; b.vy = -b.vy * 0.7; }
    }
    // pairwise collisions (equal mass, swap normal velocity components)
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy), min = a.r + b.r;
      if (dist > 0 && dist < min) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = (min - dist) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const avn = a.vx * nx + a.vy * ny, bvn = b.vx * nx + b.vy * ny;
        const diff = avn - bvn;
        if (diff > 0) {
          a.vx -= diff * nx * 0.92; a.vy -= diff * ny * 0.92;
          b.vx += diff * nx * 0.92; b.vy += diff * ny * 0.92;
        }
      }
    }
    // asyqs leaving the circle
    for (const a of st.asyqs) {
      if (!a.out && Math.hypot(a.x - CIRCLE.x, a.y - CIRCLE.y) > CIRCLE.r + a.r) {
        a.out = true;
        st.hits++;
        updateHud();
      }
    }
    // all stopped?
    if (bs.every(b => b.vx === 0 && b.vy === 0)) {
      if (st.hits >= TARGETS || st.shots <= 0) { finish(); return; }
      st.saqa.x = SAQA_START.x; st.saqa.y = SAQA_START.y;
      st.saqa.vx = 0; st.saqa.vy = 0;
      st.phase = "aim";
    }
  }

  function finish() {
    st.phase = "over";
    const beans = st.hits * BEAN_PER_HIT;
    App.reportGame(st.hits >= 3 ? "win" : "lose", beans);
    App.toast(t("asyq_over", { hits: st.hits, n: beans }));
    const b = App.el("div", "result-banner");
    b.innerHTML = `<h3 class="${st.hits >= 3 ? "win" : ""}">${t("asyq_over", { hits: st.hits, n: beans })}</h3>`;
    const acts = App.el("div", "actions");
    const again = App.el("button", "btn-primary", t("play_again"));
    again.onclick = startGame;
    const back = App.el("button", "btn-ghost", t("to_lobby"));
    back.onclick = () => { st = null; App.go("lobby"); };
    acts.appendChild(again); acts.appendChild(back);
    b.appendChild(acts);
    root.querySelector(".asyq-wrap").appendChild(b);
  }

  /* ---------- draw ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // circle
    ctx.beginPath();
    ctx.arc(CIRCLE.x, CIRCLE.y, CIRCLE.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    // asyqs
    for (const a of st.asyqs) {
      if (a.out) continue;
      drawBone(a.x, a.y, a.r, "#e8d5ae", "#b09468");
    }
    // saqa
    drawBone(st.saqa.x, st.saqa.y, st.saqa.r, "#d94f30", "#8f2f18");
    // aim line
    if (st.drag && st.phase === "aim") {
      ctx.beginPath();
      ctx.moveTo(st.drag.x, st.drag.y);
      ctx.lineTo(st.saqa.x, st.saqa.y);
      ctx.strokeStyle = "rgba(255,255,255,.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      // direction arrow
      const dx = st.saqa.x - st.drag.x, dy = st.saqa.y - st.drag.y;
      const len = Math.hypot(dx, dy) || 1;
      ctx.beginPath();
      ctx.moveTo(st.saqa.x, st.saqa.y);
      ctx.lineTo(st.saqa.x + (dx / len) * Math.min(len, 100), st.saqa.y + (dy / len) * Math.min(len, 100));
      ctx.strokeStyle = "rgba(254,197,12,.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  function drawBone(x, y, r, fill, edge) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.78, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - r * 0.25, y - r * 0.2, r * 0.28, r * 0.2, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fill();
  }

  function loop() {
    cancelAnimationFrame(raf);
    const tick = () => {
      if (!st || !canvas || !canvas.isConnected) return;
      step();
      draw();
      if (st.phase !== "over") raf = requestAnimationFrame(tick);
      else draw();
    };
    raf = requestAnimationFrame(tick);
  }

  function open() {
    root = document.getElementById("asyq-root");
    if (!st) startScreen();
    else { buildDom(); loop(); if (st.phase === "over") startScreen(); }
  }
  function onLang() { if (root && !st) startScreen(); else if (st) { updateHud(); } }
  function rules() { App.openModal("Асық ату — " + t("rules"), t("asyq_rules_html")); }

  return { open, onLang, rules };
})();

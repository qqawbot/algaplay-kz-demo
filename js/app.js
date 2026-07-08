/* Alga Play KZ — bootstrap & wiring */
(function () {
  const GAMES = { belka: GameBelka, togyz: GameTogyz, durak: GameDurak, asyq: GameAsyq };

  document.addEventListener("alga:view", e => {
    const g = GAMES[e.detail];
    if (g) g.open();
  });
  document.addEventListener("alga:lang", () => {
    Object.values(GAMES).forEach(g => g.onLang());
  });

  document.getElementById("belka-rules-btn").onclick = () => GameBelka.rules();
  document.getElementById("togyz-rules-btn").onclick = () => GameTogyz.rules();
  document.getElementById("durak-rules-btn").onclick = () => GameDurak.rules();
  document.getElementById("asyq-rules-btn").onclick = () => GameAsyq.rules();

  window.addEventListener("hashchange", () => App.go((location.hash || "#lobby").slice(1)));

  App.init();
})();

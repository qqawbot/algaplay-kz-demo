/* Alga Play KZ — PWA install: SW registration + platform-split add-to-home prompt.
   Android/Chrome: capture beforeinstallprompt, fire native prompt on a win high-moment.
   iOS Safari: no native prompt → show a bilingual (kk/ru) illustrated guide overlay. */
const PWA = (() => {
  const SEEN_KEY = "algaplay_a2h_v1";   // remembers last prompt so we don't nag
  const COOLDOWN_DAYS = 7;
  let deferred = null;                    // stashed beforeinstallprompt event (Android)
  let promptedThisSession = false;

  const t = (k, v) => App.t(k, v);
  const isStandalone = () =>
    matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream &&
    /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
  const platform = () => (deferred ? "android" : isIOS() ? "ios" : "other");

  function canPromptAgain() {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (!raw) return true;
      const { ts, installed } = JSON.parse(raw);
      if (installed) return false;
      return Date.now() - ts > COOLDOWN_DAYS * 864e5;
    } catch (e) { return true; }
  }
  function remember(extra) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ts: Date.now(), ...extra })); } catch (e) {}
  }

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e;
    App.track("a2h_available", { platform: "android" });
  });
  window.addEventListener("appinstalled", () => {
    App.track("a2h_installed", { platform: platform() });
    remember({ installed: true });
    deferred = null;
  });

  // called on a win high-moment (document 'alga:gamewin')
  function maybePrompt() {
    if (isStandalone() || promptedThisSession || !canPromptAgain()) return;
    const p = platform();
    if (p === "android" && deferred) {
      promptedThisSession = true;
      App.track("a2h_prompt", { platform: "android" });
      deferred.prompt();
      deferred.userChoice.then(c => {
        App.track("a2h_choice", { platform: "android", outcome: c.outcome });
        remember({ installed: c.outcome === "accepted" });
        deferred = null;
      });
    } else if (p === "ios") {
      promptedThisSession = true;
      App.track("a2h_prompt", { platform: "ios" });
      showIOSGuide();
      remember({});
    }
    // "other" (desktop / unsupported): stay silent, browser has its own install UI
  }

  function showIOSGuide() {
    App.openModal(t("pwa_title"),
      `<p class="muted">${t("pwa_sub")}</p>` +
      `<ol class="pwa-steps">` +
        `<li><span class="pwa-ico">${shareIcon()}</span>${t("pwa_step1")}</li>` +
        `<li><span class="pwa-ico">➕</span>${t("pwa_step2")}</li>` +
        `<li><span class="pwa-ico">✓</span>${t("pwa_step3")}</li>` +
      `</ol>` +
      `<button class="btn-primary" id="pwa-ok">${t("pwa_ok")}</button>`);
    const ok = document.getElementById("pwa-ok");
    if (ok) ok.onclick = () => App.closeModal();
  }
  function shareIcon() {
    // iOS share glyph (inline SVG, brand sky)
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00afca" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/></svg>`;
  }

  function register() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js?v=2").catch(() => { /* offline-first is best-effort */ });
      });
    }
    document.addEventListener("alga:gamewin", maybePrompt);
  }

  return { register, maybePrompt };
})();

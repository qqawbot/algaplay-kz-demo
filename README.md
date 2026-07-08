# Alga Play KZ — Қазақ ойындарының платформасы 🇰🇿

**Alga Play KZ** is an open, dependency-free web game platform featuring Kazakhstan's most popular traditional and mainstream games. Successor to the closed-source [alga-play-web](https://github.com/qqawbot/alga-play-web) Flutter demo, rebuilt from scratch in vanilla HTML/CSS/JS — no build step, deployable anywhere (GitHub Pages included).

**Платформа казахских игр** — открытая веб-платформа без зависимостей с самыми популярными играми Казахстана.

## Games / Ойындар

| Game | Kazakh name | Type | Opponent |
|---|---|---|---|
| 🐿️ **Belka** | Белка | 2v2 trick-taking card game (32 cards), the platform flagship | You + AI partner vs 2 AI |
| ⚫ **Togyzqumalaq** | Тоғызқұмалақ | National mancala mind sport: 18 pits, 162 kumalaks, tuzdyq rule | Minimax AI (alpha-beta) |
| 🃏 **Durak** | Дурак (подкидной) | The most played card game in Kazakhstan & CIS (36 cards) | Heuristic AI |
| 🦴 **Asyq atu** | Асық ату | Traditional knucklebone shooting, as a canvas physics game | Solo, 7 shots |
| 🎲 Nardy · 🪨 Bes tas | Нарды · Бес тас | — | Coming soon |

## Platform features

- 🫘 **Beans economy** — soft currency: antes, winnings, daily task rewards. No real-money play.
- ✅ **Daily tasks** — play 1 / win 1 / play 3, claimable bean rewards, resets daily.
- 👤 **Profile** — nickname, rank ladder (Новичок → Хан), per-game stats, win rate. Stored in `localStorage`.
- 🌐 **Trilingual UI** — Қазақша / Русский / English, switchable live.

## Run

No build, no dependencies:

```bash
# any static server, e.g.
python3 -m http.server 8080
# open http://localhost:8080
```

Or just open `index.html` in a browser.

## Structure

```
index.html          SPA shell (lobby + 4 game views)
css/style.css       steppe-sky theme (Kazakh flag palette)
js/i18n.js          kk / ru / en dictionaries
js/core.js          store, router, tasks, profile, shared UI
js/app.js           wiring
js/games/belka.js   Belka engine + bots
js/games/togyz.js   Togyzqumalaq engine + minimax AI
js/games/durak.js   Durak engine + heuristic AI
js/games/asyq.js    Asyq atu canvas physics
```

## Rules references

- **Togyzqumalaq**: 9 pits × 9 kumalaks per side; sowing leaves one stone in the source pit; capture on making an opponent pit even; a pit made exactly 3 becomes your *tuzdyq* (not the 9th pit, not mirroring the opponent's, once per game); first to 82 wins.
- **Belka**: 32 cards, teams 2×2, follow suit or play anything; A=11, 10=10, K=4, Q=3, J=2, last trick +10 (130 total); 66+ points wins the round, 3 rounds win the match.
- **Durak podkidnoy**: classic rules, one attack card at a time, throw-in by rank, max 6 per bout.

---

*Alga! (Алға — «Forward!»)* · Demo project, beans only, 18+ not required 🫘

# Local pass & play

React + Vite client using Zustand and the shared Ludo engine. One phone is enough
for 2 to 4 players. No server or accounts are involved. Standard rules remain
the default; enable **Tunisian mode** on setup for special tiles and cards.

From the monorepo root:

```sh
pnpm install
pnpm dev
```

Open the Vite URL printed in the terminal. To play on a phone, use the computer's
LAN IP with that port on the same Wi-Fi network (allow the dev server through
the firewall if necessary). Vite binds to all interfaces for local development.

Choose the player count and start. Each player has four numbered pawns. Roll,
tap a highlighted pawn on the board or its larger numbered selection button,
then confirm the move. This second selection surface makes stacked pawns easy
to choose on a small screen. Pass the phone when the turn changes.

## Tunisian mode, language, and feedback

- Ten emoji-marked special tiles use the [engine rules](../../packages/engine/README.md).
- Expand Quick rules (the `?` button in the header) for a translated tile legend.
- A double six opens an event-card modal. Dismiss it to choose a highlighted
  eligible target (on the board or the large numbered circles), confirm, and
  then play the pending six. Cards without targets explain why they have no effect.
- EN / FR / TN switches UI and event feedback live. Tunisian uses Latin-script
  Darija; `fr.ts` and `tn.ts` have compile-time-checked complete dictionaries.
- Six cosmetic reactions show a player-attributed bubble for exactly two seconds.
  A new reaction replaces the old one and restarts its timer.
- Sound is off by default. Enable it via the sound button (a user gesture unlocks
  Web Audio). Each roll plays a synthesized "vroom vroom" car-engine rev while
  the die tumbles. Movement, capture, cards and victory use quiet tones, without
  external assets. Audio failures are visibly reported.
- The die is a 3D CSS cube on a felt tray. It hops and spins during the roll,
  lands on the rolled face, flashes gold on a six and shows a 🔥 streak badge.
- The game screen fills exactly one phone viewport (`100dvh`), with no page
  scrolling. The board is sized from the space left over by the header, turn
  banner, dice stage, player chips, pawn picker and reactions. Its symbols
  scale with container units. Reduced motion skips the roll animation.
- Numbered selection circles are 40–46px, with explicit selected and
  playable states and per-player colors.

## Architecture

- `GameController` is the synchronous rules interface; `LocalController` delegates
  directly to the engine.
- Vite and TypeScript resolve the engine's workspace source directly, so tests
  and type-checking do not require prebuilt engine output, and engine edits are
  included in client hot reload.
- The Zustand store retains authoritative game state separately from visual pawn
  positions. It queues engine events and locks actions until playback completes.
- Movement events advance one relative tile per timer tick, including home-lane
  entry and backward effects. Returns to the yard are immediate. Captures,
  finish events and turn handovers follow in order.
- Card modals pause playback; the remaining events resume after dismissal.
  The controller exposes legal move and legal target queries.
- Reduced-motion preferences skip animation delays but preserve event order.
  Restarting clears the queue and cancels outstanding timers.
- Games exist only in memory: refreshing closes the current game.

`pnpm --filter @ludo/client test` runs controller, store, UI, localization,
reaction-timing and sound tests, including complete Tunisian games.
`pnpm build`, `pnpm typecheck`, and `pnpm test` from the root cover both packages.

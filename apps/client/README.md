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

Choose the player count and start. Each player has four numbered pawns and a
color-matched die beside their board corner (red top-left, green top-right,
yellow bottom-right, blue bottom-left). Tap the current player's die or the
**Roll dice** button for a random result from 1 to 6. Touch starts the roll
immediately on contact, without waiting for a click; releasing does not roll
again. Mouse clicks and keyboard activation also work. Other players' dice stay
locked, and each die keeps that player's latest result. All roll controls lock
during playback and while a move or card target is pending. Roll,
tap a highlighted pawn on the board or its larger numbered button to move it
immediately, with no extra confirmation. Card targets still require confirmation.
This second interaction surface makes stacked pawns easy
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
  Tapping either roll control also resumes audio after browser suspension
  (for example, after switching apps on a phone).
- The die is a 3D CSS cube on a felt tray. It hops and spins during the roll,
  lands on the rolled face, flashes gold on a six and shows a 🔥 streak badge.
- Setup and the game screen fit one viewport (`100dvh`), with no page
  scrolling. The board is sized from the space left over by the header, turn
  banner, roll button, player chips, pawn picker and reactions. Corner dice
  occupy reserved space above and below the board without covering pawns. Its symbols
  scale with container units. Landscape screens place the board beside the
  controls instead of stacking everything vertically. Reduced motion skips
  the roll animation.
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

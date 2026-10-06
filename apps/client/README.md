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
tap a highlighted pawn directly on the board to move it
immediately, with no extra confirmation. Card targets still require confirmation.
The numbered footer buttons are removed to leave more room for the board.
Stacked board pawns are offset so they can be chosen individually.
Pass the phone when the turn changes.

## Collectible bonuses

Local games enable six one-use pickups on the shared track: **+** at indices
12 and 38, **⌂** at 24 and 50, and **🤪** at 4 and 30. A pawn must land exactly on a pickup to
collect it; passing over it does not count. The pickup disappears from the
board and stays in that player's inventory until used. All player inventories
remain visible, including empty ones.

After rolling, when a legal pawn move is pending and playback has finished:

- **+** reserves an additional roll after the pawn moves. It does not change
  the current die. Only one can be reserved per move. A six still grants its
  normal extra roll; the reserved bonus is retained until a non-six move
  consumes it. Three consecutive sixes still forfeit the turn.
- **⌂** highlights that player's unfinished pawns outside the yard. Tap one
  to return it to its starting yard (not to the finish). The rolled die remains
  available; if no legal move remains, normal no-move rules apply. Tap the
  house button again to cancel without spending the bonus.
- **🤪 Crazy +6 +6** gives two extra moves of six before the original rolled
  move. Choose a pawn directly on the board for each six; the same pawn or
  different pawns may be used. A six can leave the yard under normal rules.
  These moves allow captures and landing effects but do not roll the die,
  increase the six streak, draw double-six cards, or grant extra rolls.
  If no pawn can use a remaining six, that unused move is skipped. The
  original die then resumes, subject to normal no-move rules. Victory ends
  immediately. Other bonuses are locked until the crazy moves finish.

Bonuses cannot be used on another player's turn, during animation or a card
choice, before rolling, or after victory. A roll with no legal move still
passes automatically under the normal rules.

## Tunisian mode, language, and feedback

- Setup and gameplay use the supplied Tunisian Ludo artwork as a decorative,
  softly blurred background at 8% opacity. The board has a faint 6% overlay
  of the same artwork. These layers never intercept taps.
- Ten emoji-marked special tiles use the [engine rules](../../packages/engine/README.md).
- Expand Quick rules (the `?` button in the header) for a translated tile legend.
- A double six opens an event-card modal. Dismiss it to choose a highlighted
  eligible target on the board, confirm, and
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
  scrolling. The board is sized from the space left over by the header,
  roll button, player chips, card-target confirmation and reactions. The turn-information
  box is hidden during play to leave more room for the board; screen readers
  still receive turn updates, and the victory announcement remains visible. Corner dice
  occupy reserved space above and below the board without covering pawns. Its symbols
  scale with container units. Landscape screens place the board beside the
  controls instead of stacking everything vertically. Reduced motion skips
  the roll animation.
- Board pawns are shaded 3D-style playing pieces with a head, body, base and
  visible number. They are larger in each player's yard and compact on the track.
  Tap or click a highlighted piece directly to move it after the roll stops.

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

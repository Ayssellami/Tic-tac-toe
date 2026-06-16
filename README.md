# Tic-Tac-Toe

A real-time multiplayer Tic-Tac-Toe game built with vanilla JavaScript and Firebase. Two players are matched instantly via anonymous sign-in, choose between a classic 3×3 board or a larger 5×5 board, play against each other live, send emoji reactions during the game, and compete on a persistent leaderboard.

**Live site:** https://tic-tac-toe-2c101.web.app

---

## Features

- **Two board sizes** — choose 3×3 (classic, 3-in-a-row wins) or 5×5 (4-in-a-row wins) before joining; matchmaking pairs players who selected the same mode
- **Real-time multiplayer** — two players in separate browsers share a live game board; every move syncs instantly via Firestore
- **Anonymous matchmaking** — no account needed; enter a name and get matched with the next available player automatically
- **Emoji reactions** — click any of 5 emoji buttons (👍 😂 🔥 😮 😢) to send a reaction that floats up on screen for both players
- **Score-based leaderboard** — tracks wins (3pts), draws (1pt), and losses (0pts) across all players with live updates
- **Rematch system** — both players can vote to replay without leaving the game

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript (ES modules), HTML, CSS |
| Auth | Firebase Anonymous Authentication |
| Database & real-time sync | Cloud Firestore (`onSnapshot` listeners) |
| Hosting | Firebase Hosting |
| Build | None — no bundler, no npm, no build step |

Firebase SDKs are loaded directly from the Google CDN (`firebase/12.14.0`), so the project has zero local dependencies.

---

## How It Works

### Board size selection
Before joining, players pick 3×3 or 5×5 via a toggle on the lobby screen. The chosen size is passed through to `findOrCreateGame`, which filters the Firestore waiting-game query by `size`. This means a 3×3 player is only ever matched with another 3×3 player, and likewise for 5×5. The board size is stored in the game document so the joining player automatically gets the correct grid.

Win conditions differ by mode: 3×3 uses the classic 3-in-a-row (8 possible lines), while 5×5 requires 4-in-a-row (28 possible lines computed dynamically).

### Matchmaking
When a player joins, `lobby.js` queries Firestore for any game with `status: "waiting"` **and matching `size`**. If one exists (and isn't theirs), they claim it via a Firestore transaction — preventing race conditions when two players join simultaneously. If no game is available, a new one is created and the player waits as X.

### Game sync
Both players subscribe to the same `games/{gameId}` document with `onSnapshot`. Every move is a `updateDoc` write that instantly triggers the other player's listener. No polling, no WebSockets — Firestore handles it.

### Emoji reactions
Clicking a reaction button writes `{ emoji, by, id }` to the game document. Both clients' `onSnapshot` callbacks detect the new unique `id` and play the float-up CSS animation locally. A new reaction doesn't clear the board or interrupt gameplay.

### Leaderboard
After each game ends, `game.js` writes stats to a separate `leaderboard/{uid}` document using `setDoc` with `merge: true` and Firestore `increment()` — safe for concurrent writes. `leaderboard.js` listens to the top 10 by score in real time.

---

## Project Structure

```
TIC-TAC-TOE/
├── public/
│   ├── index.html          # Single page — login screen + game screen + leaderboard
│   ├── style.css           # Dark theme, board layout, reaction bar & float animation
│   ├── firebase-config.js  # Firebase app initialisation (Auth + Firestore)
│   ├── main.js             # Entry point — screen routing, wires login → lobby → game
│   ├── lobby.js            # Anonymous sign-in, matchmaking (find-or-create game)
│   ├── game.js             # Board rendering, move logic, reactions, stats writing
│   └── leaderboard.js      # Live top-10 leaderboard query
├── firebase.json           # Hosting + Firestore config
├── firestore.rules         # Firestore security rules
└── .firebaserc             # Firebase project alias (tic-tac-toe-2c101)
```

---

## Running Locally

You need the [Firebase CLI](https://firebase.google.com/docs/cli) installed.

```bash
# Serve the public/ folder with Firebase Hosting emulator
firebase emulators:start --only hosting
```

Then open **http://localhost:5000** in two browser tabs, enter a name in each, and click **Join game** — they'll be matched automatically.

> The app connects to the **live** Firestore database even when running locally (the emulator only covers hosting). Both tabs must be on the same origin (`localhost:5000`) for Firestore rules to allow writes.

---

## Deploying

```bash
firebase deploy --only hosting
```

---

## Firestore Data Model

### `games/{gameId}`
```
{
  board:       string[9|25],       // "" | "X" | "O" for each cell (9 for 3×3, 25 for 5×5)
  size:        3 | 5,              // board mode chosen by the host
  players:     { X: uid, O: uid },
  playerNames: { X: name, O: name },
  turn:        "X" | "O",
  status:      "waiting" | "active" | "won" | "draw",
  winner:      "X" | "O" | null,
  rematch:     { X: bool, O: bool },
  reaction:    { emoji, by: uid, id: string } | null,
  createdAt:   timestamp
}
```

### `leaderboard/{uid}`
```
{
  name:   string,
  wins:   number,
  losses: number,
  draws:  number,
  score:  number   // wins×3 + draws×1
}
```

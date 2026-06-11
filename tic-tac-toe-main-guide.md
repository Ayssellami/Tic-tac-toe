# Multiplayer Tic-Tac-Toe on Firebase — The Main Build Guide

**Read this whole guide, both of you.** It's the shared source of truth: it explains how the game works, *why* each piece exists, and walks you from where you are now to a working multiplayer game you can play across two phones. After you've read it, each of you also has a personal guide that says which parts *you* drive — but you'll both understand the entire thing, Firebase concepts and game logic alike.

---

## 0. Where you are, and where you're going

**You already have:**
- A Firebase project, with **both of you added as editors** (so you both share the same cloud backend — good).
- **Hosting** and **Cloud Firestore (in test mode)** turned on.
- The Firebase CLI installed and `firebase login` done.
- The default *"Firebase Hosting setup complete"* landing page showing when you double-click the HTML file.

**You're going to build:** log in → join a lobby → the game **auto-starts** when 2 players are in → play → win / lose / draw → play again or end. All moves sync between both players live, with no page refreshes.

> **Why tic-tac-toe?** The game is deliberately tiny — that's the point. With the rules of play out of the way, all your attention goes to the ideas that transfer to *any* multiplayer app: logging in, sharing state in a database, live updates between devices, safe writes, and permissions. Tic-tac-toe is just the vehicle; **the Firebase architecture is the real project.**

**Two things are shared, and you must keep both in sync:**
1. **The Firebase project** (the cloud backend) — already shared via editor access. ✓
2. **The code** (the files on your laptops) — *not* shared yet. See "Sharing your code" below.

### A quick glossary (skim now, refer back anytime)
You'll meet these words constantly. No need to memorize them — just know they exist:

| Word | What it means here |
|---|---|
| **uid** | A player's unique ID, handed out at login |
| **Collection** | A folder of documents in Firestore (ours is `games`) |
| **Document** | One saved object — for us, one whole game |
| **Listener** (`onSnapshot`) | Code that watches a document and reacts to every live change |
| **Transaction** | A safer write that re-checks the data before saving, to avoid clashes |
| **Security rules** | Server-side permissions deciding who can read/write the database |
| **Emulator** | A local copy of a Firebase service for testing on your own machine |
| **Deploy** | Publish your site to the real web with `firebase deploy` |

### Your tools on macOS
- **Terminal** — open it via Spotlight (`⌘ + Space`, type "Terminal") or Applications → Utilities → Terminal. This is where you run `firebase` commands.
- **A code editor** — install **Visual Studio Code** (free, from <https://code.visualstudio.com>). Open your project folder with **File → Open Folder**, or run `code .` from Terminal inside the folder if you enabled the `code` command.
- **A web browser** — Chrome or Safari. You'll keep two windows open for testing.
- **The Firebase console** — <https://console.firebase.google.com>. Keep this open in a tab the whole time; watching your data change here is one of the best ways to understand what your code is doing.

### Sharing your code

**Option A — GitHub (recommended).** One of you creates a repo, the other is added as a collaborator. macOS already has `git` (the first time you run it, it may prompt you to install the Xcode Command Line Tools — accept).

```bash
# Person who owns the folder, run once inside the project folder:
git init
git add .
git commit -m "Starting point"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOUR-NAME/tic-tac-toe.git
git push -u origin main

# The other person, after being added as a collaborator:
git clone https://github.com/YOUR-NAME/tic-tac-toe.git
```

Day to day: `git pull` before you start, `git add . && git commit -m "..." && git push` when you finish a chunk. The file `.firebaserc` (created earlier) records your project ID, so cloning the repo automatically points the other person at the same Firebase project.

**Option B — Slack (quick start).** Zip and share the `public/` folder plus `firebase.json`, `.firebaserc`, and `firestore.rules`. It works, but agree on one rule: **only one person edits a shared file at a time, and say so in Slack.** Move to Option A the moment this gets painful.

### The project map
Six files do all the work. Here's what each one is and who leads on it — keep this handy:

```
public/
  index.html          the two screens (login + game)              — pair
  style.css           how it looks                                — pair (B polishes)
  firebase-config.js  connects to your Firebase project           — pair
  lobby.js            login + matchmaking                         — Intern A
  game.js             the live board, moves, win/draw, rematch    — Intern B
  main.js             wires the screens + the two files together  — pair
firestore.rules       database permissions (project root)         — Intern A
```

The milestone-by-milestone version of "who leads" is in the table just below.

### How you'll split the work (overview)
Both of you build and understand everything. For each milestone, one person *drives* (writes it first, explains it) and the other *reviews*. The split is balanced so you each lead on some Firebase concepts **and** some game logic:

| Milestone | Topic | Drives | Reviews |
|---|---|---|---|
| 0–1 | Local workflow + skeleton + connect Firebase | **Pair** | **Pair** |
| 2 | Anonymous login | **A** | B |
| 3 | Matchmaking + transactions | **A** | B |
| 4 | Realtime board (auto-start + sync) | **B** | A |
| 5 | Making moves | **B** | A |
| 6 | Win / draw detection | **A** | B |
| 7 | Play again / end game | **B** | A |
| 8 | Deploy to the world | **Pair** | **Pair** |
| 9 | Security rules | **A** | B |

Your personal guide breaks down exactly what "drive" means for each of your milestones. For now: read on.

---

## 1. The one workflow change to make first: stop double-clicking the file

The default landing page worked when you double-clicked it. **Your game will not**, and here's why: opening a file directly gives the browser a `file://` address, and browsers **refuse to run JavaScript modules** (the `import` statements you're about to use) from `file://` for security reasons. Your game also talks to a live cloud database, which needs a real web address too. So from now on you'll run a tiny local web server that serves your files over `http://`, exactly like the real internet does.

The Firebase CLI has this built in. You don't need to set anything up.

### Verify you have a recent Node.js
You already installed the CLI, so Node is on your machine. Confirm it's new enough (20 or higher):
```bash
node -v
```
If it prints something below `v20`, install the **LTS** version from <https://nodejs.org> (download the macOS `.pkg`, double-click, follow the installer), then re-check.

### Run your site locally
In Terminal, go to your project folder and start the local Hosting server:
```bash
cd ~/path/to/your/tic-tac-toe     # wherever your project folder lives
firebase emulators:start --only hosting
```
It prints a line like:
```
✔  hosting: Local server: http://localhost:5000
```
Open **http://localhost:5000** in your browser. (Right now you'll still see the default page — that changes in Milestone 1.) Leave this command running while you work; it auto-serves your latest saved files. Press `Ctrl + C` in Terminal to stop it.

> Your database still lives in the real cloud (in test mode). That's intentional and good for learning — you'll watch your writes appear live in the Firebase console. (Later, if you want a fully offline setup, there's a Firestore emulator too, but it needs Java and isn't necessary for this project.)

### How to test two players on one laptop
Two windows of the **same** browser share the same anonymous login, which breaks matchmaking (you'd keep trying to join your own game). So always test with **two different login contexts**:
- one normal window **+** one **Incognito/Private** window, **or**
- two different browsers (Chrome and Safari), **or**
- two different devices.

---

## 2. How the finished game works (the mental model)

Before building, get this picture in your head. Both of you should be able to explain it.

### One Firestore document = one game
All the state for a single game lives in **one document** inside a `games` collection. This is the contract your whole app is built around:

```
games/{autoGeneratedId}
{
  board:       ["", "", "", "", "", "", "", "", ""],   // 9 cells, index 0–8
  players:     { X: "<uid of host>", O: null },          // O fills in when player 2 joins
  playerNames: { X: "Alex",         O: null },           // for display
  turn:        "X",                                       // whose move it is
  status:      "waiting",   // "waiting" → "active" → "won" | "draw"
  winner:      null,        // "X" | "O" | null
  rematch:     { X: false, O: false },                    // for the "play again" handshake
  createdAt:   <serverTimestamp>
}
```

The board is a flat list of 9 strings. Cell index → position on the grid:
```
 0 | 1 | 2
-----------
 3 | 4 | 5
-----------
 6 | 7 | 8
```

### The flow
```
 Player clicks "Join"
        │
        ▼
 Sign in anonymously ──► get a uid (their identity)
        │
        ▼
 Is there a game with status "waiting" that isn't mine?
        │                                   │
       YES                                 NO
        │                                   │
 Join it as O,                       Create a new game
 set status "active"                 as X, status "waiting"
        │                                   │
        └─────────────────┬─────────────────┘
                          ▼
        Listen to my game document (live)
                          │
   status "waiting"  ──►  show "Waiting in lobby…"
   status "active"   ──►  show board; my cells active on my turn   ◄── AUTO-START
   status won/draw   ──►  show result + [Play again] [End game]
```

The magic is that last block: a **live listener** on the game document redraws the screen every time the document changes — on **both** players' laptops. The game "auto-starts" simply because joining flips `status` to `"active"`, and the listener reacts. Every move works the same way: write to the document, and both screens update.

### The concepts you'll learn (and where)
- **Authentication** (Milestone 2) — `signInAnonymously`; a `uid` is a player's identity.
- **Firestore queries** (M3) — searching a collection for an open game.
- **Transactions** (M3) — safely claiming a game when two people join at the same instant.
- **Creating & updating documents** (M3, M5) — `addDoc`, `updateDoc`.
- **Realtime listeners** (M4) — `onSnapshot`, the engine that makes it multiplayer.
- **Game logic** (M5, M6) — turns, legal moves, detecting a win or a draw.
- **Security rules** (M9) — who is allowed to read and write what.

---

## 3. Build it, milestone by milestone

Each milestone has a **Goal**, the **Concept** behind it, exactly what to **Do**, and how to **Run & verify** before moving on. Don't skip the verify step — catching a problem at the milestone where you introduced it is ten times easier than later.

All your code files live in the **`public/`** folder (except `firestore.rules`, which sits in the project root).

Throughout the milestones you'll see **"In production →"** notes. Each one flags a place where we intentionally keep things simple for learning, and says what a real, shipped app would do instead. They aren't bugs — they're a map of where the shortcuts are, and most of them become stretch goals later.

---

### Milestone 1 — Project skeleton + connect to Firebase
**Goal:** replace the default page with your own two-screen skeleton, and confirm your code is talking to Firebase.
**Concept:** the *config object* tells the SDK which project to connect to. These values ship in your public code and are **not secrets** — your real protection comes from security rules (M9). You'll load Firebase as modern **ES modules** from a CDN, which is why your script tag uses `type="module"`.

**Do this:**

**(a) Get your web config from the console.** In the Firebase console, click the **gear → Project settings**. Scroll to **Your apps**. If there's no web app yet, click the web icon `</>`, give it a nickname (e.g. `web`), leave "set up Hosting" unchecked, and **Register app**. Copy the `firebaseConfig` object it shows you.

**(b) Clean out the defaults.** In `public/`, you can delete `404.html` and you'll replace `index.html` below.

**(c) Create the files.** Put each of these in `public/`:

`public/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tic-Tac-Toe</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Tic-Tac-Toe</h1>

    <!-- Screen 1: login / lobby entry -->
    <section id="login-screen">
      <label for="name">Your name</label>
      <input id="name" type="text" placeholder="Your name" maxlength="16" />
      <button id="join">Join game</button>
      <p class="hint">You'll be matched with the next person who joins.</p>
    </section>

    <!-- Screen 2: the game (also shows the "waiting in lobby" state) -->
    <section id="game-screen" class="hidden">
      <!-- aria-live tells screen readers to announce turn changes and results -->
      <p id="status" aria-live="polite">Loading…</p>
      <div id="board"></div>
      <div id="result"></div>
    </section>
  </main>

  <!-- type="module" is REQUIRED for the import statements to work -->
  <script type="module" src="main.js"></script>
</body>
</html>
```

`public/style.css`
```css
* { box-sizing: border-box; }
body {
  font-family: system-ui, sans-serif;
  background: #0f172a; color: #e2e8f0;
  margin: 0; min-height: 100vh;
  display: grid; place-items: center;
}
main { text-align: center; padding: 2rem; }
h1 { margin-bottom: 1.5rem; }

input, button {
  font-size: 1rem; padding: 0.6rem 1rem;
  border-radius: 8px; border: 1px solid #334155;
}
input { background: #1e293b; color: #e2e8f0; margin-right: 0.5rem; }
button { background: #6366f1; color: white; border: none; cursor: pointer; }
button:hover { background: #4f46e5; }
button:disabled { opacity: 0.6; cursor: default; }

/* Visible keyboard focus — important for anyone navigating without a mouse */
button:focus-visible,
input:focus-visible {
  outline: 3px solid white;
  outline-offset: 3px;
}

.hint { color: #94a3b8; font-size: 0.85rem; margin-top: 1rem; }
.hidden { display: none; }

#status { font-size: 1.2rem; margin-bottom: 1rem; min-height: 1.5rem; }

#board {
  display: grid;
  grid-template-columns: repeat(3, 90px);
  grid-template-rows: repeat(3, 90px);
  gap: 6px; justify-content: center; margin: 0 auto 1rem;
}
.cell {
  font-size: 2.5rem; font-weight: 700;
  background: #1e293b; border: none; border-radius: 8px;
  color: #e2e8f0; cursor: pointer;
}
.cell:hover { background: #334155; }
#board.locked .cell { cursor: not-allowed; }

#result button { margin: 0 0.25rem; }
```

`public/firebase-config.js` — **paste your real config from step (a)** over the placeholders:
```js
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);   // used in Milestone 2
export const db = getFirestore(app); // used from Milestone 3 on
```

`public/main.js` — minimal for now, just to prove everything loads:
```js
import { auth, db } from "./firebase-config.js";

console.log("Firebase connected:", db.app.options.projectId);

// We'll wire up the button in the next milestones.
```

> Keep all three `firebasejs/12.14.0/...` import URLs on the **same version number**. `12.14.0` is current; you can bump it later as long as all three match.

**Run & verify:** with `firebase emulators:start --only hosting` running, open http://localhost:5000. You should see your dark "Tic-Tac-Toe" screen with a name box and a Join button. Open the browser's developer console (Chrome/Safari: `⌘ + Option + J` / `⌘ + Option + C`) and confirm it logs **"Firebase connected:"** with your project ID and shows **no red errors**. If you see a CORS or module error, you opened the file directly instead of via localhost — go back to Milestone 1's run step.

---

### Milestone 2 — Anonymous login  *(Driver: A)*
**Goal:** clicking "Join" signs the player in and gives you a `uid`.
**Concept:** **Anonymous Authentication** creates a throwaway account instantly — no email, no password — and hands you a unique `uid`. That `uid` is how the rest of the app tells the two players apart. (Swapping this for real Google/email login later is a clean upgrade.)

**Do this:**

**(a) Turn it on in the console.** Build → **Authentication** → **Get started** → **Sign-in method** tab → click **Anonymous** → enable → **Save**.

**(b) Create `public/lobby.js`** with the sign-in function:
```js
import { auth, db } from "./firebase-config.js";
import { signInAnonymously }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

// Anonymous sign-in: instant login, no password. Returns the player's uid.
export async function signIn(name) {
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}
```

**(c) Update `public/main.js`** to use it:
```js
import { signIn } from "./lobby.js";

const joinBtn   = document.getElementById("join");
const nameInput = document.getElementById("name");

joinBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "Anonymous").trim();
  const uid = await signIn(name);
  console.log("Signed in as:", name, "uid:", uid);
  // Milestone 3 will add: findOrCreateGame(uid, name)
  // Milestone 4 will add: startGame(...)
});
```

**Run & verify:** reload localhost:5000, type a name, click **Join**. The console should log your `uid`. Then in the Firebase console go to **Authentication → Users** — you'll see a new anonymous user appear. 🎉

> ✋ **Checkpoint — explain to your partner before moving on:** What is a `uid`, and why do two *normal* browser tabs behave like the same player (while a normal tab + an Incognito tab behave like two)?

---

### Milestone 3 — Matchmaking (find or create a game)  *(Driver: A)*
**Goal:** two players who click Join end up in the **same** game document.
**Concept:** This is the meatiest Firebase lesson. You'll **query** the collection for a game that's `"waiting"`. If you find one, you claim it — but two people might tap Join at the same instant and both try to claim the same game. A **transaction** prevents that: it re-reads the document and only writes if it's *still* open, so exactly one person wins and the other falls through to host their own game. (A plain `updateDoc` would let both think they joined — that's the bug a transaction fixes.)

**Do this — add to `public/lobby.js`:**
```js
import {
  collection, query, where, limit, getDocs, addDoc,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// Find an open game to join, or host a new one if there isn't one.
export async function findOrCreateGame(uid, name) {
  // 1) Look for games waiting for a second player.
  const snapshot = await getDocs(
    query(collection(db, "games"), where("status", "==", "waiting"), limit(5))
  );
  // Don't join a game we're hosting ourselves.
  const candidate = snapshot.docs.find((d) => d.data().players.X !== uid);

  if (candidate) {
    // 2) Claim it safely. The transaction re-checks the game is still open.
    try {
      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(candidate.ref);
        const data = fresh.data();
        if (!data || data.status !== "waiting" || data.players.O) {
          throw new Error("That game was just taken");
        }
        tx.update(candidate.ref, {
          "players.O": uid,
          "playerNames.O": name,
          status: "active",          // ← this flip will trigger the auto-start
        });
      });
      return { gameId: candidate.id, myMark: "O" };
    } catch (e) {
      console.log("Couldn't join, hosting our own instead:", e.message);
      // fall through to create a new game
    }
  }

  // 3) Nothing to join (or we lost the race) → host a new game and wait.
  const newGame = await addDoc(collection(db, "games"), {
    board: ["", "", "", "", "", "", "", "", ""],
    players: { X: uid, O: null },
    playerNames: { X: name, O: null },
    turn: "X",
    status: "waiting",
    winner: null,
    rematch: { X: false, O: false },
    createdAt: serverTimestamp(),
  });
  return { gameId: newGame.id, myMark: "X" };
}
```

**Update the Join handler in `public/main.js`** to call it (and, just for this test, show the result):
```js
import { signIn, findOrCreateGame } from "./lobby.js";
// ...inside the click handler, after signIn:
  const { gameId, myMark } = await findOrCreateGame(uid, name);
  alert(`You are ${myMark} in game ${gameId}`);
```

**Run & verify:** open localhost:5000 in a **normal window and an Incognito window**. Join in the first → alert says you're **X**. Join in the second → alert says you're **O**, with the **same game id**. Meanwhile, in the Firebase console open **Firestore Database → Data** and watch the `games` collection: a document appears with `status: "waiting"`, then flips to `"active"` with both player uids filled in. Seeing that live is the moment matchmaking "clicks."

> You'll notice the `find()` skips a game you host yourself. That's why you need two different login contexts to test — two normal windows would share one uid and never match.

> **In production →** With only two players, matchmaking is reliable, but the *create* path has a subtle race: if both players tapped Join at the exact same instant with no waiting game yet, they'd each create their own game and never meet. The transaction in step 2 protects *claiming* an existing open game (the real collision risk once there are 3+ people), not creating one. A shipped matchmaker would handle the create-race too — fine to leave for a two-person workshop.

> ✋ **Checkpoint — explain to your partner before moving on:** Walk through the race out loud. Two players try to join the *same* waiting game at the same moment — where exactly does the transaction stop the bug, and what happens to the player who loses the race?

---

### Milestone 4 — The realtime board (auto-start + live sync)  *(Driver: B)*
**Goal:** when the second player joins, the board appears on **both** screens automatically.
**Concept:** **`onSnapshot`** attaches a live listener to the game document. Its callback runs every time the document changes — for both players. This single feature powers the auto-start (board shows when `status` becomes `"active"`) and, soon, every move. From here on, **you never update the board by hand** — you change the document, and the listener redraws the screen.

**Do this — create `public/game.js`:**
```js
import { db } from "./firebase-config.js";
import { doc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

let gameId = null, myMark = null, latest = null, unsubscribe = null, onEndCb = null;

const boardEl  = document.getElementById("board");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

// Called by main.js once we're in a game.
export function startGame(id, mark, onEnd) {
  gameId = id; myMark = mark; onEndCb = onEnd || null;
  buildBoard();

  // THE multiplayer engine: fires on every change to the game doc, for BOTH players.
  unsubscribe = onSnapshot(doc(db, "games", gameId), (snap) => {
    if (!snap.exists()) return;     // (stretch goal: handle opponent leaving)
    latest = snap.data();
    render();
  });
}

function buildBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.setAttribute("aria-label", `Cell ${i + 1}: empty`);  // screen-reader label
    // click handling comes in Milestone 5
    boardEl.appendChild(cell);
  }
}

function render() {
  const cells = boardEl.querySelectorAll(".cell");
  latest.board.forEach((value, i) => {
    cells[i].textContent = value;
    cells[i].setAttribute("aria-label", `Cell ${i + 1}: ${value || "empty"}`);
  });
  resultEl.innerHTML = "";

  if (latest.status === "waiting") {
    statusEl.textContent = `Waiting in the lobby for an opponent… (you are ${myMark})`;
    boardEl.classList.add("locked");
    return;
  }
  if (latest.status === "active") {
    const myTurn = latest.turn === myMark;
    statusEl.textContent = myTurn ? "Your move" : "Opponent's move";
    boardEl.classList.toggle("locked", !myTurn);
    return;
  }
  // game over states are handled in Milestone 6
}
```

**Now give `public/main.js` its near-final form** (it switches screens and starts the game):
```js
import { signIn, findOrCreateGame } from "./lobby.js";
import { startGame } from "./game.js";

const loginScreen = document.getElementById("login-screen");
const gameScreen  = document.getElementById("game-screen");
const nameInput   = document.getElementById("name");
const joinBtn     = document.getElementById("join");

function show(screen) {
  loginScreen.classList.toggle("hidden", screen !== "login");
  gameScreen.classList.toggle("hidden", screen !== "game");
}

joinBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "Anonymous").trim();
  joinBtn.disabled = true;
  joinBtn.textContent = "Joining…";
  try {
    const uid = await signIn(name);                          // Milestone 2
    const { gameId, myMark } = await findOrCreateGame(uid, name); // Milestone 3
    show("game");
    startGame(gameId, myMark, () => {                        // Milestone 4
      show("login");                                          // runs when game ends (M7)
      joinBtn.disabled = false;
      joinBtn.textContent = "Join game";
    });
  } catch (err) {
    alert("Something went wrong: " + err.message);
    joinBtn.disabled = false;
    joinBtn.textContent = "Join game";
  }
});

show("login");
```

**Run & verify:** normal window + Incognito window. Join in the first → you see the empty board and **"Waiting in the lobby…"**. Join in the second → **both** windows instantly switch to the board, one showing "Your move", the other "Opponent's move". That instant flip is `onSnapshot` doing its job.

> **In production →** If your opponent closes their tab mid-game, your listener fires with a document that no longer exists and the code just `return`s — so you'd sit on a frozen board. A finished app would notice this and show "Your opponent left" with a way back to the lobby. (It's a stretch goal in Intern B's guide.)

> ✋ **Checkpoint — explain to your partner before moving on:** When you click a cell, what actually redraws the board? Why don't we update the squares directly in the click handler?

---

### Milestone 5 — Making moves  *(Driver: B)*
**Goal:** clicking a cell places your mark and the opponent sees it; turns alternate.
**Concept:** A move is just an **`updateDoc`** that writes the new `board` and flips `turn`. You validate three things before writing: the game is active, it's your turn, and the cell is empty. Notice you *don't* need a transaction here, even though Milestone 3 did — a move is naturally turn-based, so the two players never write at the same moment, and the checks above keep illegal moves out. That's the real difference: a *join* is two different people racing for one open slot; a *move* is one person writing on their own turn.

**Do this — in `public/game.js`:**

Add `updateDoc` to the firestore import:
```js
import { doc, onSnapshot, updateDoc }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
```

Wire each cell to a click handler inside `buildBoard()`:
```js
    cell.addEventListener("click", () => handleClick(i));
```

Add the handler (win detection is added next milestone — for now it just flips the turn):
```js
function handleClick(i) {
  if (!latest || latest.status !== "active") return; // not playing
  if (latest.turn !== myMark) return;                // not your turn
  if (latest.board[i] !== "") return;                // cell taken

  const board = [...latest.board];
  board[i] = myMark;

  updateDoc(doc(db, "games", gameId), {
    board,
    turn: myMark === "X" ? "O" : "X",   // Milestone 6 adds win/draw handling here
  });
}
```

**Run & verify:** two windows. Take turns clicking — each mark appears on **both** boards, and the "Your move / Opponent's move" labels swap correctly. Confirm you **can't** click on your opponent's turn or into a filled cell. (The game won't end yet — that's next.)

> **In production →** Those three checks live only in the browser, so a double-click, stale data, or someone bypassing the page could still send an odd write. A real game would also enforce the rules on the server — with a transaction, stricter security rules, or a Cloud Function. For this learning version the UI checks are enough; just know the guard is client-side only.

---

### Milestone 6 — Win and draw detection  *(Driver: A)*
**Goal:** the game recognizes a win or a draw and announces the result.
**Concept:** pure game logic. There are 8 winning lines (3 rows, 3 columns, 2 diagonals). After each move you check them; if none match and all 9 cells are filled, it's a draw. The result is written into the document so **both** players' listeners show it.

**Do this — in `public/game.js`:**

Add the winning lines near the top of the file:
```js
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // columns
  [0,4,8],[2,4,6],           // diagonals
];
```

Add the checker function:
```js
function getWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}
```

Upgrade `handleClick` to decide the outcome instead of always flipping the turn:
```js
function handleClick(i) {
  if (!latest || latest.status !== "active") return;
  if (latest.turn !== myMark) return;
  if (latest.board[i] !== "") return;

  const board = [...latest.board];
  board[i] = myMark;

  const winner = getWinner(board);
  const full = board.every((c) => c !== "");
  const update = { board };
  if (winner)    { update.status = "won";  update.winner = winner; }
  else if (full) { update.status = "draw"; }
  else           { update.turn = myMark === "X" ? "O" : "X"; }

  updateDoc(doc(db, "games", gameId), update);
}
```

Add the game-over branch to `render()` (after the `"active"` block):
```js
  // game over
  boardEl.classList.add("locked");
  if (latest.status === "draw") statusEl.textContent = "It's a draw!";
  else statusEl.textContent = latest.winner === myMark ? "You win! 🎉" : "You lose 😖";
  showEndButtons();   // the buttons themselves come in Milestone 7
```

That branch calls `showEndButtons()`, which Milestone 7 will build. To keep your code runnable right now, add a temporary empty version of it at the bottom of `game.js` — Milestone 7 replaces it:
```js
function showEndButtons() {
  // Milestone 7 fills this in.
}
```

**Run & verify:** play a full game and win along a row, a column, and a diagonal; then play one to a draw. Both screens should show the right result *text* ("You win!" on one, "You lose" on the other; "It's a draw!" on both). The Play again / End game buttons don't appear yet — that's Milestone 7; the stub just keeps the page from erroring in the meantime.

---

### Milestone 7 — Play again / end game  *(Driver: B)*
**Goal:** after a game ends, both players can agree to a rematch, or leave.
**Concept:** a rematch needs **both** players to opt in, so each sets a flag (`rematch.X` / `rematch.O`); whoever sets the second flag resets the board. "End game" must **unsubscribe the listener** (otherwise it keeps running in the background) and return to the login screen.

**Do this — in `public/game.js`:**

Add `getDoc` and `deleteDoc` to the import:
```js
import { doc, getDoc, onSnapshot, updateDoc, deleteDoc }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
```

Now replace the temporary `showEndButtons` stub from Milestone 6 with the real version, and add the two actions it triggers:
```js
function showEndButtons() {
  const again = document.createElement("button");
  again.textContent = "Play again";
  again.onclick = requestRematch;

  const end = document.createElement("button");
  end.textContent = "End game";
  end.onclick = () => endGame(true);

  resultEl.append(again, end);
}

// A rematch happens only when BOTH players have asked for one.
async function requestRematch() {
  const ref = doc(db, "games", gameId);
  await updateDoc(ref, { [`rematch.${myMark}`]: true });

  const snap = await getDoc(ref);
  const r = snap.data().rematch;
  if (r.X && r.O) {
    await updateDoc(ref, {
      board: ["", "", "", "", "", "", "", "", ""],
      turn: "X", status: "active", winner: null,
      rematch: { X: false, O: false },
    });
  } else {
    statusEl.textContent = "Waiting for opponent to accept a rematch…";
  }
}

export async function endGame(removeDoc = false) {
  if (unsubscribe) unsubscribe();                 // stop the live listener (important!)
  if (removeDoc && gameId) {
    try { await deleteDoc(doc(db, "games", gameId)); } catch (e) {}
  }
  gameId = null; myMark = null; latest = null;
  if (onEndCb) onEndCb();                          // main.js sends us back to login
}
```

**Run & verify:** finish a game. Click **Play again** in one window — it says "Waiting for opponent…". Click it in the other — both boards reset to a fresh game. Finish again, then click **End game** — that window returns to the login screen. You've got a complete loop. 🎉

> **In production →** `requestRematch` reads the document right after writing its own flag, so two players clicking "Play again" at the same instant could both read before either reset runs. For two friends it works fine; a polished version would do the reset inside a **transaction** — the same tool from Milestone 3. The pattern keeps returning: whenever two people might write the same thing at once, that's a transaction.

> ✋ **Checkpoint — explain to your partner before moving on:** Why must `endGame` call `unsubscribe()`? And why does a rematch only restart once *both* players have clicked "Play again"?

---

### Milestone 8 — Deploy to the world  *(Pair)*
**Goal:** put your game on the real internet and play it across two phones.
**Concept:** `firebase deploy` uploads your `public/` folder to Firebase Hosting and gives you a public `https://` URL.

**Do this:**
```bash
firebase deploy
```
It prints:
```
Hosting URL: https://YOUR-PROJECT-ID.web.app
```
Open that on two phones (or a phone and a laptop) and play. Different devices have separate logins, so matchmaking pairs you correctly.

> **Coordination:** because you're both editors, you can both deploy. Iterate locally with `firebase emulators:start --only hosting` and only run `firebase deploy` when you mean to publish, so you don't overwrite each other. Deploy just the site with `firebase deploy --only hosting`.

---

### Milestone 9 — Replace test mode with starter security rules  *(Driver: A)*
**Goal:** replace test mode (which lets *anyone* read and write, and expires after ~30 days) with rules that require a signed-in user.
**Concept:** **Security rules** run on Google's servers and decide who can read or write each document. They're your real protection — not the config object.

**Do this — replace the contents of `firestore.rules`** (in the project root):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Anyone signed in (even anonymously) can read games, create one, and update one.
    // Solid starting point. A tighter, player-restricted version is an Intern A stretch goal.
    match /games/{gameId} {
      allow read, create, update, delete: if request.auth != null;
    }
  }
}
```
Deploy just the rules:
```bash
firebase deploy --only firestore:rules
```
**Run & verify:** play a full game on the deployed URL — everything should still work, but now an un-signed-in request would be rejected. (If you ever see "Missing or insufficient permissions," it almost always means rules — re-check this file and that sign-in succeeded.)

> **In production →** These are *starter* rules, not a finished security model. They block anyone who isn't signed in, but they still trust every signed-in user equally — so any signed-in player could in principle read or change any game. That's acceptable for a workshop. Restricting changes to a game's own two players is the natural next step, and it's written up in Intern A's stretch goals.

---

## 4. Complete files for reference

Once you've finished all milestones, your files should match these. Use them to check your work.

<details>
<summary><code>public/index.html</code></summary>

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tic-Tac-Toe</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Tic-Tac-Toe</h1>
    <section id="login-screen">
      <label for="name">Your name</label>
      <input id="name" type="text" placeholder="Your name" maxlength="16" />
      <button id="join">Join game</button>
      <p class="hint">You'll be matched with the next person who joins.</p>
    </section>
    <section id="game-screen" class="hidden">
      <p id="status" aria-live="polite">Loading…</p>
      <div id="board"></div>
      <div id="result"></div>
    </section>
  </main>
  <script type="module" src="main.js"></script>
</body>
</html>
```
</details>

<details>
<summary><code>public/firebase-config.js</code></summary>

```js
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```
</details>

<details>
<summary><code>public/lobby.js</code> (Intern A's file)</summary>

```js
import { auth, db } from "./firebase-config.js";
import { signInAnonymously }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  collection, query, where, limit, getDocs, addDoc,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

export async function signIn(name) {
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

export async function findOrCreateGame(uid, name) {
  const snapshot = await getDocs(
    query(collection(db, "games"), where("status", "==", "waiting"), limit(5))
  );
  const candidate = snapshot.docs.find((d) => d.data().players.X !== uid);

  if (candidate) {
    try {
      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(candidate.ref);
        const data = fresh.data();
        if (!data || data.status !== "waiting" || data.players.O) {
          throw new Error("That game was just taken");
        }
        tx.update(candidate.ref, {
          "players.O": uid,
          "playerNames.O": name,
          status: "active",
        });
      });
      return { gameId: candidate.id, myMark: "O" };
    } catch (e) {
      console.log("Couldn't join, hosting our own instead:", e.message);
    }
  }

  const newGame = await addDoc(collection(db, "games"), {
    board: ["", "", "", "", "", "", "", "", ""],
    players: { X: uid, O: null },
    playerNames: { X: name, O: null },
    turn: "X",
    status: "waiting",
    winner: null,
    rematch: { X: false, O: false },
    createdAt: serverTimestamp(),
  });
  return { gameId: newGame.id, myMark: "X" };
}
```
</details>

<details>
<summary><code>public/game.js</code> (Intern B's file)</summary>

```js
import { db } from "./firebase-config.js";
import { doc, getDoc, onSnapshot, updateDoc, deleteDoc }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

let gameId = null, myMark = null, latest = null, unsubscribe = null, onEndCb = null;

const boardEl  = document.getElementById("board");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

export function startGame(id, mark, onEnd) {
  gameId = id; myMark = mark; onEndCb = onEnd || null;
  buildBoard();
  unsubscribe = onSnapshot(doc(db, "games", gameId), (snap) => {
    if (!snap.exists()) return;
    latest = snap.data();
    render();
  });
}

function buildBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.setAttribute("aria-label", `Cell ${i + 1}: empty`);
    cell.addEventListener("click", () => handleClick(i));
    boardEl.appendChild(cell);
  }
}

function render() {
  const cells = boardEl.querySelectorAll(".cell");
  latest.board.forEach((value, i) => {
    cells[i].textContent = value;
    cells[i].setAttribute("aria-label", `Cell ${i + 1}: ${value || "empty"}`);
  });
  resultEl.innerHTML = "";

  if (latest.status === "waiting") {
    statusEl.textContent = `Waiting in the lobby for an opponent… (you are ${myMark})`;
    boardEl.classList.add("locked");
    return;
  }
  if (latest.status === "active") {
    const myTurn = latest.turn === myMark;
    statusEl.textContent = myTurn ? "Your move" : "Opponent's move";
    boardEl.classList.toggle("locked", !myTurn);
    return;
  }
  boardEl.classList.add("locked");
  if (latest.status === "draw") statusEl.textContent = "It's a draw!";
  else statusEl.textContent = latest.winner === myMark ? "You win! 🎉" : "You lose 😖";
  showEndButtons();
}

function handleClick(i) {
  if (!latest || latest.status !== "active") return;
  if (latest.turn !== myMark) return;
  if (latest.board[i] !== "") return;

  const board = [...latest.board];
  board[i] = myMark;

  const winner = getWinner(board);
  const full = board.every((c) => c !== "");
  const update = { board };
  if (winner)    { update.status = "won";  update.winner = winner; }
  else if (full) { update.status = "draw"; }
  else           { update.turn = myMark === "X" ? "O" : "X"; }

  updateDoc(doc(db, "games", gameId), update);
}

function getWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function showEndButtons() {
  const again = document.createElement("button");
  again.textContent = "Play again";
  again.onclick = requestRematch;
  const end = document.createElement("button");
  end.textContent = "End game";
  end.onclick = () => endGame(true);
  resultEl.append(again, end);
}

async function requestRematch() {
  const ref = doc(db, "games", gameId);
  await updateDoc(ref, { [`rematch.${myMark}`]: true });
  const snap = await getDoc(ref);
  const r = snap.data().rematch;
  if (r.X && r.O) {
    await updateDoc(ref, {
      board: ["", "", "", "", "", "", "", "", ""],
      turn: "X", status: "active", winner: null,
      rematch: { X: false, O: false },
    });
  } else {
    statusEl.textContent = "Waiting for opponent to accept a rematch…";
  }
}

export async function endGame(removeDoc = false) {
  if (unsubscribe) unsubscribe();
  if (removeDoc && gameId) {
    try { await deleteDoc(doc(db, "games", gameId)); } catch (e) {}
  }
  gameId = null; myMark = null; latest = null;
  if (onEndCb) onEndCb();
}
```
</details>

<details>
<summary><code>public/main.js</code> (shared)</summary>

```js
import { signIn, findOrCreateGame } from "./lobby.js";
import { startGame } from "./game.js";

const loginScreen = document.getElementById("login-screen");
const gameScreen  = document.getElementById("game-screen");
const nameInput   = document.getElementById("name");
const joinBtn     = document.getElementById("join");

function show(screen) {
  loginScreen.classList.toggle("hidden", screen !== "login");
  gameScreen.classList.toggle("hidden", screen !== "game");
}

joinBtn.addEventListener("click", async () => {
  const name = (nameInput.value || "Anonymous").trim();
  joinBtn.disabled = true;
  joinBtn.textContent = "Joining…";
  try {
    const uid = await signIn(name);
    const { gameId, myMark } = await findOrCreateGame(uid, name);
    show("game");
    startGame(gameId, myMark, () => {
      show("login");
      joinBtn.disabled = false;
      joinBtn.textContent = "Join game";
    });
  } catch (err) {
    alert("Something went wrong: " + err.message);
    joinBtn.disabled = false;
    joinBtn.textContent = "Join game";
  }
});

show("login");
```
</details>

<details>
<summary><code>firestore.rules</code> (project root)</summary>

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /games/{gameId} {
      allow read, create, update, delete: if request.auth != null;
    }
  }
}
```
</details>

---

## 5. When something breaks (macOS troubleshooting)

- **Blank page, or console error mentioning CORS / "Cross origin requests are only supported for HTTP."** → You opened the file directly (`file://`). Run `firebase emulators:start --only hosting` and use **http://localhost:5000**.
- **"Missing or insufficient permissions."** → A security-rules problem: either sign-in didn't happen, or test mode expired, or your `firestore.rules` is too strict. Re-check Milestone 9 and that you reached `signIn` successfully.
- **Both windows become "X" / never get matched.** → You're using two windows of the same browser, sharing one anonymous login. Use one normal + one Incognito window, or two devices.
- **`command not found: firebase`** → The CLI isn't on your PATH. Reinstall with `npm install -g firebase-tools`; on macOS you may need `sudo`, or fix your npm global prefix.
- **`Error: Could not load the default credentials` / wrong project.** → Run `firebase login` again, and `firebase use` inside the folder to confirm the selected project matches your `.firebaserc`.
- **"Port 5000 is already in use."** → A previous server is still running. Stop it with `Ctrl + C`, or start on another port: `firebase emulators:start --only hosting --port 5050`.
- **Nothing imports / "Failed to fetch dynamically imported module."** → A typo in an import path or mismatched SDK version numbers. All `firebasejs/12.14.0/...` URLs must use the **same** version.
- **Changes don't show up.** → Hard-refresh the browser (`⌘ + Shift + R`). The local server serves your latest *saved* files, so make sure you saved in your editor.

---

## 6. Next: your personal guides

You've now got the full picture. Each of you has a personal guide that zooms in on the milestones you drive — what to build, the concepts to focus on, how to test your part on its own, and how to hand off cleanly to each other. Read this main guide first; lean on your personal guide while you build; and **review each other's milestones** so you both leave understanding the entire game, front to back.

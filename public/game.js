import { db } from "./firebase-config.js";
import {
  doc, onSnapshot, updateDoc, deleteDoc, getDoc, setDoc, increment,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

let gameId = null, myMark = null, myUid = null, myName = null;
let latest = null, unsubscribe = null, onEndCb = null, statsWritten = false;
let lastReactionId = null;
let boardSize = 3, winLines = [];

const boardEl       = document.getElementById("board");
const statusEl      = document.getElementById("status");
const resultEl      = document.getElementById("result");
const reactionBarEl = document.getElementById("reaction-bar");

const REACTION_EMOJIS = ["👍", "😂", "🔥", "😮", "😢"];
function getWinLines(size) {
  if (size === 3) return [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  // 5×5: 4-in-a-row (28 lines)
  const lines = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c <= 1; c++)
      lines.push([r*5+c, r*5+c+1, r*5+c+2, r*5+c+3]);
  for (let c = 0; c < 5; c++)
    for (let r = 0; r <= 1; r++)
      lines.push([r*5+c, (r+1)*5+c, (r+2)*5+c, (r+3)*5+c]);
  for (let r = 0; r <= 1; r++)
    for (let c = 0; c <= 1; c++)
      lines.push([r*5+c, (r+1)*5+c+1, (r+2)*5+c+2, (r+3)*5+c+3]);
  for (let r = 0; r <= 1; r++)
    for (let c = 3; c <= 4; c++)
      lines.push([r*5+c, (r+1)*5+c-1, (r+2)*5+c-2, (r+3)*5+c-3]);
  return lines;
}

export function startGame(id, mark, uid, name, size, onEnd) {
  gameId = id; myMark = mark; myUid = uid; myName = name;
  boardSize = size || 3;
  winLines = getWinLines(boardSize);
  onEndCb = onEnd || null;
  statsWritten = false;
  lastReactionId = null;
  buildBoard();
  buildReactionBar();

  unsubscribe = onSnapshot(doc(db, "games", gameId), (snap) => {
    if (!snap.exists()) return;
    latest = snap.data();
    // reset statsWritten flag when a rematch resets the board
    if (latest.status === "active" || latest.status === "waiting") statsWritten = false;
    handleReaction(latest.reaction);
    render();
  });
}

function buildReactionBar() {
  reactionBarEl.innerHTML = "";
  for (const emoji of REACTION_EMOJIS) {
    const btn = document.createElement("button");
    btn.className = "reaction-btn";
    btn.textContent = emoji;
    btn.setAttribute("aria-label", `React with ${emoji}`);
    btn.addEventListener("click", () => sendReaction(emoji));
    reactionBarEl.appendChild(btn);
  }
}

function sendReaction(emoji) {
  if (!gameId) return;
  updateDoc(doc(db, "games", gameId), {
    reaction: { emoji, by: myUid, id: `${Date.now()}-${Math.random()}` },
  });
}

function handleReaction(r) {
  if (!r) return;
  // On first snapshot of a session, baseline without animating so we don't
  // replay a reaction left over from before this player joined.
  if (lastReactionId === null) {
    lastReactionId = r.id;
    return;
  }
  if (r.id === lastReactionId) return;
  lastReactionId = r.id;
  animateReaction(r.emoji);
}

function animateReaction(emoji) {
  const span = document.createElement("span");
  span.className = "floating-emoji";
  span.textContent = emoji;
  // Random horizontal spread across the bar width
  const jitter = Math.floor(Math.random() * 200) - 100;
  span.style.left = `calc(50% + ${jitter}px)`;
  reactionBarEl.appendChild(span);
  span.addEventListener("animationend", () => span.remove(), { once: true });
}

function buildBoard() {
  boardEl.innerHTML = "";
  boardEl.className = `size-${boardSize}`;
  for (let i = 0; i < boardSize * boardSize; i++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.setAttribute("aria-label", `Cell ${i + 1}: empty`);
    cell.addEventListener("click", () => handleClick(i));
    boardEl.appendChild(cell);
  }
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
  // game over
  boardEl.classList.add("locked");
  if (latest.status === "draw") statusEl.textContent = "It's a draw!";
  else statusEl.textContent = latest.winner === myMark ? "You win! 🎉" : "You lose 😖";

  if (!statsWritten) {
    statsWritten = true;
    writeStats();
  }
  showEndButtons();
}

async function writeStats() {
  const won  = latest.winner === myMark;
  const draw = latest.status === "draw";
  // Always write all three fields so orderBy("wins") never excludes this document.
  // increment(0) initializes the field to 0 if absent, otherwise leaves it unchanged.
  try {
    await setDoc(doc(db, "leaderboard", myUid), {
      name: myName,
      wins:   won              ? increment(1) : increment(0),
      losses: (!won && !draw)  ? increment(1) : increment(0),
      draws:  draw             ? increment(1) : increment(0),
      score: won ? increment(3) : draw ? increment(1) : increment(0),
    }, { merge: true });
  } catch (e) {
    console.warn("Leaderboard write failed:", e);
  }
}

function getWinner(board) {
  for (const line of winLines) {
    const val = board[line[0]];
    if (val && line.every(i => board[i] === val)) return val;
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
      board: Array(boardSize * boardSize).fill(""),
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
  gameId = null; myMark = null; myUid = null; myName = null; latest = null;
  if (onEndCb) onEndCb();
}

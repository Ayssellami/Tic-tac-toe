import { db } from "./firebase-config.js";
import {
  doc, onSnapshot, updateDoc, deleteDoc, getDoc, setDoc, increment,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

let gameId = null, myMark = null, myUid = null, myName = null;
let latest = null, unsubscribe = null, onEndCb = null, statsWritten = false;

const boardEl  = document.getElementById("board");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // columns
  [0,4,8],[2,4,6],           // diagonals
];

export function startGame(id, mark, uid, name, onEnd) {
  gameId = id; myMark = mark; myUid = uid; myName = name;
  onEndCb = onEnd || null;
  statsWritten = false;
  buildBoard();

  unsubscribe = onSnapshot(doc(db, "games", gameId), (snap) => {
    if (!snap.exists()) return;
    latest = snap.data();
    // reset statsWritten flag when a rematch resets the board
    if (latest.status === "active" || latest.status === "waiting") statsWritten = false;
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
    }, { merge: true });
  } catch (e) {
    console.warn("Leaderboard write failed:", e);
  }
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
  gameId = null; myMark = null; myUid = null; myName = null; latest = null;
  if (onEndCb) onEndCb();
}

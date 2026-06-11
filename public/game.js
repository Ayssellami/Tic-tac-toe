import { db } from "./firebase-config.js";
import { doc, onSnapshot, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

let gameId = null, myMark = null, latest = null, unsubscribe = null, onEndCb = null;

const boardEl  = document.getElementById("board");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // columns
  [0,4,8],[2,4,6],           // diagonals
];

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
    cell.addEventListener("click", () => handleClick(i));
    // click handling comes in Milestone 5
    boardEl.appendChild(cell);
  }
}

function handleClick(i) {
  if (!latest || latest.status !== "active") return; // not playing
  if (latest.turn !== myMark) return;                // not your turn
  if (latest.board[i] !== "") return;                // cell taken

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
  showEndButtons();   // the buttons themselves come in Milestone 7
  // game over states are handled in Milestone 6
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
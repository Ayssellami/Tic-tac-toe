import { signIn, findOrCreateGame } from "./lobby.js";
import { startGame } from "./game.js";
import { startLeaderboard } from "./leaderboard.js";

const loginScreen    = document.getElementById("login-screen");
const gameScreen     = document.getElementById("game-screen");
const nameInput      = document.getElementById("name");
const joinBtn        = document.getElementById("join");
const sizeBtns       = document.querySelectorAll(".size-btn");
const minigameToggle = document.getElementById("minigame-toggle");

let selectedSize = 3;
let minigameMode = false;

sizeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    sizeBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedSize = Number(btn.dataset.size);
  });
});

minigameToggle.addEventListener("click", () => {
  minigameMode = !minigameMode;
  minigameToggle.classList.toggle("active", minigameMode);
  minigameToggle.textContent = minigameMode ? "Minigames: On" : "Minigames: Off";
});

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
    const { gameId, myMark } = await findOrCreateGame(uid, name, selectedSize, minigameMode);
    show("game");
    startGame(gameId, myMark, uid, name, selectedSize, () => {
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
startLeaderboard();

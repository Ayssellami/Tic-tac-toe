import { signIn, findOrCreateGame } from "./lobby.js";
import { startGame } from "./game.js";
import { startLeaderboard } from "./leaderboard.js";

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
    startGame(gameId, myMark, uid, name, () => {
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

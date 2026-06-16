import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, limit, onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const tableBody = document.getElementById("leaderboard-body");

export function startLeaderboard() {
  const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));

  return onSnapshot(q, (snap) => {
    tableBody.innerHTML = "";
    if (snap.empty) {
      tableBody.innerHTML = '<tr><td colspan="5" class="lb-empty">No games played yet</td></tr>';
      return;
    }
    snap.docs.forEach((d, i) => {
      const { name = "?", wins = 0, losses = 0, draws = 0, score = 0 } = d.data();
      const tr = document.createElement("tr");
      [i + 1, name, wins, losses, draws, score].forEach((val) => {
        const td = document.createElement("td");
        td.textContent = val;
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  }, (err) => {
    console.error("Leaderboard query failed:", err);
    tableBody.innerHTML = '<tr><td colspan="6" class="lb-empty">Leaderboard unavailable</td></tr>';
  });
}

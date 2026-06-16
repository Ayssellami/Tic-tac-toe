import { auth, db } from "./firebase-config.js";
import { signInAnonymously }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
    collection, query, where, limit, getDocs, addDoc,
    runTransaction, serverTimestamp
  } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";


// Anonymous sign-in: instant login, no password. Returns the player's uid.
export async function signIn(name) {
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}  
  
// Find an open game to join, or host a new one if there isn't one.
export async function findOrCreateGame(uid, name, size = 3) {
    // 1) Look for games waiting for a second player with the same board size.
    const snapshot = await getDocs(
      query(collection(db, "games"), where("status", "==", "waiting"), where("size", "==", size), limit(5))
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
      board: Array(size * size).fill(""),
      size,
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
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, addDoc, doc, query, orderBy, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const COURSE_ID = "ai-mastery";
let currentUser = null;
const replyUnsubs = new Map(); // doubtId -> unsubscribe fn, so we don't double-listen on re-render

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  document.getElementById("user-name").textContent = user.displayName || "Student";
  document.getElementById("user-email").textContent = user.email;
  listenDoubts();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

document.getElementById("doubt-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("doubt-input");
  const text = input.value.trim();
  if (!text) return;

  const btn = document.getElementById("doubt-submit-btn");
  btn.disabled = true;
  btn.textContent = "Posting...";
  try {
    await addDoc(collection(db, "doubts"), {
      uid: currentUser.uid,
      userName: currentUser.displayName || "Student",
      text,
      courseId: COURSE_ID,
      createdAt: serverTimestamp(),
    });
    input.value = "";
  } catch (err) {
    alert("Could not post your doubt. Please try again.");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Post doubt";
  }
});

function listenDoubts() {
  const q = query(collection(db, "doubts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const list = document.getElementById("doubt-list");

    if (snap.empty) {
      list.innerHTML = `<div class="empty-state"><h3>No doubts yet</h3><p>Be the first to ask something.</p></div>`;
      return;
    }

    list.innerHTML = snap.docs.map((d) => {
      const doubt = d.data();
      return `
        <div class="doubt-card" data-id="${d.id}">
          <div class="doubt-card__meta">${escapeHtml(doubt.userName || "Student")} · ${formatTime(doubt.createdAt)}</div>
          <div class="doubt-card__text">${escapeHtml(doubt.text)}</div>
          <div class="doubt-replies" id="replies-${d.id}"></div>
          <form class="doubt-reply-form" data-doubt-id="${d.id}">
            <input type="text" placeholder="Write a reply…" required />
            <button type="submit" class="btn btn-ghost" style="width:auto;padding:8px 16px;">Reply</button>
          </form>
        </div>`;
    }).join("");

    snap.docs.forEach((d) => listenReplies(d.id));
    list.querySelectorAll(".doubt-reply-form").forEach((form) => {
      form.addEventListener("submit", onReplySubmit);
    });
  });
}

function listenReplies(doubtId) {
  if (replyUnsubs.has(doubtId)) return; // already listening
  const q = query(collection(db, "doubts", doubtId, "replies"), orderBy("createdAt", "asc"));
  const unsub = onSnapshot(q, (snap) => {
    const container = document.getElementById(`replies-${doubtId}`);
    if (!container) return; // doubt card was re-rendered/removed
    container.innerHTML = snap.docs.map((d) => {
      const r = d.data();
      return `<div class="doubt-reply">
        <span class="doubt-reply__author">${escapeHtml(r.userName || "Student")}:</span>
        <span>${escapeHtml(r.text)}</span>
      </div>`;
    }).join("");
  });
  replyUnsubs.set(doubtId, unsub);
}

async function onReplySubmit(e) {
  e.preventDefault();
  const form = e.target;
  const doubtId = form.dataset.doubtId;
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) return;

  input.disabled = true;
  try {
    await addDoc(collection(db, "doubts", doubtId, "replies"), {
      uid: currentUser.uid,
      userName: currentUser.displayName || "Student",
      text,
      createdAt: serverTimestamp(),
    });
    input.value = "";
  } catch (err) {
    alert("Could not post your reply. Please try again.");
    console.error(err);
  } finally {
    input.disabled = false;
  }
}

function formatTime(ts) {
  if (!ts || !ts.toDate) return "just now";
  return ts.toDate().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

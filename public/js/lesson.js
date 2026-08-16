import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const COURSE_ID = "ai-mastery";
const params = new URLSearchParams(location.search);
const lessonId = params.get("id") || "lesson-1";

const SEED_LESSON = {
  id: "lesson-1",
  order: 1,
  title: "Building Presentations with AI",
  description: "How to go from a raw idea to a polished, presentable deck using AI tools end to end.",
  // Path inside Firebase Storage, e.g. "lectures/ai-mastery/lesson-1.mp4"
  videoPath: "lectures/ai-mastery/lesson-1.mp4",
};

let currentUser = null;
let saveTimer = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  document.getElementById("user-name").textContent = user.displayName || "Student";
  document.getElementById("user-email").textContent = user.email;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const enrolled = userSnap.exists() ? !!userSnap.data().enrolled : false;
  if (!enrolled) {
    window.location.href = "dashboard.html";
    return;
  }

  await loadLesson();
  await loadNotes();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

async function loadLesson() {
  let lesson = SEED_LESSON;
  try {
    const snap = await getDoc(doc(db, "courses", COURSE_ID, "lessons", lessonId));
    if (snap.exists()) lesson = { id: snap.id, ...snap.data() };
  } catch (e) {
    console.warn("Using seed lesson content:", e.message);
  }

  document.title = `${lesson.title} — LyroWeb Academy`;
  document.getElementById("lesson-title").textContent = lesson.title;
  document.getElementById("lesson-title-2").textContent = lesson.title;
  document.getElementById("lesson-desc").textContent = lesson.description || "";

  const frame = document.getElementById("video-frame");
  try {
    const url = await getDownloadURL(ref(storage, lesson.videoPath));
    frame.innerHTML = `<video controls controlsList="nodownload" src="${url}"></video>`;
  } catch (e) {
    frame.innerHTML = `<div style="color:#8A90A0;display:flex;align-items:center;justify-content:center;height:100%;font-family:var(--font-mono);font-size:13px;text-align:center;padding:20px;">
      Video not uploaded yet.<br>Upload to Storage path: <code>${lesson.videoPath}</code>
    </div>`;
  }
}

async function loadNotes() {
  const ref_ = doc(db, "users", currentUser.uid, "notes", lessonId);
  const snap = await getDoc(ref_);
  const input = document.getElementById("notes-input");
  if (snap.exists()) input.value = snap.data().text || "";

  input.addEventListener("input", () => {
    document.getElementById("save-state").textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNotes, 800);
  });
}

async function saveNotes() {
  const text = document.getElementById("notes-input").value;
  const ref_ = doc(db, "users", currentUser.uid, "notes", lessonId);
  await setDoc(ref_, { text, updatedAt: serverTimestamp() }, { merge: true });
  document.getElementById("save-state").textContent = "Saved";
}

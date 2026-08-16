import { auth, db, API_BASE } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, collection, getDocs, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const COURSE_ID = "ai-mastery";

// Seed content shown until you populate /courses/ai-mastery/lessons in Firestore.
// Structure to add in Firestore console:
//   courses/ai-mastery                { title, price }
//   courses/ai-mastery/lessons/{id}   { title, order, description, durationLabel, videoPath }
const SEED_LESSONS = [
  {
    id: "lesson-1",
    order: 1,
    title: "Building Presentations with AI",
    description: "How to go from a raw idea to a polished, presentable deck using AI tools end to end.",
    durationLabel: "48 min",
  },
];

let currentUser = null;
let enrolled = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  document.getElementById("user-name").textContent = user.displayName || "Student";
  document.getElementById("user-email").textContent = user.email;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  enrolled = userSnap.exists() ? !!userSnap.data().enrolled : false;

  document.getElementById("course-pill").textContent = enrolled ? "Enrolled" : "Preview";
  renderEnrollStatus();
  await renderLessons();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

function renderEnrollStatus() {
  const el = document.getElementById("enroll-status");
  if (enrolled) {
    el.innerHTML = `<span class="pill">✓ Active</span>`;
  } else {
    el.innerHTML = `<button class="btn btn-amber" id="enroll-btn" style="width:auto;padding:10px 20px;">Enroll now</button>`;
    document.getElementById("enroll-btn").addEventListener("click", startCheckout);
  }
}

async function renderLessons() {
  const grid = document.getElementById("lesson-grid");
  const paywallArea = document.getElementById("paywall-area");
  grid.innerHTML = "";
  paywallArea.innerHTML = "";

  let lessons = SEED_LESSONS;
  try {
    const q = query(collection(db, "courses", COURSE_ID, "lessons"), orderBy("order"));
    const snap = await getDocs(q);
    if (!snap.empty) {
      lessons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    // Firestore not seeded yet / not configured — fall back to seed content.
    console.warn("Using seed lesson content:", e.message);
  }

  if (!enrolled) {
    paywallArea.innerHTML = `
      <div class="paywall">
        <div class="locked-badge">🔒 Not enrolled</div>
        <h3 style="font-family:var(--font-display);font-size:20px;">AI Mastery Course</h3>
        <p style="color:var(--slate);font-size:14px;margin-top:6px;">Full lecture library, downloadable slide templates, and notes that save automatically.</p>
        <div class="price">₹1,999 <span>one-time</span></div>
        <button class="btn btn-amber" id="paywall-enroll-btn" style="margin-top:16px;">Enroll with Cashfree</button>
      </div>`;
    document.getElementById("paywall-enroll-btn").addEventListener("click", startCheckout);
  }

  lessons.forEach((lesson) => {
    const card = document.createElement("a");
    card.href = enrolled ? `lesson.html?id=${lesson.id}` : "javascript:void(0)";
    card.className = "slide-card";
    if (!enrolled) card.style.cursor = "not-allowed";

    card.innerHTML = `
      <div class="slide-card__fold ${enrolled ? "" : "locked"}"></div>
      <div class="slide-card__thumb">
        <div class="slide-card__number">LESSON ${String(lesson.order).padStart(2, "0")}</div>
      </div>
      <div class="slide-card__body">
        <div class="slide-card__title">${lesson.title}</div>
        <div class="slide-card__meta">${lesson.durationLabel || ""}${lesson.description ? " · " + lesson.description : ""}</div>
        <div class="progress-ring-row">
          <div class="progress-track"><div class="progress-fill" style="width:0%"></div></div>
          <div class="progress-pct">0%</div>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  if (lessons.length === 0) {
    grid.innerHTML = `<div class="empty-state"><h3>No lessons yet</h3><p>Add lessons under courses/${COURSE_ID}/lessons in Firestore.</p></div>`;
  }
}

async function startCheckout() {
  try {
    const res = await fetch(`${API_BASE}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName,
        courseId: COURSE_ID,
      }),
    });
    const data = await res.json();
    if (data.paymentLink) {
      window.location.href = data.paymentLink;
    } else {
      alert("Could not start checkout. Please try again.");
    }
  } catch (e) {
    alert("Checkout server isn't reachable. Make sure the /server backend is running (see README).");
  }
}

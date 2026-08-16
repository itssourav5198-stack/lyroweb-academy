import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const errorBox = document.getElementById("auth-error");

function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.add("show");
}

// Ensure a /users/{uid} profile doc exists. New users default to enrolled: false.
async function ensureUserDoc(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name: user.displayName || extra.name || "",
      email: user.email,
      enrolled: false,
      createdAt: serverTimestamp(),
    });
  }
}

// Redirect already-logged-in users straight to the dashboard
onAuthStateChanged(auth, (user) => {
  const onAuthPage = location.pathname.endsWith("index.html") || location.pathname.endsWith("signup.html") || location.pathname === "/";
  if (user && onAuthPage) {
    window.location.href = "dashboard.html";
  }
});

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("show");
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "Logging in...";
    try {
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(friendlyAuthError(err.code));
      btn.disabled = false;
      btn.textContent = "Log in";
    }
  });
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("show");
    const btn = document.getElementById("signup-btn");
    btn.disabled = true;
    btn.textContent = "Creating account...";
    try {
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await ensureUserDoc(cred.user, { name });
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(friendlyAuthError(err.code));
      btn.disabled = false;
      btn.textContent = "Create account";
    }
  });
}

const googleBtn = document.getElementById("google-btn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    errorBox.classList.remove("show");
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureUserDoc(cred.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(friendlyAuthError(err.code));
    }
  });
}

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

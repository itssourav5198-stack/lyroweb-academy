# LyroWeb Academy

A paid mastery-course platform: students log in, watch recorded lectures, and take
notes that autosave. First course: **"Building Presentations with AI."**

- **Frontend**: plain HTML/CSS/JS (no build step) — `public/`
- **Backend**: small Node/Express server for Cashfree order creation + webhook — `server/`
- **Auth, data, video**: Firebase (Auth, Firestore, Storage)
- **Payments**: Cashfree (order creation is server-side — required, since it needs your secret key)

---

## 1. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project.
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Firestore Database** → Create database (production mode).
4. **Storage** → Get started (default bucket is fine).
5. Project Settings → General → "Your apps" → Add a **Web app** → copy the config
   object into `public/js/firebase-config.js`.
6. Deploy the security rules in this repo:
   ```
   firebase deploy --only firestore:rules,storage:rules
   ```
   (or paste `firestore.rules` / `storage.rules` into the console's Rules tabs manually)

### Add your course content
In Firestore, create:
```
courses/ai-mastery                        { title: "AI Mastery Course", price: 1999 }
courses/ai-mastery/lessons/lesson-1        { title: "Building Presentations with AI",
                                              order: 1,
                                              description: "...",
                                              durationLabel: "48 min",
                                              videoPath: "lectures/ai-mastery/lesson-1.mp4" }
```
Until you do this, the site shows a one-lesson placeholder so you can preview the UI.

### Upload the lecture video
Firebase Console → Storage → upload the recording to the exact path you set as
`videoPath` above (e.g. `lectures/ai-mastery/lesson-1.mp4`). The Storage rules only
allow reading it to users marked `enrolled: true`.

---

## 2. Set up Cashfree

1. Sign up at [Cashfree Merchant Dashboard](https://merchant.cashfree.com).
2. Developers → API Keys → copy your **App ID** and **Secret Key** (use Sandbox keys first).
3. In `server/.env` (copy from `.env.example`), fill in `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`.
4. In the Cashfree dashboard, set your webhook URL to `https://<your-backend-domain>/cashfree-webhook`
   once the backend is deployed (step 4 below) — this is what marks a student "enrolled" after payment.

### Firebase Admin credentials (needed by the backend)
Firebase Console → Project Settings → Service Accounts → **Generate new private key**.
Paste the entire JSON contents as a single line into `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env`.

---

## 3. Run locally

**Frontend** — any static server works, e.g.:
```
cd public
npx serve .
```

**Backend**:
```
cd server
cp .env.example .env   # then fill in real values
npm install
npm start
```
The frontend's `API_BASE` in `firebase-config.js` should point at `http://localhost:4000` for local dev.

---

## 4. Deploy

- **Frontend**: any static host — Vercel, Firebase Hosting, or Netlify. You already use
  Vercel for LyroWeb, Mr. Lyricist, and Sohima — this fits the same flow.
- **Backend**: needs a Node host that stays running (Render, Railway, or a small VPS) —
  not a static host, since it holds your Cashfree secret key.
- Update `FRONTEND_URL` and `BACKEND_URL` in `.env` to the deployed URLs once live, and
  update `API_BASE` in `firebase-config.js` to your deployed backend URL.

---

## How enrollment works

1. Student clicks **Enroll** → frontend calls `POST /create-order` on your backend.
2. Backend creates a Cashfree order (using your secret key — never exposed to the browser)
   and returns a payment link.
3. Student pays on Cashfree's hosted checkout.
4. Cashfree calls your `/cashfree-webhook` → backend verifies the signature → sets
   `users/{uid}.enrolled = true` in Firestore using the Admin SDK (which bypasses the
   client security rules — this is the *only* legitimate way `enrolled` gets set to `true`).
5. Student is redirected back, dashboard now shows unlocked lessons.

## What's next / not built yet
- Real phone number collection at checkout (Cashfree requires one; currently a placeholder).
- Admin UI for adding lessons/courses (currently done via Firebase Console).
- Progress tracking (video watch %) — the UI has progress bars wired up but not yet
  connected to actual playback position; can add a `timeupdate` listener on the `<video>`
  element writing to `users/{uid}/progress/{lessonId}` the same way notes autosave.
- Multiple courses — schema already supports it (`courses/{courseId}`), dashboard just
  needs a course-picker if you add a second one.

// ============================================================
// LyroWeb Academy — backend
// Handles Cashfree order creation (needs your secret key) and
// the payment-success webhook that marks a user "enrolled" in Firestore.
// Cashfree's checkout has to originate server-side because it needs
// your client secret — this can't happen safely in the browser.
// ============================================================
import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import admin from "firebase-admin";

const app = express();
app.use(cors());
app.use(express.json());

// ---- Firebase Admin (for writing enrolled:true after payment) ----
// Put your service-account JSON path in .env as FIREBASE_SERVICE_ACCOUNT_PATH
// (Firebase Console → Project Settings → Service Accounts → Generate new private key)
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}")
  ),
});
const db = admin.firestore();

const CASHFREE_BASE =
  process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const COURSE_PRICE_INR = 1999;

// ---- Create a Cashfree order + hosted payment link ----
app.post("/create-order", async (req, res) => {
  const { uid, email, name, courseId } = req.body;
  if (!uid || !email) return res.status(400).json({ error: "Missing uid/email" });

  const orderId = `order_${uid}_${Date.now()}`;

  try {
    const response = await fetch(`${CASHFREE_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: COURSE_PRICE_INR,
        order_currency: "INR",
        customer_details: {
          customer_id: uid,
          customer_email: email,
          customer_name: name || "Student",
          customer_phone: "9999999999", // Cashfree requires a phone; collect a real one at checkout if needed
        },
        order_meta: {
          return_url: `${process.env.FRONTEND_URL}/dashboard.html?order_id={order_id}`,
          notify_url: `${process.env.BACKEND_URL}/cashfree-webhook`,
        },
        order_tags: { courseId: courseId || "ai-mastery" },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Cashfree order error:", data);
      return res.status(500).json({ error: "Cashfree order creation failed", detail: data });
    }

    // payment_session_id is used with Cashfree's JS SDK, or use payments.cashfree.com link flow.
    res.json({
      orderId,
      paymentSessionId: data.payment_session_id,
      paymentLink: data.payment_link || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error creating order" });
  }
});

// ---- Cashfree webhook: verify signature, mark user enrolled ----
app.post(
  "/cashfree-webhook",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-webhook-signature"];
      const timestamp = req.headers["x-webhook-timestamp"];
      const rawBody = req.body.toString();

      const expectedSignature = crypto
        .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
        .update(timestamp + rawBody)
        .digest("base64");

      if (expectedSignature !== signature) {
        return res.status(401).send("Invalid signature");
      }

      const payload = JSON.parse(rawBody);
      const event = payload.type;
      const orderId = payload.data?.order?.order_id;
      const uid = orderId?.split("_")[1]; // order_{uid}_{timestamp}

      if (event === "PAYMENT_SUCCESS_WEBHOOK" && uid) {
        await db.collection("users").doc(uid).set(
          { enrolled: true, enrolledAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        console.log(`Enrolled user ${uid} after successful payment.`);
      }

      res.status(200).send("ok");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(400).send("Webhook processing failed");
    }
  }
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`LyroWeb Academy backend running on :${PORT}`));

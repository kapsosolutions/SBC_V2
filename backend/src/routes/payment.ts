import { Router } from "express";
import crypto from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { getRazorpay, razorpayConfigured } from "../lib/razorpay";
import { requireUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

const MEMBERSHIP_AMOUNT = 199;
const MEMBERSHIP_PLAN = "1_year";

function addOneYear(date: Date): Date {
  const next = new Date(date.getTime());
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/*
 * ============================================================
 * POST /api/payment/create-order
 * ============================================================
 */
router.post(
  "/create-order",
  asyncHandler(async (req, res) => {
    // 1. Authenticate user
    let decodedUser;
    try {
      decodedUser = await requireUser(req);
    } catch (error) {
      console.error("Payment order authentication failed:", error);
      return res.status(401).json({
        success: false,
        error: "Unauthorized. Firebase ID token is required.",
      });
    }

    const uid = decodedUser.uid;

    // 2. Server-side payment config (never trust the browser for amount)
    if (!razorpayConfigured()) {
      console.error("Razorpay environment variables are missing.");
      return res.status(500).json({
        success: false,
        error: "Razorpay payment is not configured on the server.",
      });
    }

    // 3. Request purpose
    const body = req.body ?? {};
    const requestedPurpose =
      typeof body?.purpose === "string"
        ? body.purpose.trim().toLowerCase()
        : "";

    const isRenewal = requestedPurpose === "sbc membership renewal";
    const purpose = isRenewal
      ? "SBC membership renewal"
      : "SBC student membership";

    // 4. Renewal safety check
    if (isRenewal) {
      const db = adminDb();
      const studentSnap = await db.collection("students").doc(uid).get();
      if (!studentSnap.exists) {
        return res.status(404).json({
          success: false,
          error:
            "Student membership account was not found. Please complete registration first.",
        });
      }
    }

    // 5. Create Razorpay order (amount hard-enforced to ₹199)
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: MEMBERSHIP_AMOUNT * 100,
      currency: "INR",
      receipt: `sbc_${uid.slice(0, 8)}_${Date.now()}`,
      notes: {
        purpose,
        uid,
        membershipPlan: "1_year",
        amount: String(MEMBERSHIP_AMOUNT),
      },
    });

    return res.json({
      success: true,
      order,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  })
);

/*
 * ============================================================
 * POST /api/payment/verify
 * ============================================================
 */
router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const errorResponse = (message: string, status: number) =>
      res.status(status).json({ success: false, error: message });

    // 1. Authenticate the Firebase user
    let decodedUser;
    try {
      decodedUser = await requireUser(req);
    } catch (error) {
      const message =
        (error as Error)?.message === "FORBIDDEN"
          ? "Access denied."
          : "Unauthorized. Firebase ID token is required.";
      return errorResponse(message, 401);
    }

    const uid = decodedUser.uid;

    // 2. Read verification data
    const body = req.body ?? {};
    const orderId = String(body?.razorpay_order_id || "").trim();
    const paymentId = String(body?.razorpay_payment_id || "").trim();
    const signature = String(body?.razorpay_signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return errorResponse("Missing Razorpay payment verification fields.", 400);
    }

    // 3. Verify Razorpay signature
    if (!razorpayConfigured()) {
      console.error("Razorpay environment variables are missing.");
      return errorResponse("Payment verification is not configured.", 500);
    }
    const keySecret = process.env.RAZORPAY_KEY_SECRET as string;

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    const valid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

    if (!valid) {
      return errorResponse("Invalid payment signature.", 400);
    }

    // 4. Verify the actual Razorpay order (server enforces ₹199 / INR)
    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.fetch(orderId);
    const orderAmount = Number(razorpayOrder.amount);
    const orderCurrency = String(razorpayOrder.currency || "").toUpperCase();

    if (orderAmount !== MEMBERSHIP_AMOUNT * 100 || orderCurrency !== "INR") {
      console.error("Invalid SBC membership order:", {
        orderId,
        orderAmount,
        orderCurrency,
      });
      return errorResponse("Invalid SBC membership payment amount.", 400);
    }

    // 5. Verify the payment really belongs to this order
    const payments = await razorpay.orders.fetchPayments(orderId);
    const matchingPayment = Array.isArray(payments?.items)
      ? payments.items.find((payment: any) => payment?.id === paymentId)
      : null;

    if (!matchingPayment) {
      return errorResponse(
        "Payment could not be confirmed for this Razorpay order.",
        400
      );
    }

    if (String(matchingPayment.status || "").toLowerCase() !== "captured") {
      return errorResponse("Payment has not been captured successfully.", 400);
    }

    if (
      Number(matchingPayment.amount) !== MEMBERSHIP_AMOUNT * 100 ||
      String(matchingPayment.currency || "").toUpperCase() !== "INR"
    ) {
      return errorResponse("Invalid captured payment amount.", 400);
    }

    // 6. Firestore
    const db = adminDb();
    const studentRef = db.collection("students").doc(uid);
    const paymentRef = db.collection("membershipPayments").doc(paymentId);

    // 7. Idempotency + membership date calculation
    const result = await db.runTransaction(async (transaction) => {
      const existingPayment = await transaction.get(paymentRef);

      if (existingPayment.exists) {
        const existingData = existingPayment.data() || {};
        const storedStart = toDate(existingData.membershipStartDate);
        const storedExpiry = toDate(existingData.membershipExpiryDate);

        return {
          alreadyProcessed: true,
          membershipStartDate: storedStart?.toISOString() || null,
          membershipExpiryDate: storedExpiry?.toISOString() || null,
          isRenewal:
            existingData.uid === uid && existingData.type === "renewal",
        };
      }

      const studentSnap = await transaction.get(studentRef);
      const paymentDate = new Date();

      if (studentSnap.exists) {
        const studentData = studentSnap.data() || {};
        const currentExpiry = toDate(studentData.membershipExpiryDate);
        const currentStart = toDate(studentData.membershipStartDate);

        const active =
          !!currentExpiry &&
          currentExpiry.getTime() > paymentDate.getTime();

        const membershipStartDate = active
          ? currentStart || paymentDate
          : paymentDate;

        const membershipExpiryDate = active
          ? addOneYear(currentExpiry as Date)
          : addOneYear(paymentDate);

        transaction.update(studentRef, {
          membershipStatus: "active",
          membershipStartDate: Timestamp.fromDate(membershipStartDate),
          membershipExpiryDate: Timestamp.fromDate(membershipExpiryDate),
          membershipPlan: MEMBERSHIP_PLAN,
          lastMembershipPaymentId: paymentId,
          lastMembershipOrderId: orderId,
          lastMembershipPaymentAt: FieldValue.serverTimestamp(),
          membershipUpdatedAt: FieldValue.serverTimestamp(),
        });

        transaction.set(paymentRef, {
          uid,
          type: "renewal",
          amount: MEMBERSHIP_AMOUNT,
          currency: "INR",
          razorpayPaymentId: paymentId,
          razorpayOrderId: orderId,
          membershipStartDate: Timestamp.fromDate(membershipStartDate),
          membershipExpiryDate: Timestamp.fromDate(membershipExpiryDate),
          paidAt: FieldValue.serverTimestamp(),
          verifiedAt: FieldValue.serverTimestamp(),
          status: "paid",
        });

        return {
          alreadyProcessed: false,
          membershipStartDate: membershipStartDate.toISOString(),
          membershipExpiryDate: membershipExpiryDate.toISOString(),
          isRenewal: true,
        };
      }

      // New registration: student doc created later by the frontend.
      const membershipStartDate = paymentDate;
      const membershipExpiryDate = addOneYear(paymentDate);

      transaction.set(paymentRef, {
        uid,
        type: "registration",
        amount: MEMBERSHIP_AMOUNT,
        currency: "INR",
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
        membershipStartDate: Timestamp.fromDate(membershipStartDate),
        membershipExpiryDate: Timestamp.fromDate(membershipExpiryDate),
        paidAt: FieldValue.serverTimestamp(),
        verifiedAt: FieldValue.serverTimestamp(),
        status: "paid",
      });

      return {
        alreadyProcessed: false,
        membershipStartDate: membershipStartDate.toISOString(),
        membershipExpiryDate: membershipExpiryDate.toISOString(),
        isRenewal: false,
      };
    });

    // 8. Final response
    return res.json({
      success: true,
      verified: true,
      paymentId,
      orderId,
      membershipStartDate: result.membershipStartDate,
      membershipExpiryDate: result.membershipExpiryDate,
      membershipUpdated: result.isRenewal && !result.alreadyProcessed,
      alreadyProcessed: result.alreadyProcessed,
    });
  })
);

export default router;

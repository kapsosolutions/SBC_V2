import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { requireUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

const STEP = 10;
const REWARD = 250;
const MIN = 250;

/*
 * ============================================================
 * GET /api/payout/history
 * ============================================================
 */
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    try {
      const decoded = await requireUser(req);
      const db = adminDb();
      const studentSnap = await db
        .collection("students")
        .doc(decoded.uid)
        .get();
      if (!studentSnap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "Student not found." });
      }
      const data = studentSnap.data() || {};
      const successful = Number(data.successfulReferrals || 0);
      const totalEarned = Math.floor(successful / STEP) * REWARD;
      const paid = Number(data.referralPaidAmount || 0);
      const pending = Number(data.referralPendingPayoutAmount || 0);
      const available = Math.max(totalEarned - paid - pending, 0);

      const snap = await db
        .collection("payoutRequests")
        .where("uid", "==", decoded.uid)
        .get();
      const history = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const at = a.requestedAt?.toMillis?.() || 0;
          const bt = b.requestedAt?.toMillis?.() || 0;
          return bt - at;
        });

      return res.json({
        success: true,
        wallet: {
          successfulReferrals: successful,
          totalEarned,
          paidAmount: paid,
          pendingPayout: pending,
          available,
        },
        history,
      });
    } catch (error) {
      const code = (error as Error)?.message === "UNAUTHORIZED" ? 401 : 500;
      return res.status(code).json({
        success: false,
        error: code === 401 ? "Unauthorized." : "Unable to load payout history.",
      });
    }
  })
);

/*
 * ============================================================
 * POST /api/payout/request
 * ============================================================
 */
router.post(
  "/request",
  asyncHandler(async (req, res) => {
    try {
      const decoded = await requireUser(req);
      const body = req.body ?? {};

      const amount = Math.floor(Number(body?.amount || 0));
      const method = String(body?.method || "").toLowerCase();

      const upiId = String(body?.upiId || "").trim();
      const accountName = String(
        body?.accountHolderName || body?.accountName || ""
      ).trim();
      const accountNumber = String(body?.accountNumber || "").trim();
      const ifsc = String(body?.ifsc || "").trim().toUpperCase();

      if (!Number.isFinite(amount) || amount < MIN) {
        return res
          .status(400)
          .json({ success: false, error: `Minimum payout is ₹${MIN}.` });
      }

      if (!["upi", "bank"].includes(method)) {
        return res
          .status(400)
          .json({ success: false, error: "Choose UPI or Bank Account." });
      }

      if (method === "upi" && !upiId) {
        return res
          .status(400)
          .json({ success: false, error: "UPI ID is required." });
      }

      if (method === "bank" && (!accountName || !accountNumber || !ifsc)) {
        return res.status(400).json({
          success: false,
          error: "Complete bank details are required.",
        });
      }

      const db = adminDb();
      const studentRef = db.collection("students").doc(decoded.uid);
      const payoutRef = db.collection("payoutRequests").doc();

      let available = 0;

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(studentRef);
        if (!snap.exists) {
          throw new Error("Student not found.");
        }
        const data = snap.data() || {};

        const successful = Number(data.successfulReferrals || 0);
        const totalEarned = Math.floor(successful / STEP) * REWARD;
        const paid = Number(data.referralPaidAmount || 0);
        const pending = Number(data.referralPendingPayoutAmount || 0);

        available = Math.max(totalEarned - paid - pending, 0);

        if (amount > available) {
          throw new Error(`INSUFFICIENT:${available}`);
        }

        tx.set(payoutRef, {
          uid: decoded.uid,
          studentName: String(data.fullName || ""),
          studentMobile: String(data.mobile || ""),
          amount,
          method,
          upiId: method === "upi" ? upiId : "",
          accountName: method === "bank" ? accountName : "",
          accountNumber: method === "bank" ? accountNumber : "",
          ifsc: method === "bank" ? ifsc : "",
          status: "pending",
          requestedAt: FieldValue.serverTimestamp(),
        });

        tx.set(
          studentRef,
          {
            referralPendingPayoutAmount: pending + amount,
            referralUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      return res.json({
        success: true,
        payoutRequestId: payoutRef.id,
        amount,
        availableAfterRequest: Math.max(available - amount, 0),
      });
    } catch (error) {
      const msg = String((error as Error)?.message || "");

      if (msg.startsWith("INSUFFICIENT:")) {
        return res.status(400).json({
          success: false,
          error: `Available payout balance is ₹${msg.split(":")[1]}.`,
        });
      }

      const code = msg === "UNAUTHORIZED" ? 401 : 500;
      console.error("Payout request error:", error);

      return res.status(code).json({
        success: false,
        error:
          code === 401
            ? "Unauthorized."
            : msg || "Unable to create payout request.",
      });
    }
  })
);

export default router;

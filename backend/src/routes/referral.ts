import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { requireUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

const REWARD_STEP = 10;
const REWARD_AMOUNT = 250;
const STEP = 10;
const REWARD = 250;

/*
 * ============================================================
 * POST /api/referral/process
 * ============================================================
 */
router.post(
  "/process",
  asyncHandler(async (req, res) => {
    try {
      const decoded = await requireUser(req);
      const body = req.body ?? {};
      const referredUid = String(body?.referredUid || decoded.uid);
      if (referredUid !== decoded.uid) {
        return res
          .status(403)
          .json({ success: false, error: "Invalid student." });
      }

      const db = adminDb();
      const studentRef = db.collection("students").doc(referredUid);
      const studentSnap = await studentRef.get();
      if (!studentSnap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "Student profile not found." });
      }

      const student = studentSnap.data() || {};
      if (
        String(student.status || "").toLowerCase() !== "active" ||
        String(student.paymentStatus || "").toLowerCase() !== "paid"
      ) {
        return res.status(400).json({
          success: false,
          error: "Student payment is not eligible for referral credit.",
        });
      }
      if (!student.razorpayPaymentId || !student.razorpayOrderId) {
        return res.status(400).json({
          success: false,
          error: "Verified payment details are missing.",
        });
      }

      const referralCode = String(student.referredBy || "").trim();
      if (!referralCode) {
        return res.json({ success: true, counted: false, reason: "no_referral" });
      }

      const referrerQuery = await db
        .collection("students")
        .where("referralCode", "==", referralCode)
        .limit(2)
        .get();
      if (referrerQuery.empty) {
        return res
          .status(400)
          .json({ success: false, error: "Referrer not found." });
      }
      const referrerDoc = referrerQuery.docs[0];
      if (referrerDoc.id === referredUid) {
        return res
          .status(400)
          .json({ success: false, error: "Self referral is not allowed." });
      }

      const referralRef = db.collection("referrals").doc(referredUid);
      let counted = false;
      let successfulReferrals = 0;

      await db.runTransaction(async (tx) => {
        const [referralSnap, referrerSnap] = await Promise.all([
          tx.get(referralRef),
          tx.get(referrerDoc.ref),
        ]);
        const referrer = referrerSnap.data() || {};
        successfulReferrals = Number(referrer.successfulReferrals || 0);

        if (
          referralSnap.exists &&
          String(referralSnap.data()?.status || "") === "success"
        ) {
          return;
        }

        const next = successfulReferrals + 1;
        successfulReferrals = next;
        counted = true;

        tx.set(
          referralRef,
          {
            referredUid,
            referrerUid: referrerDoc.id,
            referralCode,
            status: "success",
            paymentStatus: "paid",
            razorpayPaymentId: String(student.razorpayPaymentId),
            razorpayOrderId: String(student.razorpayOrderId),
            successfulAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        tx.set(
          studentRef,
          {
            referralStatus: "success",
            referralPaymentStatus: "success",
            referralProcessedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        tx.set(
          referrerDoc.ref,
          {
            successfulReferrals: next,
            pendingReferrals: Math.max(
              Number(referrer.pendingReferrals || 0) - 1,
              0
            ),
            referralRewardUnlocked: Math.floor(next / REWARD_STEP) > 0,
            referralTotalEarned:
              Math.floor(next / REWARD_STEP) * REWARD_AMOUNT,
            referralUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      return res.json({
        success: true,
        counted,
        successfulReferrals,
        totalEarned:
          Math.floor(successfulReferrals / REWARD_STEP) * REWARD_AMOUNT,
      });
    } catch (error) {
      const code = (error as Error)?.message === "UNAUTHORIZED" ? 401 : 500;
      console.error("Referral process error:", error);
      return res.status(code).json({
        success: false,
        error: code === 401 ? "Unauthorized." : "Unable to process referral.",
      });
    }
  })
);

/*
 * ============================================================
 * POST /api/referral/reconcile
 * ============================================================
 */
router.post(
  "/reconcile",
  asyncHandler(async (req, res) => {
    try {
      const decoded = await requireUser(req);
      const db = adminDb();
      const referrerRef = db.collection("students").doc(decoded.uid);
      const referrerSnap = await referrerRef.get();
      if (!referrerSnap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "Student not found." });
      }
      const referrer = referrerSnap.data() || {};
      const code = String(referrer.referralCode || "").trim();
      if (!code) {
        return res.json({ success: true, counted: 0 });
      }

      const studentsSnap = await db
        .collection("students")
        .where("referredBy", "==", code)
        .get();
      let counted = 0;

      for (const referred of studentsSnap.docs) {
        if (referred.id === decoded.uid) continue;
        const data = referred.data() || {};
        if (
          String(data.status || "").toLowerCase() !== "active" ||
          String(data.paymentStatus || "").toLowerCase() !== "paid"
        ) {
          continue;
        }

        const referralRef = db.collection("referrals").doc(referred.id);
        await db.runTransaction(async (tx) => {
          const referralSnap = await tx.get(referralRef);
          if (
            referralSnap.exists &&
            String(referralSnap.data()?.status || "") === "success"
          ) {
            return;
          }
          const freshReferrer = await tx.get(referrerRef);
          const fresh = freshReferrer.data() || {};
          const next = Number(fresh.successfulReferrals || 0) + 1;
          tx.set(
            referralRef,
            {
              referredUid: referred.id,
              referrerUid: decoded.uid,
              referralCode: code,
              status: "success",
              paymentStatus: "paid",
              razorpayPaymentId: String(data.razorpayPaymentId || ""),
              razorpayOrderId: String(data.razorpayOrderId || ""),
              successfulAt: FieldValue.serverTimestamp(),
              reconciled: true,
            },
            { merge: true }
          );
          tx.set(
            referred.ref,
            {
              referralStatus: "success",
              referralPaymentStatus: "success",
              referralProcessedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          tx.set(
            referrerRef,
            {
              successfulReferrals: next,
              referralTotalEarned: Math.floor(next / STEP) * REWARD,
              referralRewardUnlocked: Math.floor(next / STEP) > 0,
              referralUpdatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          counted += 1;
        });
      }

      const finalSnap = await referrerRef.get();
      const finalData = finalSnap.data() || {};
      const successful = Number(finalData.successfulReferrals || 0);
      return res.json({
        success: true,
        counted,
        successfulReferrals: successful,
        totalEarned: Math.floor(successful / STEP) * REWARD,
      });
    } catch (error) {
      const code = (error as Error)?.message === "UNAUTHORIZED" ? 401 : 500;
      console.error("Referral reconcile error:", error);
      return res.status(code).json({
        success: false,
        error: code === 401 ? "Unauthorized." : "Unable to reconcile referrals.",
      });
    }
  })
);

export default router;

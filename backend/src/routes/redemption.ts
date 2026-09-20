import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { requireUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

const MAX_REDEMPTIONS = 4;

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/*
 * ============================================================
 * POST /api/redemption/create
 * ============================================================
 */
router.post(
  "/create",
  asyncHandler(async (req, res) => {
    let decoded;
    try {
      decoded = await requireUser(req);
    } catch {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized. Please login again." });
    }

    const uid = decoded.uid;
    const body = req.body ?? {};

    const businessId =
      typeof body?.businessId === "string" ? body.businessId.trim() : "";
    const businessName =
      typeof body?.businessName === "string" ? body.businessName.trim() : "";
    const businessVerificationId =
      typeof body?.businessVerificationId === "string"
        ? body.businessVerificationId.trim()
        : "";
    const offerId =
      typeof body?.offerId === "string" ? body.offerId.trim() : "";
    const offerTitle =
      typeof body?.offerTitle === "string" ? body.offerTitle.trim() : "";
    const offerDiscount =
      typeof body?.offerDiscount === "string" ? body.offerDiscount.trim() : "";

    if (!businessId || !offerId) {
      return res
        .status(400)
        .json({ success: false, error: "Business and offer are required." });
    }

    const db = adminDb();

    // Membership is checked server-side immediately before creating a request.
    const studentRef = db.collection("students").doc(uid);
    const studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      return res
        .status(404)
        .json({ success: false, error: "Student account was not found." });
    }

    const student = studentSnap.data() || {};
    const expiryDate = toDate(student.membershipExpiryDate);
    const now = new Date();

    if (!expiryDate || expiryDate.getTime() <= now.getTime()) {
      if (student.membershipStatus !== "expired") {
        await studentRef.update({
          membershipStatus: "expired",
          membershipUpdatedAt: FieldValue.serverTimestamp(),
        });
      }
      return res.status(403).json({
        success: false,
        error:
          "Your SBC membership has expired. Please renew your membership before redeeming offers.",
        code: "MEMBERSHIP_EXPIRED",
      });
    }

    if (student.membershipStatus === "expired") {
      await studentRef.update({
        membershipStatus: "active",
        membershipUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Max 4 redemptions per student per business, regardless of offer.
    const usageRef = db
      .collection("businessStudentUsage")
      .doc(`${businessId}_${uid}`);
    const usageSnap = await usageRef.get();
    const currentUsage = usageSnap.exists
      ? Math.max(0, Number(usageSnap.data()?.count || 0))
      : 0;

    if (currentUsage >= MAX_REDEMPTIONS) {
      return res.status(403).json({
        success: false,
        error: `Redemption limit reached. You can redeem from this business only ${MAX_REDEMPTIONS} times in total.`,
        code: "REDEMPTION_LIMIT_REACHED",
      });
    }

    // Re-read the offer so the request cannot invent an inactive offer.
    const offerSnap = await db.collection("offers").doc(offerId).get();
    if (!offerSnap.exists) {
      return res.status(404).json({ success: false, error: "Offer not found." });
    }

    const offerData = offerSnap.data() || {};
    if (
      String(offerData.status || "").toLowerCase() !== "active" ||
      String(offerData.businessId || "") !== businessId
    ) {
      return res
        .status(409)
        .json({ success: false, error: "This offer is no longer available." });
    }

    const requestRef = db.collection("redemptionRequests").doc();
    await requestRef.set({
      studentId: uid,
      studentName:
        student.name ||
        student.fullName ||
        student.studentName ||
        "SBC Student",
      studentCardNumber:
        student.cardNumber || student.studentCardNumber || "",
      businessId,
      businessName:
        businessName || offerData.businessName || "SBC Partner Business",
      businessVerificationId,
      offerId,
      offerTitle: offerTitle || offerData.title || "SBC Offer",
      offerDiscount: offerDiscount || offerData.discount || "",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ success: true, requestId: requestRef.id });
  })
);

export default router;

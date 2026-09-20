import { Router } from "express";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

/*
 * ============================================================
 * POST /api/student/check-mobile
 * ============================================================
 */
router.post(
  "/check-mobile",
  asyncHandler(async (req, res) => {
    try {
      const body = req.body ?? {};

      const mobile =
        typeof body.mobile === "string"
          ? body.mobile.replace(/\D/g, "").trim()
          : "";

      // When called AFTER OTP verification, Firebase Auth has already
      // created the current phone user; do not treat it as a duplicate.
      const excludeUid =
        typeof body.excludeUid === "string" ? body.excludeUid.trim() : "";

      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return res.status(400).json({
          success: false,
          error: "Please enter a valid 10-digit Indian mobile number.",
        });
      }

      const db = adminDb();

      // Check students collection.
      const snapshot = await db
        .collection("students")
        .where("mobile", "==", mobile)
        .limit(10)
        .get();

      if (!snapshot.empty) {
        const matchingStudent = snapshot.docs.find((item) => {
          const data = item.data();
          const studentUid =
            typeof data.uid === "string" ? data.uid : item.id;
          return !excludeUid || studentUid !== excludeUid;
        });

        if (matchingStudent) {
          return res.json({
            success: true,
            exists: true,
            message: "This mobile number is already registered.",
          });
        }
      }

      // Check Firebase Auth.
      try {
        const authUser = await adminAuth().getUserByPhoneNumber(`+91${mobile}`);
        if (authUser && authUser.uid !== excludeUid) {
          return res.json({
            success: true,
            exists: true,
            message: "This mobile number is already registered.",
          });
        }
      } catch (authError: any) {
        if (authError?.code !== "auth/user-not-found") {
          console.error("Firebase Auth mobile check error:", authError);
          throw authError;
        }
      }

      // Mobile available.
      return res.json({ success: true, exists: false });
    } catch (error) {
      console.error("Student mobile check error:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to check mobile number.",
      });
    }
  })
);

export default router;

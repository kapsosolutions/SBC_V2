import { Router } from "express";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

function normalizeMobile(value: string): string {
  let number = String(value || "").trim();
  number = number.replace(/[\s\-()]/g, "");
  if (number.startsWith("+91")) number = number.slice(3);
  if (number.startsWith("91") && number.length === 12) number = number.slice(2);
  if (number.startsWith("0") && number.length === 11) number = number.slice(1);
  return number;
}

/**
 * Shared logic: does a business account exist for this mobile number?
 * Checks the exact stored value plus common legacy formats.
 */
async function businessMobileExists(mobile: string): Promise<boolean> {
  const db = adminDb();
  const variants = [mobile, `0${mobile}`, `91${mobile}`, `+91${mobile}`];

  for (const variant of variants) {
    const snapshot = await db
      .collection("businesses")
      .where("mobile", "==", variant)
      .limit(1)
      .get();
    if (!snapshot.empty) return true;
  }
  return false;
}

async function handleMobileCheck(rawMobile: unknown) {
  const mobile = normalizeMobile(String(rawMobile ?? ""));

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return {
      status: 400,
      payload: { success: false, exists: false, error: "Invalid mobile number." },
    };
  }

  const exists = await businessMobileExists(mobile);
  return { status: 200, payload: { success: true, exists } };
}

/*
 * ============================================================
 * POST /api/business/check-mobile
 * ============================================================
 * Used by the business "forgot password" flow to confirm the number
 * belongs to a registered business before sending a reset OTP.
 */
router.post(
  "/check-mobile",
  asyncHandler(async (req, res) => {
    try {
      const { status, payload } = await handleMobileCheck(req.body?.mobile);
      return res.status(status).json(payload);
    } catch (error) {
      console.error("Business mobile check error:", error);
      return res.status(500).json({
        success: false,
        exists: false,
        error: "Unable to check business registration.",
      });
    }
  })
);

/*
 * ============================================================
 * POST /api/business/reset-password
 * ============================================================
 * Kept for backward compatibility: same registered-mobile check.
 */
router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    try {
      const { status, payload } = await handleMobileCheck(req.body?.mobile);
      return res.status(status).json(payload);
    } catch (error) {
      console.error("Business mobile check error:", error);
      return res.status(500).json({
        success: false,
        exists: false,
        error: "Unable to check business registration.",
      });
    }
  })
);

export default router;

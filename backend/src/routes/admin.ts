import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, adminMessaging } from "../lib/firebase-admin";
import { requireUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { env } from "../config/env";

const router = Router();

const DASHBOARD_URL = `${env.appPublicUrl.replace(/\/$/, "")}/student/dashboard`;
const NOTIFICATION_ICON = env.notificationIconUrl;

/*
 * ============================================================
 * POST /api/admin/check-email
 * ============================================================
 */
router.post(
  "/check-email",
  asyncHandler(async (req, res) => {
    try {
      const body = req.body ?? {};
      const email = String(body?.email || "").trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          exists: false,
          message: "Email is required.",
        });
      }

      const auth = adminAuth();
      const db = adminDb();

      let user;
      try {
        user = await auth.getUserByEmail(email);
      } catch (error: any) {
        if (error?.code === "auth/user-not-found") {
          return res.json({ success: true, exists: false });
        }
        throw error;
      }

      const adminSnap = await db.collection("admins").doc(user.uid).get();
      if (!adminSnap.exists) {
        return res.json({ success: true, exists: false });
      }

      return res.json({ success: true, exists: true });
    } catch (error) {
      console.error("Admin check-email failed:", error);
      return res.status(500).json({
        success: false,
        exists: false,
        message: "Unable to verify admin account.",
      });
    }
  })
);

/*
 * ============================================================
 * GET /api/admin/payouts
 * ============================================================
 */
router.get(
  "/payouts",
  asyncHandler(async (req, res) => {
    try {
      const { db } = await requireAdmin(req);
      const snap = await db.collection("payoutRequests").get();
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a: any, b: any) =>
            (b.requestedAt?.toMillis?.() || 0) -
            (a.requestedAt?.toMillis?.() || 0)
        );
      return res.json({ success: true, items });
    } catch (error) {
      const msg = String((error as Error)?.message || "");
      const code = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
      return res.status(code).json({
        success: false,
        error:
          code === 403
            ? "Admin access denied."
            : code === 401
              ? "Unauthorized."
              : "Unable to load payouts.",
      });
    }
  })
);

/*
 * ============================================================
 * PATCH /api/admin/payouts
 * ============================================================
 */
router.patch(
  "/payouts",
  asyncHandler(async (req, res) => {
    try {
      const { decoded, db } = await requireAdmin(req);
      const body = req.body ?? {};
      const id = String(body?.id || "").trim();
      const action = String(body?.action || "").toLowerCase();
      const utr = String(body?.utr || "").trim();
      const note = String(body?.note || "").trim();
      if (!id || !["approve", "reject"].includes(action)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid payout action." });
      }

      const payoutRef = db.collection("payoutRequests").doc(id);
      await db.runTransaction(async (tx) => {
        const payoutSnap = await tx.get(payoutRef);
        if (!payoutSnap.exists) throw new Error("Payout not found.");
        const payout = payoutSnap.data() || {};
        if (String(payout.status || "") !== "pending") {
          throw new Error("This payout is already processed.");
        }
        const uid = String(payout.uid || "");
        const amount = Number(payout.amount || 0);
        const studentRef = db.collection("students").doc(uid);
        const studentSnap = await tx.get(studentRef);
        const student = studentSnap.data() || {};
        const pending = Number(student.referralPendingPayoutAmount || 0);

        if (action === "approve") {
          tx.update(payoutRef, {
            status: "paid",
            utr,
            adminNote: note,
            approvedBy: decoded.uid,
            paidAt: FieldValue.serverTimestamp(),
          });
          tx.set(
            studentRef,
            {
              referralPendingPayoutAmount: Math.max(pending - amount, 0),
              referralPaidAmount:
                Number(student.referralPaidAmount || 0) + amount,
              referralUpdatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          tx.update(payoutRef, {
            status: "rejected",
            adminNote: note,
            rejectedBy: decoded.uid,
            rejectedAt: FieldValue.serverTimestamp(),
          });
          tx.set(
            studentRef,
            {
              referralPendingPayoutAmount: Math.max(pending - amount, 0),
              referralUpdatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      });

      return res.json({ success: true });
    } catch (error) {
      const msg = String((error as Error)?.message || "");
      const code = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 400;
      return res.status(code).json({
        success: false,
        error:
          code === 403
            ? "Admin access denied."
            : code === 401
              ? "Unauthorized."
              : msg || "Unable to update payout.",
      });
    }
  })
);

/*
 * ============================================================
 * POST /api/admin/notifications/send
 * ============================================================
 */
router.post(
  "/notifications/send",
  asyncHandler(async (req, res) => {
    try {
      // Authorization: verified user who is also an admin.
      let adminUid: string;
      try {
        const decoded = await requireUser(req);
        adminUid = decoded.uid;
      } catch {
        return res.status(401).json({
          success: false,
          error: "Unauthorized. Firebase ID token is required.",
        });
      }

      const db = adminDb();
      const adminSnap = await db.collection("admins").doc(adminUid).get();
      if (!adminSnap.exists) {
        return res
          .status(403)
          .json({ success: false, error: "Admin access denied." });
      }

      const body = req.body ?? {};
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const message =
        typeof body.message === "string" ? body.message.trim() : "";
      const imageUrl =
        typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          error: "Notification title and message are required.",
        });
      }

      if (imageUrl && !imageUrl.startsWith("https://")) {
        return res.status(400).json({
          success: false,
          error: "Notification image URL must use HTTPS.",
        });
      }

      // Collect FCM tokens.
      const tokenSnap = await db.collection("fcmTokens").get();
      const tokens = tokenSnap.docs
        .map((tokenDoc) => {
          const data = tokenDoc.data();
          return {
            id: tokenDoc.id,
            token: typeof data.token === "string" ? data.token.trim() : "",
            studentId:
              typeof data.studentId === "string" ? data.studentId : "",
          };
        })
        .filter((item) => item.token.length > 0);

      if (tokens.length === 0) {
        return res.json({
          success: true,
          totalTokens: 0,
          successCount: 0,
          failureCount: 0,
          cleanedTokens: 0,
          message: "No students have enabled notifications yet.",
        });
      }

      const messaging = adminMessaging();
      let successCount = 0;
      let failureCount = 0;
      const invalidTokenIds: string[] = [];
      const failedTokens: Array<{
        tokenId: string;
        studentId: string;
        errorCode: string;
        errorMessage: string;
      }> = [];

      // Firebase multicast max = 500.
      for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const batchTokens = batch.map((item) => item.token);

        const webNotification: {
          title: string;
          body: string;
          icon: string;
          badge: string;
          requireInteraction: boolean;
          tag: string;
          image?: string;
        } = {
          title,
          body: message,
          icon: NOTIFICATION_ICON,
          badge: NOTIFICATION_ICON,
          requireInteraction: false,
          tag: `sbc-${Date.now()}-${i}`,
        };

        if (imageUrl) {
          webNotification.image = imageUrl;
        }

        const response = await messaging.sendEachForMulticast({
          tokens: batchTokens,
          notification: { title, body: message },
          data: {
            title,
            body: message,
            url: DASHBOARD_URL,
            ...(imageUrl ? { imageUrl } : {}),
          },
          webpush: {
            headers: { Urgency: "high" },
            notification: webNotification,
            fcmOptions: { link: DASHBOARD_URL },
          },
        });

        response.responses.forEach((result, index) => {
          const currentToken = batch[index];
          if (result.success) {
            successCount++;
            return;
          }
          failureCount++;
          const errorCode = result.error?.code || "";
          const errorMessage = result.error?.message || "";
          failedTokens.push({
            tokenId: currentToken.id,
            studentId: currentToken.studentId,
            errorCode,
            errorMessage,
          });
          if (
            errorCode.includes("registration-token-not-registered") ||
            errorCode.includes("invalid-registration-token") ||
            errorCode.includes("unregistered")
          ) {
            invalidTokenIds.push(currentToken.id);
          }
        });
      }

      // Delete invalid tokens.
      for (const tokenId of invalidTokenIds) {
        try {
          await db.collection("fcmTokens").doc(tokenId).delete();
        } catch (error) {
          console.error("Failed to delete invalid token:", error);
        }
      }

      // Notification log.
      await db.collection("notificationLogs").add({
        title,
        message,
        imageUrl: imageUrl || null,
        target: "all_students",
        totalTokens: tokens.length,
        successCount,
        failureCount,
        cleanedTokens: invalidTokenIds.length,
        sentBy: adminUid,
        createdAt: new Date(),
      });

      return res.json({
        success: true,
        totalTokens: tokens.length,
        successCount,
        failureCount,
        cleanedTokens: invalidTokenIds.length,
        failedTokens,
        imageUrl: imageUrl || null,
        message: `Notification sent. ${successCount} successful, ${failureCount} failed.`,
      });
    } catch (error) {
      console.error("Notification send error:", error);
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send notification.",
      });
    }
  })
);

export default router;

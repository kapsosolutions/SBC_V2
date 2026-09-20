import type { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../lib/firebase-admin";

/**
 * Extract and verify the Firebase ID token from the Authorization header.
 * Throws "UNAUTHORIZED" when the token is missing or invalid.
 */
export async function requireUser(req: Request): Promise<DecodedIdToken> {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }
  const token = authorization.substring(7).trim();
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

/**
 * Verify the caller is an authenticated user AND listed in the `admins`
 * Firestore collection. Throws "UNAUTHORIZED" or "FORBIDDEN".
 */
export async function requireAdmin(
  req: Request
): Promise<{ decoded: DecodedIdToken; db: Firestore }> {
  const decoded = await requireUser(req);
  const db = adminDb();
  const snap = await db.collection("admins").doc(decoded.uid).get();
  if (!snap.exists) {
    throw new Error("FORBIDDEN");
  }
  return { decoded, db };
}

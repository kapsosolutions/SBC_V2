import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env";

/**
 * Resolve the Firebase Admin private key from the environment.
 *
 * Accepts either:
 *   - FIREBASE_ADMIN_PRIVATE_KEY_BASE64 : base64-encoded PEM (recommended)
 *   - FIREBASE_ADMIN_PRIVATE_KEY        : raw PEM (with \n or real newlines)
 */
function resolvePrivateKey(): string {
  const { privateKeyBase64, privateKey } = env.firebase;

  let pem: string | undefined;

  if (privateKeyBase64) {
    pem = Buffer.from(privateKeyBase64.trim(), "base64").toString("utf8");
  } else if (privateKey) {
    pem = privateKey;
  }

  if (!pem) {
    throw new Error("Firebase Admin private key is not configured.");
  }

  // Normalise escaped newlines that survive .env transport.
  pem = pem.replace(/\\n/g, "\n").trim();

  if (
    !pem.includes("-----BEGIN PRIVATE KEY-----") ||
    !pem.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error("Firebase Admin private key is not a valid PEM key.");
  }

  return pem;
}

let cachedApp: App | null = null;

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }

  const { projectId, clientEmail } = env.firebase;
  if (!projectId || !clientEmail) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  const privateKey = resolvePrivateKey();

  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return cachedApp;
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminMessaging() {
  return getMessaging(getAdminApp());
}

/**
 * True when all Firebase Admin credentials are present in the environment.
 * Used by the status endpoint (does not initialise the app).
 */
export function firebaseConfigured(): boolean {
  return Boolean(
    env.firebase.projectId &&
      env.firebase.clientEmail &&
      (env.firebase.privateKeyBase64 || env.firebase.privateKey)
  );
}

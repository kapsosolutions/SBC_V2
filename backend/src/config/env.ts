import dotenv from "dotenv";

dotenv.config();

/**
 * Centralised, typed access to environment variables.
 *
 * Nothing sensitive is hard-coded in the codebase. Every secret is read
 * from the process environment (a local `.env` in development, or the
 * Render dashboard in production).
 */

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const rawOrigins = optional("FRONTEND_ORIGIN") ?? "";

export const env = {
  nodeEnv: optional("NODE_ENV") ?? "development",
  port: Number(optional("PORT") ?? "8080"),

  /**
   * Comma-separated list of allowed frontend origins for CORS.
   * Example: https://app.vercel.app,https://www.studentbenefitcard.com
   */
  frontendOrigins: rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),

  firebase: {
    projectId: optional("FIREBASE_ADMIN_PROJECT_ID"),
    clientEmail: optional("FIREBASE_ADMIN_CLIENT_EMAIL"),
    // Either a base64-encoded PEM (preferred for env portability) ...
    privateKeyBase64: optional("FIREBASE_ADMIN_PRIVATE_KEY_BASE64"),
    // ... or the raw PEM (with literal \n sequences or real newlines).
    privateKey: optional("FIREBASE_ADMIN_PRIVATE_KEY"),
  },

  razorpay: {
    keyId: optional("RAZORPAY_KEY_ID"),
    keySecret: optional("RAZORPAY_KEY_SECRET"),
  },

  /**
   * Public site URL used inside push-notification payloads
   * (click-through link + notification icons).
   */
  appPublicUrl:
    optional("APP_PUBLIC_URL") ?? "https://www.studentbenefitcard.com",
  notificationIconUrl:
    optional("NOTIFICATION_ICON_URL") ??
    "https://www.studentbenefitcard.com/sbc-notification-icon.png",
};

export { required };

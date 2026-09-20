import Razorpay from "razorpay";
import { env } from "../config/env";

/**
 * Lazily construct a Razorpay client so the server can boot even if
 * payment credentials are not yet configured (the payment routes will
 * return a clear 500 instead).
 */
export function getRazorpay(): Razorpay {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function razorpayConfigured(): boolean {
  return Boolean(env.razorpay.keyId && env.razorpay.keySecret);
}

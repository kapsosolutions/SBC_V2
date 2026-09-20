"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      prefill?: {
        name?: string;
        contact?: string;
      };
      theme?: {
        color?: string;
      };
      modal?: {
        ondismiss?: () => void;
      };
      handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => void;
    }) => {
      open: () => void;
    };
  }
}

type StudentData = {
  fullName?: string;
  mobile?: string;
  membershipStatus?: string;
  membershipStartDate?: Timestamp | Date | string | null;
  membershipExpiryDate?: Timestamp | Date | string | null;
};

function toDate(value: StudentData["membershipExpiryDate"]): Date | null {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  return null;
}

function formatDate(date: Date | null) {
  if (!date) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener(
        "load",
        () => resolve(true),
        { once: true }
      );
      existing.addEventListener(
        "error",
        () => resolve(false),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function StudentRenewMembership() {
  const router = useRouter();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/student/login");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "students", user.uid));

        if (!snap.exists()) {
          setErrorMessage(
            "Student account details could not be found. Please sign in again."
          );
          return;
        }

        setStudent(snap.data() as StudentData);
      } catch (error) {
        console.error("Unable to load student membership:", error);
        setErrorMessage(
          "Unable to load your membership details. Please try again."
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const expiryDate = useMemo(
    () => toDate(student?.membershipExpiryDate),
    [student?.membershipExpiryDate]
  );

  const membershipCurrentlyActive =
    !!expiryDate && expiryDate.getTime() > Date.now();

  const startPayment = async () => {
    if (paymentLoading) return;

    try {
      setErrorMessage("");
      setStatusMessage("Creating secure payment...");
      setPaymentLoading(true);

      const user = auth.currentUser;

      if (!user) {
        throw new Error("Your login session has expired. Please sign in again.");
      }

      const idToken = await user.getIdToken();

      const scriptLoaded = await loadRazorpay();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Unable to load secure payment checkout. Please try again."
        );
      }

      const orderResponse = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amount: 199,
          purpose: "SBC membership renewal",
        }),
      });

      const orderData = await orderResponse.json().catch(() => ({}));

      if (
        !orderResponse.ok ||
        !orderData?.success ||
        !orderData?.order?.id ||
        !orderData?.keyId
      ) {
        throw new Error(
          orderData?.error ||
            "Unable to create the renewal payment order."
        );
      }

      setStatusMessage("Opening secure payment...");

      await new Promise<void>((resolve) => {
        let completed = false;

        const finish = () => {
          if (completed) return;
          completed = true;
          resolve();
        };

        const RazorpayCheckout = window.Razorpay;

        if (!RazorpayCheckout) {
          finish();
          return;
        }

        const razorpay = new RazorpayCheckout({
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "Student Benefit Card",
          description: "SBC Membership Renewal - 1 Year",
          order_id: orderData.order.id,
          prefill: {
            name: student?.fullName?.trim() || "",
            contact: (student?.mobile || "").replace(/\D/g, ""),
          },
          theme: {
            color: "#07111f",
          },
          modal: {
            ondismiss: () => {
              setStatusMessage("");
              setPaymentLoading(false);
              finish();
            },
          },
          handler: async (response) => {
            try {
              setStatusMessage("Verifying payment securely...");

              const currentUser = auth.currentUser;
              if (!currentUser) {
                throw new Error(
                  "Your login session expired during payment verification."
                );
              }

              const freshToken = await currentUser.getIdToken(true);

              const verifyResponse = await fetch(`${API_BASE_URL}/api/payment/verify`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${freshToken}`,
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  purpose: "SBC membership renewal",
                }),
              });

              const verifyData = await verifyResponse
                .json()
                .catch(() => ({}));

              if (!verifyResponse.ok || !verifyData?.success) {
                throw new Error(
                  verifyData?.error || "Payment verification failed."
                );
              }

              if (
                !verifyData?.membershipStartDate ||
                !verifyData?.membershipExpiryDate
              ) {
                throw new Error(
                  "Payment was verified, but the new membership dates were not returned by the server. Please contact SBC support before making another payment."
                );
              }

              setStatusMessage(
                "Payment verified. Updating your SBC membership..."
              );

              // The payment verification endpoint is the authority for
              // membership dates. The client deliberately does not calculate
              // or write membership dates here.
              await new Promise((resolve) => setTimeout(resolve, 500));

              router.replace("/student/dashboard");
            } catch (error: any) {
              console.error("Membership renewal verification error:", error);
              setErrorMessage(
                error?.message ||
                  "Payment verification failed. Please contact SBC support."
              );
              setStatusMessage("");
            } finally {
              setPaymentLoading(false);
              finish();
            }
          },
        });

        razorpay.open();
      });
    } catch (error: any) {
      console.error("Membership renewal payment error:", error);
      setErrorMessage(
        error?.message ||
          "Unable to start the renewal payment. Please try again."
      );
      setStatusMessage("");
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/60">
            Loading your membership...
          </p>
        </div>
      </main>
    );
  }

  if (errorMessage && !student) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl">
          <h1 className="text-2xl font-semibold">SBC Membership</h1>
          <p className="mt-3 text-sm leading-6 text-white/65">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/student/dashboard")}
            className="mt-6 w-full rounded-2xl bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-white/90"
          >
            Back to Dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-5 py-10 sm:px-8">
        <section className="w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 px-6 py-7 sm:px-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="mb-6 text-sm text-white/55 transition hover:text-white"
            >
              ← Back
            </button>

            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                  Student Benefit Card
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  Renew SBC
                </h1>
                <p className="mt-2 max-w-lg text-sm leading-6 text-white/60">
                  Continue your SBC student benefits for another full year.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                <p className="text-xs text-white/45">Renewal</p>
                <p className="mt-1 text-xl font-bold">₹199</p>
                <p className="text-xs text-white/45">1 year</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-7 sm:px-8">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/45">Current membership</p>
                  <p className="mt-1 font-semibold">
                    {membershipCurrentlyActive ? "Active" : "Expired"}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    membershipCurrentlyActive
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-red-400/15 text-red-300"
                  }`}
                >
                  {membershipCurrentlyActive ? "ACTIVE" : "EXPIRED"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs text-white/40">Current start</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(toDate(student?.membershipStartDate))}
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs text-white/40">Current valid until</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(expiryDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-semibold">How renewal works</p>
              <div className="mt-4 space-y-3 text-sm text-white/60">
                <p>✓ ₹199 for one year of SBC membership.</p>
                <p>
                  ✓ If your membership is still active, your existing expiry
                  date is preserved and one year is added.
                </p>
                <p>
                  ✓ If your membership has expired, the new year starts from
                  the successful payment date.
                </p>
                <p>
                  ✓ Payment cancellation or failure does not change your
                  membership dates.
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm leading-6 text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {statusMessage ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                {statusMessage}
              </div>
            ) : null}

            <button
              type="button"
              disabled={paymentLoading}
              onClick={startPayment}
              className="w-full rounded-2xl bg-white px-5 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {paymentLoading ? "Processing..." : "Renew SBC for ₹199"}
            </button>

            <p className="text-center text-xs leading-5 text-white/35">
              Payment is processed securely through Razorpay. Your membership
              dates are calculated and controlled by the SBC server after
              successful payment verification.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
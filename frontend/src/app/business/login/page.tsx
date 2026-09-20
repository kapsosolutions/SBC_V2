 "use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";

import {
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

export default function BusinessLogin() {
  const router = useRouter();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  /* ==========================================
   * FORGOT PASSWORD
   * ========================================== */
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMobile, setResetMobile] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"mobile" | "otp" | "password">("mobile");
  const [resetLoading, setResetLoading] = useState(false);

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  /*
   * ==========================================
   * NORMALIZE MOBILE NUMBER
   * ==========================================
   */

  const normalizeMobile = (
    value: string
  ) => {
    let number = value.trim();

    number = number.replace(
      /[\s\-()]/g,
      ""
    );

    if (number.startsWith("+91")) {
      number = number.slice(3);
    }

    if (
      number.startsWith("91") &&
      number.length === 12
    ) {
      number = number.slice(2);
    }

    if (
      number.startsWith("0") &&
      number.length === 11
    ) {
      number = number.slice(1);
    }

    return number;
  };

  const cleanupResetRecaptcha = () => {
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {}
    recaptchaVerifierRef.current = null;
  };

  useEffect(() => {
    return () => cleanupResetRecaptcha();
  }, []);

  const normalizeResetMobile = (value: string) => {
    let number = value.trim().replace(/[\s\-()]/g, "");

    if (number.startsWith("+91")) number = number.slice(3);
    if (number.startsWith("91") && number.length === 12) number = number.slice(2);
    if (number.startsWith("0") && number.length === 11) number = number.slice(1);

    return number;
  };

  const openForgotPassword = () => {
    setShowForgotPassword(true);
    setResetStep("mobile");
    setResetMobile("");
    setResetOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetLoading(false);
    confirmationResultRef.current = null;
    cleanupResetRecaptcha();
  };

  const closeForgotPassword = () => {
    confirmationResultRef.current = null;
    cleanupResetRecaptcha();
    setShowForgotPassword(false);
    setResetStep("mobile");
    setResetMobile("");
    setResetOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetLoading(false);
  };

  const createResetRecaptcha = () => {
    if (typeof window === "undefined") return null;
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current;

    const verifier = new RecaptchaVerifier(
      auth,
      "business-reset-recaptcha-container",
      {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => cleanupResetRecaptcha(),
      }
    );

    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const sendBusinessResetOtp = async () => {
    const cleanedMobile = normalizeResetMobile(resetMobile);

    if (!/^[6-9]\d{9}$/.test(cleanedMobile)) {
      alert("Enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setResetLoading(true);

      /*
       * IMPORTANT:
       * FIRST check whether this mobile belongs to a
       * registered business. Only then send OTP.
       *
       * This prevents a student-only number or any
       * unregistered number from receiving a business
       * password-reset OTP.
       */
      const checkResponse = await fetch(
        `${API_BASE_URL}/api/business/check-mobile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mobile: cleanedMobile,
          }),
        }
      );

      const checkData = await checkResponse.json().catch(() => ({}));

      if (!checkResponse.ok || !checkData.exists) {
        alert(
          "❌ No business account is registered with this mobile number. Please use your registered business mobile number."
        );
        return;
      }

      const verifier = createResetRecaptcha();

      if (!verifier) {
        throw new Error("Unable to initialize security verification.");
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        `+91${cleanedMobile}`,
        verifier
      );

      confirmationResultRef.current = confirmationResult;
      setResetMobile(cleanedMobile);
      setResetStep("otp");

      alert("OTP sent to your registered business mobile number.");
    } catch (error: any) {
      console.error("Business Forgot Password OTP Error:", error);
      cleanupResetRecaptcha();

      if (error?.code === "auth/invalid-phone-number") {
        alert("Enter a valid mobile number.");
      } else if (error?.code === "auth/too-many-requests") {
        alert("Too many attempts. Please try again later.");
      } else if (error?.code === "auth/quota-exceeded") {
        alert("OTP limit reached. Please try again later.");
      } else {
        alert(error?.message || "Unable to send OTP. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const verifyBusinessResetOtp = async () => {
    if (!resetOtp.trim()) {
      alert("Enter the OTP.");
      return;
    }

    if (!confirmationResultRef.current) {
      alert("Please request a new OTP.");
      setResetStep("mobile");
      return;
    }

    try {
      setResetLoading(true);

      await confirmationResultRef.current.confirm(resetOtp.trim());

      setResetStep("password");
      cleanupResetRecaptcha();
    } catch (error: any) {
      console.error("Business Forgot Password OTP Verify Error:", error);

      if (error?.code === "auth/invalid-verification-code") {
        alert("Invalid OTP. Please check and try again.");
      } else if (error?.code === "auth/code-expired") {
        alert("OTP expired. Please request a new OTP.");
        setResetStep("mobile");
      } else {
        alert("OTP verification failed. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const resetBusinessPassword = async () => {
    if (newPassword.length < 6) {
      alert("Password should be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alert("Passwords do not match.");
      return;
    }

    const phoneUser = auth.currentUser;

    if (!phoneUser) {
      alert("Reset session expired. Please start again.");
      setResetStep("mobile");
      return;
    }

    try {
      setResetLoading(true);

      const idToken = await phoneUser.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/business/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          mobile: normalizeResetMobile(resetMobile),
          newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to reset business password."
        );
      }

      await signOut(auth);
      closeForgotPassword();

      alert(
        "✅ Password reset successful. Please login with your new password."
      );
    } catch (error: any) {
      console.error("Business Password Reset Error:", error);
      alert(error?.message || "Unable to reset password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  /*
   * ==========================================
   * LOGIN
   * ==========================================
   */

  const loginBusiness = async () => {
    const normalizedMobile =
      normalizeMobile(mobile);

    if (!normalizedMobile) {
      alert(
        "Please enter your mobile number."
      );
      return;
    }

    if (!/^\d{10}$/.test(normalizedMobile)) {
      alert(
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    if (!password) {
      alert(
        "Please enter your password."
      );
      return;
    }

    try {
      setLoading(true);

      const email =
        `${normalizedMobile}@business.spc`;

      console.log(
        "Business login email:",
        email
      );

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const uid =
        userCredential.user.uid;

      const businessRef = doc(
        db,
        "businesses",
        uid
      );

      const businessSnap =
        await getDoc(
          businessRef
        );

      if (!businessSnap.exists()) {
        alert(
          "Your Firebase account exists, but your business profile was not found. Please contact SBC Admin."
        );

        return;
      }

      const business =
        businessSnap.data();

      const status =
        String(
          business.status || ""
        ).toLowerCase();

      if (status !== "approved") {
        if (status === "pending") {
          alert(
            "⏳ Your business registration is still waiting for admin approval."
          );
        } else if (
          status === "rejected"
        ) {
          alert(
            "❌ Your business registration was rejected. Please contact SBC Admin."
          );
        } else {
          alert(
            `Your business account is not approved yet.\n\nCurrent status: ${
              business.status || "Unknown"
            }`
          );
        }

        return;
      }

      router.replace(
        "/business/dashboard"
      );

    } catch (error: any) {
      console.error(
        "Business Login Error:",
        error
      );

      switch (error?.code) {
        case "auth/invalid-credential":
          alert(
            "❌ Invalid mobile number or password."
          );
          break;

        case "auth/user-not-found":
          alert(
            "❌ No business account exists with this mobile number."
          );
          break;

        case "auth/wrong-password":
          alert(
            "❌ Incorrect password."
          );
          break;

        case "auth/invalid-email":
          alert(
            "❌ Invalid business login format."
          );
          break;

        case "auth/user-disabled":
          alert(
            "❌ This business account has been disabled."
          );
          break;

        case "auth/too-many-requests":
          alert(
            "⚠️ Too many login attempts. Please wait and try again."
          );
          break;

        case "auth/network-request-failed":
          alert(
            "🌐 Network error. Please check your internet connection and try again."
          );
          break;

        default:
          alert(
            `❌ Login failed.\n\nError: ${
              error?.code ||
              "Unknown error"
            }`
          );
      }

    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#07111f]">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(212,175,55,0.14),transparent_32%),radial-gradient(circle_at_90%_85%,rgba(7,17,31,0.09),transparent_30%),linear-gradient(135deg,#fffdf7_0%,#f5f3ed_52%,#eeeade_100%)]" />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#07111f]/10 blur-3xl" />

        <div className="relative w-full max-w-5xl">

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-5 rounded-full border border-black/10 bg-white/85 px-5 py-2.5 text-sm font-bold text-[#07111f] shadow-sm backdrop-blur transition hover:border-[#d4af37]/50 hover:bg-white"
          >
            ← Back to Home
          </button>

          <div className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_30px_100px_rgba(7,17,31,0.16)] backdrop-blur-xl lg:grid-cols-[0.8fr_1.2fr]">

            {/* BRAND PANEL */}
            <div className="relative hidden overflow-hidden bg-[#07111f] p-10 text-white lg:flex lg:flex-col lg:justify-between">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#d4af37]/15 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#d4af37]/10 blur-3xl" />

              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4af37]/40 bg-[#d4af37]/10 text-lg font-black text-[#f1cf63]">
                  SBC
                </div>

                <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-[#d4af37]">
                  Student Benefit Card
                </p>

                <h2 className="mt-3 text-4xl font-black leading-tight">
                  Welcome back,
                  <span className="block text-[#f1cf63]">Partner.</span>
                </h2>

                <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
                  Manage your SBC business account and connect with students through exclusive benefits.
                </p>
              </div>

              <div className="relative grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-xl">🏪</p>
                  <p className="mt-2 text-xs font-black">Business Portal</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-xl">🎁</p>
                  <p className="mt-2 text-xs font-black">Student Benefits</p>
                </div>
              </div>
            </div>

            {/* LOGIN PANEL */}
            <div className="p-6 sm:p-9 lg:p-11">

              <div className="mb-7 text-center lg:hidden">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#07111f] text-base font-black text-[#f1cf63] shadow-lg">
                  SBC
                </div>
              </div>

              <div className="text-center lg:text-left">
                <div className="inline-flex items-center rounded-full border border-[#d4af37]/30 bg-[#fff8df] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a680c]">
                  ✦ Business Login
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#07111f] sm:text-4xl">
                  Welcome Back
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  Login to your SBC Business Account
                </p>

                <p className="mt-1 text-xs font-semibold text-[#a37b0d]">
                  Student Benefit Card Partner
                </p>
              </div>

              <div className="mt-8 space-y-5">

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Mobile Number
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                      📱
                    </span>

                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="Enter mobile number"
                      value={mobile}
                      onChange={(e) =>
                        setMobile(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          loginBusiness();
                        }
                      }}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-3.5 pl-12 pr-4 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Password
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                      🔒
                    </span>

                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) =>
                        setPassword(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          loginBusiness();
                        }
                      }}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-3.5 pl-12 pr-4 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>
                </div>

                <div className="-mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs font-black text-[#a37b0d] hover:text-[#07111f] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="button"
                  onClick={loginBusiness}
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "⏳ Logging In..."
                    : "Login to Business Portal →"}
                </button>

                <div className="rounded-2xl border border-black/5 bg-[#fbfaf6] p-4 text-center text-sm text-slate-500">
                  Don't have a business account?{" "}
                  <Link
                    href="/business/register"
                    className="font-black text-[#a37b0d] hover:text-[#07111f] hover:underline"
                  >
                    Register
                  </Link>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-between border-t border-black/5 pt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Student Benefit Card</span>
                <span className="text-[#a37b0d]">SBC • 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* FORGOT PASSWORD MODAL */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07111f]/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_100px_rgba(7,17,31,0.3)]">
            <div className="bg-[#07111f] px-6 py-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                    Business Account
                  </p>
                  <h2 className="mt-1 text-2xl font-black">Reset Password</h2>
                  <p className="mt-1 text-xs text-white/55">
                    Verify your registered business mobile number.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white transition hover:bg-white/15"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-7">
              {resetStep === "mobile" && (
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Registered Business Mobile
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="Enter business mobile number"
                      value={resetMobile}
                      onChange={(e) => setResetMobile(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendBusinessResetOtp();
                      }}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-3.5 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={sendBusinessResetOtp}
                    disabled={resetLoading}
                    className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resetLoading ? "⏳ Checking..." : "Continue →"}
                  </button>
                </div>
              )}

              {resetStep === "otp" && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[#d4af37]/25 bg-[#fff8df] p-4 text-sm text-[#07111f]">
                    OTP sent to <strong>+91 {resetMobile}</strong>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Enter OTP
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={resetOtp}
                      onChange={(e) =>
                        setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") verifyBusinessResetOtp();
                      }}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-3.5 text-center text-xl font-black tracking-[0.35em] text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={verifyBusinessResetOtp}
                    disabled={resetLoading}
                    className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resetLoading ? "⏳ Verifying..." : "Verify OTP →"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      confirmationResultRef.current = null;
                      cleanupResetRecaptcha();
                      setResetOtp("");
                      setResetStep("mobile");
                    }}
                    className="w-full text-xs font-black text-[#a37b0d] hover:text-[#07111f] hover:underline"
                  >
                    Use a different number
                  </button>
                </div>
              )}

              {resetStep === "password" && (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
                    ✓ Mobile number verified. Create your new password.
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      New Password
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-3.5 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") resetBusinessPassword();
                      }}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-3.5 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={resetBusinessPassword}
                    disabled={resetLoading}
                    className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resetLoading ? "⏳ Resetting Password..." : "Reset Password →"}
                  </button>
                </div>
              )}

              <div
                id="business-reset-recaptcha-container"
                className="pointer-events-none absolute h-0 w-0 overflow-hidden"
              />
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

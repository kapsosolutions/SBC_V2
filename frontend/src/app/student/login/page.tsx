 "use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";

import {
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  updatePassword,
  type ConfirmationResult,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

export default function StudentLogin() {
  const router = useRouter();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot Password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMobile, setResetMobile] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetStep, setResetStep] = useState<"mobile" | "otp" | "password">("mobile");
  const [resetLoading, setResetLoading] = useState(false);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const cleanupResetRecaptcha = () => {
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {}
    recaptchaVerifierRef.current = null;
  };

  useEffect(() => {
    return () => {
      cleanupResetRecaptcha();
    };
  }, []);

  const createResetRecaptcha = () => {
    if (typeof window === "undefined") return null;
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current;

    const verifier = new RecaptchaVerifier(
      auth,
      "student-reset-recaptcha-container",
      {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => cleanupResetRecaptcha(),
      }
    );
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const loginStudent = async () => {
    if (!mobile.trim() || !password) {
      alert("Enter Mobile Number & Password");
      return;
    }

    try {
      setLoading(true);

      const email = `${mobile.trim()}@student.spc`;

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const uid = userCredential.user.uid;

      const studentRef = doc(db, "students", uid);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        alert("Student not found");
        return;
      }

      const student = studentSnap.data();

      console.log("Student Data:", student);
      console.log("Status:", student.status);
      console.log("UID:", uid);

      const status = (student.status || "").toLowerCase();

      if (status !== "approved" && status !== "active") {
        alert(
          "Your account is waiting for admin approval."
        );
        return;
      }

      router.replace("/student/dashboard");
    } catch (error: any) {
      console.error("Student Login Error:", error);

      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/user-not-found" ||
        error?.code === "auth/wrong-password"
      ) {
        alert("Invalid Mobile Number or Password");
      } else {
        alert("Login Failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const sendResetOtp = async () => {
    const cleanedMobile = resetMobile.trim().replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanedMobile)) {
      alert("Enter a valid 10-digit mobile number.");
      return;
    }
    try {
      setResetLoading(true);
      const verifier = createResetRecaptcha();
      if (!verifier) throw new Error("Unable to initialize security verification.");
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        `+91${cleanedMobile}`,
        verifier
      );
      confirmationResultRef.current = confirmationResult;
      setResetMobile(cleanedMobile);
      setResetStep("otp");
      alert("OTP sent to your mobile number.");
    } catch (error: any) {
      console.error("Forgot Password OTP Error:", error);
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

  const verifyResetOtp = async () => {
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
      console.error("Forgot Password OTP Verify Error:", error);
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

  const resetStudentPassword = async () => {
    if (newPassword.length < 6) {
      alert("Password should be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (!auth.currentUser) {
      alert("Reset session expired. Please start again.");
      setResetStep("mobile");
      return;
    }
    try {
      setResetLoading(true);
      await updatePassword(auth.currentUser, newPassword);
      await auth.signOut();
      confirmationResultRef.current = null;
      cleanupResetRecaptcha();
      setShowForgotPassword(false);
      setResetStep("mobile");
      setResetMobile("");
      setResetOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
      alert("Password reset successful. Please login with your new password.");
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      if (error?.code === "auth/weak-password") {
        alert("Password should be at least 6 characters.");
      } else {
        alert(error?.message || "Unable to reset password. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotPassword = () => {
    try { auth.signOut(); } catch {}
    cleanupResetRecaptcha();
    confirmationResultRef.current = null;
    setShowForgotPassword(false);
    setResetStep("mobile");
    setResetMobile("");
    setResetOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#07111f]">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">

        {/* PREMIUM BACKGROUND */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(212,175,55,0.13),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(7,17,31,0.10),transparent_30%),linear-gradient(135deg,#fffdf7_0%,#f5f3ed_52%,#eeeade_100%)]" />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#07111f]/10 blur-3xl" />

        <div className="relative w-full max-w-5xl">

          {/* BACK */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-5 rounded-full border border-black/10 bg-white/80 px-5 py-2.5 text-sm font-bold text-[#07111f] shadow-sm backdrop-blur transition hover:border-[#d4af37]/50 hover:bg-white"
          >
            ← Back to Home
          </button>

          <div className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_30px_100px_rgba(7,17,31,0.16)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">

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
                  Your benefits.
                  <span className="block text-[#f1cf63]">
                    One card.
                  </span>
                </h2>

                <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
                  Sign in to discover exclusive student offers, partner benefits and SBC reward points.
                </p>
              </div>

              <div className="relative space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/40">
                    SBC Benefits
                  </p>
                  <p className="mt-1 font-bold text-white">
                    🎁 Offers & Discounts
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-white/35">
                  <span>Secure Student Access</span>
                  <span className="font-black text-[#f1cf63]">
                    SBC • 2026
                  </span>
                </div>
              </div>
            </div>

            {/* LOGIN PANEL */}
            <div className="p-7 sm:p-10 lg:p-12">

              <div className="mb-8 lg:hidden">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#07111f] text-lg font-black text-[#f1cf63] shadow-lg">
                  SBC
                </div>
              </div>

              <div className="text-center lg:text-left">
                <div className="inline-flex items-center rounded-full border border-[#d4af37]/30 bg-[#fff8df] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a680c]">
                  ✦ Student Portal
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#07111f] sm:text-4xl">
                  Welcome Back
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  Login to your SBC account
                </p>
              </div>

              <div className="mt-8 space-y-5">

                {/* MOBILE */}
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
                      placeholder="Enter your mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-4 pl-12 pr-4 text-base font-medium text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Password
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                      🔐
                    </span>

                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-4 pl-12 pr-4 text-base font-medium text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>

                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs font-bold text-[#a37b0d] transition hover:text-[#07111f] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                {/* LOGIN */}
                <button
                  type="button"
                  onClick={loginStudent}
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#07111f] py-4 text-base font-black text-white shadow-[0_12px_30px_rgba(7,17,31,0.18)] transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Logging In...
                    </span>
                  ) : (
                    "Login to SBC →"
                  )}
                </button>

                {/* REGISTER */}
                <div className="rounded-2xl border border-[#d4af37]/20 bg-[#fffdf5] p-4 text-center">
                  <p className="text-sm text-slate-500">
                    Don't have an account?{" "}
                    <Link
                      href="/student/register"
                      className="font-black text-[#a37b0d] transition hover:text-[#07111f] hover:underline"
                    >
                      Register Now
                    </Link>
                  </p>
                </div>
              </div>

              {/* FOOTER */}
              <div className="mt-8 flex items-center justify-between border-t border-black/5 pt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Student Benefit Card</span>
                <span className="text-[#a37b0d]">SBC • 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111f]/55 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_30px_100px_rgba(7,17,31,0.25)] sm:p-8">
            <button type="button" onClick={closeForgotPassword} disabled={resetLoading} className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50" aria-label="Close">×</button>
            <div className="pr-10">
              <div className="inline-flex items-center rounded-full border border-[#d4af37]/30 bg-[#fff8df] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#8a680c]">✦ Account Recovery</div>
              <h2 className="mt-4 text-2xl font-black text-[#07111f]">Forgot Password?</h2>
              <p className="mt-2 text-sm leading-5 text-slate-500">Verify your registered mobile number with OTP and create a new password.</p>
            </div>

            <div className="mt-6">
              {resetStep === "mobile" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Registered Mobile Number</label>
                    <input type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="Enter 10-digit mobile number" value={resetMobile} onChange={(e) => setResetMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-4 text-base font-medium text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10" />
                  </div>
                  <button type="button" onClick={sendResetOtp} disabled={resetLoading} className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(7,17,31,0.16)] transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50">{resetLoading ? "Sending OTP..." : "Send OTP →"}</button>
                </div>
              )}

              {resetStep === "otp" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Enter OTP</label>
                    <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit OTP" value={resetOtp} onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-4 text-center text-xl font-black tracking-[0.35em] text-[#07111f] outline-none transition placeholder:text-slate-400 placeholder:tracking-normal focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10" />
                  </div>
                  <button type="button" onClick={verifyResetOtp} disabled={resetLoading} className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(7,17,31,0.16)] transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50">{resetLoading ? "Verifying..." : "Verify OTP →"}</button>
                  <button type="button" onClick={() => { confirmationResultRef.current = null; cleanupResetRecaptcha(); setResetOtp(""); setResetStep("mobile"); }} disabled={resetLoading} className="w-full text-xs font-bold text-[#a37b0d] hover:underline disabled:opacity-50">Change Mobile Number</button>
                </div>
              )}

              {resetStep === "password" && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">New Password</label>
                    <input type="password" autoComplete="new-password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-4 text-base font-medium text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">Confirm New Password</label>
                    <input type="password" autoComplete="new-password" placeholder="Re-enter new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-4 text-base font-medium text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10" />
                  </div>
                  <p className="text-[11px] leading-4 text-slate-400">Password must be at least 6 characters.</p>
                  <button type="button" onClick={resetStudentPassword} disabled={resetLoading} className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(7,17,31,0.16)] transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50">{resetLoading ? "Updating Password..." : "Reset Password →"}</button>
                </div>
              )}
            </div>
            <div id="student-reset-recaptcha-container" />
          </div>
        </div>
      )}
    </main>
  );
}

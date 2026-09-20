
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  EmailAuthProvider,
  linkWithCredential,
  signOut,
  deleteUser,
  ConfirmationResult,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

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

export default function StudentRegister() {
  const router = useRouter();

  const [referralCode, setReferralCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [checkingMobile, setCheckingMobile] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [college, setCollege] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");

  const recaptchaRef =
    useRef<RecaptchaVerifier | null>(null);

  const confirmationResultRef =
    useRef<ConfirmationResult | null>(null);

  /*
   * ============================================================
   * REFERRAL CODE
   * ============================================================
   *
   * Example:
   * /student/register?ref=ABC123
   *
   * We only capture the referral code here.
   * The referral becomes successful only after the referred
   * student's eligible SBC payment is successfully completed.
   */

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(
      window.location.search
    );

    const urlReferralCode =
      params.get("ref")?.trim() || "";

    let storedReferralCode = "";

    try {
      storedReferralCode =
        sessionStorage.getItem(
          "sbc_referral_code"
        )?.trim() || "";
    } catch {}

    const ref =
      urlReferralCode || storedReferralCode;

    if (ref) {
      const normalizedRef =
        ref.slice(0, 64);

      setReferralCode(
        normalizedRef
      );

      try {
        sessionStorage.setItem(
          "sbc_referral_code",
          normalizedRef
        );
      } catch {}

      console.log(
        "🎁 SBC referral code captured:",
        normalizedRef
      );
    }
  }, []);

  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */

  useEffect(() => {
    return () => {
      try {
        recaptchaRef.current?.clear();
      } catch {}

      recaptchaRef.current = null;
      confirmationResultRef.current = null;
    };
  }, []);

  /*
   * ============================================================
   * GET PHONE NUMBER
   * ============================================================
   */

  const getPhoneNumber = () => {
    const cleaned =
      mobile.replace(/\D/g, "").trim();

    if (
      cleaned.length !== 10 ||
      !/^[6-9]\d{9}$/.test(cleaned)
    ) {
      return null;
    }

    return `+91${cleaned}`;
  };

  /*
   * ============================================================
   * RECAPTCHA
   * ============================================================
   */

  const getRecaptchaVerifier = () => {
    if (typeof window === "undefined") {
      return null;
    }

    if (recaptchaRef.current) {
      return recaptchaRef.current;
    }

    const button =
      document.getElementById(
        "student-send-otp-button"
      );

    if (!button) {
      throw new Error(
        "Send OTP button is not available."
      );
    }

    const verifier =
      new RecaptchaVerifier(
        auth,
        "student-send-otp-button",
        {
          size: "invisible",

          callback: () => {
            console.log(
              "Firebase reCAPTCHA verified"
            );
          },

          "expired-callback": () => {
            console.log(
              "Firebase reCAPTCHA expired"
            );
          },

          "error-callback": () => {
            console.log(
              "Firebase reCAPTCHA error"
            );
          },
        }
      );

    recaptchaRef.current =
      verifier;

    return verifier;
  };

  /*
   * ============================================================
   * RESET RECAPTCHA
   * ============================================================
   */

  const resetRecaptcha = () => {
    try {
      recaptchaRef.current?.clear();
    } catch {}

    recaptchaRef.current = null;
  };

  /*
   * ============================================================
   * CHECK MOBILE BEFORE OTP
   * ============================================================
   *
   * Existing registered mobile:
   *      STOP
   *      NO OTP
   *
   * New mobile:
   *      Continue
   *      Send OTP
   */

  const checkMobileAlreadyRegistered =
    async (
      cleanedMobile: string
    ): Promise<boolean> => {
      try {
        setCheckingMobile(true);

        console.log(
          "🔎 Checking mobile before OTP:",
          cleanedMobile
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/student/check-mobile`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                mobile: cleanedMobile,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to check mobile number."
          );
        }

        /*
         * Existing mobile
         */

        if (data.exists === true) {
          console.log(
            "🚫 Mobile already registered. OTP will NOT be sent."
          );

          alert(
            "⚠️ This mobile number is already registered.\n\nPlease login using your existing SBC account."
          );

          return true;
        }

        /*
         * New mobile
         */

        console.log(
          "✅ Mobile is available for registration."
        );

        return false;
      } finally {
        setCheckingMobile(false);
      }
    };

  /*
   * ============================================================
   * SEND OTP
   * ============================================================
   */

  const sendOTP = async () => {
    if (
      otpLoading ||
      checkingMobile
    ) {
      return;
    }

    if (!fullName.trim()) {
      alert(
        "Please enter your full name."
      );
      return;
    }

    const phoneNumber =
      getPhoneNumber();

    if (!phoneNumber) {
      alert(
        "Please enter a valid 10-digit Indian mobile number."
      );
      return;
    }

    const cleanedMobile =
      mobile.replace(/\D/g, "").trim();

    try {
      setOtpLoading(true);

      /*
       * ======================================================
       * FIRST CHECK DATABASE / AUTH
       * ======================================================
       *
       * This happens BEFORE Firebase OTP.
       */

      const alreadyRegistered =
        await checkMobileAlreadyRegistered(
          cleanedMobile
        );

      if (alreadyRegistered) {
        return;
      }

      /*
       * ======================================================
       * NEW NUMBER
       * NOW SEND OTP
       * ======================================================
       */

      console.log(
        "📱 New mobile. Sending OTP:",
        phoneNumber
      );

      const appVerifier =
        getRecaptchaVerifier();

      if (!appVerifier) {
        throw new Error(
          "Unable to initialize reCAPTCHA."
        );
      }

      const confirmationResult =
        await signInWithPhoneNumber(
          auth,
          phoneNumber,
          appVerifier
        );

      confirmationResultRef.current =
        confirmationResult;

      setOtpSent(true);
      setOtpVerified(false);
      setOtp("");

      alert(
        `📱 OTP sent successfully to ${phoneNumber}`
      );
    } catch (error: any) {
      console.error(
        "SEND OTP ERROR:",
        error
      );

      resetRecaptcha();

      switch (error?.code) {
        case "auth/invalid-phone-number":
          alert(
            "❌ Invalid mobile number."
          );
          break;

        case "auth/too-many-requests":
          alert(
            "❌ Too many OTP requests. Please wait and try again later."
          );
          break;

        case "auth/quota-exceeded":
          alert(
            "❌ SMS quota exceeded. Please try again later."
          );
          break;

        case "auth/operation-not-allowed":
          alert(
            "❌ Phone Authentication is not enabled in Firebase."
          );
          break;

        case "auth/captcha-check-failed":
          alert(
            "❌ Firebase reCAPTCHA verification failed. Please try again."
          );
          break;

        case "auth/invalid-app-credential":
          alert(
            "❌ Firebase reCAPTCHA application credential is invalid. Please refresh and try again."
          );
          break;

        case "auth/argument-error":
          alert(
            "❌ Firebase reCAPTCHA configuration error. Please refresh and try again."
          );
          break;

        case "auth/app-not-authorized":
          alert(
            "❌ This website is not authorized in Firebase Authentication."
          );
          break;

        case "auth/unauthorized-domain":
          alert(
            "❌ This domain is not authorized in Firebase Authentication."
          );
          break;

        default:
          alert(
            error?.message ||
              "❌ Unable to send OTP."
          );
      }
    } finally {
      setOtpLoading(false);
      setCheckingMobile(false);
    }
  };

  /*
   * ============================================================
   * VERIFY OTP
   * ============================================================
   */

  const verifyOTP = async () => {
    if (
      otp.trim().length !== 6
    ) {
      alert(
        "Please enter the 6-digit OTP."
      );
      return;
    }

    if (
      !confirmationResultRef.current
    ) {
      alert(
        "Please request OTP first."
      );
      return;
    }

    try {
      setVerifyingOtp(true);

      const result =
        await confirmationResultRef.current.confirm(
          otp.trim()
        );

      console.log(
        "OTP verified. Firebase UID:",
        result.user.uid
      );

      setOtpVerified(true);

      resetRecaptcha();

      alert(
        "✅ Mobile number verified successfully!"
      );
    } catch (error: any) {
      console.error(
        "OTP verification error:",
        error
      );

      setOtpVerified(false);

      if (
        error?.code ===
        "auth/invalid-verification-code"
      ) {
        alert(
          "❌ Invalid OTP. Please enter the correct OTP."
        );
      } else if (
        error?.code ===
        "auth/code-expired"
      ) {
        alert(
          "❌ OTP expired. Please request a new OTP."
        );
      } else {
        alert(
          error?.message ||
            "❌ OTP verification failed."
        );
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  /*
   * ============================================================
   * CHANGE MOBILE
   * ============================================================
   */

  const changeMobile = async () => {
    try {
      await signOut(auth);
    } catch {}

    confirmationResultRef.current =
      null;

    setOtpSent(false);
    setOtpVerified(false);
    setOtp("");

    resetRecaptcha();
  };

  /*
   * ============================================================
   * RAZORPAY PAYMENT
   * ============================================================
   */

  const loadRazorpay = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    if (window.Razorpay) return true;

    return new Promise((resolve) => {
      const existing = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existing) {
        existing.addEventListener("load", () => resolve(true), {
          once: true,
        });
        existing.addEventListener("error", () => resolve(false), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const startPayment = async (): Promise<{
    paymentId: string;
    orderId: string;
    membershipStartDate: string;
    membershipExpiryDate: string;
  } | null> => {
    try {
      setPaymentLoading(true);
      setPaymentStatus("Creating secure payment...");

      const scriptLoaded = await loadRazorpay();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Unable to load secure payment checkout. Please try again."
        );
      }

      const idToken = await auth.currentUser?.getIdToken();

      if (!idToken) {
        throw new Error(
          "Firebase authentication session expired. Please verify your mobile number again."
        );
      }

      const orderResponse = await fetch(
        `${API_BASE_URL}/api/payment/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            amount: 199,
            purpose: "SBC student membership",
            mobile: mobile
              .replace(/\D/g, "")
              .trim(),
            referralCode:
              referralCode || null,
          }),
        }
      );

      const orderData =
        await orderResponse.json();

      if (
        !orderResponse.ok ||
        !orderData?.success ||
        !orderData?.order?.id ||
        !orderData?.keyId
      ) {
        throw new Error(
          orderData?.error ||
            "Unable to create payment order. Razorpay Key ID is missing."
        );
      }

      setPaymentStatus(
        "Opening secure payment..."
      );

      return await new Promise(
        (resolve) => {
          let completed = false;

          const finish = (
            value:
              | {
                  paymentId: string;
                  orderId: string;
                  membershipStartDate: string;
                  membershipExpiryDate: string;
                }
              | null
          ) => {
            if (completed) return;
            completed = true;
            resolve(value);
          };

          const RazorpayCheckout =
            window.Razorpay;

          if (!RazorpayCheckout) {
            finish(null);
            return;
          }

          const razorpay =
            new RazorpayCheckout({
              key: orderData.keyId,
              amount:
                orderData.order.amount,
              currency:
                orderData.order.currency,
              name:
                "Student Benefit Card",
              description:
                "SBC Student Membership",
              order_id:
                orderData.order.id,
              prefill: {
                name:
                  fullName.trim(),
                contact:
                  mobile
                    .replace(/\D/g, "")
                    .trim(),
              },
              theme: {
                color: "#07111f",
              },
              modal: {
                ondismiss: async () => {
                  // OTP creates a temporary Firebase phone-auth user.
                  // If the student closes/cancels payment before success,
                  // remove that temporary user so the mobile is reusable.
                  try {
                    const temporaryUser = auth.currentUser;
                    if (temporaryUser) {
                      await deleteUser(temporaryUser);
                      console.log(
                        "🧹 Temporary Firebase phone user removed after payment cancellation."
                      );
                    }
                  } catch (cleanupError) {
                    console.warn(
                      "Temporary Firebase user cleanup skipped:",
                      cleanupError
                    );
                    try {
                      await signOut(auth);
                    } catch {}
                  }

                  setPaymentStatus("");
                  setPaymentLoading(false);
                  setOtpSent(false);
                  setOtpVerified(false);
                  setOtp("");
                  confirmationResultRef.current = null;
                  resetRecaptcha();
                  finish(null);
                },
              },
              handler: async (
                response
              ) => {
                try {
                  setPaymentStatus(
                    "Verifying payment securely..."
                  );

                  const idToken =
                    await auth.currentUser?.getIdToken();

                  if (!idToken) {
                    throw new Error(
                      "Firebase authentication session expired. Please verify your mobile number again."
                    );
                  }

                  const verifyResponse =
                    await fetch(
                      `${API_BASE_URL}/api/payment/verify`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type":
                            "application/json",
                          Authorization:
                            `Bearer ${idToken}`,
                        },
                        body: JSON.stringify(
                          {
                            razorpay_order_id:
                              response.razorpay_order_id,
                            razorpay_payment_id:
                              response.razorpay_payment_id,
                            razorpay_signature:
                              response.razorpay_signature,
                          }
                        ),
                      }
                    );

                  const verifyData =
                    await verifyResponse.json();

                  if (
                    !verifyResponse.ok ||
                    !verifyData?.success
                  ) {
                    throw new Error(
                      verifyData?.error ||
                        "Payment verification failed."
                    );
                  }

                  setPaymentStatus(
                    "Payment verified successfully."
                  );

                  finish({
                    paymentId:
                      response.razorpay_payment_id,
                    orderId:
                      response.razorpay_order_id,
                    membershipStartDate:
                      String(
                        verifyData.membershipStartDate ||
                          ""
                      ),
                    membershipExpiryDate:
                      String(
                        verifyData.membershipExpiryDate ||
                          ""
                      ),
                  });
                } catch (error: any) {
                  console.error(
                    "Payment verification error:",
                    error
                  );

                  alert(
                    error?.message ||
                      "❌ Payment verification failed. Please contact SBC support."
                  );

                  setPaymentStatus("");
                  finish(null);
                } finally {
                  setPaymentLoading(false);
                }
              },
            });

          razorpay.open();
        }
      );
    } catch (error: any) {
      console.error(
        "Payment error:",
        error
      );

      alert(
        error?.message ||
          "❌ Unable to start payment."
      );

      setPaymentStatus("");
      setPaymentLoading(false);

      return null;
    }
  };

  /*
   * ============================================================
   * REGISTER STUDENT
   * ============================================================
   */

  const registerStudent =
    async () => {
      if (
        !fullName.trim() ||
        !mobile.trim() ||
        !password ||
        !college.trim() ||
        !course.trim() ||
        !year.trim()
      ) {
        alert(
          "Please fill all fields."
        );
        return;
      }

      if (
        !otpSent ||
        !otpVerified
      ) {
        alert(
          "Please verify your mobile number with OTP first."
        );
        return;
      }

      if (
        password.length < 6
      ) {
        alert(
          "Password should be at least 6 characters."
        );
        return;
      }

      const cleanedMobile =
        mobile.replace(/\D/g, "").trim();

      if (
        !/^[6-9]\d{9}$/.test(
          cleanedMobile
        )
      ) {
        alert(
          "Please enter a valid 10-digit Indian mobile number."
        );
        return;
      }

      try {
        setLoading(true);

        /*
         * ======================================================
         * CURRENT FIREBASE USER
         * ======================================================
         *
         * IMPORTANT:
         *
         * After OTP verification Firebase Auth has already
         * created / signed in the phone-auth user.
         *
         * Therefore currentUser.uid must be passed to the
         * duplicate-check API so that the API does NOT
         * consider this same user as another registered user.
         */

        const currentUser =
          auth.currentUser;

        if (!currentUser) {
          alert(
            "❌ OTP verification session expired. Please verify OTP again."
          );

          setOtpVerified(false);

          return;
        }

        console.log(
          "👤 Current OTP Firebase UID:",
          currentUser.uid
        );

        /*
         * ======================================================
         * SECOND SAFETY CHECK
         * ======================================================
         *
         * This checks again immediately before account creation.
         *
         * IMPORTANT:
         *
         * excludeUid tells the API:
         *
         * "If the Firebase Auth user belongs to this same UID,
         * do NOT treat it as a duplicate."
         */

        const duplicateCheck =
          await fetch(
            `${API_BASE_URL}/api/student/check-mobile`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                mobile:
                  cleanedMobile,

                /*
                 * THIS IS THE IMPORTANT FIX
                 */
                excludeUid:
                  currentUser.uid,
              }),
            }
          );

        const duplicateData =
          await duplicateCheck.json();

        if (!duplicateCheck.ok) {
          throw new Error(
            duplicateData.error ||
              "Unable to verify mobile registration status."
          );
        }

        /*
         * If another student / another Firebase Auth account
         * already owns this mobile, stop registration.
         */

        if (
          duplicateData.exists === true
        ) {
          alert(
            "⚠️ This mobile number is already registered.\n\nPlease login using your existing SBC account."
          );

          try {
            await signOut(auth);
          } catch {}

          setOtpSent(false);
          setOtpVerified(false);

          confirmationResultRef.current =
            null;

          return;
        }

        /*
         * ======================================================
         * PAYMENT — ₹199
         * ======================================================
         *
         * The payment is verified on the server before the
         * final SBC student document is created.
         */

        const payment =
          await startPayment();

        if (!payment) {
          // Payment did not complete. Remove the temporary phone-auth
          // user so this mobile number is not falsely treated as registered.
          try {
            const temporaryUser = auth.currentUser;
            if (temporaryUser) {
              await deleteUser(temporaryUser);
              console.log(
                "🧹 Temporary Firebase phone user removed after unsuccessful payment."
              );
            }
          } catch (cleanupError) {
            console.warn(
              "Temporary Firebase user cleanup after payment failure skipped:",
              cleanupError
            );
            try {
              await signOut(auth);
            } catch {}
          }

          setOtpSent(false);
          setOtpVerified(false);
          setOtp("");
          confirmationResultRef.current = null;
          resetRecaptcha();
          return;
        }

        /*
         * ======================================================
         * CREATE LOGIN EMAIL
         * ======================================================
         */

        const loginEmail =
          `${cleanedMobile}@student.spc`;

        const emailCredential =
          EmailAuthProvider.credential(
            loginEmail,
            password
          );

        /*
         * ======================================================
         * LINK PHONE AUTH + EMAIL/PASSWORD
         * ======================================================
         *
         * Firebase phone user already exists because OTP
         * was verified.
         *
         * We now attach email/password login to that same UID.
         */

        const linkedUser =
          await linkWithCredential(
            currentUser,
            emailCredential
          );

        const uid =
          linkedUser.user.uid;

        console.log(
          "✅ Phone + Email credential linked. UID:",
          uid
        );

        /*
         * ======================================================
         * CREATE SBC CARD
         * ======================================================
         */

        const cardNumber =
          "SBC" +
          Math.floor(
            100000 +
              Math.random() *
                900000
          );

        /*
         * ======================================================
         * SAVE STUDENT
         * ======================================================
         */

        await setDoc(
          doc(
            db,
            "students",
            uid
          ),
          {
            uid,

            fullName:
              fullName.trim(),

            mobile:
              cleanedMobile,

            email:
              loginEmail,

            college:
              college.trim(),

            course:
              course.trim(),

            year:
              year.trim(),

            cardNumber,

            /*
             * Membership dates are calculated by the secure
             * server-side payment verification API.
             *
             * The registration page only stores the dates returned
             * by that verified payment response.
             */
            membershipStatus:
              "active",

            membershipStartDate:
              Timestamp.fromDate(
                new Date(
                  payment.membershipStartDate
                )
              ),

            membershipExpiryDate:
              Timestamp.fromDate(
                new Date(
                  payment.membershipExpiryDate
                )
              ),

            membershipPlan:
              "1_year",

            lastMembershipPaymentId:
              payment.paymentId,

            lastMembershipOrderId:
              payment.orderId,

            lastMembershipPaymentAt:
              serverTimestamp(),

            // Payment is successfully verified. No admin approval
            // is required for student activation.
            status:
              "active",

            phoneVerified:
              true,

            // This student's own referral code is separate
            // from the code used to refer them.
            referralCode:
              uid.slice(0, 8).toUpperCase(),

            ...(referralCode
              ? {
                  referredBy:
                    referralCode,
                  referralStatus:
                    "pending",
                  referralPaymentStatus:
                    "success",
                }
              : {}),

            paymentStatus:
              "paid",
            paymentAmount:
              199,
            paymentCurrency:
              "INR",
            razorpayPaymentId:
              payment.paymentId,
            razorpayOrderId:
              payment.orderId,
            paidAt:
              serverTimestamp(),

            createdAt:
              serverTimestamp(),
          }
        );

        console.log(
          "✅ Student document created:",
          uid
        );

        /*
         * ======================================================
         * AUTO LOGIN AFTER REGISTRATION
         * ======================================================
         *
         * Payment has already been verified and the student
         * document is saved as ACTIVE. Keep the Firebase session
         * signed in and send the student directly to the dashboard.
         */

        confirmationResultRef.current =
          null;

        resetRecaptcha();

        alert(
          `✅ Payment successful & student registration completed!\n\nYour SBC Card Number: ${cardNumber}\n\nYour ₹199 payment has been verified. Your SBC membership is active for 1 year.`
        );

        router.replace(
          "/student/dashboard"
        );
      } catch (error: any) {
        console.error(
          "Student registration error:",
          error
        );

        if (
          error?.code ===
          "auth/email-already-in-use"
        ) {
          alert(
            "❌ This mobile number is already registered."
          );

          try {
            await signOut(auth);
          } catch {}
        } else if (
          error?.code ===
          "auth/credential-already-in-use"
        ) {
          alert(
            "❌ This mobile number is already linked to another account."
          );

          try {
            await signOut(auth);
          } catch {}
        } else if (
          error?.code ===
          "auth/provider-already-linked"
        ) {
          alert(
            "❌ This mobile number is already registered."
          );
        } else if (
          error?.code ===
          "auth/weak-password"
        ) {
          alert(
            "❌ Password should be at least 6 characters."
          );
        } else {
          alert(
            error?.message ||
              "❌ Student registration failed."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f7f9fc] text-[#07111f]">

      <div className="relative min-h-screen w-full overflow-x-hidden px-0 py-0 sm:flex sm:items-center sm:justify-center sm:px-6 sm:py-8">

        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f7faff_0%,#f7f9fc_45%,#ffffff_100%)]" />

        <div className="absolute -left-24 top-20 hidden h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl sm:block" />

        <div className="absolute -right-24 bottom-0 hidden h-80 w-80 rounded-full bg-[#07111f]/10 blur-3xl sm:block" />

        <div className="relative mx-auto w-full min-w-0 max-w-6xl px-0 sm:px-0">

          {/* BACK */}

          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            className="flex h-14 w-full items-center border-b border-black/[.06] bg-white px-4 text-sm font-bold text-[#07111f] shadow-sm sm:mb-4 sm:h-auto sm:w-auto sm:rounded-full sm:border sm:px-4 sm:py-2 sm:text-sm"
          >
            ← Back to Home
          </button>

          <div className="grid w-full min-w-0 max-w-full overflow-hidden border-0 bg-white shadow-none sm:rounded-3xl sm:border sm:border-black/5 sm:shadow-[0_18px_50px_rgba(7,17,31,0.10)] lg:grid-cols-[0.8fr_1.2fr]">

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
                  Start your
                  <span className="block text-[#f1cf63]">
                    SBC journey.
                  </span>
                </h2>

                <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
                  Register once, get your SBC card and unlock exclusive student benefits from partner businesses.
                </p>

              </div>

              <div className="relative space-y-3">

                <div className="grid grid-cols-2 gap-3">

                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-xl">
                      🎁
                    </p>

                    <p className="mt-2 text-xs font-black">
                      Exclusive Offers
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-xl">
                      ⭐
                    </p>

                    <p className="mt-2 text-xs font-black">
                      Reward Points
                    </p>
                  </div>

                </div>

                <div className="flex items-center justify-between pt-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                  <span>
                    Secure Registration
                  </span>

                  <span className="text-[#f1cf63]">
                    SBC • 2026
                  </span>
                </div>

              </div>

            </div>

            {/* FORM PANEL */}

            <div className="min-w-0 max-w-full px-4 pb-8 pt-5 sm:p-9 lg:p-11">

              {/* MOBILE BRANDING */}

              <div className="mb-4 flex items-center justify-center gap-3 text-left lg:hidden">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#07111f] text-xs font-black text-[#f1cf63] shadow-md">
                  SBC
                </div>

              </div>

              <div className="text-left">

                <div className="inline-flex items-center rounded-full border border-[#d4af37]/30 bg-[#fff8df] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#8a680c]">
                  ✦ Student Registration
                </div>

                <h1 className="mt-3 max-w-full break-words text-[1.9rem] font-black leading-[1.08] tracking-[-0.03em] text-[#07111f] sm:text-4xl">
                  Create Your SBC Account
                </h1>

                <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
                  Complete your details and verify your mobile number.
                </p>

              </div>

              <div className="mt-6 min-w-0 max-w-full space-y-4 sm:mt-7">

                {/* NAME */}

                <div>

                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                    Full Name
                  </label>

                  <div className="relative">

                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                      👤
                    </span>

                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) =>
                        setFullName(
                          e.target.value
                        )
                      }
                      disabled={loading}
                      className="block h-12 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-3 text-sm shadow-[0_2px_8px_rgba(7,17,31,.03)] outline-none transition placeholder:text-slate-400 focus:border-[#1557d6] focus:ring-4 focus:ring-[#1557d6]/10 disabled:bg-slate-100 sm:h-auto sm:rounded-2xl sm:py-3.5 sm:pr-4"
                    />

                  </div>

                </div>

                {/* MOBILE */}

                <div>

                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                    Mobile Number
                  </label>

                  <div className="flex w-full min-w-0 gap-2">

                    <div className="flex h-12 shrink-0 items-center rounded-xl bg-[#07111f] px-3 text-sm font-black text-[#f1cf63] sm:h-auto sm:rounded-2xl sm:px-4">
                      +91
                    </div>

                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => {
                        setMobile(
                          e.target.value
                            .replace(
                              /\D/g,
                              ""
                            )
                            .slice(
                              0,
                              10
                            )
                        );
                      }}
                      disabled={
                        otpSent ||
                        loading ||
                        otpLoading
                      }
                      className="block h-12 w-0 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-[0_2px_8px_rgba(7,17,31,.03)] outline-none transition placeholder:text-slate-400 focus:border-[#1557d6] focus:bg-white focus:ring-4 focus:ring-[#1557d6]/10 disabled:bg-slate-100 sm:h-auto sm:rounded-2xl sm:p-3.5"
                    />

                  </div>

                </div>

                {/* SECURITY NOTE */}

                <div className="rounded-xl border border-blue-100 bg-[#f7faff] p-3.5 sm:rounded-2xl sm:p-4">

                  <p className="text-sm font-black text-[#8a680c]">
                    🔐 Secure Mobile Verification
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Your mobile number is checked before OTP is sent. Already registered numbers cannot create another SBC account.
                  </p>

                </div>

                {/* REFERRAL */}

                {referralCode && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-black text-emerald-700">
                      🎁 Referral Applied
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-700/80">
                      You joined SBC using a referral link. Your friend&apos;s
                      referral will be counted after you successfully complete
                      the required SBC payment.
                    </p>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      Referral Code: {referralCode}
                    </p>
                  </div>
                )}

                {/* SEND OTP */}

                {!otpSent && (
                  <button
                    id="student-send-otp-button"
                    type="button"
                    onClick={sendOTP}
                    disabled={
                      otpLoading ||
                      checkingMobile ||
                      mobile.length !==
                        10 ||
                      !fullName.trim()
                    }
                    className="h-12 w-full rounded-xl bg-[#07111f] px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(7,17,31,.12)] transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkingMobile
                      ? "🔎 Checking Mobile..."
                      : otpLoading
                      ? "📱 Sending OTP..."
                      : "📱 Send OTP →"}
                  </button>
                )}

                {/* OTP */}

                {otpSent && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(7,17,31,.04)] sm:rounded-2xl sm:p-5">

                    <div className="mb-4">

                      <p className="font-black text-[#8a680c]">
                        📱 OTP Verification
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Enter the 6-digit OTP sent to
                        <strong className="text-[#07111f]">
                          {" "}
                          +91 {mobile}
                        </strong>
                      </p>

                    </div>

                    {!otpVerified ? (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          onChange={(e) =>
                            setOtp(
                              e.target.value
                                .replace(
                                  /\D/g,
                                  ""
                                )
                                .slice(
                                  0,
                                  6
                                )
                            )
                          }
                          className="block h-14 w-full min-w-0 max-w-full rounded-xl border border-blue-100 bg-white px-3 text-center text-xl font-black tracking-[0.35em] shadow-inner outline-none focus:border-[#1557d6] focus:ring-4 focus:ring-[#1557d6]/10 sm:h-auto sm:rounded-2xl sm:p-4 sm:text-2xl sm:tracking-[0.5em]"
                        />

                        <button
                          type="button"
                          onClick={
                            verifyOTP
                          }
                          disabled={
                            verifyingOtp ||
                            otp.length !==
                              6
                          }
                          className="mt-3 h-12 w-full rounded-xl bg-[#07111f] text-sm font-black text-white transition hover:bg-[#101d2e] disabled:opacity-50 sm:h-auto sm:rounded-2xl sm:py-3.5"
                        >
                          {verifyingOtp
                            ? "⏳ Verifying..."
                            : "✅ Verify OTP"}
                        </button>

                        <button
                          type="button"
                          onClick={
                            sendOTP
                          }
                          disabled={
                            otpLoading ||
                            checkingMobile
                          }
                          className="mt-1 w-full rounded-xl py-2 text-xs font-bold text-[#1557d6] transition hover:bg-blue-50 disabled:opacity-50 sm:py-2.5 sm:text-sm"
                        >
                          {checkingMobile
                            ? "Checking..."
                            : otpLoading
                            ? "Sending..."
                            : "🔄 Resend OTP"}
                        </button>

                        <button
                          type="button"
                          onClick={
                            changeMobile
                          }
                          className="mt-0.5 w-full py-2 text-[11px] font-bold text-slate-500 hover:underline"
                        >
                          Change Mobile Number
                        </button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">

                        <p className="text-base font-black text-emerald-700">
                          ✅ Mobile Number Verified
                        </p>

                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          +91 {mobile}
                        </p>

                      </div>
                    )}

                  </div>
                )}

                {/* DETAILS */}

                <div className="grid min-w-0 max-w-full grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">

                  <div>

                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                      Password
                    </label>

                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Create password"
                      value={password}
                      onChange={(e) =>
                        setPassword(
                          e.target.value
                        )
                      }
                      disabled={
                        loading ||
                        !otpVerified
                      }
                      className="block h-12 w-full min-w-0 max-w-full rounded-xl border border-black/10 bg-[#fbfaf6] px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10 disabled:bg-slate-100 sm:h-auto sm:rounded-2xl sm:p-3.5"
                    />

                  </div>

                  <div>

                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                      College
                    </label>

                    <input
                      type="text"
                      placeholder="College name"
                      value={college}
                      onChange={(e) =>
                        setCollege(
                          e.target.value
                        )
                      }
                      disabled={
                        loading ||
                        !otpVerified
                      }
                      className="block h-12 w-full min-w-0 max-w-full rounded-xl border border-black/10 bg-[#fbfaf6] px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10 disabled:bg-slate-100 sm:h-auto sm:rounded-2xl sm:p-3.5"
                    />

                  </div>

                  <div>

                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                      Course
                    </label>

                    <input
                      type="text"
                      placeholder="Course"
                      value={course}
                      onChange={(e) =>
                        setCourse(
                          e.target.value
                        )
                      }
                      disabled={
                        loading ||
                        !otpVerified
                      }
                      className="block h-12 w-full min-w-0 max-w-full rounded-xl border border-black/10 bg-[#fbfaf6] px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10 disabled:bg-slate-100 sm:h-auto sm:rounded-2xl sm:p-3.5"
                    />

                  </div>

                  <div>

                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
                      Year
                    </label>

                    <input
                      type="text"
                      placeholder="Year"
                      value={year}
                      onChange={(e) =>
                        setYear(
                          e.target.value
                        )
                      }
                      disabled={
                        loading ||
                        !otpVerified
                      }
                      className="block h-12 w-full min-w-0 max-w-full rounded-xl border border-black/10 bg-[#fbfaf6] px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10 disabled:bg-slate-100 sm:h-auto sm:rounded-2xl sm:p-3.5"
                    />

                  </div>

                </div>

                {/* PAYMENT NOTE */}

                {otpVerified && (
                  <div className="rounded-xl border border-[#d4af37]/25 bg-[#fffdf5] p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#07111f]">
                          SBC Membership Fee
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Secure payment powered by Razorpay Test Mode.
                        </p>
                      </div>

                      <div className="shrink-0 text-lg font-black text-[#8a680c] sm:text-xl">
                        ₹199
                      </div>
                    </div>
                  </div>
                )}

                {/* REGISTER */}

                <button
                  type="button"
                  onClick={
                    registerStudent
                  }
                  disabled={
                    loading ||
                    paymentLoading ||
                    !otpVerified
                  }
                  className="min-h-12 w-full rounded-xl bg-[#1557d6] px-4 py-3.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(21,87,214,.18)] transition hover:bg-[#124bb8] disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:rounded-2xl sm:py-4"
                >
                  {paymentLoading
                    ? paymentStatus ||
                      "⏳ Processing Payment..."
                    : loading
                    ? "⏳ Completing Registration..."
                    : !otpVerified
                    ? "🔒 Verify Mobile First"
                    : "💳 Pay ₹199 & Create SBC Account →"}
                </button>

                {/* LOGIN */}

                <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3 text-center text-xs text-slate-500 sm:rounded-2xl sm:p-4 sm:text-sm">

                  Already have an account?{" "}

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/student/login"
                      )
                    }
                    className="font-black text-[#a37b0d] hover:text-[#07111f] hover:underline"
                  >
                    Login
                  </button>

                </div>

              </div>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:mt-7 sm:pt-5 sm:text-[10px]">
                <span>
                  Student Benefit Card
                </span>

                <span className="text-[#a37b0d]">
                  SBC • 2026
                </span>
              </div>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}
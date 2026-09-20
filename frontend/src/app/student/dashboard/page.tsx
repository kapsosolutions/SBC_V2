"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import QRCode from "react-qr-code";
import StudentScanRedeem from "@/components/StudentScanRedeem";

import { auth, db } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";
import { enableStudentNotifications } from "@/lib/firebase-messaging";

import {
  getMessaging,
  onMessage,
} from "firebase/messaging";

import { getApp } from "firebase/app";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

interface Student {
  uid: string;
  fullName?: string;
  cardNumber?: string;
  college?: string;
  course?: string;
  year?: string;
  mobile?: string;
  email?: string;
  status?: string;
  points?: number;
  referralCode?: string;
  successfulReferrals?: number;
  pendingReferrals?: number;
  referralRewardUnlocked?: boolean;

  // Server-authoritative SBC membership fields
  membershipStatus?: "active" | "expired" | string;
  membershipStartDate?: string;
  membershipExpiryDate?: string;
  membershipPlan?: string;
  lastMembershipPaymentId?: string;
  lastMembershipOrderId?: string;
}

export default function StudentDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [error, setError] = useState("");

  // Notification setup UI
  const [showNotificationPrompt, setShowNotificationPrompt] =
    useState(false);

  const [notificationEnabling, setNotificationEnabling] =
    useState(false);

  const [notificationError, setNotificationError] =
    useState("");

  const [notificationsReady, setNotificationsReady] =
    useState(false);

  /* Cumulative points */
  const [totalPoints, setTotalPoints] = useState(0);

  const referralCode = student?.referralCode || "";
  const scanRedeemRef = useRef<HTMLDivElement | null>(null);

  // Referral payout wallet
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutRequesting, setPayoutRequesting] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("250");
  const [payoutMethod, setPayoutMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [payoutWallet, setPayoutWallet] = useState({
    successfulReferrals: 0,
    totalEarned: 0,
    paidAmount: 0,
    pendingPayout: 0,
    available: 0,
  });

  /*
   * ==========================================
   * SESSION CACHE
   * ==========================================
   */

  const getCacheKey = (uid: string) => {
    return `sbc_student_dashboard_${uid}`;
  };

  /*
   * ==========================================
   * SAVE STUDENT CACHE
   * ==========================================
   */

  const saveStudentToCache = (studentData: Student) => {
    try {
      if (typeof window === "undefined") {
        return;
      }

      sessionStorage.setItem(
        getCacheKey(studentData.uid),
        JSON.stringify(studentData)
      );

      console.log(
        "✅ Student saved to session cache."
      );
    } catch (error) {
      console.error(
        "Student cache save error:",
        error
      );
    }
  };

  /*
   * ==========================================
   * LOAD STUDENT CACHE
   * ==========================================
   */

  const loadStudentFromCache = (
    uid: string
  ): Student | null => {
    try {
      if (typeof window === "undefined") {
        return null;
      }

      const cached =
        sessionStorage.getItem(
          getCacheKey(uid)
        );

      if (!cached) {
        return null;
      }

      const parsed =
        JSON.parse(cached) as Student;

      if (!parsed || !parsed.uid) {
        return null;
      }

      if (parsed.uid !== uid) {
        console.warn(
          "Cached student UID does not match current auth UID."
        );

        return null;
      }

      return parsed;
    } catch (error) {
      console.error(
        "Student cache read error:",
        error
      );

      return null;
    }
  };

  /*
   * ==========================================
   * BUILD STUDENT OBJECT
   * ==========================================
   */

  const buildStudentData = (
    data: any,
    uid: string,
    email?: string | null
  ): Student => {
    return {
      uid,

      fullName:
        data.fullName || "",

      cardNumber:
        data.cardNumber || "",

      college:
        data.college || "",

      course:
        data.course || "",

      year:
        data.year || "",

      mobile:
        data.mobile || "",

      email:
        data.email ||
        email ||
        "",

      status:
        data.status ||
        "pending",

      points:
        Number(data.points || 0),

      referralCode:
        data.referralCode || uid.slice(0, 8).toUpperCase(),

      successfulReferrals:
        Number(data.successfulReferrals || 0),

      pendingReferrals:
        Number(data.pendingReferrals || 0),

      referralRewardUnlocked:
        Boolean(data.referralRewardUnlocked || false),

      membershipStatus:
        data.membershipStatus || "",

      membershipStartDate:
        data.membershipStartDate?.toDate?.()?.toISOString?.() ||
        (typeof data.membershipStartDate === "string"
          ? data.membershipStartDate
          : ""),

      membershipExpiryDate:
        data.membershipExpiryDate?.toDate?.()?.toISOString?.() ||
        (typeof data.membershipExpiryDate === "string"
          ? data.membershipExpiryDate
          : ""),

      membershipPlan:
        data.membershipPlan || "",

      lastMembershipPaymentId:
        data.lastMembershipPaymentId || "",

      lastMembershipOrderId:
        data.lastMembershipOrderId || "",
    };
  };

  /*
   * ==========================================
   * APPLY STUDENT
   * ==========================================
   */

  const applyStudent = (
    studentData: Student
  ) => {
    setStudent(studentData);
    setError("");

    saveStudentToCache(
      studentData
    );
  };

  /*
   * ==========================================
   * LOAD STUDENT REWARD POINTS
   * ==========================================
   */

  const loadStudentPoints = async (
    authUid: string
  ): Promise<string> => {
    try {
      /*
       * IMPORTANT:
       * Do not choose the highest duplicate studentPoints
       * document. The points document must belong to the
       * same student document used for the student profile.
       */

      let pointsDocumentId = authUid;

      try {
        const studentUidQuery =
          query(
            collection(
              db,
              "students"
            ),
            where(
              "uid",
              "==",
              authUid
            )
          );

        const studentUidSnap =
          await getDocs(
            studentUidQuery
          );

        /*
         * Prefer the complete student profile document.
         * This prevents an incomplete duplicate record from
         * being used just because it appears first.
         */
        const completeStudentDoc =
          studentUidSnap.docs.find(
            (studentDoc) => {
              const data =
                studentDoc.data();

              return Boolean(
                data.fullName &&
                data.cardNumber
              );
            }
          );

        if (completeStudentDoc) {
          pointsDocumentId =
            completeStudentDoc.id;
        } else if (
          studentUidSnap.docs.length > 0
        ) {
          pointsDocumentId =
            studentUidSnap.docs[0].id;
        }
      } catch (
        studentLookupError
      ) {
        console.error(
          "Student document ID lookup for points failed:",
          studentLookupError
        );
      }

      const pointsSnap =
        await getDoc(
          doc(
            db,
            "studentPoints",
            pointsDocumentId
          )
        );

      const storedPoints =
        pointsSnap.exists()
          ? Number(
              pointsSnap.data()
                .totalPoints || 0
            )
          : 0;

      setTotalPoints(
        storedPoints
      );

      setStudent(
        (current) => {
          if (!current) {
            return current;
          }

          const updated = {
            ...current,
            points: storedPoints,
          };

          saveStudentToCache(
            updated
          );

          return updated;
        }
      );

      console.log(
        "⭐ FINAL STUDENT POINTS:",
        {
          authUid,
          pointsDocument:
            pointsDocumentId,
          totalPoints:
            storedPoints,
        }
      );

      return pointsDocumentId;
    } catch (error) {
      console.error(
        "Student points load error:",
        error
      );

      return authUid;
    }
  };

  /*
   * ==========================================
   * LOAD STUDENT
   * ==========================================
   */

  const loadStudent = async (
    uid: string,
    email?: string | null
  ): Promise<boolean> => {

    /*
     * METHOD 1
     * students/{uid}
     */

    try {
      const studentRef =
        doc(
          db,
          "students",
          uid
        );

      const snap =
        await getDoc(
          studentRef
        );

      console.log(
        "Direct student document:",
        {
          id: snap.id,
          exists:
            snap.exists(),
          uid,
          email,
        }
      );

      if (
        snap.exists()
      ) {
        const data =
          snap.data();

        /*
         * If a duplicate document exists at students/{uid}
         * but does not contain the actual student profile,
         * continue to the UID-field lookup below.
         */
        if (
          data.fullName &&
          data.cardNumber
        ) {
          const studentData =
            buildStudentData(
              data,
              uid,
              email
            );

          console.log(
            "✅ STUDENT FOUND BY DOCUMENT ID"
          );

          applyStudent(
            studentData
          );

          return true;
        }

        console.warn(
          "⚠️ Direct student document is incomplete. Continuing with UID-field lookup."
        );
      }
    } catch (error) {
      console.error(
        "Direct student document error:",
        error
      );
    }

    /*
     * METHOD 2
     * students where uid == auth.uid
     */

    try {
      const uidQuery =
        query(
          collection(
            db,
            "students"
          ),
          where(
            "uid",
            "==",
            uid
          )
        );

      const uidSnap =
        await getDocs(
          uidQuery
        );

      console.log(
        "Student UID query:",
        {
          empty:
            uidSnap.empty,
          size:
            uidSnap.size,
        }
      );

      if (
        !uidSnap.empty
      ) {
        const studentDoc =
          uidSnap.docs.find(
            (doc) => {
              const data =
                doc.data();

              return Boolean(
                data.fullName &&
                data.cardNumber
              );
            }
          ) || uidSnap.docs[0];

        const data =
          studentDoc.data();

        const studentData =
          buildStudentData(
            data,
            studentDoc.id,
            email
          );

        if (
          data.uid &&
          data.uid !== uid
        ) {
          console.warn(
            "Student UID mismatch. Rejecting record."
          );

          return false;
        }

        console.log(
          "✅ STUDENT FOUND BY UID FIELD"
        );

        applyStudent(
          studentData
        );

        return true;
      }
    } catch (error) {
      console.error(
        "Student UID query error:",
        error
      );
    }

    /*
     * METHOD 3
     * Search by email
     */

    if (email) {
      try {
        const emailQuery =
          query(
            collection(
              db,
              "students"
            ),
            where(
              "email",
              "==",
              email
            )
          );

        const emailSnap =
          await getDocs(
            emailQuery
          );

        console.log(
          "Student email query:",
          {
            empty:
              emailSnap.empty,
            size:
              emailSnap.size,
          }
        );

        if (
          !emailSnap.empty
        ) {
          const studentDoc =
            emailSnap.docs[0];

          const data =
            studentDoc.data();

          if (
            data.uid &&
            data.uid !== uid
          ) {
            console.warn(
              "Email matched another student's UID. Rejecting."
            );

            return false;
          }

          const studentData =
            buildStudentData(
              data,
              studentDoc.id,
              email
            );

          console.log(
            "✅ STUDENT FOUND BY EMAIL"
          );

          applyStudent(
            studentData
          );

          return true;
        }
      } catch (error) {
        console.error(
          "Student email query error:",
          error
        );
      }
    }

    console.warn(
      "❌ AUTH USER IS NOT A VALID STUDENT:",
      {
        uid,
        email,
      }
    );

    return false;
  };

  /*
   * ==========================================
   * FORCE STUDENT LOGIN
   * ==========================================
   */

  const redirectToStudentLogin =
    async () => {
      try {
        console.warn(
          "⚠️ Current account is not a student. Redirecting to student login."
        );

        await signOut(
          auth
        );
      } catch (error) {
        console.error(
          "Sign out during student guard failed:",
          error
        );
      } finally {
        router.replace(
          "/student/login"
        );
      }
    };

  /*
   * ==========================================
   * FOREGROUND NOTIFICATION LISTENER
   * ==========================================
   *
   * This handles notifications while the
   * SBC website is OPEN.
   *
   * Screen OFF / background:
   * firebase-messaging-sw.js handles it.
   *
   * Website OPEN:
   * onMessage() receives the message here.
   */

  useEffect(() => {
    if (
      !notificationsReady
    ) {
      return;
    }

    let unsubscribe:
      | (() => void)
      | undefined;

    const startForegroundListener =
      async () => {
        try {
          if (
            typeof window ===
            "undefined"
          ) {
            return;
          }

          if (
            !("Notification" in window)
          ) {
            console.log(
              "🔔 Browser does not support notifications."
            );

            return;
          }

          if (
            Notification.permission !==
            "granted"
          ) {
            console.log(
              "🔔 Notification permission is not granted."
            );

            return;
          }

          /*
           * Firebase Messaging
           */

          const app =
            getApp();

          const messaging =
            getMessaging(
              app
            );

          /*
           * FOREGROUND FCM
           */

          unsubscribe =
            onMessage(
              messaging,
              async (
                payload
              ) => {
                console.log(
                  "🔔 SBC FOREGROUND FCM MESSAGE RECEIVED:",
                  payload
                );

                const title =
                  payload
                    .notification
                    ?.title ||
                  payload
                    .data
                    ?.title ||
                  "SBC Notification";

                const body =
                  payload
                    .notification
                    ?.body ||
                  payload
                    .data
                    ?.body ||
                  "";

                const url =
                  payload
                    .data
                    ?.url ||
                  "/student/dashboard";

                try {
                  /*
                   * Use the existing
                   * Firebase service worker.
                   */

                  const registration =
                    await navigator
                      .serviceWorker
                      .ready;

                  await registration.showNotification(
                    title,
                    {
                      body,

                      icon:
                        "/icon-192.png",

                      badge:
                        "/icon-192.png",

                      data: {
                        url,
                      },

                      requireInteraction:
                        false,
                    }
                  );

                  console.log(
                    "✅ SBC foreground notification displayed."
                  );
                } catch (
                  notificationError
                ) {
                  console.error(
                    "❌ Foreground notification display failed:",
                    notificationError
                  );

                  /*
                   * Browser fallback
                   */

                  try {
                    new Notification(
                      title,
                      {
                        body,

                        icon:
                          "/icon-192.png",
                      }
                    );

                    console.log(
                      "✅ Browser notification fallback displayed."
                    );
                  } catch (
                    fallbackError
                  ) {
                    console.error(
                      "❌ Notification fallback failed:",
                      fallbackError
                    );
                  }
                }
              }
            );

          console.log(
            "✅ SBC foreground FCM listener started."
          );
        } catch (error) {
          console.error(
            "❌ SBC foreground notification listener setup failed:",
            error
          );
        }
      };

    startForegroundListener();

    return () => {
      if (
        unsubscribe
      ) {
        unsubscribe();
        unsubscribe =
          undefined;
      }

      console.log(
        "🔕 SBC foreground FCM listener removed."
      );
    };
  }, [
    notificationsReady,
  ]);

  /*
   * ==========================================
   * SBC NOTIFICATION PROMPT
   * ==========================================
   */

  const prepareNotificationPrompt =
    async (
      uid: string
    ) => {
      try {
        if (
          typeof window ===
          "undefined"
        ) {
          return;
        }

        if (
          !("Notification" in window)
        ) {
          console.log(
            "Browser does not support notifications."
          );

          return;
        }

        const enabledKey =
          `sbc_notifications_enabled_${uid}`;

        const permanentlyEnabled =
          localStorage.getItem(
            enabledKey
          );

        /*
         * Already enabled:
         *
         * Start foreground listener too.
         */

        if (
          permanentlyEnabled ===
          "true"
        ) {
          console.log(
            "🔔 SBC notifications already enabled."
          );

          if (
            Notification.permission ===
            "granted"
          ) {
            try {
              await enableStudentNotifications();

              setNotificationsReady(
                true
              );

              console.log(
                "✅ SBC notification token refreshed."
              );
            } catch (
              error
            ) {
              console.error(
                "Unable to refresh notification token:",
                error
              );
            }
          }

          return;
        }

        /*
         * Permission already granted:
         */

        if (
          Notification.permission ===
          "granted"
        ) {
          try {
            await enableStudentNotifications();

            localStorage.setItem(
              enabledKey,
              "true"
            );

            setNotificationsReady(
              true
            );

            console.log(
              "✅ Browser notification permission already granted."
            );
          } catch (
            error
          ) {
            console.error(
              "Unable to refresh notification token:",
              error
            );
          }

          return;
        }

        /*
         * Popup once per login session.
         */

        const sessionPromptKey =
          `sbc_notification_prompt_shown_${uid}`;

        const alreadyShownThisLogin =
          sessionStorage.getItem(
            sessionPromptKey
          );

        if (
          alreadyShownThisLogin ===
          "true"
        ) {
          console.log(
            "🔔 Notification popup already shown in this login session."
          );

          return;
        }

        sessionStorage.setItem(
          sessionPromptKey,
          "true"
        );

        setNotificationError(
          ""
        );

        setShowNotificationPrompt(
          true
        );
      } catch (error) {
        console.error(
          "Notification setup preparation error:",
          error
        );
      }
    };

  /*
   * ==========================================
   * ENABLE NOTIFICATIONS
   * ==========================================
   */

  const handleEnableNotifications =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        setNotificationError(
          "Please login again and try."
        );

        return;
      }

      try {
        setNotificationEnabling(
          true
        );

        setNotificationError(
          ""
        );

        /*
         * If the user previously BLOCKED notifications at the browser
         * level, the permission prompt will not reappear. Guide them to
         * re-enable it manually instead of silently hanging.
         */
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "denied"
        ) {
          throw new Error(
            "Notifications are blocked in your browser. Please allow notifications for this site in your browser settings, then try again."
          );
        }

        /*
         * Must be directly triggered by button click.
         *
         * Guard against a hung FCM / service-worker call so the button
         * never gets stuck on "Enabling Notifications...".
         */
        const token = await Promise.race([
          enableStudentNotifications(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Enabling notifications timed out. Please check your connection and try again."
                  )
                ),
              30000
            )
          ),
        ]);

        if (!token) {
          throw new Error(
            "FCM token was not generated."
          );
        }

        localStorage.setItem(
          `sbc_notifications_enabled_${user.uid}`,
          "true"
        );

        /*
         * Start foreground
         * notification listener.
         */

        setNotificationsReady(
          true
        );

        setShowNotificationPrompt(
          false
        );

        console.log(
          "✅ SBC notifications enabled successfully."
        );
      } catch (error) {
        console.error(
          "Notification enable failed:",
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : "Unable to enable notifications.";

        setNotificationError(
          message
        );
      } finally {
        setNotificationEnabling(
          false
        );
      }
    };

  /*
   * ==========================================
   * NOTIFICATION CANCEL
   * ==========================================
   */

  const handleNotificationCancel =
    () => {
      setShowNotificationPrompt(
        false
      );
    };

  /*
   * ==========================================
   * AUTH + STUDENT GUARD
   * ==========================================
   */

  useEffect(() => {
    let mounted = true;

    let unsubscribePoints:
      | (() => void)
      | null = null;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          user
        ) => {
          if (!mounted) {
            return;
          }

          /*
           * NOT LOGGED IN
           */

          if (!user) {
            setStudent(
              null
            );

            setNotificationsReady(
              false
            );

            setLoading(
              false
            );

            router.replace(
              "/student/login"
            );

            return;
          }

          console.log(
            "================================"
          );

          console.log(
            "STUDENT PAGE AUTH USER:",
            {
              uid:
                user.uid,
              email:
                user.email,
            }
          );

          /*
           * CHECK CACHE
           */

          const cachedStudent =
            loadStudentFromCache(
              user.uid
            );

          if (
            cachedStudent
          ) {
            setStudent(
              cachedStudent
            );

            setError(
              ""
            );

            setLoading(
              false
            );

            console.log(
              "✅ Showing cached student dashboard."
            );
          } else {
            setLoading(
              true
            );

            setError(
              ""
            );
          }

          /*
           * VERIFY STUDENT
           */

          const success =
            await loadStudent(
              user.uid,
              user.email
            );

          if (!mounted) {
            return;
          }

          /*
           * INVALID ACCOUNT
           */

          if (!success) {
            console.warn(
              "❌ This authenticated account is not a valid SBC student."
            );

            setStudent(
              null
            );

            setNotificationsReady(
              false
            );

            setLoading(
              false
            );

            await redirectToStudentLogin();

            return;
          }

          /*
           * LOAD POINTS
           */

          const pointsDocumentId =
            await loadStudentPoints(
              user.uid
            );

          if (!mounted) {
            return;
          }

          if (
            unsubscribePoints
          ) {
            unsubscribePoints();

            unsubscribePoints =
              null;
          }

          /*
           * REAL-TIME POINTS
           */

          unsubscribePoints =
            onSnapshot(
              doc(
                db,
                "studentPoints",
                pointsDocumentId
              ),
              (
                pointsSnap
              ) => {
                if (
                  !mounted
                ) {
                  return;
                }

                const latestTotalPoints =
                  pointsSnap.exists()
                    ? Number(
                        pointsSnap.data()
                          .totalPoints ||
                          0
                      )
                    : 0;

                setTotalPoints(
                  latestTotalPoints
                );

                setStudent(
                  (
                    current
                  ) => {
                    if (
                      !current
                    ) {
                      return current;
                    }

                    const updated =
                      {
                        ...current,
                        points:
                          latestTotalPoints,
                      };

                    saveStudentToCache(
                      updated
                    );

                    return updated;
                  }
                );

                console.log(
                  "⭐ STUDENT DASHBOARD REAL-TIME TOTAL POINTS:",
                  latestTotalPoints
                );
              },
              (
                pointsError
              ) => {
                console.error(
                  "Student points listener error:",
                  pointsError
                );
              }
            );

          /*
           * DASHBOARD READY
           */

          setLoading(
            false
          );

          /*
           * Notification setup
           */

          prepareNotificationPrompt(
            user.uid
          ).catch(
            (
              notificationSetupError
            ) =>
              console.error(
                "Notification setup error:",
                notificationSetupError
              )
          );
        }
      );

    return () => {
      mounted = false;

      unsubscribe();

      if (
        unsubscribePoints
      ) {
        unsubscribePoints();

        unsubscribePoints =
          null;
      }
    };
  }, [
    router,
  ]);

  useEffect(() => {
    if (!student) return;

    loadPayoutWallet(true).catch((error) => {
      console.error("Initial payout wallet load failed:", error);
    });
  }, [student?.uid]);

  /*
   * ==========================================
   * MEMBERSHIP
   * ==========================================
   *
   * Membership validity is determined from the server-authoritative
   * membershipExpiryDate. We do not trust membershipStatus alone.
   */

  const membershipExpiry = student?.membershipExpiryDate
    ? new Date(student.membershipExpiryDate)
    : null;

  const membershipStart = student?.membershipStartDate
    ? new Date(student.membershipStartDate)
    : null;

  const membershipDateIsValid =
    Boolean(
      membershipExpiry &&
      !Number.isNaN(membershipExpiry.getTime())
    );

  const membershipIsActive =
    membershipDateIsValid &&
    membershipExpiry!.getTime() > Date.now();

  const membershipIsExpired =
    membershipDateIsValid &&
    membershipExpiry!.getTime() <= Date.now();


  /*
   * ==========================================
   * OPEN SCANNER FROM MOBILE NAV
   * ==========================================
   *
   * When Offers → Scan & Redeem navigates here with
   * ?open=scan, trigger the same existing hidden
   * StudentScanRedeem button used by this dashboard.
   */
  useEffect(() => {
    if (!student || !membershipIsActive) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("open") !== "scan") return;

    const timer = window.setTimeout(() => {
      const scanButton = scanRedeemRef.current?.querySelector("button");

      if (scanButton) {
        scanButton.click();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${window.location.hash}`
        );
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [student?.uid, membershipIsActive]);

  const formatMembershipDate = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renewMembership = () => {
    router.push("/student/renew");
  };

  /*
   * ==========================================
   * LOGOUT
   * ==========================================
   */

  const logout =
    async () => {
      try {
        const user =
          auth.currentUser;

        if (user) {
          const sessionPromptKey =
            `sbc_notification_prompt_shown_${user.uid}`;

          sessionStorage.removeItem(
            sessionPromptKey
          );
        }

        setNotificationsReady(
          false
        );

        await signOut(
          auth
        );

        router.replace(
          "/student/login"
        );
      } catch (error) {
        console.error(
          "Logout error:",
          error
        );
      }
    };

  /*
   * ==========================================
   * RETRY
   * ==========================================
   */

  const retryLoading =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        router.replace(
          "/student/login"
        );

        return;
      }

      setLoading(
        true
      );

      setError(
        ""
      );

      const cachedStudent =
        loadStudentFromCache(
          user.uid
        );

      if (
        cachedStudent
      ) {
        setStudent(
          cachedStudent
        );

        setLoading(
          false
        );
      }

      const success =
        await loadStudent(
          user.uid,
          user.email
        );

      if (!success) {
        if (
          cachedStudent
        ) {
          setStudent(
            cachedStudent
          );

          setError(
            ""
          );

          setLoading(
            false
          );

          return;
        }

        await redirectToStudentLogin();

        return;
      }

      await loadStudentPoints(
        user.uid
      );

      setLoading(
        false
      );

      /*
       * Re-enable foreground
       * notification listener.
       */

      if (
        Notification.permission ===
        "granted"
      ) {
        setNotificationsReady(
          true
        );
      }
    };

  /*
   * ==========================================
   * REFERRAL PAYOUT WALLET
   * ==========================================
   */

  const getAuthenticatedHeaders = async (): Promise<Record<string, string>> => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Please login again and try.");
    }

    const token = await user.getIdToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const loadPayoutWallet = async (silent = false) => {
    try {
      if (!silent) setPayoutLoading(true);
      setPayoutError("");

      const headers = await getAuthenticatedHeaders();

      // Recover any already-paid referrals that may not have been processed
      // at the time the referred student completed payment.
      await fetch(`${API_BASE_URL}/api/referral/reconcile`, {
        method: "POST",
        headers,
      }).catch(() => null);

      const response = await fetch(`${API_BASE_URL}/api/payout/history`, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load referral payout wallet.");
      }

      const wallet = data.wallet || {};
      setPayoutWallet({
        successfulReferrals: Number(wallet.successfulReferrals || 0),
        totalEarned: Number(wallet.totalEarned || 0),
        paidAmount: Number(wallet.paidAmount || 0),
        pendingPayout: Number(wallet.pendingPayout || 0),
        available: Number(wallet.available || 0),
      });
      setPayoutHistory(Array.isArray(data.history) ? data.history : []);

      // Keep the referral card in sync with the server-side wallet.
      setStudent((current) => {
        if (!current) return current;
        const updated = {
          ...current,
          successfulReferrals: Number(wallet.successfulReferrals || 0),
          referralRewardUnlocked: Number(wallet.successfulReferrals || 0) >= 10,
        };
        saveStudentToCache(updated);
        return updated;
      });
    } catch (error) {
      console.error("Payout wallet load error:", error);
      if (!silent) {
        setPayoutError(
          error instanceof Error
            ? error.message
            : "Unable to load referral payout wallet."
        );
      }
    } finally {
      if (!silent) setPayoutLoading(false);
    }
  };

  const openPayoutModal = () => {
    setPayoutError("");
    setPayoutSuccess("");
    setPayoutAmount(
      String(
        Math.max(
          250,
          payoutWallet.available >= 250 ? 250 : payoutWallet.available
        )
      )
    );
    setShowPayoutModal(true);
  };

  const getReferralLink = () => {
    if (typeof window === "undefined" || !referralCode) return "";
    return `${window.location.origin}/student/register?ref=${encodeURIComponent(referralCode)}`;
  };

  const copyReferralLink = async () => {
    const link = getReferralLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setPayoutSuccess("Referral link copied successfully.");
      setPayoutError("");
    } catch (error) {
      console.error("Referral link copy failed:", error);
      setPayoutError("Unable to copy referral link. Please copy it manually.");
      setPayoutSuccess("");
    }
  };

  const shareReferralLink = async () => {
    const link = getReferralLink();
    if (!link) return;

    const shareText = `Join Student Benefit Card (SBC) using my referral link and unlock student benefits: ${link}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Student Benefit Card - SBC",
          text: "Join Student Benefit Card using my referral link.",
          url: link,
        });
        return;
      }

      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      console.error("Referral sharing failed:", error);
      setPayoutError("Unable to share the referral link right now.");
      setPayoutSuccess("");
    }
  };

  const submitPayoutRequest = async () => {
    try {
      setPayoutRequesting(true);
      setPayoutError("");
      setPayoutSuccess("");

      const amount = Number(payoutAmount);

      if (!Number.isInteger(amount) || amount < 250) {
        throw new Error("Minimum payout request is ₹250.");
      }

      if (amount > payoutWallet.available) {
        throw new Error(
          `Available payout balance is ₹${payoutWallet.available.toLocaleString()}.`
        );
      }

      if (payoutMethod === "upi" && !upiId.trim()) {
        throw new Error("Please enter your UPI ID.");
      }

      if (
        payoutMethod === "bank" &&
        (!accountHolderName.trim() ||
          !accountNumber.trim() ||
          !ifsc.trim())
      ) {
        throw new Error("Please enter complete bank details.");
      }

      const headers = await getAuthenticatedHeaders();

      const response = await fetch(`${API_BASE_URL}/api/payout/request`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount,
          method: payoutMethod,
          upiId: payoutMethod === "upi" ? upiId.trim() : "",
          accountHolderName:
            payoutMethod === "bank" ? accountHolderName.trim() : "",
          accountNumber:
            payoutMethod === "bank" ? accountNumber.trim() : "",
          ifsc: payoutMethod === "bank" ? ifsc.trim().toUpperCase() : "",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to submit payout request.");
      }

      setPayoutSuccess(
        `Payout request for ₹${amount.toLocaleString()} submitted successfully.`
      );
      setShowPayoutModal(false);
      await loadPayoutWallet(true);
    } catch (error) {
      console.error("Payout request error:", error);
      setPayoutError(
        error instanceof Error
          ? error.message
          : "Unable to submit payout request."
      );
    } finally {
      setPayoutRequesting(false);
    }
  };

  /*
   * ==========================================
   * LOADING SCREEN
   * ==========================================
   */

  if (
    loading &&
    !student
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">

        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-xl">

          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />

          <h2 className="text-2xl font-bold text-blue-700">
            Loading Student Dashboard...
          </h2>

          <p className="mt-2 text-gray-500">
            Please wait...
          </p>

        </div>

      </main>
    );
  }

  /*
   * ==========================================
   * STUDENT NOT AVAILABLE
   * ==========================================
   */

  if (!student) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">

        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
            ⚠️
          </div>

          <h2 className="mt-5 text-2xl font-bold text-red-600">
            Student Details Not Available
          </h2>

          <p className="mt-3 text-gray-600">
            {error ||
              "We could not load your SBC student details."}
          </p>

          <button
            onClick={
              retryLoading
            }
            className="mt-6 w-full rounded-xl bg-blue-600 py-4 font-bold text-white transition hover:bg-blue-700"
          >
            🔄 Try Again
          </button>

          <button
            onClick={
              logout
            }
            className="mt-3 w-full rounded-xl bg-red-600 py-4 font-bold text-white transition hover:bg-red-700"
          >
            Logout
          </button>

        </div>

      </main>
    );
  }

  /*
   * ==========================================
   * QR DATA
   * ==========================================
   */

  const qrValue =
    JSON.stringify({
      studentId:
        student.uid,

      cardNumber:
        student.cardNumber ||
        "",

      type: "student",
    });

  /*
   * ==========================================
   * PREMIUM SBC DASHBOARD UI
   * ==========================================
   */

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-slate-900">

      {showNotificationPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07111f]/70 p-5 backdrop-blur-sm">

          <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_100px_rgba(7,17,31,0.35)]">

            <div className="bg-gradient-to-br from-[#07111f] via-[#111827] to-[#5f4700] px-7 py-8 text-white">

              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4af37]/50 bg-[#d4af37]/10 text-2xl">
                🔔
              </div>

              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f1cf63]">
                Student Benefit Card
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Stay Updated with SBC
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/70">
                Get new offers, important announcements and SBC updates directly on your device.
              </p>

            </div>

            <div className="p-7">

              <div className="rounded-2xl border border-[#d4af37]/20 bg-[#fbfaf6] p-4">

                <p className="text-sm font-bold text-[#07111f]">
                  🔔 Enable notifications
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Tap Enable below. Chrome will then ask for notification permission.
                </p>

              </div>

              {notificationError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {notificationError}
                </div>
              )}

              <button
                type="button"
                onClick={
                  handleEnableNotifications
                }
                disabled={
                  notificationEnabling
                }
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#b98a16] via-[#d4af37] to-[#f1cf63] px-5 py-4 text-sm font-black text-[#07111f] shadow-lg transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {notificationEnabling
                  ? "Enabling Notifications..."
                  : "🔔 Enable Notifications"}
              </button>

              <button
                type="button"
                onClick={
                  handleNotificationCancel
                }
                disabled={
                  notificationEnabling
                }
                className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Maybe Later
              </button>

            </div>

          </div>

        </div>
      )}

      {/* TOP NAV */}

      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#07111f]/95 text-white backdrop-blur-xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d4af37]/50 bg-[#d4af37]/10 text-lg font-black text-[#f1cf63] shadow-[0_0_30px_rgba(212,175,55,0.12)]">
              SBC
            </div>

            <div>

              <p className="break-words text-xs font-black uppercase tracking-[0.18em] text-[#FFD700] sm:text-[15px] sm:tracking-[0.25em]">
                Student Benefit Card
              </p>

              <p className="text-xs font-medium text-white/70 sm:text-sm">
                Premium Student Dashboard
              </p>

            </div>

          </div>

          <button
            onClick={
              logout
            }
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/10 hover:text-[#f1cf63]"
          >
            Logout
          </button>

        </div>

      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[2rem] bg-[#07111f] p-6 text-white shadow-[0_25px_80px_rgba(7,17,31,0.20)] sm:p-8 lg:p-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative grid gap-7 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
            <div className="flex flex-col justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                ✦ Verified SBC Student
              </div>
              <p className="mt-7 text-sm font-semibold text-white/45">Welcome back,</p>
              <h1 className="mt-1 break-words text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-[#f1cf63]">{student.fullName || "Student"}</span>
                <span className="ml-2">👋</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
                Your SBC card unlocks exclusive student benefits, partner offers and reward points.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">
                  Card {student.cardNumber || "—"}
                </span>
                <span className={`rounded-full px-4 py-2 text-sm font-black ${membershipIsActive ? "bg-emerald-400/10 text-emerald-300" : membershipIsExpired ? "bg-red-400/10 text-red-300" : "bg-amber-400/10 text-amber-300"}`}>
                  ● {membershipIsActive ? "MEMBERSHIP ACTIVE" : membershipIsExpired ? "MEMBERSHIP EXPIRED" : "MEMBERSHIP STATUS UNAVAILABLE"}
                </span>
              </div>
            </div>

            {/* DESKTOP QUICK ACTIONS */}
            <div className="hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 md:flex md:flex-col md:justify-center">
              <div className="grid gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const scanButton = scanRedeemRef.current?.querySelector("button");
                    if (scanButton) scanButton.click();
                  }}
                  disabled={!membershipIsActive}
                  className={`group rounded-2xl border p-5 text-left transition ${
                    membershipIsActive
                      ? "border-[#d4af37]/30 bg-[#d4af37]/10 hover:border-[#d4af37]/60 hover:bg-[#d4af37]/15"
                      : "cursor-not-allowed border-white/10 bg-white/[0.03] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                        Scan at Business
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-white">
                        📷 Scan & Redeem
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-white/55">
                        Scan a business QR and redeem an active SBC offer.
                      </p>
                    </div>
                    <span className="rounded-xl bg-[#d4af37] px-4 py-3 text-sm font-black text-[#07111f] transition group-hover:bg-[#f1cf63]">
                      Scan QR →
                    </span>
                  </div>
                </button>

                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => router.push("/student/offers")}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-left transition hover:border-[#d4af37]/40 hover:bg-[#d4af37]/10"
                  >
                    <span className="text-2xl">🎁</span>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                      SBC Benefits
                    </p>
                    <h3 className="mt-1 text-xl font-black text-white">
                      Explore Offers
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-white/50">
                      Discover exclusive discounts from verified partners.
                    </p>
                    <span className="mt-4 inline-flex rounded-lg bg-[#d4af37] px-4 py-2 text-xs font-black text-[#07111f]">
                      Explore Offers →
                    </span>
                  </button>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                      Reward Points
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-4xl font-black text-[#f1cf63]">
                        {totalPoints.toLocaleString()}
                      </span>
                      <span className="pb-1 text-sm font-bold text-white/50">
                        / 1000
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#d4af37] transition-all"
                        style={{
                          width: `${Math.min(100, (totalPoints / 1000) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-white/55">
                      {Math.max(0, 1000 - totalPoints).toLocaleString()} points to get Surprise Gift 🎁
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* MOBILE REWARD POINTS */}
        <section className="mt-7 md:hidden">
          <div className="rounded-[2rem] border border-[#d4af37]/25 bg-[#07111f] p-6 text-white shadow-[0_20px_60px_rgba(7,17,31,0.14)]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
              Reward Points
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black text-[#f1cf63]">
                {totalPoints.toLocaleString()}
              </span>
              <span className="pb-1 text-sm font-bold text-white/50">
                / 1000
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#d4af37] transition-all"
                style={{
                  width: `${Math.min(100, (totalPoints / 1000) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-3 text-xs font-semibold text-white/55">
              {Math.max(0, 1000 - totalPoints).toLocaleString()} points to get Surprise Gift 🎁
            </p>
          </div>
        </section>

        {/* REFERRAL MARKETING */}

        <section id="referral" className="mt-7">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#d4af37]/25 bg-gradient-to-br from-[#07111f] via-[#101b2b] to-[#17243a] p-7 text-white shadow-[0_20px_60px_rgba(7,17,31,0.14)] sm:p-9">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#d4af37]/10 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative grid gap-7 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                  🎁 SBC Referral Program
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                  Refer Friends. Grow Your SBC Rewards.
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
                  Share your personal referral link with friends and help more students join the SBC community. Your referral activity and rewards are tracked automatically.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      Your Code
                    </p>
                    <p className="mt-2 break-all text-lg font-black tracking-wider text-[#f1cf63]">
                      {referralCode || "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      Successful
                    </p>
                    <p className="mt-2 text-2xl font-black text-white">
                      {payoutWallet.successfulReferrals.toLocaleString()}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      Available Reward
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#f1cf63]">
                      ₹{payoutWallet.available.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* REFERRAL PROGRESS */}
                <div className="mt-6 rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#f1cf63]">
                        Refer & Earn ₹250
                      </p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {Math.min(10, payoutWallet.successfulReferrals)} / 10 students joined
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#f1cf63]">
                        {Math.min(100, (payoutWallet.successfulReferrals / 10) * 100)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#d4af37] transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (payoutWallet.successfulReferrals / 10) * 100)}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-xs font-semibold text-white/55">
                    {payoutWallet.successfulReferrals >= 10
                      ? "🎉 10 successful referrals completed. ₹250 reward is unlocked."
                      : `${10 - payoutWallet.successfulReferrals} more successful referral${10 - payoutWallet.successfulReferrals === 1 ? "" : "s"} to unlock ₹250.`}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={shareReferralLink}
                    disabled={!referralCode}
                    className="rounded-xl bg-[#d4af37] px-6 py-3.5 text-sm font-black text-[#07111f] transition hover:bg-[#f1cf63] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    📲 Share Referral Link
                  </button>

                  <button
                    type="button"
                    onClick={copyReferralLink}
                    disabled={!referralCode}
                    className="rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-black text-white transition hover:border-[#d4af37]/50 hover:bg-[#d4af37]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    🔗 Copy Link
                  </button>

                  <button
                    type="button"
                    onClick={openPayoutModal}
                    disabled={payoutWallet.available < 250 || payoutLoading}
                    className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-6 py-3.5 text-sm font-black text-[#f1cf63] transition hover:bg-[#d4af37]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    💰 Request Payout
                  </button>
                </div>

                {(payoutSuccess || payoutError) && (
                  <div
                    className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${
                      payoutError
                        ? "border-red-300/20 bg-red-500/10 text-red-200"
                        : "border-emerald-300/20 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {payoutError || payoutSuccess}
                  </div>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                  Referral Wallet
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/55">Total earned</span>
                    <span className="font-black">₹{payoutWallet.totalEarned.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/55">Paid</span>
                    <span className="font-black">₹{payoutWallet.paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/55">Pending payout</span>
                    <span className="font-black">₹{payoutWallet.pendingPayout.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3">
                    <span className="text-sm font-bold text-[#f1cf63]">Available</span>
                    <span className="text-lg font-black text-[#f1cf63]">₹{payoutWallet.available.toLocaleString()}</span>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-white/40">
                  Minimum payout request: ₹250. Referral wallet is verified from the SBC server before payout requests are submitted.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PAYOUT MODAL */}
        {showPayoutModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#07111f]/75 p-5 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[2rem] bg-white p-7 shadow-[0_30px_100px_rgba(7,17,31,0.35)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b18a16]">Referral Wallet</p>
                  <h2 className="mt-2 text-2xl font-black text-[#07111f]">Request Payout</h2>
                  <p className="mt-2 text-sm text-slate-500">Available: ₹{payoutWallet.available.toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="rounded-full bg-slate-100 px-3 py-2 text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6">
                <label className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Amount</label>
                <input
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 font-bold outline-none focus:border-[#d4af37]"
                  placeholder="250"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPayoutMethod("upi")}
                  className={`rounded-xl border px-4 py-3 text-sm font-black ${
                    payoutMethod === "upi"
                      ? "border-[#d4af37] bg-[#d4af37]/10 text-[#8a680c]"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod("bank")}
                  className={`rounded-xl border px-4 py-3 text-sm font-black ${
                    payoutMethod === "bank"
                      ? "border-[#d4af37] bg-[#d4af37]/10 text-[#8a680c]"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  Bank
                </button>
              </div>

              {payoutMethod === "upi" ? (
                <div className="mt-5">
                  <label className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">UPI ID</label>
                  <input
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 font-semibold outline-none focus:border-[#d4af37]"
                    placeholder="name@upi"
                  />
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <input
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3.5 font-semibold outline-none focus:border-[#d4af37]"
                    placeholder="Account holder name"
                  />
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3.5 font-semibold outline-none focus:border-[#d4af37]"
                    placeholder="Account number"
                  />
                  <input
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3.5 font-semibold uppercase outline-none focus:border-[#d4af37]"
                    placeholder="IFSC code"
                  />
                </div>
              )}

              {payoutError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {payoutError}
                </div>
              )}

              <button
                type="button"
                onClick={submitPayoutRequest}
                disabled={payoutRequesting || payoutWallet.available < 250}
                className="mt-6 w-full rounded-xl bg-[#07111f] px-5 py-4 text-sm font-black text-white transition hover:bg-[#122039] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {payoutRequesting ? "Submitting..." : "Submit Payout Request"}
              </button>
            </div>
          </div>
        )}

                {/* DIGITAL CARD + MEMBERSHIP */}
        <section id="your-card" className="mt-7 grid gap-7 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#111d2d] via-[#07111f] to-[#020811] p-6 text-white shadow-[0_20px_60px_rgba(7,17,31,0.18)] sm:p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#d4af37]/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d4af37]">Digital Membership Card</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Your Digital SBC Card</h2>
              </div>
              <div className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2 text-xs font-black text-[#f1cf63]">SBC</div>
            </div>
            <div className="relative mt-7 rounded-[1.6rem] border border-[#d4af37]/25 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Student Benefit Card</p>
                  <p className="mt-2 text-xl font-black text-[#f1cf63]">More Benefits. More Savings.</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 text-lg font-black text-[#f1cf63]">SBC</div>
              </div>
              <div className="mt-8 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Card Holder</p>
                  <p className="mt-1 text-xl font-black">{student.fullName || "—"}</p>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Card Number</p>
                  <p className="mt-1 text-sm font-black tracking-wider text-white/80">{student.cardNumber || "—"}</p>
                </div>
                <div className="flex w-full justify-center sm:w-auto sm:justify-end">
                  <div className="flex items-center justify-center rounded-2xl bg-white p-3 shadow-xl">
                    <QRCode value={qrValue} size={130} />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-xs text-white/40">Verified Student Membership</span>
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#f1cf63]">SBC • 2026</span>
              </div>
            </div>
            <p className="relative mt-4 text-xs leading-5 text-white/45">Show your digital SBC card or QR when visiting an SBC Business Partner.</p>
          </div>

          <div className="rounded-[2rem] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b18a16]">Account</p>
                <h2 className="mt-2 text-2xl font-black text-[#07111f] sm:text-3xl">Membership Status</h2>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${membershipIsActive ? "bg-emerald-50 text-emerald-600" : membershipIsExpired ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                {membershipIsActive ? "✓" : membershipIsExpired ? "!" : "•"}
              </div>
            </div>
            <div className={`mt-7 rounded-[1.5rem] border p-6 ${membershipIsActive ? "border-emerald-100 bg-emerald-50" : membershipIsExpired ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Current Status</p>
                  <p className={`mt-1 text-3xl font-black ${membershipIsActive ? "text-emerald-700" : membershipIsExpired ? "text-red-700" : "text-amber-700"}`}>
                    {membershipIsActive ? "ACTIVE" : membershipIsExpired ? "EXPIRED" : "NOT AVAILABLE"}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-2 text-xs font-black ${membershipIsActive ? "bg-emerald-100 text-emerald-700" : membershipIsExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {membershipIsActive ? "✓ Valid" : membershipIsExpired ? "Renew Required" : "Check Account"}
                </span>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white/75 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Started</p><p className="mt-1 text-sm font-black text-[#07111f]">{formatMembershipDate(membershipStart)}</p></div>
                <div className="rounded-xl bg-white/75 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Valid Until</p><p className="mt-1 text-sm font-black text-[#07111f]">{formatMembershipDate(membershipExpiry)}</p></div>
                <div className="rounded-xl bg-white/75 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Plan</p><p className="mt-1 text-sm font-black text-[#07111f]">{student.membershipPlan || "Student Plan"}</p></div>
                <div className="rounded-xl bg-white/75 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Card Number</p><p className="mt-1 text-sm font-black text-[#07111f]">{student.cardNumber || "—"}</p></div>
              </div>
              {membershipIsActive ? (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-white/70 p-4 text-sm font-semibold text-emerald-800">✓ You are all set. Enjoy exclusive SBC student benefits.</div>
              ) : membershipIsExpired ? (
                <button type="button" onClick={renewMembership} className="mt-5 w-full rounded-xl bg-[#d4af37] py-3.5 text-sm font-black text-[#07111f] transition hover:bg-[#f1cf63]">Renew SBC Membership →</button>
              ) : (
                <p className="mt-5 rounded-xl border border-amber-200 bg-white/70 p-4 text-xs leading-5 text-amber-700">Membership dates are not available for this account yet. Please refresh after your membership payment is completed.</p>
              )}
            </div>
          </div>
        </section>

        {/* MOBILE BOTTOM NAV */}
        <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+6px)] md:hidden">
          <div className="mx-auto max-w-lg rounded-[1.35rem] border border-[#24364d] bg-[#020d19]/95 p-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="grid grid-cols-4 items-center gap-1">

              {/* HOME — SELECTED */}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] border border-[#d4af37] bg-[#d4af37]/10 px-1 py-1.5 text-[#f1cf63] transition active:scale-[0.97]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4af37] text-[#07111f]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 21V14H15V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[10px] font-black leading-4">Home</span>
                <span className="absolute bottom-0 h-1 w-16 max-w-[72%] rounded-full bg-[#f1cf63]" />
              </button>

              {/* OFFERS — NORMAL */}
              <button
                type="button"
                onClick={() => router.push("/student/offers")}
                className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] px-1 py-1.5 text-white transition active:scale-[0.97]"
              >
                <span className="flex h-7 w-7 items-center justify-center text-white">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M20.59 13.41L13.41 20.59C12.63 21.37 11.37 21.37 10.59 20.59L3.41 13.41C2.63 12.63 2.63 11.37 3.41 10.59L10.59 3.41C11.37 2.63 12.63 2.63 13.41 3.41L20.59 10.59C21.37 11.37 21.37 12.63 20.59 13.41Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-[10px] font-bold leading-4">Offers</span>
              </button>

              {/* SCAN & REDEEM — COMPACT */}
              <button
                type="button"
                onClick={() => {
                  const scanButton = scanRedeemRef.current?.querySelector("button");
                  if (scanButton) scanButton.click();
                }}
                disabled={!membershipIsActive}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] px-1 py-1.5 transition active:scale-[0.97] ${
                  membershipIsActive ? "text-white" : "cursor-not-allowed text-white/30"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center ${membershipIsActive ? "text-white" : "text-white/30"}`}>
                  <svg width="25" height="25" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M7 15V9C7 7.89543 7.89543 7 9 7H15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M27 7H33C34.1046 7 35 7.89543 35 9V15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 27V33C7 34.1046 7.89543 35 9 35H15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M27 35H33C34.1046 35 35 34.1046 35 33V27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11 21H31" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-[10px] font-black leading-4 text-center">Scan & Redeem</span>
              </button>

              {/* REFER A FRIEND — NORMAL */}
              <button
                type="button"
                onClick={shareReferralLink}
                className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] px-1 py-1.5 text-white transition active:scale-[0.97]"
              >
                <span className="flex h-7 w-7 items-center justify-center text-white">
                  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M16 21V19C16 17.3431 14.6569 16 13 16H7C5.34315 16 4 17.3431 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
                    <path d="M19 8V14M16 11H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-[10px] font-bold leading-4 text-center">Refer a Friend</span>
              </button>

            </div>
          </div>
        </nav>

        {/* Hidden scan component: keeps the existing scan/redeem functionality without rendering its card on the dashboard. */}
        <div ref={scanRedeemRef} className="fixed -left-[10000px] top-0 h-px w-px overflow-visible">
          <StudentScanRedeem />
        </div>

        {/* FOOTER */}

        <footer className="mt-10 pb-24 md:pb-7 flex flex-col gap-3 border-t border-black/10 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <p className="font-black text-[#07111f]">
              Student Benefit Card
            </p>

            <p className="mt-1">
              One card. More benefits. More savings.
            </p>

          </div>

          <button
            onClick={
              logout
            }
            className="w-fit rounded-full border border-slate-300 px-5 py-2.5 font-bold text-slate-700 transition hover:border-[#b18a16] hover:text-[#8a680c]"
          >
            Logout
          </button>

        </footer>

      </div>

    </main>
  );
}
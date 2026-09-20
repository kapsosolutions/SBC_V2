
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import BusinessProtected from "@/components/BusinessProtected";

import { auth, db } from "@/lib/firebase";

import {
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";

import QRCode from "qrcode";

interface PendingRedemption {
  id: string;

  studentId?: string;

  studentName?: string;

  studentCardNumber?: string;

  studentMobile?: string;

  offerId?: string;

  offerTitle?: string;

  discount?: string;

  businessId?: string;

  businessName?: string;

  status?: string;

  createdAt?: any;
}

export default function BusinessDashboard() {
  const router = useRouter();

  const [businessName, setBusinessName] =
    useState("Business");

  const [businessId, setBusinessId] =
    useState("");

  const [businessQr, setBusinessQr] =
    useState("");

  const [totalOffers, setTotalOffers] =
    useState(0);

  const [totalScans, setTotalScans] =
    useState(0);

  const [totalRedeemed, setTotalRedeemed] =
    useState(0);

  const [pendingRedemptions, setPendingRedemptions] =
    useState<PendingRedemption[]>([]);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [showPendingPopup, setShowPendingPopup] =
    useState(false);

  const [showBusinessQr, setShowBusinessQr] =
    useState(false);

  const [loadingBusinessQr, setLoadingBusinessQr] =
    useState(true);

  const [successRedemption, setSuccessRedemption] = useState<{
    businessName: string;
    offerTitle: string;
    discount: string;
    pointsAwarded: number;
    totalPoints: number | null;
  } | null>(null);

  /*
   * ==========================================
   * GENERATE BUSINESS ID
   * ==========================================
   */

  const generateBusinessId = () => {
    const randomNumber =
      Math.floor(
        10000 +
          Math.random() *
            90000
      );

    return `SBC-BIZ-${randomNumber}`;
  };

  /*
   * ==========================================
   * CREATE / LOAD BUSINESS ID + QR
   * ==========================================
   */

  const setupBusinessQr = async (
    uid: string,
    currentBusinessName: string
  ) => {
    try {
      setLoadingBusinessQr(true);

      const businessRef =
        doc(
          db,
          "businesses",
          uid
        );

      const businessSnap =
        await getDoc(
          businessRef
        );

      let finalBusinessId = "";

      if (
        businessSnap.exists()
      ) {
        const data =
          businessSnap.data();

        finalBusinessId =
          data.businessId ||
          "";
      }

      /*
       * Existing business without Business ID
       */

      if (
        !finalBusinessId
      ) {
        finalBusinessId =
          generateBusinessId();

        /*
         * Re-read inside transaction
         * so two tabs don't create
         * different Business IDs.
         */

        await runTransaction(
          db,
          async (
            transaction
          ) => {
            const latestSnap =
              await transaction.get(
                businessRef
              );

            if (
              latestSnap.exists()
            ) {
              const latestData =
                latestSnap.data();

              if (
                latestData.businessId
              ) {
                finalBusinessId =
                  latestData.businessId;

                return;
              }
            }

            transaction.update(
              businessRef,
              {
                businessId:
                  finalBusinessId,

                businessIdCreatedAt:
                  serverTimestamp(),
              }
            );
          }
        );
      }

      setBusinessId(
        finalBusinessId
      );

      /*
       * BUSINESS QR DATA
       */

      const qrData =
        JSON.stringify({
          type:
            "SBC_BUSINESS",

          businessId:
            finalBusinessId,

          businessName:
            currentBusinessName,
        });

      const qrImage =
        await QRCode.toDataURL(
          qrData,
          {
            width: 500,

            margin: 3,

            errorCorrectionLevel:
              "H",
          }
        );

      setBusinessQr(
        qrImage
      );

    } catch (error) {
      console.error(
        "Business QR setup error:",
        error
      );
    } finally {
      setLoadingBusinessQr(
        false
      );
    }
  };

  /*
   * ==========================================
   * PRINT BUSINESS QR
   * ==========================================
   */

  const printBusinessQr = () => {
    if (
      !businessQr ||
      !businessId
    ) {
      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=700,height=800"
      );

    if (!printWindow) {
      alert(
        "Please allow popups to print your Business QR."
      );

      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>

      <html>

        <head>

          <title>
            SBC Business QR
          </title>

          <style>

            body {
              margin: 0;
              padding: 40px;
              font-family: Arial, sans-serif;
              text-align: center;
            }

            .card {
              max-width: 500px;
              margin: auto;
              border: 3px solid #16a34a;
              border-radius: 24px;
              padding: 35px;
            }

            h1 {
              color: #15803d;
              font-size: 30px;
              margin-bottom: 8px;
            }

            h2 {
              font-size: 24px;
              margin: 10px 0;
            }

            img {
              width: 350px;
              height: 350px;
              margin: 20px auto;
            }

            .id {
              background: #fef3c7;
              padding: 15px;
              border-radius: 12px;
              font-size: 24px;
              font-weight: bold;
              margin-top: 15px;
            }

            .instruction {
              font-size: 18px;
              color: #555;
              line-height: 1.5;
            }

            .footer {
              margin-top: 25px;
              color: #999;
              font-size: 13px;
            }

          </style>

        </head>

        <body>

          <div class="card">

            <h1>
              🎓 SBC
            </h1>

            <h2>
              ${businessName}
            </h2>

            <p class="instruction">
              Scan this QR to redeem
              SBC Student Benefits
            </p>

            <img
              src="${businessQr}"
              alt="SBC Business QR"
            />

            <div class="id">
              Business ID:
              ${businessId}
            </div>

            <p class="instruction">
              If QR scanning is unavailable,
              students can enter this
              Business ID manually.
            </p>

            <div class="footer">
              Student Benefit Card • SBC
            </div>

          </div>

          <script>

            window.onload = function() {
              window.print();
            };

          </script>

        </body>

      </html>
    `);

    printWindow.document.close();
  };

  /*
   * ==========================================
   * DOWNLOAD BUSINESS QR
   * ==========================================
   */

  const downloadBusinessQr = () => {
    if (
      !businessQr ||
      !businessId
    ) {
      return;
    }

    const link =
      document.createElement(
        "a"
      );

    link.href =
      businessQr;

    link.download =
      `${businessId}-SBC-QR.png`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );
  };

  /*
   * ==========================================
   * LOGOUT
   * ==========================================
   */

  const logout = async () => {
    await signOut(
      auth
    );

    router.replace(
      "/business/login"
    );
  };

  /*
   * ==========================================
   * AUTH + LOAD DASHBOARD
   * ==========================================
   */

  useEffect(() => {
    let unsubscribeRedemptions:
      | (() => void)
      | null = null;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        async (user) => {
          /*
           * NOT LOGGED IN
           */

          if (!user) {
            if (
              unsubscribeRedemptions
            ) {
              unsubscribeRedemptions();

              unsubscribeRedemptions =
                null;
            }

            return;
          }

          try {
            /*
             * ========================================
             * BUSINESS
             * ========================================
             */

            const businessSnap =
              await getDoc(
                doc(
                  db,
                  "businesses",
                  user.uid
                )
              );

            let currentBusinessName =
              "Business";

            if (
              businessSnap.exists()
            ) {
              const businessData =
                businessSnap.data();

              currentBusinessName =
                businessData.businessName ||
                "Business";

              setBusinessName(
                currentBusinessName
              );
            }

            /*
             * ========================================
             * BUSINESS QR
             * ========================================
             */

            await setupBusinessQr(
              user.uid,
              currentBusinessName
            );

            /*
             * ========================================
             * OFFERS
             * ========================================
             */

            const offersSnap =
              await getDocs(
                query(
                  collection(
                    db,
                    "offers"
                  ),

                  where(
                    "businessId",
                    "==",
                    user.uid
                  )
                )
              );

            setTotalOffers(
              offersSnap.size
            );

            /*
             * ========================================
             * EXISTING REDEMPTIONS
             * ========================================
             */

            const redeemSnap =
              await getDocs(
                query(
                  collection(
                    db,
                    "redemptions"
                  ),

                  where(
                    "businessId",
                    "==",
                    user.uid
                  )
                )
              );

            setTotalScans(
              redeemSnap.size
            );

            setTotalRedeemed(
              redeemSnap.size
            );

            /*
             * ========================================
             * REAL-TIME PENDING REQUESTS
             * ========================================
             */

            const pendingQuery =
              query(
                collection(
                  db,
                  "redemptionRequests"
                ),

                where(
                  "businessId",
                  "==",
                  user.uid
                ),

                where(
                  "status",
                  "==",
                  "pending"
                )
              );

            /*
             * Remove old listener if any.
             */

            if (
              unsubscribeRedemptions
            ) {
              unsubscribeRedemptions();

              unsubscribeRedemptions =
                null;
            }

            unsubscribeRedemptions =
              onSnapshot(
                pendingQuery,

                (snapshot) => {
                  const requests:
                    PendingRedemption[] =
                    snapshot.docs.map(
                      (
                        requestDoc
                      ) => {
                        const data =
                          requestDoc.data();

                        return {
                          id:
                            requestDoc.id,

                          studentId:
                            data.studentId,

                          studentName:
                            data.studentName ||
                            "SBC Student",

                          studentCardNumber:
                            data.studentCardNumber ||
                            "",

                          studentMobile:
                            data.studentMobile ||
                            "",

                          offerId:
                            data.offerId,

                          offerTitle:
                            data.offerTitle ||
                            "SBC Offer",

                          discount:
                            data.discount ||
                            "",

                          businessId:
                            data.businessId,

                          businessName:
                            data.businessName ||
                            currentBusinessName,

                          status:
                            data.status ||
                            "pending",

                          createdAt:
                            data.createdAt,
                        };
                      }
                    );

                  setPendingRedemptions(
                    requests
                  );

                  /*
                   * Automatically open popup
                   * whenever pending request exists.
                   */

                  if (
                    requests.length >
                    0
                  ) {
                    setShowPendingPopup(
                      true
                    );
                  } else {
                    setShowPendingPopup(
                      false
                    );
                  }
                },

                (error) => {
                  console.error(
                    "Pending redemption listener error:",
                    error
                  );
                }
              );

          } catch (error) {
            console.error(
              "Business dashboard loading error:",
              error
            );
          }
        }
      );

    return () => {
      unsubscribeAuth();

      if (
        unsubscribeRedemptions
      ) {
        unsubscribeRedemptions();

        unsubscribeRedemptions =
          null;
      }
    };
  }, []);

  /*
   * ==========================================
   * APPROVE REDEMPTION
   * ==========================================
   *
   * THIS IS THE IMPORTANT PART.
   *
   * Student request:
   *
   * redemptionRequests
   * status = pending
   *
   * Business clicks APPROVE.
   *
   * Transaction performs:
   *
   * 1. Verify request
   * 2. Verify business
   * 3. Verify offer
   * 4. Check 4-use limit
   * 5. Increase business usage
   * 6. Create redemptions document
   * 7. Mark request approved
   *
   * Student can then listen to
   * redemptionRequests in real time.
   */

  const approveRedemption =
    async (
      request: PendingRedemption
    ) => {
      /*
       * Prevent double click.
       */

      if (
        processingId
      ) {
        return;
      }

      const businessUser =
        auth.currentUser;

      if (!businessUser) {
        alert(
          "❌ Business login required."
        );

        return;
      }

      /*
       * Validate request data.
       */

      if (
        !request.studentId ||
        !request.offerId
      ) {
        alert(
          "❌ Invalid redemption request. Student or offer information is missing."
        );

        return;
      }

      /*
       * Make sure this request belongs
       * to currently logged-in business.
       */

      if (
        request.businessId &&
        request.businessId !==
          businessUser.uid
      ) {
        alert(
          "❌ This redemption request belongs to another business."
        );

        return;
      }

      try {
        setProcessingId(
          request.id
        );

        /*
         * ========================================
         * REFERENCES
         * ========================================
         */

        const requestRef =
          doc(
            db,
            "redemptionRequests",
            request.id
          );

        const usageDocId =
          `${businessUser.uid}_${request.studentId}`;

        const usageRef =
          doc(
            db,
            "businessStudentUsage",
            usageDocId
          );

        const offerRef =
          doc(
            db,
            "offers",
            request.offerId
          );

        /*
         * ========================================
         * STUDENT REWARD POINTS
         * ========================================
         *
         * IMPORTANT:
         *
         * A business must NOT read students/{studentId}
         * or studentPoints/{studentId}.
         *
         * Firebase rules intentionally keep the student's
         * private profile/points unreadable by businesses.
         *
         * Therefore this approval transaction uses
         * Firestore increment() for the points update.
         *
         * This removes the permission-denied error caused by
         * transaction.get(students/{studentId}).
         */

        const studentRef =
          doc(
            db,
            "students",
            request.studentId
          );

        const studentPointsRef =
          doc(
            db,
            "studentPoints",
            request.studentId
          );

        /*
         * Create redemption ID before
         * transaction starts.
         */

        const redemptionRef =
          doc(
            collection(
              db,
              "redemptions"
            )
          );

        /*
         * ========================================
         * LEGACY COUNT
         * ========================================
         *
         * Existing old redemption records
         * are counted outside transaction.
         *
         * The new businessStudentUsage document
         * remains the primary counter.
         */

        const existingRedemptionQuery =
          query(
            collection(
              db,
              "redemptions"
            ),

            where(
              "studentId",
              "==",
              request.studentId
            ),

            where(
              "businessId",
              "==",
              businessUser.uid
            )
          );

        const existingRedemptionSnap =
          await getDocs(
            existingRedemptionQuery
          );

        const existingRedemptionCount =
          existingRedemptionSnap.size;

        let finalUsageCount =
          0;

        let pointsAwarded =
          0;

        /*
         * We cannot read the student's cumulative
         * points from a business account.
         *
         * The actual total is calculated atomically
         * by Firestore using increment().
         *
         * Keep null here so the success popup never
         * displays a fake or stale total.
         */
        let newStudentPoints:
          number | null =
          null;

        /*
         * ========================================
         * ATOMIC TRANSACTION
         * ========================================
         */

        await runTransaction(
          db,
          async (
            transaction
          ) => {
            /*
             * ======================================
             * ALL TRANSACTION READS FIRST
             * ======================================
             *
             * DO NOT READ:
             *
             * students/{studentId}
             * studentPoints/{studentId}
             *
             * Both are private to the student/admin.
             */

            const requestSnap =
              await transaction.get(
                requestRef
              );

            const usageSnap =
              await transaction.get(
                usageRef
              );

            const offerSnap =
              await transaction.get(
                offerRef
              );

            /*
             * ======================================
             * REQUEST VALIDATION
             * ======================================
             */

            if (
              !requestSnap.exists()
            ) {
              throw new Error(
                "REQUEST_NOT_FOUND"
              );
            }

            const requestData =
              requestSnap.data();

            /*
             * Business ownership.
             */

            if (
              requestData.businessId !==
              businessUser.uid
            ) {
              throw new Error(
                "INVALID_BUSINESS"
              );
            }

            /*
             * Duplicate approval protection.
             */

            if (
              requestData.status !==
              "pending"
            ) {
              throw new Error(
                "REQUEST_ALREADY_PROCESSED"
              );
            }

            /*
             * ======================================
             * OFFER VALIDATION
             * ======================================
             */

            if (
              !offerSnap.exists()
            ) {
              throw new Error(
                "OFFER_NOT_FOUND"
              );
            }

            const offerData =
              offerSnap.data();

            /*
             * Offer must belong to same business.
             */

            if (
              offerData.businessId !==
              businessUser.uid
            ) {
              throw new Error(
                "INVALID_OFFER_BUSINESS"
              );
            }

            /*
             * Offer must still be active.
             */

            if (
              offerData.status &&
              offerData.status !==
                "active"
            ) {
              throw new Error(
                "OFFER_NOT_ACTIVE"
              );
            }

            /*
             * ======================================
             * BUSINESS-WISE USAGE
             * ======================================
             *
             * Primary:
             *
             * businessStudentUsage
             *
             * Fallback:
             *
             * old redemptions
             *
             * Offer ID is NOT part of the count.
             */

            const storedUsageCount =
              usageSnap.exists()
                ? Number(
                    usageSnap.data()
                      .count || 0
                  )
                : 0;

            const currentUsageCount =
              Math.max(
                storedUsageCount,
                existingRedemptionCount
              );

            /*
             * ======================================
             * UNLIMITED BUSINESS-WISE USAGE
             * ======================================
             *
             * There is NO 4-use blocking limit.
             *
             * The count is business + student based,
             * not offer based.
             */

            finalUsageCount =
              currentUsageCount + 1;

            /*
             * ======================================
             * CALCULATE REWARD POINTS
             * ======================================
             *
             * 1st redemption  = 20 points
             * 2nd redemption  = 10 points
             * 3rd onward      = 5 points
             *
             * IMPORTANT:
             * This continues forever because usage is
             * unlimited. There is NO 4-use cutoff.
             */

            if (
              finalUsageCount ===
              1
            ) {
              pointsAwarded =
                20;
            } else if (
              finalUsageCount ===
              2
            ) {
              pointsAwarded =
                10;
            } else {
              pointsAwarded =
                5;
            }

            /*
             * ======================================
             * UPDATE BUSINESS + STUDENT USAGE
             * ======================================
             */

            transaction.set(
              usageRef,

              {
                studentId:
                  request.studentId,

                businessId:
                  businessUser.uid,

                count:
                  finalUsageCount,

                maxAllowed:
                  null,

                unlimited:
                  true,

                updatedAt:
                  serverTimestamp(),
              },

              {
                merge: true,
              }
            );

            /*
             * ======================================
             * UPDATE STUDENT PROFILE POINTS
             * ======================================
             *
             * IMPORTANT:
             *
             * No transaction.get(studentRef).
             *
             * Firestore increment() updates the existing
             * value atomically without exposing the current
             * value to the business account.
             *
             * The security rule permits only these reward
             * fields to be changed by the approving business.
             */

            transaction.set(
              studentRef,
              {
                points:
                  increment(
                    pointsAwarded
                  ),

                totalPointsEarned:
                  increment(
                    pointsAwarded
                  ),

                lastPointsEarned:
                  pointsAwarded,

                lastPointsEarnedAt:
                  serverTimestamp(),

                lastPointsBusinessId:
                  businessUser.uid,

                lastPointsBusinessName:
                  requestData.businessName ||
                  businessName,

                lastPointsRedemptionId:
                  redemptionRef.id,

                updatedAt:
                  serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            /*
             * ======================================
             * UPDATE STUDENT POINTS DOCUMENT
             * ======================================
             *
             * This is also write-only from the business
             * side. Firestore atomically increments the
             * student's existing totalPoints.
             */

            transaction.set(
              studentPointsRef,
              {
                studentId:
                  request.studentId,

                totalPoints:
                  increment(
                    pointsAwarded
                  ),

                lastPointsEarned:
                  pointsAwarded,

                lastPointsBusinessId:
                  businessUser.uid,

                lastPointsBusinessName:
                  requestData.businessName ||
                  businessName,

                lastRedemptionId:
                  redemptionRef.id,

                updatedAt:
                  serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            /*
             * ======================================
             * CREATE ACTUAL REDEMPTION
             * ======================================
             */

            transaction.set(
              redemptionRef,

              {
                studentId:
                  request.studentId,

                studentName:
                  requestData.studentName ||
                  "",

                studentMobile:
                  requestData.studentMobile ||
                  "",

                studentCardNumber:
                  requestData.studentCardNumber ||
                  "",

                businessId:
                  businessUser.uid,

                businessName:
                  requestData.businessName ||
                  businessName,

                offerId:
                  request.offerId,

                offerTitle:
                  requestData.offerTitle ||
                  offerData.title ||
                  "",

                discount:
                  requestData.discount ||
                  requestData.offerDiscount ||
                  offerData.discount ||
                  "",

                requestId:
                  request.id,

                pointsAwarded:
                  pointsAwarded,

                redemptionNumber:
                  finalUsageCount,

                /*
                 * The exact cumulative total is private
                 * and is updated atomically by Firestore.
                 * Do not write a guessed value here.
                 */
                studentPointsAfterRedemption:
                  null,

                redeemedAt:
                  serverTimestamp(),

                status:
                  "redeemed",
              }
            );

            /*
             * ======================================
             * APPROVE REQUEST
             * ======================================
             */

            // Firestore rules allow the business to update the request
            // status and approval timestamp. Points and redemption data
            // are already written to their dedicated documents above.
            transaction.update(
              requestRef,

              {
                status:
                  "approved",

                approvedAt:
                  serverTimestamp(),
              }
            );
          }
        );

        /*
         * ========================================
         * DASHBOARD STATISTICS
         * ========================================
         */

        setTotalRedeemed(
          (current) =>
            current + 1
        );

        setTotalScans(
          (current) =>
            current + 1
        );

        /*
         * ========================================
         * SUCCESS MESSAGE
         * ========================================
         *
         * We intentionally do not show a cumulative
         * total here because the business account is not
         * allowed to read the student's private points.
         */

        setSuccessRedemption({
          businessName:
            request.businessName ||
            businessName,

          offerTitle:
            request.offerTitle ||
            "SBC Offer",

          discount:
            request.discount ||
            (request as any).offerDiscount ||
            "",

          pointsAwarded,

          totalPoints:
            newStudentPoints,
        });
      } catch (error: any) {
        console.error(
          "Approve redemption error:",
          error
        );

        if (
          error?.message ===
          "REQUEST_ALREADY_PROCESSED"
        ) {
          alert(
            "ℹ️ This redemption request has already been processed."
          );
        } else if (
          error?.message ===
          "REQUEST_NOT_FOUND"
        ) {
          alert(
            "❌ Redemption request no longer exists."
          );
        } else if (
          error?.message ===
          "OFFER_NOT_FOUND"
        ) {
          alert(
            "❌ The selected offer no longer exists."
          );
        } else if (
          error?.message ===
          "OFFER_NOT_ACTIVE"
        ) {
          alert(
            "❌ This offer is no longer active."
          );
        } else if (
          error?.message ===
          "INVALID_BUSINESS"
        ) {
          alert(
            "❌ Business verification failed."
          );
        } else if (
          error?.message ===
          "INVALID_OFFER_BUSINESS"
        ) {
          alert(
            "❌ This offer does not belong to your business."
          );
        } else if (
          error?.code ===
          "permission-denied"
        ) {
          alert(
            "❌ Permission denied while approving redemption. Please refresh and try again."
          );
        } else {
          alert(
            "❌ Unable to approve redemption. Please try again."
          );
        }

      } finally {
        setProcessingId(
          null
        );
      }
    };

  /*
   * ==========================================
   * REJECT REDEMPTION
   * ==========================================
   */

  const rejectRedemption =
    async (
      request: PendingRedemption
    ) => {
      if (
        processingId
      ) {
        return;
      }

      const businessUser =
        auth.currentUser;

      if (!businessUser) {
        alert(
          "❌ Business login required."
        );

        return;
      }

      try {
        setProcessingId(
          request.id
        );

        const requestRef =
          doc(
            db,
            "redemptionRequests",
            request.id
          );

        await runTransaction(
          db,
          async (
            transaction
          ) => {
            const requestSnap =
              await transaction.get(
                requestRef
              );

            if (
              !requestSnap.exists()
            ) {
              throw new Error(
                "REQUEST_NOT_FOUND"
              );
            }

            const requestData =
              requestSnap.data();

            /*
             * Business ownership.
             */

            if (
              requestData.businessId !==
              businessUser.uid
            ) {
              throw new Error(
                "INVALID_BUSINESS"
              );
            }

            /*
             * Only pending requests
             * can be rejected.
             */

            if (
              requestData.status !==
              "pending"
            ) {
              throw new Error(
                "REQUEST_ALREADY_PROCESSED"
              );
            }

            transaction.update(
              requestRef,

              {
                status:
                  "rejected",

                rejectedAt:
                  serverTimestamp(),

                rejectedBy:
                  businessUser.uid,
              }
            );
          }
        );

      } catch (error: any) {
        console.error(
          "Reject redemption error:",
          error
        );

        if (
          error?.message ===
          "REQUEST_ALREADY_PROCESSED"
        ) {
          alert(
            "ℹ️ This redemption request has already been processed."
          );
        } else if (
          error?.message ===
          "REQUEST_NOT_FOUND"
        ) {
          alert(
            "❌ Redemption request no longer exists."
          );
        } else {
          alert(
            "❌ Unable to reject redemption. Please try again."
          );
        }

      } finally {
        setProcessingId(
          null
        );
      }
    };

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <BusinessProtected>

      <main className="min-h-screen bg-[#f5f3ed] text-slate-900">

        {/* PREMIUM TOP NAV */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07111f]/95 text-white shadow-lg backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d4af37]/50 bg-[#d4af37]/10 text-sm font-black text-[#f1cf63]">
                SBC
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#f1cf63]">
                  Student Benefit Card
                </p>
                <p className="text-sm font-medium text-white/55">
                  Business Partner Portal
                </p>
              </div>
            </div>

            <button
              onClick={logout}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/10 hover:text-[#f1cf63]"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">

          {/* HERO */}
          <section className="relative overflow-hidden rounded-[2rem] bg-[#07111f] p-7 text-white shadow-[0_25px_80px_rgba(7,17,31,0.20)] sm:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl" />
            <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                  ✦ Verified SBC Business
                </div>

                <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                  Welcome,
                  <span className="block text-[#f1cf63]">
                    {businessName}
                  </span>
                </h1>

                <p className="mt-3 max-w-2xl text-base leading-7 text-white/60">
                  Manage your SBC offers, verify students and approve redemption requests from one premium dashboard.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-5 backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Business ID
                </p>
                <p className="mt-2 break-all text-xl font-black tracking-wide text-[#f1cf63]">
                  {loadingBusinessQr ? "Generating..." : businessId || "Not available"}
                </p>
              </div>
            </div>
          </section>

          {/* BUSINESS QR */}
          <section className="mt-7 grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">

            <div className="relative overflow-hidden rounded-[2rem] bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-9">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#d4af37]/10 blur-3xl" />

              <div className="relative">
                <div className="inline-flex rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#a37b0d]">
                  🎓 SBC Business Verification
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-[#07111f]">
                  Your Business QR
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Students can scan this QR to verify your business before redeeming an SBC benefit.
                </p>

                <div className="mt-6 rounded-2xl border border-[#d4af37]/20 bg-[#fbfaf6] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    SBC Business ID
                  </p>
                  <p className="mt-2 break-all text-2xl font-black tracking-wide text-[#07111f]">
                    {loadingBusinessQr ? "Generating..." : businessId || "Not available"}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowBusinessQr(true)}
                    disabled={!businessQr}
                    className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-black text-white transition hover:bg-[#10243b] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    📷 View QR
                  </button>

                  <button
                    onClick={downloadBusinessQr}
                    disabled={!businessQr}
                    className="rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-5 py-3 text-sm font-black text-[#8a680c] transition hover:bg-[#d4af37]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ⬇️ Download
                  </button>

                  <button
                    onClick={printBusinessQr}
                    disabled={!businessQr}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-[#d4af37]/50 hover:text-[#8a680c] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    🖨️ Print
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center rounded-[2rem] bg-[#07111f] p-7 shadow-[0_20px_60px_rgba(7,17,31,0.16)] sm:p-9">
              {loadingBusinessQr ? (
                <div className="flex h-64 w-64 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.05]">
                  <div className="text-center">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#f1cf63]" />
                    <p className="mt-3 text-sm font-semibold text-white/50">
                      Creating QR...
                    </p>
                  </div>
                </div>
              ) : businessQr ? (
                <div className="rounded-[1.5rem] border border-[#d4af37]/30 bg-white p-5 shadow-2xl">
                  <img
                    src={businessQr}
                    alt="SBC Business QR"
                    className="h-56 w-56"
                  />
                  <p className="mt-3 text-center text-xs font-black uppercase tracking-wider text-slate-500">
                    Scan to verify business
                  </p>
                </div>
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-red-50 text-center text-sm font-bold text-red-600">
                  Unable to generate QR
                </div>
              )}
            </div>

          </section>

          {/* PENDING ALERT */}
          {pendingRedemptions.length > 0 && (
            <section className="mt-7 rounded-[2rem] border border-[#d4af37]/30 bg-gradient-to-r from-[#fffdf5] to-[#f7f1dd] p-6 shadow-[0_20px_60px_rgba(120,90,20,0.08)] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex rounded-full bg-[#d4af37]/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#8a680c]">
                    🔔 Action Required
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-[#07111f]">
                    Pending SBC Redemptions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    You have{" "}
                    <span className="font-black text-[#07111f]">
                      {pendingRedemptions.length}
                    </span>{" "}
                    student redemption request
                    {pendingRedemptions.length === 1 ? "" : "s"} waiting for approval.
                  </p>
                </div>

                <button
                  onClick={() => setShowPendingPopup(true)}
                  className="rounded-xl bg-[#07111f] px-6 py-3 text-sm font-black text-white transition hover:bg-[#10243b]"
                >
                  🔔 View Requests
                </button>
              </div>
            </section>
          )}

          {/* STATISTICS */}
          <section className="mt-7 grid gap-5 md:grid-cols-3">

            <div className="rounded-[1.5rem] bg-[#07111f] p-6 text-white shadow-[0_18px_50px_rgba(7,17,31,0.14)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                🎁 Total Offers
              </p>
              <div className="mt-4 flex items-end justify-between">
                <h2 className="text-4xl font-black text-[#f1cf63]">{totalOffers}</h2>
                <span className="text-2xl">🎁</span>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                📷 Total Scans
              </p>
              <div className="mt-4 flex items-end justify-between">
                <h2 className="text-4xl font-black text-[#07111f]">{totalScans}</h2>
                <span className="text-2xl">📷</span>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                🎉 Total Redeemed
              </p>
              <div className="mt-4 flex items-end justify-between">
                <h2 className="text-4xl font-black text-[#07111f]">{totalRedeemed}</h2>
                <span className="text-2xl">✓</span>
              </div>
            </div>

          </section>

          {/* QUICK ACTIONS */}
          <section className="mt-7">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a37b0d]">
                Business Tools
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#07111f]">
                Quick Actions
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">

              <Link
                href="/business/add-offer"
                className="group rounded-[1.5rem] bg-[#07111f] p-6 text-white shadow-[0_18px_50px_rgba(7,17,31,0.12)] transition hover:-translate-y-1"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d4af37]/10 text-xl text-[#f1cf63]">
                  ➕
                </div>
                <h2 className="mt-5 text-xl font-black">Add Offer</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Create a new student benefit.
                </p>
              </Link>

              <Link
                href="/business/my-offers"
                className="group rounded-[1.5rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition hover:-translate-y-1"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d4af37]/10 text-xl">
                  🎁
                </div>
                <h2 className="mt-5 text-xl font-black text-[#07111f]">My Offers</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  View and manage your offers.
                </p>
              </Link>

              <Link
                href="/business/history"
                className="group rounded-[1.5rem] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition hover:-translate-y-1"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d4af37]/10 text-xl">
                  📊
                </div>
                <h2 className="mt-5 text-xl font-black text-[#07111f]">History</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  View all redeemed offers.
                </p>
              </Link>

            </div>
          </section>

          {/* PORTAL INFO */}
          <section className="mt-7 rounded-[2rem] bg-[#07111f] p-7 text-white shadow-[0_20px_60px_rgba(7,17,31,0.14)] sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f1cf63]">
                  SBC Business Portal
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Everything in one place.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                  Manage offers, display your Business QR, receive student redemption requests and track your redemptions securely.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-center">
                <p className="text-lg font-black text-[#f1cf63]">SBC</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  2026
                </p>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="mt-8 flex flex-col gap-3 border-t border-black/10 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black text-[#07111f]">Student Benefit Card</p>
              <p className="mt-1">One card. More benefits. More savings.</p>
            </div>

            <button
              onClick={logout}
              className="w-fit rounded-full border border-slate-300 px-5 py-2.5 font-bold text-slate-700 transition hover:border-[#b18a16] hover:text-[#8a680c]"
            >
              Logout
            </button>
          </footer>

        </div>
      </main>

      {/* ==========================================
          BUSINESS QR MODAL
      =========================================== */}

      {showBusinessQr &&
        businessQr && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

            <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-2xl font-extrabold text-green-700">
                    📷 SBC Business QR
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {businessName}
                  </p>

                </div>

                <button
                  onClick={() =>
                    setShowBusinessQr(
                      false
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl font-bold hover:bg-gray-200"
                >
                  ✕
                </button>

              </div>

              <div className="mt-6 rounded-3xl border-4 border-green-100 bg-white p-6">

                <img
                  src={
                    businessQr
                  }
                  alt="SBC Business QR"
                  className="mx-auto w-full max-w-xs"
                />

              </div>

              <div className="mt-5 rounded-2xl bg-yellow-50 p-4 text-center">

                <p className="text-xs font-bold text-gray-500">
                  BUSINESS ID
                </p>

                <p className="mt-1 text-xl font-extrabold text-green-700">
                  {businessId}
                </p>

              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">

                <button
                  onClick={
                    downloadBusinessQr
                  }
                  className="rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
                >
                  ⬇️ Download
                </button>

                <button
                  onClick={
                    printBusinessQr
                  }
                  className="rounded-xl bg-purple-600 py-3 font-bold text-white hover:bg-purple-700"
                >
                  🖨️ Print
                </button>

              </div>

            </div>

          </div>
        )}

      {/* ==========================================
          REDEMPTION SUCCESS POPUP
          UI ONLY — redemption logic is unchanged.
      =========================================== */}

      {successRedemption && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setSuccessRedemption(null)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500 hover:bg-gray-200"
            >
              ✕
            </button>

            <div className="p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl font-black text-green-600">
                ✓
              </div>

              <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#a37b0d]">
                SBC Redemption
              </p>

              <h2 className="mt-1 text-2xl font-black text-green-700">
                Approved Successfully!
              </h2>

              <p className="mt-1 text-sm font-extrabold text-gray-700">
                {successRedemption.businessName}
              </p>

              <div className="mt-4 rounded-xl bg-green-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Benefit Redeemed
                </p>
                <p className="mt-1 text-base font-extrabold text-green-700">
                  🎁 {successRedemption.offerTitle}
                </p>
                {successRedemption.discount && (
                  <p className="mt-1 text-sm font-black text-blue-600">
                    {successRedemption.discount}
                  </p>
                )}
              </div>

              <div className="mt-3 rounded-xl bg-purple-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-purple-600">
                  ⭐ Reward Points Earned
                </p>
                <p className="mt-1 text-3xl font-black text-purple-700">
                  +{successRedemption.pointsAwarded}
                </p>
                {successRedemption.totalPoints !== null && (
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Total Student Points: {successRedemption.totalPoints}
                  </p>
                )}
              </div>

              <p className="mt-3 text-xs font-semibold text-gray-400">
                The student can now see the approved redemption.
              </p>

              <button
                type="button"
                onClick={() => setSuccessRedemption(null)}
                className="mt-4 w-full rounded-xl bg-[#07111f] py-3 text-sm font-black text-white hover:bg-[#10243b]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          PENDING REDEMPTION POPUP
      =========================================== */}

      {showPendingPopup &&
        pendingRedemptions.length >
          0 && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">

            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">

              {/* HEADER */}

              <div className="sticky top-0 border-b bg-white p-6">

                <div className="flex items-center justify-between">

                  <div>

                    <h2 className="text-2xl font-extrabold text-green-700">
                      🔔 New SBC Redemption
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Student requests waiting for approval
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setShowPendingPopup(
                        false
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl font-bold hover:bg-gray-200"
                  >
                    ✕
                  </button>

                </div>

              </div>

              {/* REQUESTS */}

              <div className="space-y-5 p-6">

                {pendingRedemptions.map(
                  (
                    request
                  ) => {

                    const isProcessing =
                      processingId ===
                      request.id;

                    return (
                      <div
                        key={
                          request.id
                        }
                        className="rounded-2xl border-2 border-yellow-200 bg-yellow-50 p-5"
                      >

                        {/* STUDENT */}

                        <div className="mb-4">

                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                            Student
                          </p>

                          <h3 className="mt-1 text-xl font-extrabold text-gray-800">
                            👤{" "}
                            {request.studentName ||
                              "SBC Student"}
                          </h3>

                          {request.studentCardNumber && (

                            <p className="mt-1 text-sm font-semibold text-gray-500">
                              Card No:{" "}
                              {
                                request.studentCardNumber
                              }
                            </p>

                          )}

                        </div>

                        {/* OFFER */}

                        <div className="rounded-xl bg-white p-4">

                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                            Offer
                          </p>

                          <p className="mt-1 text-lg font-extrabold text-green-700">
                            🎁{" "}
                            {request.offerTitle ||
                              "SBC Offer"}
                          </p>

                          {request.discount && (

                            <p className="mt-1 text-sm font-bold text-blue-600">
                              {request.discount}
                            </p>

                          )}

                        </div>

                        {/* STATUS */}

                        <div className="mt-4 rounded-xl bg-yellow-100 p-3 text-center">

                          <p className="text-sm font-bold text-yellow-800">
                            ⏳ Waiting for Business Approval
                          </p>

                        </div>

                        {/* ACTIONS */}

                        <div className="mt-5 grid grid-cols-2 gap-3">

                          <button
                            onClick={() =>
                              rejectRedemption(
                                request
                              )
                            }
                            disabled={
                              isProcessing
                            }
                            className="rounded-xl bg-red-600 py-4 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                          >

                            {isProcessing
                              ? "Please wait..."
                              : "✕ Reject"}

                          </button>

                          <button
                            onClick={() =>
                              approveRedemption(
                                request
                              )
                            }
                            disabled={
                              isProcessing
                            }
                            className="rounded-xl bg-green-600 py-4 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                          >

                            {isProcessing
                              ? "Please wait..."
                              : "✓ Approve"}

                          </button>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            </div>

          </div>
        )}

    </BusinessProtected>
  );
}
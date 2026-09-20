"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";

import { onAuthStateChanged, signOut } from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { Html5Qrcode } from "html5-qrcode";

interface Offer {
  id: string;
  title?: string;
  discount?: string;
  description?: string;
  category?: string;
  image?: string;
  desktopImage?: string;
  mobileImage?: string;

  businessId?: string;
  businessName?: string;
  businessMobile?: string;
  businessAddress?: string;

  status?: string;
}

interface BusinessInfo {
  businessId: string;
  businessName: string;
}

const MAX_REDEMPTIONS = 4;

export default function StudentOffers() {
  const router = useRouter();

  const [offers, setOffers] =
    useState<Offer[]>([]);

  const [categories, setCategories] =
    useState<string[]>([]);

  const [usageCounts, setUsageCounts] =
    useState<Record<string, number>>({});

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("All");

  /*
   * ==========================================
   * REDEMPTION STATES
   * ==========================================
   */

  const [selectedOffer, setSelectedOffer] =
    useState<Offer | null>(null);

  const [pendingOffer, setPendingOffer] =
    useState<Offer | null>(null);

  const [approvedOffer, setApprovedOffer] =
    useState<Offer | null>(null);

  const [approvedPoints, setApprovedPoints] =
    useState(0);

  const [approvedTotalPoints, setApprovedTotalPoints] =
    useState(0);

  const [rejectedOffer, setRejectedOffer] =
    useState<Offer | null>(null);

  /*
   * ==========================================
   * FULL OFFER DETAILS MODAL
   * ==========================================
   */

  const [detailsOffer, setDetailsOffer] =
    useState<Offer | null>(null);

  const [pendingRequestId, setPendingRequestId] =
    useState<string | null>(null);

  const [redeemLoading, setRedeemLoading] =
    useState(false);

  /*
   * ==========================================
   * BUSINESS VERIFICATION
   * ==========================================
   */

  const [showVerificationModal, setShowVerificationModal] =
    useState(false);

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [businessIdInput, setBusinessIdInput] =
    useState("");

  const [verifiedBusiness, setVerifiedBusiness] =
    useState<BusinessInfo | null>(null);

  const [verificationLoading, setVerificationLoading] =
    useState(false);

  const [verificationError, setVerificationError] =
    useState("");

  const [scannerError, setScannerError] =
    useState("");

  /*
   * ==========================================
   * AUTH + LOAD DATA
   * ==========================================
   */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/student/login"
            );

            return;
          }

          try {
            await Promise.all([
              loadOffers(),
              loadCategories(),
            ]);

            await loadBusinessUsage(
              user.uid
            );
          } catch (error) {
            console.error(
              "Student offers loading error:",
              error
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  /*
   * ==========================================
   * REAL-TIME REDEMPTION STATUS
   * ==========================================
   *
   * When student creates a request:
   *
   * pendingRequestId = document ID
   *
   * Student listens to:
   *
   * redemptionRequests/{pendingRequestId}
   *
   * Business Approve:
   *
   * pending -> approved
   *
   * Student immediately sees Approved.
   * ==========================================
   */

  useEffect(() => {
    if (
      !pendingRequestId
    ) {
      return;
    }

    const requestRef =
      doc(
        db,
        "redemptionRequests",
        pendingRequestId
      );

    const unsubscribe =
      onSnapshot(
        requestRef,
        (snapshot) => {
          if (
            !snapshot.exists()
          ) {
            return;
          }

          const data =
            snapshot.data();

          const status =
            String(
              data.status ||
              "pending"
            );

          /*
           * ======================================
           * APPROVED
           * ======================================
           */

          if (
            status ===
            "approved"
          ) {

            const approvedBusinessName =
              data.businessName ||
              pendingOffer?.businessName ||
              "SBC Partner Business";

            const approvedOfferData: Offer =
              pendingOffer || {
                id:
                  data.offerId ||
                  "",
                title:
                  data.offerTitle ||
                  "SBC Offer",
                discount:
                  data.offerDiscount ||
                  "",
                businessId:
                  data.businessId ||
                  "",
                businessName:
                  approvedBusinessName,
              };

            setApprovedOffer(
              approvedOfferData
            );

            setApprovedPoints(
              Number(data.pointsAwarded || 0)
            );

            setApprovedTotalPoints(
              Number(data.totalPoints || 0)
            );

            setPendingOffer(
              null
            );

            setPendingRequestId(
              null
            );

            /*
             * Reload usage.
             *
             * NOTE:
             * Actual usage document creation
             * will be handled in the next step.
             */

            if (
              auth.currentUser
            ) {
              loadBusinessUsage(
                auth.currentUser.uid
              );
            }

            return;
          }

          /*
           * ======================================
           * REJECTED
           * ======================================
           */

          if (
            status ===
            "rejected"
          ) {

            const rejectedOfferData: Offer =
              pendingOffer || {
                id:
                  data.offerId ||
                  "",
                title:
                  data.offerTitle ||
                  "SBC Offer",
                discount:
                  data.offerDiscount ||
                  "",
                businessId:
                  data.businessId ||
                  "",
                businessName:
                  data.businessName ||
                  "SBC Partner Business",
              };

            setRejectedOffer(
              rejectedOfferData
            );

            setPendingOffer(
              null
            );

            setPendingRequestId(
              null
            );

            return;
          }
        },
        (error) => {
          console.error(
            "Redemption realtime listener error:",
            error
          );
        }
      );

    return () =>
      unsubscribe();
  }, [
    pendingRequestId,
    pendingOffer,
  ]);

  /*
   * ==========================================
   * LOAD OFFERS
   * ==========================================
   */

  const loadOffers = async () => {
    try {
      const offerQuery =
        query(
          collection(
            db,
            "offers"
          ),
          where(
            "status",
            "==",
            "active"
          )
        );

      const offerSnap =
        await getDocs(
          offerQuery
        );

      const businessSnap =
        await getDocs(
          collection(
            db,
            "businesses"
          )
        );

      const businessMap =
        new Map<
          string,
          {
            name: string;
            mobile: string;
            address: string;
          }
        >();

      businessSnap.docs.forEach(
        (businessDoc) => {
          const data =
            businessDoc.data();

          businessMap.set(
            businessDoc.id,
            {
              name:
                data.businessName ||
                "",

              mobile:
                data.mobile ||
                data.phone ||
                data.businessMobile ||
                data.ownerMobile ||
                "",

              address:
                data.address ||
                data.businessAddress ||
                data.location ||
                data.fullAddress ||
                "",
            }
          );
        }
      );

      const data: Offer[] =
        offerSnap.docs.map(
          (item) => {
            const offerData =
              item.data();

            const businessId =
              String(
                offerData.businessId ||
                ""
              );

            const business =
              businessMap.get(
                businessId
              );

            return {
              id:
                item.id,

              title:
                offerData.title ||
                "",

              discount:
                offerData.discount ||
                "",

              description:
                offerData.description ||
                "",

              category:
                offerData.category ||
                "Other",

              image:
                offerData.image ||
                offerData.imageUrl ||
                "",
              desktopImage:
                offerData.desktopImage ||
                offerData.image ||
                offerData.imageUrl ||
                "",
              mobileImage:
                offerData.mobileImage ||
                offerData.image ||
                offerData.imageUrl ||
                "",

              businessId,

              businessName:
                offerData.businessName ||
                business?.name ||
                "SBC Partner Business",

              businessMobile:
                offerData.businessMobile ||
                business?.mobile ||
                "",

              businessAddress:
                offerData.businessAddress ||
                offerData.address ||
                business?.address ||
                "",

              status:
                offerData.status ||
                "active",
            };
          }
        );

      setOffers(
        data
      );

    } catch (error) {
      console.error(
        "Offer loading error:",
        error
      );

      setOffers([]);
    }
  };

  /*
   * ==========================================
   * FIND STUDENT IDS
   * ==========================================
   */

  const findStudentIds =
    async (
      studentUid: string
    ) => {

      const studentIds =
        new Set<string>();

      studentIds.add(
        studentUid
      );

      try {
        const studentRef =
          doc(
            db,
            "students",
            studentUid
          );

        const studentSnap =
          await getDoc(
            studentRef
          );

        if (
          studentSnap.exists()
        ) {
          studentIds.add(
            studentSnap.id
          );
        }

      } catch (error) {
        console.error(
          "Student document lookup error:",
          error
        );
      }

      try {
        const studentQuery =
          query(
            collection(
              db,
              "students"
            ),
            where(
              "uid",
              "==",
              studentUid
            )
          );

        const studentSnap =
          await getDocs(
            studentQuery
          );

        studentSnap.docs.forEach(
          (studentDoc) => {
            studentIds.add(
              studentDoc.id
            );
          }
        );

      } catch (error) {
        console.error(
          "Student UID query error:",
          error
        );
      }

      return Array.from(
        studentIds
      );
    };

  /*
   * ==========================================
   * LOAD BUSINESS USAGE
   * ==========================================
   */

  const loadBusinessUsage =
    async (
      studentUid: string
    ) => {

      try {

        const studentIds =
          await findStudentIds(
            studentUid
          );

        const offerQuery =
          query(
            collection(
              db,
              "offers"
            ),
            where(
              "status",
              "==",
              "active"
            )
          );

        const offerSnap =
          await getDocs(
            offerQuery
          );

        const businessIds =
          new Set<string>();

        offerSnap.docs.forEach(
          (offerDoc) => {

            const data =
              offerDoc.data();

            const businessId =
              String(
                data.businessId ||
                ""
              );

            if (
              businessId
            ) {
              businessIds.add(
                businessId
              );
            }

          }
        );

        const counts: Record<
          string,
          number
        > = {};

        for (
          const businessId of businessIds
        ) {

          let highestCount =
            0;

          for (
            const studentId of studentIds
          ) {

            try {

              const usageRef =
                doc(
                  db,
                  "businessStudentUsage",
                  `${businessId}_${studentId}`
                );

              const usageSnap =
                await getDoc(
                  usageRef
                );

              if (
                usageSnap.exists()
              ) {

                const data =
                  usageSnap.data();

                const count =
                  Number(
                    data.count ||
                    0
                  );

                if (
                  count >
                  highestCount
                ) {
                  highestCount =
                    count;
                }

              }

            } catch (error) {

              console.error(
                "Business usage document error:",
                {
                  businessId,
                  studentId,
                  error,
                }
              );

            }

          }

          if (
            highestCount >
            0
          ) {

            counts[
              businessId
            ] =
              Math.min(
                highestCount,
                MAX_REDEMPTIONS
              );

          }

        }

        /*
         * Legacy redemption fallback
         */

        const legacyCounts: Record<
          string,
          number
        > = {};

        const redemptionDocs =
          new Map<
            string,
            any
          >();

        for (
          const studentId of studentIds
        ) {

          try {

            const redemptionQuery =
              query(
                collection(
                  db,
                  "redemptions"
                ),
                where(
                  "studentId",
                  "==",
                  studentId
                )
              );

            const redemptionSnap =
              await getDocs(
                redemptionQuery
              );

            redemptionSnap.docs.forEach(
              (redemptionDoc) => {

                redemptionDocs.set(
                  redemptionDoc.id,
                  redemptionDoc.data()
                );

              }
            );

          } catch (error) {

            console.error(
              "Legacy redemption query error:",
              error
            );

          }

        }

        redemptionDocs.forEach(
          (data) => {

            const businessId =
              String(
                data.businessId ||
                ""
              );

            if (
              !businessId
            ) {
              return;
            }

            legacyCounts[
              businessId
            ] =
              (
                legacyCounts[
                  businessId
                ] ||
                0
              ) + 1;

          }
        );

        Object.keys(
          legacyCounts
        ).forEach(
          (businessId) => {

            if (
              counts[
                businessId
              ] === undefined
            ) {

              counts[
                businessId
              ] =
                Math.min(
                  legacyCounts[
                    businessId
                  ],
                  MAX_REDEMPTIONS
                );

            }

          }
        );

        setUsageCounts(
          counts
        );

      } catch (error) {

        console.error(
          "Business usage loading error:",
          error
        );

        setUsageCounts(
          {}
        );

      }

    };

  /*
   * ==========================================
   * LOAD CATEGORIES
   * ==========================================
   */

  const loadCategories =
    async () => {

      try {

        const snap =
          await getDocs(
            collection(
              db,
              "categories"
            )
          );

        const data =
          snap.docs
            .map(
              (item) =>
                item.data()
            )
            .filter(
              (item: any) =>
                item.status !==
                "inactive"
            )
            .map(
              (item: any) =>
                item.name
            )
            .filter(Boolean);

        setCategories(
          Array.from(
            new Set(data)
          ) as string[]
        );

      } catch (error) {

        console.error(
          "Category loading error:",
          error
        );

      }

    };

  /*
   * ==========================================
   * FILTER OFFERS
   * ==========================================
   */

  const filteredOffers =
    useMemo(() => {

      let list =
        [...offers];

      if (
        category !==
        "All"
      ) {

        list =
          list.filter(
            (offer) =>
              offer.category ===
              category
          );

      }

      const searchText =
        search
          .trim()
          .toLowerCase();

      if (
        searchText
      ) {

        list =
          list.filter(
            (offer) =>
              offer.title
                ?.toLowerCase()
                .includes(
                  searchText
                ) ||

              offer.businessName
                ?.toLowerCase()
                .includes(
                  searchText
                ) ||

              offer.category
                ?.toLowerCase()
                .includes(
                  searchText
                )
          );

      }

      return list;

    }, [
      offers,
      search,
      category,
    ]);

  /*
   * ==========================================
   * CALL BUSINESS
   * ==========================================
   */

  const openOfferDetails =
    (offer: Offer) => {
      setDetailsOffer(offer);
    };

  const closeOfferDetails =
    () => {
      setDetailsOffer(null);
    };

  const callBusiness =
    (
      offer: Offer
    ) => {

      const phone =
        offer.businessMobile ||
        "";

      if (!phone) {

        alert(
          "📞 Business phone number is not available."
        );

        return;
      }

      window.location.href =
        `tel:${phone}`;

    };

  /*
   * ==========================================
   * GET USAGE
   * ==========================================
   */

  const getUsageCount =
    (
      businessId?: string
    ) => {

      if (
        !businessId
      ) {
        return 0;
      }

      return usageCounts[
        businessId
      ] || 0;

    };

  /*
   * ==========================================
   * OPEN REDEEM
   * ==========================================
   */

  const openRedeemVerification =
    (
      offer: Offer
    ) => {

      if (
        !offer.businessId
      ) {

        alert(
          "❌ Business information is missing for this offer."
        );

        return;
      }

      const usedCount =
        getUsageCount(
          offer.businessId
        );

      // SBC RULE:
      // One student can redeem from one business a maximum
      // of 4 times in total, regardless of which offer is selected.
      if (usedCount >= MAX_REDEMPTIONS) {
        alert(
          `🚫 Redemption limit reached. You can redeem from "${offer.businessName || "this business"}" only 4 times in total.`
        );
        return;
      }

      setSelectedOffer(
        offer
      );

      setVerifiedBusiness(
        null
      );

      setBusinessIdInput(
        ""
      );

      setVerificationError(
        ""
      );

      setScannerError(
        ""
      );

      setShowVerificationModal(
        true
      );

    };

  /*
   * ==========================================
   * EXTRACT BUSINESS ID FROM QR
   * ==========================================
   */

  const extractBusinessIdFromQr =
    (
      decodedText: string
    ) => {

      const value =
        decodedText.trim();

      try {

        const parsed =
          JSON.parse(
            value
          );

        if (
          parsed?.type ===
            "SBC_BUSINESS" &&
          parsed?.businessId
        ) {

          return String(
            parsed.businessId
          ).trim();

        }

      } catch {
        /*
         * Plain text QR fallback.
         */
      }

      if (
        value
          .toUpperCase()
          .startsWith(
            "SBC-BIZ-"
          )
      ) {
        return value;
      }

      return "";

    };

  /*
   * ==========================================
   * VERIFY BUSINESS ID
   * ==========================================
   */

  const verifyBusinessId =
    async (
      enteredBusinessId: string
    ) => {

      if (
        !selectedOffer
      ) {
        return;
      }

      const cleanBusinessId =
        enteredBusinessId
          .trim();

      if (
        !cleanBusinessId
      ) {

        setVerificationError(
          "Please enter a Business ID."
        );

        return;
      }

      if (
        !selectedOffer.businessId
      ) {

        setVerificationError(
          "Offer business information is missing."
        );

        return;
      }

      try {

        setVerificationLoading(
          true
        );

        setVerificationError(
          ""
        );

        const businessQuery =
          query(
            collection(
              db,
              "businesses"
            ),
            where(
              "businessId",
              "==",
              cleanBusinessId
            )
          );

        const businessSnap =
          await getDocs(
            businessQuery
          );

        if (
          businessSnap.empty
        ) {

          setVerifiedBusiness(
            null
          );

          setVerificationError(
            "❌ Invalid Business ID. Please check the ID and try again."
          );

          return;
        }

        const businessDoc =
          businessSnap.docs[0];

        const businessData =
          businessDoc.data();

        const actualBusinessId =
          businessDoc.id;

        if (
          actualBusinessId !==
          selectedOffer.businessId
        ) {

          setVerifiedBusiness(
            null
          );

          setVerificationError(
            `❌ This Business QR/ID belongs to "${businessData.businessName || "another business"}", not "${selectedOffer.businessName || "this offer's business"}".`
          );

          return;
        }

        setVerifiedBusiness({
          businessId:
            actualBusinessId,

          businessName:
            businessData.businessName ||
            selectedOffer.businessName ||
            "SBC Partner Business",
        });

      } catch (error) {

        console.error(
          "Business verification error:",
          error
        );

        setVerificationError(
          "❌ Unable to verify business. Please try again."
        );

      } finally {

        setVerificationLoading(
          false
        );

      }

    };

  /*
   * ==========================================
   * START QR SCANNER
   * ==========================================
   */

  const startScanner =
    async () => {

      setScannerError(
        ""
      );

      setScannerOpen(
        true
      );

      setTimeout(
        async () => {

          try {

            const scanner =
              new Html5Qrcode(
                "sbc-business-qr-reader"
              );

            await scanner.start(
              {
                facingMode:
                  "environment",
              },
              {
                fps: 10,
                qrbox: {
                  width: 250,
                  height: 250,
                },
                aspectRatio: 1,
              },
              async (
                decodedText
              ) => {

                try {

                  await scanner.stop();

                } catch {}

                try {

                  scanner.clear();

                } catch {}

                setScannerOpen(
                  false
                );

                const businessId =
                  extractBusinessIdFromQr(
                    decodedText
                  );

                if (
                  !businessId
                ) {

                  setScannerError(
                    "❌ This is not a valid SBC Business QR."
                  );

                  return;
                }

                await verifyBusinessId(
                  businessId
                );

              },
              () => {}
            );

          } catch (error) {

            console.error(
              "QR scanner error:",
              error
            );

            setScannerError(
              "❌ Camera could not be opened. Please allow camera permission or use Business ID."
            );

          }

        },
        300
      );

    };

  /*
   * ==========================================
   * CLOSE SCANNER
   * ==========================================
   */

  const closeScanner =
    () => {
      setScannerOpen(
        false
      );
    };

  /*
   * ==========================================
   * REDEEM MY BENEFIT
   * ==========================================
   */

  const redeemMyBenefit =
    async () => {

      if (
        !auth.currentUser
      ) {

        alert(
          "Please login again."
        );

        router.replace(
          "/student/login"
        );

        return;
      }

      if (
        !selectedOffer
      ) {
        return;
      }

      if (
        !verifiedBusiness
      ) {

        alert(
          "Please verify the business first."
        );

        return;
      }

      if (
        verifiedBusiness.businessId !==
        selectedOffer.businessId
      ) {

        alert(
          "❌ Business verification does not match this offer."
        );

        return;
      }

      const usedCount =
        getUsageCount(
          selectedOffer.businessId
        );

      // Re-check immediately before creating the request.
      // This prevents an old/open modal from bypassing the 4-use limit.
      if (usedCount >= MAX_REDEMPTIONS) {
        alert(
          `🚫 Redemption limit reached. You can redeem from "${selectedOffer.businessName || "this business"}" only 4 times in total.`
        );

        setShowVerificationModal(false);
        setSelectedOffer(null);
        setVerifiedBusiness(null);

        if (auth.currentUser) {
          await loadBusinessUsage(
            auth.currentUser.uid
          );
        }

        return;
      }

      try {

        setRedeemLoading(
          true
        );

        const studentUid =
          auth.currentUser.uid;

        /*
         * LOAD STUDENT
         */

        let studentName =
          "SBC Student";

        let studentCardNumber =
          "";

        try {

          const studentRef =
            doc(
              db,
              "students",
              studentUid
            );

          const studentSnap =
            await getDoc(
              studentRef
            );

          if (
            studentSnap.exists()
          ) {

            const studentData =
              studentSnap.data();

            studentName =
              studentData.name ||
              studentData.fullName ||
              studentData.studentName ||
              "SBC Student";

            studentCardNumber =
              studentData.cardNumber ||
              studentData.studentCardNumber ||
              "";

          }

        } catch (error) {

          console.error(
            "Student profile loading error:",
            error
          );

        }

        /*
         * ========================================
         * CREATE PENDING REQUEST
         * ========================================
         *
         * IMPORTANT:
         *
         * The secure server API returns the request ID.
         *
         * We save it in pendingRequestId
         * so Student can listen in real-time.
         * ========================================
         */

        const idToken =
          await auth.currentUser.getIdToken();

        const response = await fetch(
          `${API_BASE_URL}/api/redemption/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              businessId:
                selectedOffer.businessId,
              businessName:
                verifiedBusiness.businessName,
              businessVerificationId:
                verifiedBusiness.businessId,
              offerId:
                selectedOffer.id,
              offerTitle:
                selectedOffer.title ||
                "SBC Offer",
              offerDiscount:
                selectedOffer.discount ||
                "",
            }),
          }
        );

        const result =
          await response.json().catch(() => ({}));

        if (!response.ok || !result?.success) {
          throw new Error(
            result?.error ||
              "Unable to send redemption request."
          );
        }

        /*
         * Save request ID BEFORE
         * closing the verification modal.
         */

        setPendingRequestId(
          String(result.requestId)
        );

        /*
         * Save offer for waiting screen.
         */

        setPendingOffer(
          selectedOffer
        );

        /*
         * Close verification.
         */

        setShowVerificationModal(
          false
        );

        setSelectedOffer(
          null
        );

        setVerifiedBusiness(
          null
        );

      } catch (error) {

        console.error(
          "Create redemption request error:",
          error
        );

        alert(
          "❌ Unable to send redemption request. Please try again."
        );

      } finally {

        setRedeemLoading(
          false
        );

      }

    };

  /*
   * ==========================================
   * CLOSE APPROVED
   * ==========================================
   */

  const closeApproved =
    () => {

      setApprovedOffer(
        null
      );

      setApprovedPoints(0);

      setApprovedTotalPoints(0);

    };

  /*
   * ==========================================
   * CLOSE REJECTED
   * ==========================================
   */

  const closeRejected =
    () => {

      setRejectedOffer(
        null
      );

    };

  /*
   * ==========================================
   * RESPONSIVE OFFER IMAGE
   * ==========================================
   *
   * Desktop uses desktopImage.
   * Mobile uses mobileImage.
   * Old offers fall back to image.
   */

  const getOfferDesktopImage = (offer: Offer) =>
    offer.desktopImage ||
    offer.image ||
    "";

  const getOfferMobileImage = (offer: Offer) =>
    offer.mobileImage ||
    offer.desktopImage ||
    offer.image ||
    "";

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  const shareReferralLink = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        router.replace("/student/login");
        return;
      }

      const studentSnap = await getDoc(
        doc(db, "students", user.uid)
      );

      if (!studentSnap.exists()) {
        alert("Referral link is not available.");
        return;
      }

      const referralCode = String(
        studentSnap.data()?.referralCode || ""
      ).trim();

      if (!referralCode) {
        alert("Referral link is not available.");
        return;
      }

      const link =
        `${window.location.origin}/student/register?ref=${encodeURIComponent(referralCode)}`;

      const shareText =
        `Join Student Benefit Card (SBC) using my referral link and unlock student benefits: ${link}`;

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
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace("/student/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-slate-900 py-8">

      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* HEADER */}

        <header className="sticky top-0 z-30 -mx-4 mb-8 border-b border-black/10 bg-[#07111f]/95 text-white backdrop-blur-xl sm:-mx-6">
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

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/student/dashboard")}
                className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/10 hover:text-[#f1cf63]"
              >
                <span aria-hidden="true">⌂</span>
                Home
              </button>

              <button
                onClick={logout}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:border-[#d4af37]/60 hover:bg-[#d4af37]/10 hover:text-[#f1cf63]"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div>
          <div className="mb-8">
            <h1 className="text-4xl font-black tracking-tight text-[#07111f] sm:text-5xl">
              🎁 Student Offers
            </h1>

            <p className="mt-2 text-slate-500">
              Exclusive Benefits for SBC Students
            </p>
          </div>

        {/* FILTERS */}

        <div className="mb-10 grid gap-5 md:grid-cols-2">

          <input
            type="text"
            placeholder="🔍 Search Offers..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            className="w-full rounded-2xl border border-black/10 bg-white p-4 font-medium text-slate-800 shadow-[0_10px_35px_rgba(15,23,42,0.06)] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
          />

          <select
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value
              )
            }
            className="w-full rounded-2xl border border-black/10 bg-white p-4 font-medium text-slate-800 shadow-[0_10px_35px_rgba(15,23,42,0.06)] outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
          >

            <option value="All">
              All Categories
            </option>

            {categories.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}

          </select>

        </div>

        {/* OFFERS */}
        {loading ? (
          <div className="rounded-[2rem] border border-black/5 bg-white p-12 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#1557d6]" />
            <h2 className="text-2xl font-bold">Loading Offers...</h2>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="rounded-[2rem] border border-black/5 bg-white p-12 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="text-6xl">🎁</div>
            <h2 className="mt-4 text-3xl font-bold text-[#1557d6]">
              No Offers Found
            </h2>
            <p className="mt-3 text-gray-500">
              No active offers match your search or category.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOffers.map((offer) => {
              const usedCount = getUsageCount(offer.businessId);

              return (
                <article
                  key={offer.id}
                  className="group overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_42px_rgba(21,87,214,0.10)]"
                >
                  <div className="grid min-h-[150px] grid-cols-[42%_58%] sm:grid-cols-[34%_66%] lg:grid-cols-[38%_62%]">
                    {/* OFFER IMAGE */}
                    <div className="relative min-h-[150px] overflow-hidden bg-slate-100">
                      {(getOfferDesktopImage(offer) || getOfferMobileImage(offer)) ? (
                        <picture>
                          <source
                            media="(max-width: 639px)"
                            srcSet={getOfferMobileImage(offer)}
                          />
                          <img
                            src={getOfferDesktopImage(offer)}
                            alt={offer.title || "SBC Offer"}
                            loading="lazy"
                            className="h-full w-full object-contain transition duration-500"
                          />
                        </picture>
                      ) : (
                        <div className="flex h-full min-h-[150px] items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 text-5xl">
                          🎁
                        </div>
                      )}

                    </div>

                    {/* OFFER INFO */}
                    <div className="flex min-w-0 flex-col justify-between p-3 sm:p-4 lg:p-5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 sm:text-[10px]">
                              🏢 {offer.businessName || "SBC Partner Business"}
                            </p>

                            <h2 className="mt-1.5 line-clamp-2 text-sm font-black leading-tight text-[#07111f] sm:text-base lg:text-lg">
                              {offer.title || "SBC Offer"}
                            </h2>
                          </div>

                          <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 sm:inline-flex">
                            ✓ Verified
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-[8px] font-black text-[#1557d6] sm:text-[9px]">
                            {offer.category || "Other"}
                          </span>

                          {offer.discount && (
                            <span className="rounded-full bg-[#fff7dc] px-2 py-1 text-[9px] font-black text-[#9a7100] sm:text-[10px]">
                              🎁 {offer.discount}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-slate-500 sm:text-[10px] sm:leading-5">
                          {offer.description || "Exclusive benefits available for SBC students."}
                        </p>

                        {offer.businessAddress && (
                          <p className="mt-1.5 line-clamp-1 text-[8px] font-semibold text-slate-400 sm:text-[9px]">
                            📍 {offer.businessAddress}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[8px] font-black text-slate-400 sm:text-[9px]">
                            USED AT BUSINESS
                          </p>
                          <p className="mt-0.5 text-[9px] font-black text-slate-700 sm:text-[10px]">
                            {usedCount}/{MAX_REDEMPTIONS} redemptions
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => openOfferDetails(offer)}
                          className="shrink-0 rounded-xl bg-[#1557d6] px-3 py-2 text-[9px] font-black text-white shadow-sm transition hover:bg-[#0e47b6] sm:px-4 sm:py-2.5 sm:text-[10px]"
                        >
                          View Offer →
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* TOTAL */}

        {!loading && (

          <div className="mt-12 overflow-hidden rounded-[2rem] bg-[#07111f] p-8 text-white shadow-[0_25px_70px_rgba(7,17,31,0.16)]">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="text-3xl font-black text-white">
                  🎉 Total Active Offers
                </h2>

                <p className="mt-2 text-white/55">
                  Discover amazing benefits from SBC Partner Businesses.
                </p>

              </div>

              <div className="rounded-3xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-10 py-6">

                <span className="block text-center text-5xl font-black text-[#f1cf63]">
                  {filteredOffers.length}
                </span>

                <p className="text-center text-sm font-bold uppercase text-white">
                  Offers
                </p>

              </div>

            </div>

          </div>

        )}

      </div>

      </div>

      {/* ==========================================
          FULL OFFER DETAILS MODAL
      =========================================== */}

      {detailsOffer && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#020811]/80 p-4 backdrop-blur-sm"
          onClick={closeOfferDetails}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >

            {/* IMAGE */}

            <div className="relative h-56 overflow-hidden bg-[#07111f] sm:h-64">

              {(getOfferDesktopImage(detailsOffer) || getOfferMobileImage(detailsOffer)) ? (

                <picture>
                  <source
                    media="(max-width: 639px)"
                    srcSet={getOfferMobileImage(detailsOffer)}
                  />
                  <img
                    src={getOfferDesktopImage(detailsOffer)}
                    alt={detailsOffer.title || "Offer"}
                    className="h-full w-full object-contain"
                  />
                </picture>

              ) : (

                <div className="flex h-full items-center justify-center text-7xl text-[#f1cf63]">
                  🎁
                </div>

              )}

              <button
                type="button"
                onClick={closeOfferDetails}
                aria-label="Close full details"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl font-bold text-white backdrop-blur transition hover:bg-black/80"
              >
                ✕
              </button>

              <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">

                <span className="rounded-full bg-[#07111f] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                  {detailsOffer.category || "Other"}
                </span>

                <span className="rounded-full border border-[#d4af37]/50 bg-[#fff8df] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#8a680c]">
                  🔥 SBC Exclusive
                </span>

              </div>

            </div>

            {/* FULL DETAILS */}

            <div className="p-6 sm:p-7">

              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                🏢 Business
              </p>

              <h2 className="mt-1 text-lg font-black text-[#07111f]">
                {detailsOffer.businessName || "SBC Partner Business"}
              </h2>

              {/* ADDRESS */}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">

                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  📍 Full Business Address
                </p>

                <p className="mt-2 whitespace-pre-line break-words text-sm font-semibold leading-6 text-slate-700">
                  {detailsOffer.businessAddress || "Address not available"}
                </p>

              </div>

              {/* OFFER */}

              <div className="mt-5">

                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                  🎁 Offer
                </p>

                <h3 className="mt-2 text-2xl font-black leading-tight text-[#b18a16]">
                  {detailsOffer.title || "SBC Offer"}
                </h3>

                {detailsOffer.discount && (
                  <p className="mt-2 text-3xl font-black text-[#b18a16]">
                    {detailsOffer.discount}
                  </p>
                )}

              </div>

              {/* DESCRIPTION */}

              <div className="mt-5 rounded-2xl border border-[#d4af37]/20 bg-[#fffdf5] p-4">

                <p className="text-xs font-black uppercase tracking-wider text-[#8a680c]">
                  📝 Offer Full Details
                </p>

                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-700">
                  {detailsOffer.description || "No additional offer details available."}
                </p>

              </div>

              {/* USAGE */}

              <div className="mt-5 rounded-2xl border border-[#d4af37]/20 bg-[#fbfaf6] p-4">

                <div className="flex items-center justify-between gap-4">

                  <div>

                    <p className="text-xs font-black uppercase tracking-wider text-[#8a680c]">
                      🎟️ Your Usage at this Business
                    </p>

                    <p className="mt-1 text-lg font-black text-[#07111f]">
                      {getUsageCount(detailsOffer.businessId)} / {MAX_REDEMPTIONS} Redemptions Used
                    </p>

                  </div>

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-[#8a680c]">
                    {getUsageCount(detailsOffer.businessId)}/{MAX_REDEMPTIONS}
                  </div>

                </div>

                <p className="mt-2 text-xs font-semibold text-[#8a680c]">
                  {getUsageCount(detailsOffer.businessId) >= MAX_REDEMPTIONS
                    ? "You have reached the maximum 4 redemptions for this business."
                    : `${MAX_REDEMPTIONS - getUsageCount(detailsOffer.businessId)} redemption${MAX_REDEMPTIONS - getUsageCount(detailsOffer.businessId) === 1 ? "" : "s"} remaining for this business.`}
                </p>

              </div>

              {/* CONTACT */}

              {detailsOffer.businessMobile && (

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">

                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    📞 Business Contact
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#07111f]">
                    {detailsOffer.businessMobile}
                  </p>

                </div>

              )}

              {/* ACTIONS */}

              <div className="mt-6 grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() =>
                    callBusiness(detailsOffer)
                  }
                  className="rounded-xl bg-[#07111f] py-3.5 text-sm font-black text-white transition hover:bg-[#101d2e]"
                >
                  📞 Call Us
                </button>

                <button
                  type="button"
                  onClick={() => {
                    closeOfferDetails();
                    openRedeemVerification(detailsOffer);
                  }}
                  disabled={
                    getUsageCount(detailsOffer.businessId) >=
                    MAX_REDEMPTIONS
                  }
                  className={`rounded-xl py-3.5 text-sm font-black transition ${
                    getUsageCount(detailsOffer.businessId) >=
                    MAX_REDEMPTIONS
                      ? "cursor-not-allowed bg-slate-300 text-slate-500"
                      : "bg-[#d4af37] text-[#07111f] hover:bg-[#f1cf63]"
                  }`}
                >
                  {getUsageCount(detailsOffer.businessId) >=
                  MAX_REDEMPTIONS
                    ? "🚫 Limit Reached"
                    : "🎁 Redeem Offer"}
                </button>

              </div>

              <button
                type="button"
                onClick={closeOfferDetails}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          BUSINESS VERIFICATION MODAL
      =========================================== */}

      {showVerificationModal &&
        selectedOffer && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020811]/80 p-4 backdrop-blur-sm">

            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

              <div className="border-b p-6">

                <div className="flex items-center justify-between">

                  <div>

                    <h2 className="text-2xl font-extrabold text-green-700">
                      🎁 Redeem Benefit
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Verify the business first
                    </p>

                  </div>

                  <button
                    onClick={() => {
                      setShowVerificationModal(
                        false
                      );

                      setSelectedOffer(
                        null
                      );

                      setVerifiedBusiness(
                        null
                      );

                      setScannerOpen(
                        false
                      );
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    ✕
                  </button>

                </div>

              </div>

              <div className="space-y-5 p-6">

                {/* SELECTED OFFER */}

                <div className="rounded-2xl bg-slate-100 p-5">

                  <p className="text-xs font-bold uppercase text-gray-500">
                    Selected Offer
                  </p>

                  <h3 className="mt-2 text-xl font-extrabold text-green-700">
                    {selectedOffer.title}
                  </h3>

                  <p className="mt-1 font-bold text-yellow-500">
                    {selectedOffer.discount}
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    🏢{" "}
                    {selectedOffer.businessName}
                  </p>

                </div>

                {verifiedBusiness ? (

                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">

                    <p className="text-sm font-bold text-green-700">
                      ✅ Business Verified
                    </p>

                    <h3 className="mt-2 text-2xl font-extrabold text-green-800">
                      {verifiedBusiness.businessName}
                    </h3>

                    <p className="mt-1 text-sm text-green-700">
                      Business ID:{" "}
                      {verifiedBusiness.businessId}
                    </p>

                  </div>

                ) : (

                  <>

                    {/* QR */}

                    <div className="rounded-2xl border border-gray-200 bg-white p-5">

                      <h3 className="text-lg font-extrabold text-gray-800">
                        📷 Scan Business QR
                      </h3>

                      <p className="mt-2 text-sm text-gray-500">
                        Scan the SBC Business QR displayed at the business counter.
                      </p>

                      {!scannerOpen && (

                        <button
                          onClick={
                            startScanner
                          }
                          className="mt-4 w-full rounded-xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-700"
                        >
                          📷 Open QR Scanner
                        </button>

                      )}

                      {scannerOpen && (

                        <div className="mt-4">

                          <div
                            id="sbc-business-qr-reader"
                            className="overflow-hidden rounded-2xl border-2 border-blue-300"
                          />

                          <button
                            onClick={
                              closeScanner
                            }
                            className="mt-3 w-full rounded-xl bg-slate-800 py-3 font-black text-white transition hover:bg-slate-700"
                          >
                            ✕ Close Scanner
                          </button>

                        </div>

                      )}

                      {scannerError && (

                        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">
                          {scannerError}
                        </p>

                      )}

                    </div>

                    {/* OR */}

                    <div className="flex items-center gap-3">

                      <div className="h-px flex-1 bg-gray-200" />

                      <span className="text-sm font-bold text-gray-400">
                        OR
                      </span>

                      <div className="h-px flex-1 bg-gray-200" />

                    </div>

                    {/* BUSINESS ID */}

                    <div className="rounded-2xl border border-gray-200 bg-white p-5">

                      <h3 className="text-lg font-extrabold text-gray-800">
                        🔢 Enter Business ID
                      </h3>

                      <p className="mt-2 text-sm text-gray-500">
                        Use the Business ID printed below the QR.
                      </p>

                      <input
                        type="text"
                        value={
                          businessIdInput
                        }
                        onChange={(e) =>
                          setBusinessIdInput(
                            e.target.value
                          )
                        }
                        onKeyDown={(e) => {

                          if (
                            e.key ===
                            "Enter"
                          ) {

                            verifyBusinessId(
                              businessIdInput
                            );

                          }

                        }}
                        placeholder="Example: SBC-BIZ-10482"
                        className="mt-4 w-full rounded-xl border border-gray-300 p-4 font-bold uppercase outline-none focus:border-green-600"
                      />

                      <button
                        onClick={() =>
                          verifyBusinessId(
                            businessIdInput
                          )
                        }
                        disabled={
                          verificationLoading
                        }
                        className="mt-3 w-full rounded-xl bg-[#07111f] py-4 font-black text-white transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        {verificationLoading
                          ? "⏳ Verifying..."
                          : "✓ Verify Business"}
                      </button>

                    </div>

                  </>

                )}

                {/* ERROR */}

                {verificationError && (

                  <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">
                    {verificationError}
                  </div>

                )}

                {/* REDEEM */}

                {verifiedBusiness && (

                  <div className="rounded-2xl border border-[#d4af37]/30 bg-[#fffaf0] p-5">

                    <p className="text-sm font-bold text-yellow-700">
                      ⚠️ Ready to Redeem
                    </p>

                    <p className="mt-2 text-sm text-gray-700">
                      Your request will be sent to the business for approval.
                    </p>

                    <button
                      onClick={
                        redeemMyBenefit
                      }
                      disabled={
                        redeemLoading
                      }
                      className="mt-4 w-full rounded-2xl bg-[#d4af37] py-5 text-lg font-black text-[#07111f] shadow-lg transition hover:bg-[#f1cf63] disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                      {redeemLoading
                        ? "⏳ Sending Request..."
                        : "🎁 REDEEM MY BENEFIT"}
                    </button>

                  </div>

                )}

              </div>

            </div>

          </div>

        )}

      {/* ==========================================
          WAITING MODAL
      =========================================== */}

      {pendingOffer && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020811]/80 p-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-[2rem] border border-black/5 bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 text-4xl">
              ⏳
            </div>

            <h2 className="mt-6 text-3xl font-extrabold text-green-700">
              Waiting for Approval
            </h2>

            <p className="mt-3 text-lg font-bold text-gray-700">
              {pendingOffer.businessName}
            </p>

            <p className="mt-4 text-gray-600">
              Your redemption request has been sent to the business.
            </p>

            <p className="mt-3 font-bold text-yellow-600">
              🎁 Your rewards are also waiting!
            </p>

            <div className="mt-6 rounded-2xl bg-slate-100 p-4">

              <p className="text-sm text-gray-500">
                Offer
              </p>

              <p className="mt-1 text-lg font-extrabold text-green-700">
                {pendingOffer.title}
              </p>

            </div>

            <p className="mt-6 text-sm text-gray-500">
              Please wait while the business confirms your redemption.
            </p>

          </div>

        </div>

      )}

      {/* ==========================================
          APPROVED MODAL
      =========================================== */}

      {approvedOffer && (

        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">

          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

            <button
              type="button"
              onClick={closeApproved}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            >
              ✕
            </button>

            <div className="p-6 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl font-black text-green-600">
                ✓
              </div>

              <h2 className="mt-3 text-2xl font-black text-green-700">
                Approved Successfully!
              </h2>

              <p className="mt-1 text-sm font-extrabold text-gray-800">
                {approvedOffer.businessName}
              </p>

              <div className="mt-4 rounded-xl bg-emerald-50 p-4">

                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Benefit Redeemed
                </p>

                <p className="mt-1 text-base font-extrabold leading-5 text-green-700">
                  🎁 {approvedOffer.title}
                </p>

                {approvedOffer.discount && (
                  <p className="mt-1 text-sm font-black text-yellow-600">
                    {approvedOffer.discount}
                  </p>
                )}

              </div>

              <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-4">

                <p className="text-xs font-black uppercase tracking-wide text-purple-600">
                  ⭐ SBC Reward Points
                </p>

                <p className="mt-1 text-3xl font-black text-purple-700">
                  +{approvedPoints}
                </p>


              </div>

              <p className="mt-3 text-xs font-semibold text-gray-400">
                Redemption successful.
              </p>

              <button
                type="button"
                onClick={closeApproved}
                className="mt-4 w-full rounded-xl bg-[#07111f] py-3 text-sm font-black text-white transition hover:bg-[#101d2e]"
              >
                ✓ Done
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ==========================================
          REJECTED MODAL
      =========================================== */}

      {rejectedOffer && (

        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">

          <div className="w-full max-w-md rounded-[2rem] border border-black/5 bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
              ✕
            </div>

            <h2 className="mt-6 text-3xl font-extrabold text-red-600">
              Request Rejected
            </h2>

            <p className="mt-3 text-lg font-bold text-gray-800">
              {rejectedOffer.businessName}
            </p>

            <div className="mt-5 rounded-2xl bg-red-50 p-5">

              <p className="text-sm text-gray-500">
                Offer
              </p>

              <p className="mt-2 text-xl font-extrabold text-red-700">
                {rejectedOffer.title}
              </p>

            </div>

            <p className="mt-5 text-sm text-gray-600">
              The business did not approve this redemption request.
            </p>

            <button
              onClick={
                closeRejected
              }
              className="mt-6 w-full rounded-2xl bg-gray-700 py-4 font-bold text-white hover:bg-gray-800"
            >
              Close
            </button>

          </div>

        </div>

      )}


        {/* MOBILE BOTTOM NAV — SAME DESIGN AS STUDENT DASHBOARD */}
        <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+6px)] md:hidden">
          <div className="mx-auto max-w-lg rounded-[1.35rem] border border-[#24364d] bg-[#020d19]/95 p-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="grid grid-cols-4 items-center gap-1">

              {/* HOME — NORMAL */}
              <button
                type="button"
                onClick={() => router.push("/student/dashboard")}
                className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] px-1 py-1.5 text-white transition active:scale-[0.97]"
              >
                <span className="flex h-7 w-7 items-center justify-center text-white">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 21V14H15V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[10px] font-bold leading-4">Home</span>
              </button>

              {/* OFFERS — SELECTED */}
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] border border-[#d4af37] bg-[#d4af37]/10 px-1 py-1.5 text-[#f1cf63] transition active:scale-[0.97]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4af37] text-[#07111f]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M20.59 13.41L13.41 20.59C12.63 21.37 11.37 21.37 10.59 20.59L3.41 13.41C2.63 12.63 2.63 11.37 3.41 10.59L10.59 3.41C11.37 2.63 12.63 2.63 13.41 3.41L20.59 10.59C21.37 11.37 21.37 12.63 20.59 13.41Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-[10px] font-black leading-4">Offers</span>
                <span className="absolute bottom-0 h-1 w-16 max-w-[72%] rounded-full bg-[#f1cf63]" />
              </button>

              {/* SCAN & REDEEM — NORMAL */}
              <button
                type="button"
                onClick={() => router.push("/student/dashboard?open=scan")}
                className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] px-1 py-1.5 text-white transition active:scale-[0.97]"
              >
                <span className="flex h-7 w-7 items-center justify-center text-white">
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

              {/* REFER A FRIEND — DIRECT SHARE */}
              <button
                type="button"
                onClick={shareReferralLink}
                className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-[1.05rem] px-1 py-1.5 text-white transition active:scale-[0.97]"
              >
                <span className="flex h-7 w-7 items-center justify-center text-white">
                  <svg
                    width="25"
                    height="25"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
                    <path
                      d="M3.5 19C4.2 15.8 6 14 9 14C12 14 13.8 15.8 14.5 19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16 8V14M13 11H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="text-[10px] font-bold leading-4 text-center">
                  Refer a Friend
                </span>
              </button>

            </div>
          </div>
        </nav>

    </main>
  );
}
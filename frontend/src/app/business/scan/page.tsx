"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";

import { onAuthStateChanged } from "firebase/auth";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
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

      return Math.min(
        usageCounts[
          businessId
        ] || 0,
        MAX_REDEMPTIONS
      );

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

      if (
        usedCount >=
        MAX_REDEMPTIONS
      ) {

        alert(
          "🚫 You have reached the maximum 4 redemptions for this business."
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

      if (
        usedCount >=
        MAX_REDEMPTIONS
      ) {

        alert(
          "🚫 You have reached the maximum 4 redemptions for this business."
        );

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
         * addDoc returns the request ID.
         *
         * We save it in pendingRequestId
         * so Student can listen in real-time.
         * ========================================
         */

        const requestRef =
          await addDoc(
            collection(
              db,
              "redemptionRequests"
            ),
            {

              studentId:
                studentUid,

              studentName,

              studentCardNumber,

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

              status:
                "pending",

              createdAt:
                serverTimestamp(),

            }
          );

        /*
         * Save request ID BEFORE
         * closing the verification modal.
         */

        setPendingRequestId(
          requestRef.id
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
   * PAGE
   * ==========================================
   */

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">

        {/* COMPACT HEADER */}
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#f4c52b] sm:text-4xl">
              STUDENT PRIVILEGE CARD
            </h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Exclusive student offers &amp; benefits
            </p>
          </div>

          <button
            onClick={() => router.push("/student/dashboard")}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-[#f4c52b] transition hover:border-[#f4c52b]/40 hover:bg-[#f4c52b]/10"
          >
            ← Dashboard
          </button>
        </header>

        {/* CATEGORIES + SEARCH */}
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
              Browse Categories
            </h2>
            <span className="text-xs font-bold text-[#f4c52b]">
              {filteredOffers.length} Offers Available
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setCategory("All")}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                category === "All"
                  ? "border-[#f4c52b] bg-[#f4c52b] text-black"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
              }`}
            >
              All Offers
            </button>
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                  category === item
                    ? "border-[#f4c52b] bg-[#f4c52b] text-black"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <input
              type="text"
              placeholder="Search offers, businesses or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-[#f4c52b]/50 focus:bg-white/[0.055]"
            />
          </div>
        </section>

        {/* LOADING */}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-14 text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-[#f4c52b]" />
            <h2 className="text-lg font-bold">Loading Offers...</h2>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-14 text-center">
            <div className="text-5xl">🎁</div>
            <h2 className="mt-3 text-2xl font-black text-[#f4c52b]">No Offers Found</h2>
            <p className="mt-2 text-sm text-white/40">No active offers available.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOffers.map((offer) => {
              const usedCount = getUsageCount(offer.businessId);
              const limitReached = usedCount >= MAX_REDEMPTIONS;

              return (
                <article
                  key={offer.id}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-[#090a0c] transition duration-300 hover:-translate-y-1 hover:border-[#f4c52b]/35 hover:shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
                >
                  {/* COMPACT IMAGE */}
                  <div className="relative h-32 overflow-hidden bg-[#111318] sm:h-36">
                    {offer.image ? (
                      <img
                        src={offer.image}
                        alt={offer.title || "Offer"}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#111318] text-5xl">🎁</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/90 to-transparent" />

                    <span className="absolute left-3 top-3 rounded-full bg-[#f4c52b] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-black">
                      {offer.discount || "SBC OFFER"}
                    </span>

                    <button
                      type="button"
                      onClick={() => openRedeemVerification(offer)}
                      disabled={limitReached}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-black/20 bg-black/55 text-sm text-[#f4c52b] backdrop-blur transition hover:bg-[#f4c52b] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                      title={limitReached ? "Usage limit reached" : "Redeem offer"}
                    >
                      🔖
                    </button>
                  </div>

                  {/* SHORT & SWEET OFFER CONTENT */}
                  <div className="p-4 sm:p-5">

                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-[#f4c52b]/25 bg-[#f4c52b]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#f4c52b]">
                        {offer.category || "Other"}
                      </span>
                      <span className="text-[10px] font-semibold text-white/35">🔥 SBC Exclusive</span>
                    </div>

                    <p className="mt-3 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                      🏢 {offer.businessName || "SBC Partner Business"}
                    </p>

                    <h2 className="mt-1.5 line-clamp-2 text-xl font-black leading-tight text-white">
                      {offer.title || "Special Offer"}
                    </h2>

                    <p className="mt-1.5 line-clamp-1 text-xs text-white/45">
                      {offer.description || "Exclusive benefit for SBC students."}
                    </p>

                    {/* USAGE — KEEP EXISTING LOGIC */}
                    <div className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 ${
                      limitReached
                        ? "border-red-500/25 bg-red-500/10"
                        : "border-white/8 bg-white/[0.025]"
                    }`}>
                      <span className={`text-[11px] font-bold ${
                        limitReached ? "text-red-400" : "text-white/55"
                      }`}>
                        {limitReached ? "🚫 Limit reached" : `Used ${usedCount}/${MAX_REDEMPTIONS} times`}
                      </span>
                      {!limitReached && (
                        <span className="text-[11px] font-black text-[#f4c52b]">
                          {MAX_REDEMPTIONS - usedCount} left
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => callBusiness(offer)}
                        className="rounded-lg border border-white/10 bg-white/[0.04] py-2.5 text-xs font-bold text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        📞 Call
                      </button>
                      <button
                        onClick={() => openRedeemVerification(offer)}
                        disabled={limitReached}
                        className={`rounded-lg py-2.5 text-xs font-black transition ${
                          limitReached
                            ? "cursor-not-allowed bg-white/10 text-white/25"
                            : "bg-[#f4c52b] text-black hover:bg-[#ffd84d]"
                        }`}
                      >
                        🎁 Redeem
                      </button>
                    </div>

                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

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

        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3">

          <div className="relative w-full max-w-sm rounded-2xl border border-black/5 bg-white px-4 py-4 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)]">

            <button
              type="button"
              onClick={closeApproved}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl font-bold leading-none text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            >
              ×
            </button>

            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl">
              ✓
            </div>

            <h2 className="mt-2 text-xl font-black text-[#b18a16]">
              Approved!
            </h2>

            <p className="mt-0.5 text-sm font-bold text-gray-800">
              {approvedOffer.businessName}
            </p>

            <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2">
              <p className="text-sm font-extrabold leading-5 text-green-700">
                {approvedOffer.title}
              </p>

              {approvedOffer.discount && (
                <p className="mt-0.5 text-xs font-bold text-yellow-600">
                  {approvedOffer.discount}
                </p>
              )}
            </div>

            <div className="mt-2 rounded-lg border border-[#d4af37]/30 bg-[#fffaf0] px-3 py-2">
              <p className="text-xs font-extrabold text-yellow-700">
                🎉 Redemption Successful
              </p>
            </div>

            <div className="mt-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2">
              <p className="text-[11px] font-bold text-purple-600">
                ⭐ SBC Reward Points
              </p>

              <p className="mt-0.5 text-2xl font-black leading-7 text-purple-700">
                +{approvedPoints} Points
              </p>

              <p className="mt-0.5 text-[10px] font-semibold text-gray-600">
                Total points: {approvedTotalPoints}
              </p>
            </div>

            <button
              onClick={closeApproved}
              className="mt-3 w-full rounded-lg bg-[#07111f] py-2 text-sm font-black text-white transition hover:bg-[#101d2e]"
            >
              ✓ Done
            </button>

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

    </main>
  );
}
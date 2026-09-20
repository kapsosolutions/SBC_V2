import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  runTransaction,
  doc,
  Firestore,
} from "firebase/firestore";

import {
  Student,
  Offer,
  RedemptionResult,
} from "@/types/student";

interface RedeemParams {
  db: Firestore;
  businessId: string;
  student: Student;
  offer: Offer;
}

export async function redeemOffer({
  db,
  businessId,
  student,
  offer,
}: RedeemParams): Promise<RedemptionResult> {
  try {
    /*
     * ==========================================
     * BASIC VALIDATION
     * ==========================================
     */

    if (!businessId) {
      return {
        success: false,
        message: "Business not found.",
        usedCount: 0,
      };
    }

    if (!student?.id) {
      return {
        success: false,
        message: "Student not found.",
        usedCount: 0,
      };
    }

    if (!offer?.id) {
      return {
        success: false,
        message: "Offer not found.",
        usedCount: 0,
      };
    }

    /*
     * ==========================================
     * OFFER MUST BE ACTIVE
     * ==========================================
     */

    const offerRef =
      doc(
        db,
        "offers",
        offer.id
      );

    return await runTransaction(
      db,
      async (transaction) => {

        const offerSnap =
          await transaction.get(
            offerRef
          );

        if (
          !offerSnap.exists()
        ) {
          throw new Error(
            "Offer not found."
          );
        }

        const offerData =
          offerSnap.data();

        if (
          offerData.status !==
          "active"
        ) {
          throw new Error(
            "Offer is inactive."
          );
        }

        /*
         * ========================================
         * BUSINESS-WISE REDEMPTION CHECK
         * ========================================
         *
         * IMPORTANT:
         *
         * LIMIT IS NOT BASED ON offerId.
         *
         * LIMIT IS BASED ON:
         *
         * studentId + businessId
         *
         * Example:
         *
         * Business A
         *
         * Old Offer -> 3 uses
         *
         * Old Offer deleted
         *
         * New Offer -> usage remains 3/4
         *
         * Student can use only 1 more time.
         *
         * Maximum = 4 redemptions
         * per student per business.
         * ========================================
         */

        const redemptionQuery =
          query(
            collection(
              db,
              "redemptions"
            ),
            where(
              "studentId",
              "==",
              student.id
            ),
            where(
              "businessId",
              "==",
              businessId
            )
          );

        const redemptionSnap =
          await getDocs(
            redemptionQuery
          );

        const usedCount =
          redemptionSnap.size;

        /*
         * ========================================
         * HARD 4-USE LIMIT
         * ========================================
         */

        if (
          usedCount >= 4
        ) {
          return {
            success: false,
            message:
              "Limit Reached",
            usedCount,
          };
        }

        /*
         * ========================================
         * SAVE NEW REDEMPTION
         * ========================================
         *
         * businessId is stored permanently.
         *
         * offerId is stored only to know
         * which offer was used at that time.
         *
         * Future limit checks will NOT depend
         * on offerId.
         * ========================================
         */

        await addDoc(
          collection(
            db,
            "redemptions"
          ),
          {
            studentId:
              student.id,

            studentName:
              student.fullName ||
              "",

            studentMobile:
              student.mobile ||
              "",

            studentCardNumber:
              student.cardNumber ||
              "",

            /*
             * MAIN BUSINESS LINK
             */

            businessId:
              businessId,

            /*
             * OFFER HISTORY
             */

            offerId:
              offer.id,

            offerTitle:
              offer.title ||
              "",

            discount:
              offer.discount ||
              "",

            redeemedAt:
              serverTimestamp(),

            status:
              "redeemed",
          }
        );

        /*
         * ========================================
         * NEW TOTAL
         * ========================================
         */

        const nextCount =
          usedCount + 1;

        /*
         * ========================================
         * RESULT
         * ========================================
         */

        if (
          nextCount === 1
        ) {
          return {
            success: true,

            message:
              "First Time Use",

            usedCount:
              nextCount,
          };
        }

        if (
          nextCount === 4
        ) {
          return {
            success: true,

            message:
              "Final Use (4/4)",

            usedCount:
              nextCount,
          };
        }

        return {
          success: true,

          message:
            `Used ${nextCount}/4`,

          usedCount:
            nextCount,
        };
      }
    );

  } catch (error) {
    console.error(
      "Redeem Offer Error:",
      error
    );

    return {
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Redeem failed",

      usedCount: 0,
    };
  }
}
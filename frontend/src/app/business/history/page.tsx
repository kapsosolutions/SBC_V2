"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BusinessProtected from "@/components/BusinessProtected";

import { auth, db } from "@/lib/firebase";

import { onAuthStateChanged } from "firebase/auth";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

interface Redemption {
  id: string;
  studentName: string;
  studentMobile: string;
  studentCardNumber?: string;
  offerTitle: string;
  discount: string;
  redeemedAt?: any;
  businessId?: string;
  status?: string;
}

export default function RedemptionHistory() {
  const router = useRouter();

  const [history, setHistory] = useState<Redemption[]>([]);
  const [filteredHistory, setFilteredHistory] =
    useState<Redemption[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * ==========================================
   * LOAD BUSINESS REDEMPTION HISTORY
   * ==========================================
   */

  const loadHistory = async (businessId: string) => {
    try {
      setLoading(true);
      setError("");

      const q = query(
        collection(db, "redemptions"),
        where("businessId", "==", businessId)
      );

      const snap = await getDocs(q);

      const data: Redemption[] = snap.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          studentName: data.studentName || "",
          studentMobile: data.studentMobile || "",
          studentCardNumber:
            data.studentCardNumber || "",
          offerTitle: data.offerTitle || "",
          discount: data.discount || "",
          redeemedAt: data.redeemedAt,
          businessId: data.businessId || "",
          status: data.status || "redeemed",
        };
      });

      /*
       * Sort newest first.
       *
       * We intentionally do NOT use Firestore orderBy()
       * because redeemedAt is created using serverTimestamp()
       * and orderBy can require an index / cause loading issues.
       */

      data.sort((a, b) => {
        const timeA =
          a.redeemedAt?.toMillis?.() || 0;

        const timeB =
          b.redeemedAt?.toMillis?.() || 0;

        return timeB - timeA;
      });

      setHistory(data);
      setFilteredHistory(data);
    } catch (err) {
      console.error(
        "Redemption history error:",
        err
      );

      setError(
        "Unable to load redemption history. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * AUTH
   * ==========================================
   */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace("/business/login");
          return;
        }

        await loadHistory(user.uid);
      }
    );

    return () => unsubscribe();
  }, [router]);

  /*
   * ==========================================
   * SEARCH
   * ==========================================
   */

  useEffect(() => {
    const searchText =
      search.trim().toLowerCase();

    if (!searchText) {
      setFilteredHistory(history);
      return;
    }

    const filtered = history.filter((item) => {
      const studentName =
        item.studentName?.toLowerCase() || "";

      const mobile =
        item.studentMobile?.toLowerCase() || "";

      const cardNumber =
        item.studentCardNumber
          ?.toLowerCase() || "";

      const offerTitle =
        item.offerTitle?.toLowerCase() || "";

      return (
        studentName.includes(searchText) ||
        mobile.includes(searchText) ||
        cardNumber.includes(searchText) ||
        offerTitle.includes(searchText)
      );
    });

    setFilteredHistory(filtered);
  }, [search, history]);

  /*
   * ==========================================
   * FORMAT DATE
   * ==========================================
   */

  const formatDate = (timestamp: any) => {
    if (!timestamp) {
      return "Processing...";
    }

    try {
      if (timestamp.toDate) {
        return timestamp
          .toDate()
          .toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          });
      }

      if (timestamp instanceof Date) {
        return timestamp.toLocaleString(
          "en-IN",
          {
            dateStyle: "medium",
            timeStyle: "short",
          }
        );
      }

      return "Processing...";
    } catch {
      return "Processing...";
    }
  };

  /*
   * ==========================================
   * REFRESH
   * ==========================================
   */

  const refreshHistory = async () => {
    const user = auth.currentUser;

    if (!user) {
      router.replace("/business/login");
      return;
    }

    await loadHistory(user.uid);
  };

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <BusinessProtected>
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <h1 className="text-4xl font-bold text-orange-700">
                📊 Redemption History
              </h1>

              <p className="mt-2 text-gray-600">
                View all student offer redemptions
                made at your business.
              </p>
            </div>

            <div className="flex gap-3">

              <button
                onClick={refreshHistory}
                disabled={loading}
                className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                🔄 Refresh
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/business/dashboard"
                  )
                }
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
              >
                🏠 Dashboard
              </button>

            </div>
          </div>

          {/* SEARCH */}

          <div className="mb-8">
            <input
              type="text"
              placeholder="🔍 Search Student / Mobile / SBC Number / Offer..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="w-full rounded-2xl border border-gray-300 bg-white p-5 text-lg outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {/* ERROR */}

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">

              <h2 className="text-xl font-bold text-red-700">
                ❌ {error}
              </h2>

              <button
                onClick={refreshHistory}
                className="mt-4 rounded-xl bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-700"
              >
                🔄 Try Again
              </button>

            </div>
          )}

          {/* LOADING */}

          {loading ? (
            <div className="rounded-3xl bg-white p-12 text-center shadow-xl">

              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />

              <h2 className="text-2xl font-bold">
                Loading Redemption History...
              </h2>

              <p className="mt-2 text-gray-500">
                Please wait...
              </p>

            </div>
          ) : filteredHistory.length === 0 ? (

            /* EMPTY */

            <div className="rounded-3xl bg-white p-14 text-center shadow-xl">

              <div className="text-6xl">
                📊
              </div>

              <h2 className="mt-5 text-3xl font-bold">
                {search
                  ? "No Matching Redemptions"
                  : "No Redemption History"}
              </h2>

              <p className="mt-3 text-gray-500">
                {search
                  ? "Try a different student name, mobile number, SBC number or offer name."
                  : "Redeemed offers will appear here."}
              </p>

            </div>
          ) : (

            /* HISTORY LIST */

            <div className="grid gap-6">

              {filteredHistory.map(
                (item, index) => (

                  <div
                    key={item.id}
                    className="overflow-hidden rounded-3xl bg-white shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
                  >

                    {/* TOP BAR */}

                    <div className="flex flex-col gap-3 bg-gradient-to-r from-orange-500 to-red-500 p-5 text-white md:flex-row md:items-center md:justify-between">

                      <div>
                        <p className="text-sm font-semibold opacity-90">
                          Redemption #{filteredHistory.length - index}
                        </p>

                        <h2 className="text-2xl font-bold">
                          👨‍🎓 {item.studentName}
                        </h2>
                      </div>

                      <span className="w-fit rounded-full bg-white px-5 py-2 font-bold text-green-700">
                        ✅ Redeemed
                      </span>

                    </div>

                    {/* DETAILS */}

                    <div className="p-6">

                      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

                        {/* STUDENT */}

                        <div className="rounded-2xl bg-slate-100 p-5">

                          <p className="text-sm font-semibold text-gray-500">
                            👤 Student Name
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-gray-900">
                            {item.studentName || "-"}
                          </h3>

                        </div>

                        {/* CARD NUMBER */}

                        <div className="rounded-2xl bg-purple-50 p-5">

                          <p className="text-sm font-semibold text-purple-600">
                            🎫 SBC Card Number
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-purple-800">
                            {item.studentCardNumber || "-"}
                          </h3>

                        </div>

                        {/* MOBILE */}

                        <div className="rounded-2xl bg-blue-50 p-5">

                          <p className="text-sm font-semibold text-blue-600">
                            📱 Mobile
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-blue-800">
                            {item.studentMobile || "-"}
                          </h3>

                        </div>

                        {/* OFFER */}

                        <div className="rounded-2xl bg-green-50 p-5">

                          <p className="text-sm font-semibold text-green-600">
                            🎁 Offer
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-green-800">
                            {item.offerTitle || "-"}
                          </h3>

                        </div>

                        {/* DISCOUNT */}

                        <div className="rounded-2xl bg-yellow-50 p-5">

                          <p className="text-sm font-semibold text-yellow-700">
                            💰 Discount
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-yellow-800">
                            {item.discount || "-"}
                          </h3>

                        </div>

                        {/* DATE */}

                        <div className="rounded-2xl bg-orange-50 p-5">

                          <p className="text-sm font-semibold text-orange-600">
                            📅 Redeemed On
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-orange-800">
                            {formatDate(
                              item.redeemedAt
                            )}
                          </h3>

                        </div>

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>
          )}

          {/* TOTAL */}

          <div className="mt-10 rounded-3xl bg-white p-6 shadow-xl">

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="text-2xl font-bold">
                  📊 Total Redemptions
                </h2>

                <p className="mt-2 text-gray-500">
                  Total redeemed offers by your
                  business.
                </p>

                {search && (
                  <p className="mt-2 text-sm font-semibold text-orange-600">
                    Showing {filteredHistory.length}{" "}
                    matching result
                    {filteredHistory.length !== 1
                      ? "s"
                      : ""}
                  </p>
                )}

              </div>

              <div className="rounded-2xl bg-orange-100 px-8 py-5 text-center">

                <span className="block text-4xl font-bold text-orange-700">
                  {history.length}
                </span>

                <span className="text-sm font-semibold text-orange-600">
                  TOTAL
                </span>

              </div>

            </div>

          </div>

        </div>
      </main>
    </BusinessProtected>
  );
}
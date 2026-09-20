"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";
import { onAuthStateChanged } from "firebase/auth";
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

interface Business {
  businessId: string;
  businessName: string;
  sbcBusinessId: string;
}

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
}

const MAX_REDEMPTIONS = 4;

export default function StudentScanRedeem() {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [usageCount, setUsageCount] = useState(0);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [pendingOffer, setPendingOffer] = useState<Offer | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [approvedOffer, setApprovedOffer] = useState<Offer | null>(null);
  const [rejectedOffer, setRejectedOffer] = useState<Offer | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace("/student/login");
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!pendingRequestId) return;

    const requestRef = doc(db, "redemptionRequests", pendingRequestId);
    return onSnapshot(requestRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const status = String(data.status || "pending");

      if (status === "approved") {
        const offer: Offer = pendingOffer || {
          id: String(data.offerId || ""),
          title: String(data.offerTitle || "SBC Offer"),
          discount: String(data.offerDiscount || ""),
          businessId: String(data.businessId || ""),
          businessName: String(data.businessName || "SBC Partner Business"),
        };
        setApprovedOffer(offer);
        setPendingOffer(null);
        setPendingRequestId(null);
        setUsageCount((current) => Math.min(current + 1, MAX_REDEMPTIONS));
      }

      if (status === "rejected") {
        const offer: Offer = pendingOffer || {
          id: String(data.offerId || ""),
          title: String(data.offerTitle || "SBC Offer"),
          discount: String(data.offerDiscount || ""),
          businessId: String(data.businessId || ""),
          businessName: String(data.businessName || "SBC Partner Business"),
        };
        setRejectedOffer(offer);
        setPendingOffer(null);
        setPendingRequestId(null);
      }
    }, (error) => {
      console.error("Scan redemption listener error:", error);
    });
  }, [pendingRequestId, pendingOffer]);

  const extractBusinessId = (decodedText: string) => {
    const value = decodedText.trim();

    try {
      const parsed = JSON.parse(value);
      if (parsed?.type === "SBC_BUSINESS" && parsed?.businessId) {
        return String(parsed.businessId).trim();
      }
    } catch {}

    if (value.toUpperCase().startsWith("SBC-BIZ-")) return value;
    return "";
  };

  const loadBusiness = async (publicBusinessId: string) => {
    setLoading(true);
    setScannerError("");

    try {
      const businessQuery = query(
        collection(db, "businesses"),
        where("businessId", "==", publicBusinessId.trim().toUpperCase())
      );
      const businessSnap = await getDocs(businessQuery);

      if (businessSnap.empty) {
        setBusiness(null);
        setOffers([]);
        setScannerError("❌ Invalid SBC Business QR.");
        return;
      }

      const businessDoc = businessSnap.docs[0];
      const data = businessDoc.data();
      const businessAuthUid = businessDoc.id;

      // Load active offers with a single-field query and filter by
      // businessId on the client. This avoids requiring a Firestore
      // composite index for status + businessId and matches the
      // working Student Offers page behaviour.
      const offerQuery = query(
        collection(db, "offers"),
        where("status", "==", "active")
      );
      const offerSnap = await getDocs(offerQuery);

      const businessOffers = offerSnap.docs
        .filter((item) => {
          const offer = item.data();
          return String(offer.businessId || "").trim() === businessAuthUid;
        })
        .map((item) => {
        const offer = item.data();
        return {
          id: item.id,
          title: offer.title || "",
          discount: offer.discount || "",
          description: offer.description || "",
          category: offer.category || "Other",
          image: offer.image || offer.imageUrl || "",
          businessId: businessAuthUid,
          businessName: offer.businessName || data.businessName || "SBC Partner Business",
          businessMobile: offer.businessMobile || data.mobile || data.businessMobile || "",
          businessAddress: offer.businessAddress || offer.address || data.address || "",
        };
      });

      setBusiness({
        businessId: businessAuthUid,
        sbcBusinessId: String(data.businessId || publicBusinessId).trim(),
        businessName: data.businessName || "SBC Partner Business",
      });
      setOffers(businessOffers);

      // Do not read businessStudentUsage from the student client here.
      // The current Firestore rules intentionally do not allow a student
      // to read a missing usage document by ID, so that read can turn a
      // perfectly valid QR scan into a misleading "Unable to load" error.
      // The secure /api/redemption/create endpoint is authoritative for
      // the 4-use limit. Start the UI counter at 0 and increment it only
      // after a business approves a redemption.
      setUsageCount(0);
    } catch (error) {
      console.error("Scan business loading error:", error);
      setBusiness(null);
      setOffers([]);
      setScannerError("❌ Unable to load this business. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setScannerError("");
    setScannerOpen(true);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("sbc-dashboard-business-qr-reader");

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
          async (decodedText) => {
            try { await scanner.stop(); } catch {}
            try { scanner.clear(); } catch {}

            setScannerOpen(false);

            const businessId = extractBusinessId(decodedText);
            if (!businessId) {
              setScannerError("❌ This is not a valid SBC Business QR.");
              return;
            }

            await loadBusiness(businessId);
          },
          () => {}
        );
      } catch (error) {
        console.error("Dashboard QR scanner error:", error);
        setScannerError(
          "❌ Camera could not be opened. Please allow camera permission."
        );
      }
    }, 250);
  };

  const closeScanner = () => setScannerOpen(false);

  const redeemOffer = async (offer: Offer) => {
    if (!auth.currentUser || !business) {
      alert("Please login again.");
      return;
    }

    if (usageCount >= MAX_REDEMPTIONS) {
      alert(
        `🚫 Redemption limit reached. You can redeem from "${business.businessName}" only 4 times in total.`
      );
      return;
    }

    try {
      setRedeemLoading(true);

      const studentSnap = await getDoc(
        doc(db, "students", auth.currentUser.uid)
      );
      const studentData = studentSnap.exists() ? studentSnap.data() : {};

      const idToken = await auth.currentUser.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/redemption/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          businessId: business.businessId,
          businessName: business.businessName,
          businessVerificationId: business.sbcBusinessId,
          offerId: offer.id,
          offerTitle: offer.title || "SBC Offer",
          offerDiscount: offer.discount || "",
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success || !result?.requestId) {
        throw new Error(
          result?.error || "Unable to send redemption request."
        );
      }

      setPendingRequestId(String(result.requestId));
      setPendingOffer(offer);
      setSelectedOffer(null);
    } catch (error) {
      console.error("Create scan redemption request error:", error);
      alert("❌ Unable to send redemption request. Please try again.");
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-[#d4af37]/25 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b18a16]">
            Scan at Business
          </p>
          <h2 className="mt-2 text-3xl font-black text-[#07111f]">
            📷 Scan & Redeem
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
            Scan the SBC Business QR, view that business&apos;s active offers,
            choose an offer and send the redemption request directly to the business.
          </p>
        </div>

        <button
          type="button"
          onClick={startScanner}
          className="rounded-2xl bg-[#07111f] px-7 py-4 font-black text-[#f1cf63] shadow-lg transition hover:bg-[#101d2e]"
        >
          📷 Scan Business QR
        </button>
      </div>

      {scannerError && (
        <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">
          {scannerError}
        </div>
      )}

      {business && (
        <div className="mt-7 rounded-[1.5rem] border border-[#d4af37]/30 bg-[#fffdf5] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a680c]">
                Verified Business
              </p>
              <h3 className="mt-1 text-2xl font-black text-[#07111f]">
                {business.businessName}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {business.sbcBusinessId}
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
              {usageCount}/{MAX_REDEMPTIONS} Used
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl bg-white p-8 text-center">
              Loading offers...
            </div>
          ) : offers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center">
              <p className="font-black text-[#07111f]">No active offers available.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="overflow-hidden rounded-2xl border border-black/5 bg-white"
                >
                  {offer.image ? (
                    <img
                      src={offer.image}
                      alt={offer.title || "SBC Offer"}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-[#07111f] text-5xl">
                      🎁
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-wider text-[#8a680c]">
                      Offer
                    </p>
                    <h4 className="mt-1 text-xl font-black text-[#07111f]">
                      {offer.title || "SBC Offer"}
                    </h4>
                    {offer.discount && (
                      <p className="mt-2 text-2xl font-black text-[#b18a16]">
                        {offer.discount}
                      </p>
                    )}
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                      {offer.description || "Offer details available."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedOffer(offer)}
                      disabled={usageCount >= MAX_REDEMPTIONS}
                      className="mt-4 w-full rounded-xl bg-[#d4af37] py-3.5 text-sm font-black text-[#07111f] transition hover:bg-[#f1cf63] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      {usageCount >= MAX_REDEMPTIONS
                        ? "🚫 Limit Reached"
                        : "🎁 Redeem Offer"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {scannerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#020811]/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#b18a16]">
                  SBC Business
                </p>
                <h3 className="text-2xl font-black text-[#07111f]">
                  Scan QR Code
                </h3>
              </div>
              <button
                type="button"
                onClick={closeScanner}
                className="rounded-full bg-slate-100 px-4 py-2 font-black"
              >
                ✕
              </button>
            </div>
            <div
              id="sbc-dashboard-business-qr-reader"
              className="mt-5 overflow-hidden rounded-2xl border-2 border-[#d4af37]/40"
            />
            <button
              type="button"
              onClick={closeScanner}
              className="mt-4 w-full rounded-xl bg-[#07111f] py-3.5 font-black text-white"
            >
              Close Scanner
            </button>
          </div>
        </div>
      )}

      {selectedOffer && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[#020811]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
            <p className="text-xs font-black uppercase tracking-wider text-[#b18a16]">
              Confirm Redemption
            </p>
            <h3 className="mt-2 text-2xl font-black text-[#07111f]">
              {selectedOffer.title || "SBC Offer"}
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {business?.businessName}
            </p>
            {selectedOffer.discount && (
              <p className="mt-4 text-3xl font-black text-[#b18a16]">
                {selectedOffer.discount}
              </p>
            )}
            <p className="mt-4 rounded-2xl bg-[#fffaf0] p-4 text-sm font-semibold leading-6 text-slate-600">
              Your redemption request will be sent to the business for approval.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedOffer(null)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-3.5 font-black text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => redeemOffer(selectedOffer)}
                disabled={redeemLoading}
                className="rounded-xl bg-[#d4af37] py-3.5 font-black text-[#07111f] disabled:bg-slate-300"
              >
                {redeemLoading ? "Sending..." : "Redeem & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOffer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#020811]/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 text-4xl">
              ⏳
            </div>
            <h3 className="mt-6 text-3xl font-black text-[#07111f]">
              Waiting for Approval
            </h3>
            <p className="mt-3 text-lg font-black">{pendingOffer.businessName}</p>
            <p className="mt-2 font-bold text-[#b18a16]">{pendingOffer.title}</p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Your redemption request has been sent to the business. Please wait for approval.
            </p>
          </div>
        </div>
      )}

      {approvedOffer && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[#020811]/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
              ✅
            </div>
            <h3 className="mt-6 text-3xl font-black text-emerald-700">
              Redemption Approved
            </h3>
            <p className="mt-3 text-lg font-black">{approvedOffer.businessName}</p>
            <p className="mt-2 font-bold text-[#b18a16]">{approvedOffer.title}</p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Show this approval screen to the business.
            </p>
            <button
              type="button"
              onClick={() => setApprovedOffer(null)}
              className="mt-6 w-full rounded-xl bg-[#07111f] py-3.5 font-black text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {rejectedOffer && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[#020811]/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl">
              ❌
            </div>
            <h3 className="mt-6 text-3xl font-black text-red-700">
              Redemption Rejected
            </h3>
            <p className="mt-3 text-lg font-black">{rejectedOffer.businessName}</p>
            <p className="mt-2 font-bold">{rejectedOffer.title}</p>
            <button
              type="button"
              onClick={() => setRejectedOffer(null)}
              className="mt-6 w-full rounded-xl bg-[#07111f] py-3.5 font-black text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

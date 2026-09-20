"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function OfferDetails({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const id = params.id;

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      router.replace("/student/offers");
      return;
    }
    loadOffer();
  }, [id]);

  const loadOffer = async () => {
    try {
      const snap = await getDoc(doc(db, "offers", id));

      if (!snap.exists()) {
        alert("Offer not found");
        router.replace("/student/offers");
        return;
      }

      setOffer({
        id: snap.id,
        ...snap.data(),
      });
    } catch (e) {
      console.log(e);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-3xl font-bold">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="relative">
            <img
              src={offer.image}
              alt={`${offer.title} - SBC Student Exclusive Offer`}
              className="h-[420px] w-full object-cover"
            />

            <div className="absolute left-6 top-6">
              <span className="rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2 text-sm font-bold text-white shadow-lg">
                {offer.category}
              </span>
            </div>

            <div className="absolute right-6 top-6 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 px-6 py-3 shadow-xl">
              <span className="text-3xl font-extrabold text-white">
                {offer.discount}
              </span>
            </div>
          </div>

          <div className="bg-slate-100 p-8">
            <div className="mb-5 rounded-2xl border border-yellow-300 bg-yellow-50 p-5 shadow-sm">
              <p className="text-center text-sm font-black uppercase tracking-wider text-amber-700">
                🎓 SBC Members Only
              </p>
              <p className="mt-2 text-center text-base font-semibold text-slate-700">
                This is an exclusive offer available only to verified Student
                Benefit Card (SBC) members.
              </p>
            </div>

            <h1 className="text-5xl font-extrabold text-green-600">
              {offer.title}
            </h1>

            <p className="mt-2 text-xl font-semibold text-gray-600">
              🎁 Exclusive SBC Student Offer
            </p>

            <p className="mt-2 text-sm font-bold text-amber-700">
              Offer available exclusively for SBC members • Membership
              required to redeem
            </p>

            <div className="mt-8 rounded-2xl bg-white p-6 shadow-md">
              <h2 className="mb-3 text-2xl font-bold text-gray-800">
                SBC Exclusive Offer
              </h2>

              <p className="leading-8 text-gray-600">
                {offer.description}
              </p>

              <div className="mt-5 rounded-xl bg-green-50 p-4">
                <p className="text-sm font-bold leading-6 text-green-800">
                  ✓ Valid only for verified SBC members
                  <br />
                  ✓ Present your SBC account/QR when redeeming
                  <br />
                  ✓ Offer redemption is subject to business approval
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-6 shadow">
                <h3 className="mb-2 text-xl font-bold text-green-600">
                  Category
                </h3>
                <p className="text-lg text-gray-700">{offer.category}</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow">
                <h3 className="mb-2 text-xl font-bold text-green-600">
                  SBC Member Benefit
                </h3>
                <p className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 bg-clip-text text-3xl font-extrabold text-transparent">
                  {offer.discount}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <h3 className="text-lg font-black text-blue-900">
                How to Redeem Your SBC Offer
              </h3>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                Log in to your SBC student account, select this offer, and
                request redemption. The partner business will review and
                approve the redemption before the benefit is applied.
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-4 md:flex-row">
              <button
                onClick={() => router.push("/student/offers")}
                className="flex-1 rounded-2xl bg-gray-700 py-4 text-lg font-bold text-white transition hover:bg-gray-800"
              >
                ⬅️ Back to Offers
              </button>

              <button
                onClick={() => router.push("/student/dashboard")}
                className="flex-1 rounded-2xl bg-green-600 py-4 text-lg font-bold text-white transition hover:bg-green-700"
              >
                📱 Show My QR
              </button>

              <button
                onClick={async () => {
                  if (navigator.share) {
                    await navigator.share({
                      title: `${offer.title} - SBC Members Only`,
                      text: `Exclusive SBC Student Offer: ${offer.title}. Available only for verified SBC members.`,
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Offer link copied");
                  }
                }}
                className="flex-1 rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700"
              >
                📤 Share Offer
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BusinessProtected from "@/components/BusinessProtected";

import { auth, db } from "@/lib/firebase";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
} from "firebase/firestore";

interface Offer {
  id: string;
  title: string;
  discount: string;
  description: string;
  category: string;
  image: string;
  status: string;
}

export default function MyOffers() {
  const router = useRouter();

  const [offers, setOffers] =
    useState<Offer[]>([]);

  const [loading, setLoading] =
    useState(true);

  /*
   * Load business offers
   */
  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/business/login"
            );
            return;
          }

          try {
            const q = query(
              collection(db, "offers"),
              where(
                "businessId",
                "==",
                user.uid
              )
            );

            const snap =
              await getDocs(q);

            const loadedOffers =
              snap.docs.map((item) => {
                const data =
                  item.data();

                return {
                  id: item.id,
                  title:
                    data.title || "",
                  discount:
                    data.discount || "",
                  description:
                    data.description ||
                    "",
                  category:
                    data.category || "",
                  image:
                    data.image || "",
                  status:
                    data.status || "active",
                };
              });

            setOffers(
              loadedOffers
            );
          } catch (error) {
            console.error(
              "Error loading offers:",
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
   * Logout
   */
  const logout = async () => {
    try {
      await signOut(auth);

      router.replace(
        "/business/login"
      );
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  };

  /*
   * Delete offer
   */
  const deleteOffer = async (
    id: string,
    title: string
  ) => {
    const ok = window.confirm(
      `Delete "${title}" ?`
    );

    if (!ok) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "offers", id)
      );

      setOffers((prev) =>
        prev.filter(
          (offer) =>
            offer.id !== id
        )
      );

      alert(
        "✅ Offer Deleted Successfully"
      );
    } catch (error) {
      console.error(
        "Delete offer error:",
        error
      );

      alert(
        "❌ Failed to delete offer"
      );
    }
  };

  /*
   * Loading
   */
  if (loading) {
    return (
      <BusinessProtected>
        <main className="flex min-h-screen items-center justify-center bg-[#f5f3ed] p-6">
          <div className="w-full max-w-md rounded-[2rem] border border-black/5 bg-white p-10 text-center shadow-[0_20px_70px_rgba(15,23,42,0.09)]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#07111f] text-2xl text-[#f1cf63]">
              ✦
            </div>
            <div className="mx-auto mb-5 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#d4af37]" />
            <h2 className="text-2xl font-black text-[#07111f]">
              Loading Offers...
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Please wait...
            </p>
          </div>
        </main>
      </BusinessProtected>
    );
  }

  return (
    <BusinessProtected>
      <main className="min-h-screen bg-[#f5f3ed] py-8 text-slate-900 sm:py-10">

        <div className="mx-auto max-w-7xl px-4 sm:px-6">

          {/* HEADER */}
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b18a16]">
                SBC Business Portal
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight text-[#07111f] sm:text-4xl">
                🎁 My Offers
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Manage all your business offers in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => router.push("/business/dashboard")}
                className="rounded-full border border-[#d4af37]/40 bg-[#07111f] px-5 py-3 text-sm font-black text-[#f1cf63] shadow-lg transition hover:bg-[#101d2e]"
              >
                🏠 Dashboard
              </button>

              <button
                onClick={() => router.push("/business/add-offer")}
                className="rounded-full bg-[#d4af37] px-5 py-3 text-sm font-black text-[#07111f] shadow-lg transition hover:bg-[#f1cf63]"
              >
                ＋ Add Offer
              </button>

              <button
                onClick={logout}
                className="rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-black text-red-600 transition hover:bg-red-50"
              >
                Logout
              </button>
            </div>

          </div>

          {/* NO OFFERS */}
          {offers.length === 0 ? (

            <div className="rounded-[2rem] border border-black/5 bg-white p-10 text-center shadow-[0_20px_70px_rgba(15,23,42,0.08)] md:p-14">

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#07111f] text-4xl text-[#f1cf63]">
                🎁
              </div>

              <h2 className="mt-6 text-3xl font-black text-[#07111f]">
                No Offers Found
              </h2>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                Create your first offer and start giving exclusive privileges to SBC students.
              </p>

              <button
                onClick={() => router.push("/business/add-offer")}
                className="mt-7 rounded-xl bg-[#d4af37] px-8 py-3.5 text-sm font-black text-[#07111f] shadow-lg transition hover:bg-[#f1cf63]"
              >
                ＋ Create First Offer
              </button>

            </div>

          ) : (

            <>
              {/* OFFERS GRID */}
              <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">

                {offers.map((offer) => (

                  <div
                    key={offer.id}
                    className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-black/5 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:border-[#d4af37]/40 hover:shadow-[0_20px_55px_rgba(15,23,42,0.12)]"
                  >

                    {/* IMAGE */}
                    <div className="relative h-48 w-full shrink-0 overflow-hidden bg-[#07111f]">

                      {offer.image ? (
                        <img
                          src={offer.image}
                          alt={offer.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#07111f] text-5xl text-[#f1cf63]">
                          🎁
                        </div>
                      )}

                      {/* STATUS */}
                      <div className="absolute right-3 top-3">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider shadow-lg ${
                            offer.status === "active"
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-700 text-white"
                          }`}
                        >
                          {offer.status === "active"
                            ? "ACTIVE"
                            : offer.status?.toUpperCase()}
                        </span>
                      </div>

                    </div>

                    {/* CARD CONTENT */}
                    <div className="flex flex-1 flex-col p-5">

                      <div>
                        <span className="rounded-full bg-[#07111f] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                          {offer.category || "Other"}
                        </span>
                      </div>

                      <h2 className="mt-4 line-clamp-2 min-h-[52px] text-xl font-black leading-tight text-[#07111f]">
                        {offer.title}
                      </h2>

                      <p className="mt-2 line-clamp-1 text-2xl font-black text-[#b18a16]">
                        {offer.discount}
                      </p>

                      <p className="mt-3 line-clamp-3 min-h-[60px] text-sm leading-5 text-slate-500">
                        {offer.description || "No description available."}
                      </p>

                      <div className="flex-1" />

                      <div className="my-5 border-t border-black/5" />

                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={() =>
                            router.push(
                              `/business/edit-offer/${offer.id}`
                            )
                          }
                          className="rounded-xl border border-[#07111f]/10 bg-[#07111f] py-3 text-xs font-black text-white transition hover:bg-[#101d2e]"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          onClick={() =>
                            deleteOffer(
                              offer.id,
                              offer.title
                            )
                          }
                          className="rounded-xl border border-red-100 bg-red-50 py-3 text-xs font-black text-red-600 transition hover:bg-red-100"
                        >
                          🗑 Delete
                        </button>
                      </div>

                    </div>

                  </div>

                ))}

              </div>

              {/* TOTAL OFFERS */}
              <div className="mt-8 overflow-hidden rounded-[2rem] bg-[#07111f] p-6 text-white shadow-[0_20px_60px_rgba(7,17,31,0.15)] sm:p-7">

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d4af37]">
                      Offer Overview
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      Total Active Offers
                    </h2>

                    <p className="mt-1 text-sm text-white/50">
                      You currently have {offers.length}{" "}
                      {offers.length === 1 ? "offer" : "offers"}.
                    </p>
                  </div>

                  <div className="flex h-16 min-w-16 items-center justify-center rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-5">
                    <span className="text-3xl font-black text-[#f1cf63]">
                      {offers.length}
                    </span>
                  </div>

                </div>

              </div>
            </>
          )}

        </div>
      </main>
    </BusinessProtected>
  );
}
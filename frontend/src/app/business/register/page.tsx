"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { auth, db } from "@/lib/firebase";

import { createUserWithEmailAndPassword } from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

interface Category {
  id: string;
  name: string;
}

export default function BusinessRegister() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [categoriesLoading, setCategoriesLoading] =
    useState(true);

  const [businessName, setBusinessName] =
    useState("");

  const [ownerName, setOwnerName] =
    useState("");

  const [mobile, setMobile] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [address, setAddress] =
    useState("");

  /*
   * ==========================================
   * LOAD CATEGORIES FROM FIRESTORE
   * ==========================================
   */

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);

        const snap = await getDocs(
          collection(db, "categories")
        );

        const data: Category[] = snap.docs
          .map((item) => {
            const itemData = item.data();

            return {
              id: item.id,

              name:
                itemData.name ||
                itemData.category ||
                itemData.title ||
                "",
            };
          })
          .filter(
            (item) =>
              item.name.trim() !== ""
          )
          .sort((a, b) =>
            a.name.localeCompare(b.name)
          );

        setCategories(data);
      } catch (error) {
        console.error(
          "Category loading error:",
          error
        );

        alert(
          "Unable to load business categories."
        );
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, []);

  /*
   * ==========================================
   * REGISTER BUSINESS
   * ==========================================
   */

  const registerBusiness = async () => {
    if (
      !businessName.trim() ||
      !ownerName.trim() ||
      !mobile.trim() ||
      !password ||
      !category ||
      !address.trim()
    ) {
      alert("Fill all fields");
      return;
    }

    try {
      setLoading(true);

      /*
       * IMPORTANT:
       *
       * Keep existing .spc Firebase Auth format.
       *
       * Do NOT change this to .sbc because
       * existing business accounts use this format.
       */

      const loginEmail =
        `${mobile.trim()}@business.spc`;

      /*
       * CREATE FIREBASE AUTH USER
       */

      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          loginEmail,
          password
        );

      const uid =
        userCredential.user.uid;

      /*
       * SAVE BUSINESS DATA
       */

      await setDoc(
        doc(db, "businesses", uid),
        {
          uid,

          businessName:
            businessName.trim(),

          ownerName:
            ownerName.trim(),

          mobile:
            mobile.trim(),

          email:
            loginEmail,

          category,

          address:
            address.trim(),

          status:
            "pending",

          createdAt:
            serverTimestamp(),
        }
      );

      /*
       * SUCCESS
       */

      alert(
        "✅ Business registration successful!\n\nYour account is waiting for admin approval."
      );

      router.replace(
        "/business/login"
      );

    } catch (error: any) {
      console.error(
        "Business registration error:",
        error
      );

      if (
        error?.code ===
        "auth/email-already-in-use"
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
            "Business registration failed."
        );
      }

    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#07111f]">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(212,175,55,0.14),transparent_32%),radial-gradient(circle_at_90%_85%,rgba(7,17,31,0.09),transparent_30%),linear-gradient(135deg,#fffdf7_0%,#f5f3ed_52%,#eeeade_100%)]" />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#07111f]/10 blur-3xl" />

        <div className="relative w-full max-w-6xl">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-5 rounded-full border border-black/10 bg-white/85 px-5 py-2.5 text-sm font-bold text-[#07111f] shadow-sm backdrop-blur transition hover:border-[#d4af37]/50 hover:bg-white"
          >
            ← Back to Home
          </button>

          <div className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_30px_100px_rgba(7,17,31,0.16)] backdrop-blur-xl lg:grid-cols-[0.8fr_1.2fr]">

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
                  Grow with
                  <span className="block text-[#f1cf63]">SBC.</span>
                </h2>

                <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
                  Join the SBC partner network and offer exclusive benefits to students across your community.
                </p>
              </div>

              <div className="relative">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-xl">🎁</p>
                    <p className="mt-2 text-xs font-black">Create Offers</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-xl">🎓</p>
                    <p className="mt-2 text-xs font-black">Reach Students</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/35">
                  <span>Partner Registration</span>
                  <span className="text-[#f1cf63]">SBC • 2026</span>
                </div>
              </div>
            </div>

            {/* FORM */}
            <div className="p-6 sm:p-9 lg:p-11">
              <div className="mb-7 text-center lg:hidden">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#07111f] text-base font-black text-[#f1cf63] shadow-lg">
                  SBC
                </div>
              </div>

              <div className="text-center lg:text-left">
                <div className="inline-flex items-center rounded-full border border-[#d4af37]/30 bg-[#fff8df] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a680c]">
                  ✦ Business Registration
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#07111f] sm:text-4xl">
                  Become an SBC Partner
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  Register your business to start offering student benefits.
                </p>
              </div>

              <div className="mt-8 space-y-4">

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Business Name
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">🏪</span>
                      <input
                        type="text"
                        autoComplete="organization"
                        placeholder="Business name"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-3.5 pl-12 pr-4 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Owner Name
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">👤</span>
                      <input
                        type="text"
                        autoComplete="name"
                        placeholder="Owner name"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-3.5 pl-12 pr-4 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">📱</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-3.5 pl-12 pr-4 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Password
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔐</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Create password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-3.5 pl-12 pr-4 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={categoriesLoading}
                      className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] p-3.5 text-base text-[#07111f] outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="">
                        {categoriesLoading
                          ? "Loading Categories..."
                          : categories.length === 0
                          ? "No Categories Available"
                          : "Select Category"}
                      </option>

                      {categories.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!categoriesLoading && categories.length === 0 && (
                  <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
                    ❌ No categories available. Please contact SBC Admin.
                  </p>
                )}

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Business Address
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-4 text-lg">📍</span>
                    <textarea
                      autoComplete="street-address"
                      placeholder="Enter complete business address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-24 w-full rounded-2xl border border-black/10 bg-[#fbfaf6] py-3.5 pl-12 pr-4 text-base text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d4af37]/20 bg-[#fffdf5] p-4">
                  <p className="text-sm font-black text-[#8a680c]">
                    ✦ Admin Approval Required
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Your business account will become active after SBC Admin reviews and approves your registration.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={registerBusiness}
                  disabled={
                    loading ||
                    categoriesLoading ||
                    categories.length === 0
                  }
                  className="w-full rounded-2xl bg-[#07111f] py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(7,17,31,0.18)] transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "⏳ Registering..."
                    : "Register Business →"}
                </button>
              </div>

              <div className="mt-7 rounded-2xl border border-black/5 bg-[#fbfaf6] p-4 text-center text-sm text-slate-500">
                Already have a business account?{" "}
                <Link
                  href="/business/login"
                  className="font-black text-[#a37b0d] hover:text-[#07111f] hover:underline"
                >
                  Login
                </Link>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Student Benefit Card</span>
                <span className="text-[#a37b0d]">SBC • 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
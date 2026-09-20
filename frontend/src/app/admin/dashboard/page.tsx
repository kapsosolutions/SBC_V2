"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";

import AdminProtected from "@/components/AdminProtected";

import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

interface Category {
  id: string;
  name: string;
  createdAt?: unknown;
}

export default function AdminDashboard() {
  const router = useRouter();

  const [students, setStudents] = useState(0);
  const [businesses, setBusinesses] = useState(0);

  const [pendingBusinesses, setPendingBusinesses] =
    useState(0);

  const [pendingStudents, setPendingStudents] =
    useState(0);

  const [offers, setOffers] = useState(0);
  const [redemptions, setRedemptions] = useState(0);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [newCategory, setNewCategory] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [categoryLoading, setCategoryLoading] =
    useState(true);

  const [addingCategory, setAddingCategory] =
    useState(false);

  const [deletingCategory, setDeletingCategory] =
    useState<string | null>(null);

  /*
   * ==========================================
   * LOAD DASHBOARD
   * ==========================================
   */

  useEffect(() => {
    loadDashboard();
    loadCategories();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      /*
       * TOTAL STUDENTS
       */

      const studentSnap = await getDocs(
        collection(db, "students")
      );

      /*
       * TOTAL BUSINESSES
       */

      const businessSnap = await getDocs(
        collection(db, "businesses")
      );

      /*
       * PENDING BUSINESSES
       */

      const pendingBusinessQuery = query(
        collection(db, "businesses"),
        where("status", "==", "pending")
      );

      const pendingBusinessSnap =
        await getDocs(
          pendingBusinessQuery
        );

      /*
       * PENDING STUDENTS
       */

      const pendingStudentQuery = query(
        collection(db, "students"),
        where("status", "==", "pending")
      );

      const pendingStudentSnap =
        await getDocs(
          pendingStudentQuery
        );

      /*
       * TOTAL OFFERS
       */

      const offerSnap = await getDocs(
        collection(db, "offers")
      );

      /*
       * TOTAL REDEMPTIONS
       */

      const redemptionSnap =
        await getDocs(
          collection(
            db,
            "redemptions"
          )
        );

      /*
       * UPDATE COUNTS
       */

      setStudents(
        studentSnap.size
      );

      setBusinesses(
        businessSnap.size
      );

      setPendingBusinesses(
        pendingBusinessSnap.size
      );

      setPendingStudents(
        pendingStudentSnap.size
      );

      setOffers(
        offerSnap.size
      );

      setRedemptions(
        redemptionSnap.size
      );

    } catch (error) {
      console.error(
        "Dashboard loading error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * LOAD CATEGORIES
   * ==========================================
   */

  const loadCategories = async () => {
    try {
      setCategoryLoading(true);

      const snap = await getDocs(
        collection(db, "categories")
      );

      const data = snap.docs
        .map((item) => ({
          id: item.id,

          name:
            item.data().name || "",

          createdAt:
            item.data().createdAt,
        }))
        .filter(
          (category) =>
            category.name.trim() !== ""
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
    } finally {
      setCategoryLoading(false);
    }
  };

  /*
   * ==========================================
   * ADD CATEGORY
   * ==========================================
   */

  const handleAddCategory = async () => {
    const categoryName =
      newCategory.trim();

    if (!categoryName) {
      alert(
        "Please enter a category name."
      );

      return;
    }

    try {
      setAddingCategory(true);

      /*
       * CHECK DUPLICATE
       */

      const existingCategory =
        categories.find(
          (category) =>
            category.name
              .trim()
              .toLowerCase() ===
            categoryName.toLowerCase()
        );

      if (existingCategory) {
        alert(
          `"${categoryName}" already exists.`
        );

        return;
      }

      /*
       * SAVE CATEGORY
       */

      const categoryRef =
        await addDoc(
          collection(
            db,
            "categories"
          ),
          {
            name: categoryName,

            createdAt:
              serverTimestamp(),
          }
        );

      /*
       * UPDATE UI
       */

      setCategories((current) =>
        [
          ...current,

          {
            id: categoryRef.id,
            name: categoryName,
          },
        ].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setNewCategory("");

      alert(
        `"${categoryName}" category added successfully.`
      );

    } catch (error) {
      console.error(
        "Add category error:",
        error
      );

      alert(
        "Unable to add category. Please try again."
      );

    } finally {
      setAddingCategory(false);
    }
  };

  /*
   * ==========================================
   * DELETE CATEGORY
   * ==========================================
   */

  const handleDeleteCategory = async (
    category: Category
  ) => {
    const ok =
      window.confirm(
        `Delete "${category.name}" category?\n\nThis will remove it from the category list. Existing businesses and offers will NOT be deleted.`
      );

    if (!ok) {
      return;
    }

    try {
      setDeletingCategory(
        category.id
      );

      await deleteDoc(
        doc(
          db,
          "categories",
          category.id
        )
      );

      setCategories((current) =>
        current.filter(
          (item) =>
            item.id !==
            category.id
        )
      );

      alert(
        `"${category.name}" category deleted successfully.`
      );

    } catch (error) {
      console.error(
        "Delete category error:",
        error
      );

      alert(
        "Unable to delete category. Please try again."
      );

    } finally {
      setDeletingCategory(null);
    }
  };

  /*
   * ==========================================
   * CATEGORY ENTER
   * ==========================================
   */

  const handleCategoryKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();

      handleAddCategory();
    }
  };

  /*
   * ==========================================
   * LOGOUT
   * ==========================================
   */

  const logout = async () => {
    try {
      await signOut(auth);

      router.replace(
        "/admin/login"
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
   * TOTAL PENDING APPROVALS
   * ==========================================
   */

  const totalPendingApprovals =
    pendingBusinesses +
    pendingStudents;

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <AdminProtected>

      <main className="min-h-screen bg-[#f5f3ed] p-4 md:p-8">

        <div className="mx-auto max-w-7xl">

          {/* ==================================
              HEADER
          =================================== */}

          <div className="mb-8 flex flex-col gap-5 rounded-[2rem] bg-[#07111f] p-6 shadow-[0_20px_60px_rgba(7,17,31,0.16)] md:flex-row md:items-center md:justify-between md:p-7">

            <div>

              <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                👋 Welcome Super Admin
              </h1>

              <p className="mt-2 text-white/60">
                SBC Administration Dashboard
              </p>

            </div>

            <button
              onClick={logout}
              className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-6 py-3 font-black text-[#f1cf63] transition hover:bg-[#d4af37]/20"
            >
              Logout
            </button>

          </div>


          {/* ==================================
              STATISTICS
          =================================== */}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

            {/* STUDENTS */}

            <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)] md:p-7">

              <p className="text-slate-500">
                👨‍🎓 Total Students
              </p>

              <h2 className="mt-4 text-5xl font-black text-[#b18a16]">

                {loading
                  ? "..."
                  : students}

              </h2>

            </div>


            {/* BUSINESSES */}

            <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)] md:p-7">

              <p className="text-slate-500">
                🏪 Total Businesses
              </p>

              <h2 className="mt-4 text-5xl font-black text-[#8a680c]">

                {loading
                  ? "..."
                  : businesses}

              </h2>

            </div>


            {/* OFFERS */}

            <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)] md:p-7">

              <p className="text-slate-500">
                🎁 Total Offers
              </p>

              <h2 className="mt-4 text-5xl font-black text-[#b18a16]">

                {loading
                  ? "..."
                  : offers}

              </h2>

            </div>


            {/* REDEMPTIONS */}

            <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)] md:p-7">

              <p className="text-slate-500">
                🎉 Total Redemptions
              </p>

              <h2 className="mt-4 text-5xl font-black text-[#8a680c]">

                {loading
                  ? "..."
                  : redemptions}

              </h2>

            </div>

          </div>


          {/* ==================================
              CATEGORY MANAGEMENT
          =================================== */}

          <div className="mt-10 rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)] md:p-8">

            <div className="mb-6">

              <h2 className="text-3xl font-bold text-[#8a680c]">
                🏷️ Manage Categories
              </h2>

              <p className="mt-2 text-white/60">
                Add or remove categories used
                across Business Registration,
                Offers and Student Offers.
              </p>

            </div>


            {/* ADD CATEGORY */}

            <div className="rounded-2xl bg-[#fffaf0] p-5">

              <label className="mb-2 block font-bold text-[#07111f]">
                Add New Category
              </label>

              <div className="flex flex-col gap-3 md:flex-row">

                <input
                  type="text"
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleCategoryKeyDown
                  }
                  placeholder="Example: Bakery"
                  className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/15"
                  disabled={
                    addingCategory
                  }
                />

                <button
                  onClick={
                    handleAddCategory
                  }
                  disabled={
                    addingCategory
                  }
                  className="rounded-xl bg-[#07111f] px-7 py-3 font-bold text-white transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {addingCategory
                    ? "Adding..."
                    : "➕ Add Category"}

                </button>

              </div>

            </div>


            {/* CATEGORY LIST */}

            <div className="mt-6">

              <div className="mb-4 flex items-center justify-between">

                <h3 className="text-xl font-bold text-[#07111f]">
                  Available Categories
                </h3>

                <span className="rounded-full bg-[#fff8df] px-4 py-2 text-sm font-bold text-[#8a680c]">
                  {categories.length} Categories
                </span>

              </div>


              {categoryLoading ? (

                <div className="rounded-2xl bg-[#fbfaf6] p-6 text-center">

                  <p className="font-semibold text-slate-500">
                    Loading categories...
                  </p>

                </div>

              ) : categories.length === 0 ? (

                <div className="rounded-2xl border-2 border-dashed border-black/10 bg-[#fbfaf6] p-8 text-center">

                  <p className="text-lg font-bold text-slate-600">
                    No categories added yet.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Add your first category above.
                  </p>

                </div>

              ) : (

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  {categories.map(
                    (category) => (

                      <div
                        key={
                          category.id
                        }
                        className="flex items-center justify-between rounded-2xl border border-black/5 bg-[#fbfaf6] p-4"
                      >

                        <div className="flex min-w-0 items-center gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff8df] text-xl">
                            🏷️
                          </div>

                          <span className="truncate font-bold text-[#07111f]">
                            {category.name}
                          </span>

                        </div>

                        <button
                          onClick={() =>
                            handleDeleteCategory(
                              category
                            )
                          }
                          disabled={
                            deletingCategory ===
                            category.id
                          }
                          className="ml-3 shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-[#07111f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >

                          {deletingCategory ===
                          category.id
                            ? "..."
                            : "🗑️"}

                        </button>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>

          </div>


          {/* ==================================
              REFERRAL PAYOUT CENTER
          =================================== */}

          <div className="mt-10 overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white shadow-[0_18px_55px_rgba(7,17,31,0.08)]">

            <div className="flex flex-col gap-6 p-7 md:flex-row md:items-center md:justify-between md:p-9">

              <div className="max-w-3xl">

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    Admin Finance
                  </span>

                  <span className="rounded-full bg-[#07111f] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#f1cf63]">
                    Referral Rewards
                  </span>
                </div>

                <h2 className="mt-4 text-3xl font-black text-emerald-700 md:text-4xl">
                  💰 Referral Payouts
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                  Review student payout requests, verify UPI or bank details,
                  make the payment, enter the UTR and mark the request as paid.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                    📋 Pending payout requests
                  </span>

                  <span className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                    🏦 UPI / Bank details
                  </span>

                  <span className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                    🔐 UTR tracking
                  </span>
                </div>

              </div>

              <Link
                href="/admin/payouts"
                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#07111f] px-7 py-4 text-sm font-black text-[#f1cf63] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#111d2d]"
              >
                Open Referral Payouts →
              </Link>

            </div>

          </div>


          {/* ==================================
              QUICK ACTIONS
          =================================== */}

          <div className="mt-10 grid gap-6 md:grid-cols-2">

            {/* PENDING APPROVALS */}

            <Link
              href="/admin/pending-approvals"
              className="rounded-[2rem] border-2 border-[#d4af37]/30 bg-white p-8 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:scale-[1.02] hover:border-[#d4af37] hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)]"
            >

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h2 className="text-3xl font-bold text-[#8a680c]">
                    ⏳ Pending Approvals
                  </h2>

                  <p className="mt-3 text-slate-600">
                    Review and approve pending
                    student and business
                    registrations.
                  </p>

                </div>

                <div className="shrink-0 rounded-2xl bg-[#fff8df] px-5 py-3 text-center">

                  <span className="block text-3xl font-extrabold text-[#8a680c]">

                    {loading
                      ? "..."
                      : totalPendingApprovals}

                  </span>

                  <span className="text-xs font-bold uppercase text-[#8a680c]">
                    Pending
                  </span>

                </div>

              </div>

            </Link>
            <Link
  href="/admin/notifications"
  className="rounded-[2rem] bg-white p-8 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)]"
>
  <h2 className="text-3xl font-bold text-[#b18a16]">
    🔔 Send Notifications
  </h2>

  <p className="mt-3 text-slate-600">
    Send web push notifications to all registered students.
  </p>
</Link>


            {/* REFERRAL PAYOUTS */}

            <Link
              href="/admin/referrals"
              className="rounded-[2rem] border-2 border-[#d4af37]/30 bg-gradient-to-br from-[#fffdf5] to-[#f7f1dd] p-8 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:scale-[1.02] hover:border-[#d4af37] hover:shadow-[0_25px_70px_rgba(120,90,20,0.14)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-[#8a680c]">
                    🎁 Referral Management
                  </h2>
                  <p className="mt-3 text-slate-600">
                    See who referred whom, full student details, and referral history.
                  </p>
                </div>

                <div className="shrink-0 rounded-2xl bg-[#07111f] px-5 py-3 text-center text-[#f1cf63]">
                  <span className="block text-2xl font-extrabold">
                    VIEW
                  </span>
                  <span className="text-xs font-bold uppercase">
                    REFERRAL DETAILS
                  </span>
                </div>
              </div>

              <div className="mt-6 inline-flex rounded-xl bg-[#07111f] px-5 py-3 text-sm font-black text-[#f1cf63]">
                Open Referral Management →
              </div>
            </Link>


            {/* BUSINESSES */}

            <Link
              href="/admin/businesses"
              className="rounded-[2rem] bg-white p-8 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)]"
            >

              <h2 className="text-3xl font-bold text-[#8a680c]">
                🏪 Manage Businesses
              </h2>

              <p className="mt-3 text-slate-600">
                Approve, Reject and Manage Businesses
              </p>

            </Link>


            {/* STUDENTS */}

            <Link
              href="/admin/students"
              className="rounded-[2rem] bg-white p-8 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)]"
            >

              <h2 className="text-3xl font-bold text-[#b18a16]">
                👨‍🎓 Manage Students
              </h2>

              <p className="mt-3 text-slate-600">
                View all registered students
              </p>

            </Link>


            {/* OFFERS */}

            <Link
              href="/admin/offers"
              className="rounded-[2rem] bg-white p-8 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)]"
            >

              <h2 className="text-3xl font-bold text-[#b18a16]">
                🎁 Manage Offers
              </h2>

              <p className="mt-3 text-slate-600">
                View and manage all offers
              </p>

            </Link>


            {/* REDEMPTIONS */}

            <Link
              href="/admin/redemptions"
              className="rounded-[2rem] bg-white p-8 shadow-[0_18px_55px_rgba(7,17,31,0.08)] transition hover:scale-[1.02] hover:shadow-[0_25px_70px_rgba(7,17,31,0.12)]"
            >

              <h2 className="text-3xl font-bold text-[#8a680c]">
                📊 Redemption Reports
              </h2>

              <p className="mt-3 text-slate-600">
                View all redemption history
              </p>

            </Link>

          </div>


          {/* ==================================
              PORTAL INFORMATION
          =================================== */}

          <div className="mt-10 rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)] md:p-8">

            <h2 className="text-3xl font-bold text-[#b18a16]">
              🚀 SBC Admin Portal
            </h2>

            <p className="mt-4 text-lg text-slate-600">
              Manage Students, Businesses,
              Offers, Categories and
              Redemptions from one central
              dashboard.
            </p>

          </div>

        </div>

      </main>

    </AdminProtected>
  );
}
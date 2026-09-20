"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";

import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";

interface Business {
  id: string;
  businessName: string;
  ownerName: string;
  mobile: string;
  category: string;
  status: string;
  createdAt?: any;
}

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // VIEW / EDIT BUSINESS
  const [selectedBusiness, setSelectedBusiness] =
    useState<Business | null>(null);
  const [modalMode, setModalMode] =
    useState<"view" | "edit" | null>(null);
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editCategory, setEditCategory] = useState("");

  /*
   * ==========================================
   * LOAD BUSINESSES
   * ==========================================
   */

  const loadBusinesses = async () => {
    try {
      setLoading(true);

      const snap = await getDocs(
        collection(db, "businesses")
      );

      const data = snap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Business[];

      setBusinesses(data);
    } catch (error) {
      console.error(
        "Error loading businesses:",
        error
      );

      alert(
        "Unable to load businesses."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  /*
   * ==========================================
   * APPROVE BUSINESS
   * ==========================================
   */

  const approveBusiness = async (
    id: string,
    name: string
  ) => {
    const ok = window.confirm(
      `Approve "${name}" as an SBC Partner Business?`
    );

    if (!ok) {
      return;
    }

    try {
      setActionLoading(id);

      await updateDoc(
        doc(db, "businesses", id),
        {
          status: "approved",
        }
      );

      setBusinesses(
        (currentBusinesses) =>
          currentBusinesses.map(
            (business) =>
              business.id === id
                ? {
                    ...business,
                    status: "approved",
                  }
                : business
          )
      );

      alert(
        `${name} approved successfully.`
      );
    } catch (error) {
      console.error(
        "Error approving business:",
        error
      );

      alert(
        "Unable to approve business."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ==========================================
   * REJECT BUSINESS
   * ==========================================
   */

  const rejectBusiness = async (
    id: string,
    name: string
  ) => {
    const ok = window.confirm(
      `Reject "${name}"?`
    );

    if (!ok) {
      return;
    }

    try {
      setActionLoading(id);

      await updateDoc(
        doc(db, "businesses", id),
        {
          status: "rejected",
        }
      );

      setBusinesses(
        (currentBusinesses) =>
          currentBusinesses.map(
            (business) =>
              business.id === id
                ? {
                    ...business,
                    status: "rejected",
                  }
                : business
          )
      );

      alert(
        `${name} rejected.`
      );
    } catch (error) {
      console.error(
        "Error rejecting business:",
        error
      );

      alert(
        "Unable to reject business."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ==========================================
   * VIEW BUSINESS
   * ==========================================
   */

  const openViewBusiness = (business: Business) => {
    setSelectedBusiness(business);
    setModalMode("view");
  };

  /*
   * ==========================================
   * EDIT BUSINESS
   * ==========================================
   */

  const openEditBusiness = (business: Business) => {
    setSelectedBusiness(business);
    setEditBusinessName(business.businessName || "");
    setEditOwnerName(business.ownerName || "");
    setEditMobile(business.mobile || "");
    setEditCategory(business.category || "");
    setModalMode("edit");
  };

  const closeBusinessModal = () => {
    setSelectedBusiness(null);
    setModalMode(null);
  };

  const saveBusiness = async () => {
    if (!selectedBusiness) return;

    const businessName = editBusinessName.trim();
    const ownerName = editOwnerName.trim();
    const mobile = editMobile.trim();
    const category = editCategory.trim();

    if (!businessName || !ownerName || !mobile || !category) {
      alert("Please fill all business details.");
      return;
    }

    try {
      setActionLoading(selectedBusiness.id);

      await updateDoc(
        doc(db, "businesses", selectedBusiness.id),
        {
          businessName,
          ownerName,
          mobile,
          category,
        }
      );

      setBusinesses((currentBusinesses) =>
        currentBusinesses.map((business) =>
          business.id === selectedBusiness.id
            ? {
                ...business,
                businessName,
                ownerName,
                mobile,
                category,
              }
            : business
        )
      );

      alert("Business details updated successfully.");
      closeBusinessModal();
    } catch (error) {
      console.error("Error updating business:", error);
      alert("Unable to update business details.");
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ==========================================
   * DELETE BUSINESS
   * ==========================================
   */

  const deleteBusiness = async (
    id: string,
    name: string
  ) => {
    const ok = window.confirm(
      `Delete "${name}" permanently?\n\nThis will also delete all offers belonging to this business. Previous redemption/history records will NOT be deleted.`
    );

    if (!ok) {
      return;
    }

    try {
      setActionLoading(id);

      /*
       * ==========================================
       * DELETE ALL OFFERS BELONGING TO BUSINESS
       * ==========================================
       *
       * Only offers are removed here.
       * Previous redemptions/history are intentionally
       * kept in Firestore.
       */
      const offersQuery = query(
        collection(db, "offers"),
        where("businessId", "==", id)
      );

      const offersSnap = await getDocs(
        offersQuery
      );

      await Promise.all(
        offersSnap.docs.map((offerDoc) =>
          deleteDoc(
            doc(db, "offers", offerDoc.id)
          )
        )
      );

      /*
       * ==========================================
       * DELETE BUSINESS
       * ==========================================
       *
       * DO NOT delete redemptions, redemptionRequests,
       * points, payout/history or other historical data.
       */
      await deleteDoc(
        doc(db, "businesses", id)
      );

      setBusinesses(
        (currentBusinesses) =>
          currentBusinesses.filter(
            (business) =>
              business.id !== id
          )
      );

      alert(
        `✅ ${name} and its offers deleted successfully. Previous history is preserved.`
      );
    } catch (error) {
      console.error(
        "Error deleting business and offers:",
        error
      );

      alert(
        "❌ Unable to delete business and its offers. Please try again."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ==========================================
   * HELPERS
   * ==========================================
   */

  const isPending = (
    business: Business
  ) =>
    business.status?.toLowerCase() ===
    "pending";

  const getCreatedTime = (
    business: Business
  ) => {
    try {
      if (
        business.createdAt?.toMillis
      ) {
        return business.createdAt.toMillis();
      }

      if (
        business.createdAt?.seconds
      ) {
        return (
          business.createdAt.seconds *
          1000
        );
      }

      if (
        business.createdAt instanceof Date
      ) {
        return business.createdAt.getTime();
      }

      if (
        typeof business.createdAt ===
        "string"
      ) {
        const time = new Date(
          business.createdAt
        ).getTime();

        return Number.isNaN(time)
          ? 0
          : time;
      }

      return 0;
    } catch {
      return 0;
    }
  };

  /*
   * ==========================================
   * FILTER + SORT
   * ==========================================
   *
   * ORDER:
   *
   * 1. Pending businesses
   * 2. Latest registrations
   * 3. Approved businesses
   * 4. Rejected businesses
   *
   */

  const filteredBusinesses =
    useMemo(() => {
      const searchText =
        search.trim().toLowerCase();

      return [...businesses]
        .filter((business) => {
          if (!searchText) {
            return true;
          }

          return (
            business.businessName
              ?.toLowerCase()
              .includes(searchText) ||
            business.ownerName
              ?.toLowerCase()
              .includes(searchText) ||
            business.mobile
              ?.toLowerCase()
              .includes(searchText) ||
            business.category
              ?.toLowerCase()
              .includes(searchText)
          );
        })
        .sort((a, b) => {
          const statusA =
            a.status?.toLowerCase();

          const statusB =
            b.status?.toLowerCase();

          /*
           * Pending first
           */

          const pendingA =
            statusA === "pending";

          const pendingB =
            statusB === "pending";

          if (
            pendingA &&
            !pendingB
          ) {
            return -1;
          }

          if (
            !pendingA &&
            pendingB
          ) {
            return 1;
          }

          /*
           * Then latest registration first
           */

          const timeA =
            getCreatedTime(a);

          const timeB =
            getCreatedTime(b);

          if (
            timeA !== timeB
          ) {
            return timeB - timeA;
          }

          /*
           * Fallback alphabetical
           */

          return (
            a.businessName || ""
          ).localeCompare(
            b.businessName || ""
          );
        });
    }, [businesses, search]);

  /*
   * ==========================================
   * PENDING COUNT
   * ==========================================
   */

  const pendingCount =
    businesses.filter(
      (business) =>
        isPending(business)
    ).length;

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <AdminProtected>
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-7xl">

          {/* ==================================
              HEADER
          =================================== */}

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <h1 className="text-4xl font-bold text-green-700">
                🏪 Business Management
              </h1>

              <p className="mt-2 text-gray-600">
                Approve, Reject and Manage Businesses
              </p>
            </div>

            <Link
              href="/admin/dashboard"
              className="rounded-xl bg-gray-700 px-6 py-3 text-center font-bold text-white transition hover:bg-gray-800"
            >
              ← Dashboard
            </Link>

          </div>

          {/* ==================================
              PENDING APPROVAL
          =================================== */}

          {!loading && (
            <div
              className={`mb-6 rounded-2xl p-5 shadow ${
                pendingCount > 0
                  ? "border-2 border-orange-300 bg-orange-50"
                  : "bg-white"
              }`}
            >

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                <div>
                  <p
                    className={`text-lg font-bold ${
                      pendingCount > 0
                        ? "text-orange-700"
                        : "text-green-700"
                    }`}
                  >
                    {pendingCount > 0
                      ? "⏳ Pending Business Approvals"
                      : "✅ No Pending Business Approvals"}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    {pendingCount > 0
                      ? "New businesses waiting for admin verification."
                      : "All currently registered businesses have been reviewed."}
                  </p>
                </div>

                <div
                  className={`rounded-xl px-6 py-3 text-2xl font-extrabold ${
                    pendingCount > 0
                      ? "bg-orange-500 text-white"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {pendingCount}
                </div>

              </div>

            </div>
          )}

          {/* ==================================
              SEARCH
          =================================== */}

          <input
            type="text"
            placeholder="🔍 Search Business, Owner, Mobile or Category..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="mb-8 w-full rounded-xl border border-gray-300 bg-white p-4 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
          />

          {/* ==================================
              LOADING
          =================================== */}

          {loading ? (

            <div className="rounded-3xl bg-white p-10 text-center shadow-xl">

              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

              <h2 className="text-2xl font-bold">
                Loading Businesses...
              </h2>

            </div>

          ) : (

            <div className="grid gap-6">

              {/* ==================================
                  NO BUSINESSES
              =================================== */}

              {filteredBusinesses.length ===
              0 ? (

                <div className="rounded-3xl bg-white p-10 text-center shadow-xl">

                  <h2 className="text-2xl font-bold">
                    No Businesses Found
                  </h2>

                  <p className="mt-3 text-gray-500">
                    Try a different search.
                  </p>

                </div>

              ) : (

                filteredBusinesses.map(
                  (business, index) => {

                    const pending =
                      isPending(
                        business
                      );

                    const recent =
                      index < 5 &&
                      getCreatedTime(
                        business
                      ) > 0;

                    const actionBusy =
                      actionLoading ===
                      business.id;

                    return (
                      <div
                        key={business.id}
                        className={`rounded-3xl bg-white p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl ${
                          pending
                            ? "border-2 border-orange-300"
                            : "border border-transparent"
                        }`}
                      >

                        <div className="grid gap-6 md:grid-cols-2">

                          {/* ==================================
                              BUSINESS INFO
                          =================================== */}

                          <div>

                            {/* NEW BADGE */}

                            {pending && (
                              <div className="mb-3 inline-flex rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">
                                ⏳ PENDING APPROVAL
                              </div>
                            )}

                            {!pending &&
                              recent && (
                                <div className="mb-3 inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
                                  🆕 RECENTLY JOINED
                                </div>
                              )}

                            <h2 className="text-3xl font-bold text-green-700">
                              {
                                business.businessName
                              }
                            </h2>

                            <p className="mt-4 text-gray-600">
                              👤 Owner :
                              <span className="font-semibold">
                                {" "}
                                {
                                  business.ownerName ||
                                  "-"
                                }
                              </span>
                            </p>

                            <p className="mt-2 text-gray-600">
                              📱 Mobile :
                              <span className="font-semibold">
                                {" "}
                                {
                                  business.mobile ||
                                  "-"
                                }
                              </span>
                            </p>

                            <p className="mt-2 text-gray-600">
                              🏷 Category :
                              <span className="font-semibold">
                                {" "}
                                {
                                  business.category ||
                                  "-"
                                }
                              </span>
                            </p>

                            {getCreatedTime(
                              business
                            ) > 0 && (
                              <p className="mt-2 text-sm text-gray-500">
                                🕐 Registered :
                                <span className="font-semibold">
                                  {" "}
                                  {new Date(
                                    getCreatedTime(
                                      business
                                    )
                                  ).toLocaleString()}
                                </span>
                              </p>
                            )}

                          </div>

                          {/* ==================================
                              STATUS + ACTIONS
                          =================================== */}

                          <div className="flex flex-col items-start justify-center">

                            <span
                              className={`rounded-full px-5 py-2 font-bold text-white ${
                                business.status
                                  ?.toLowerCase() ===
                                "approved"
                                  ? "bg-green-600"
                                  : business.status
                                        ?.toLowerCase() ===
                                    "pending"
                                  ? "bg-orange-500"
                                  : "bg-red-600"
                              }`}
                            >
                              {(
                                business.status ||
                                "unknown"
                              ).toUpperCase()}
                            </span>

                            <div className="mt-6 flex flex-wrap gap-3">

                              {/* VIEW */}

                              <button
                                onClick={() =>
                                  openViewBusiness(business)
                                }
                                disabled={actionBusy}
                                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                👁 View
                              </button>

                              {/* EDIT */}

                              <button
                                onClick={() =>
                                  openEditBusiness(business)
                                }
                                disabled={actionBusy}
                                className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                ✏️ Edit
                              </button>

                              {/* APPROVE */}

                              {business.status
                                ?.toLowerCase() !==
                                "approved" && (
                                <button
                                  onClick={() =>
                                    approveBusiness(
                                      business.id,
                                      business.businessName
                                    )
                                  }
                                  disabled={
                                    actionBusy
                                  }
                                  className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {actionBusy
                                    ? "Processing..."
                                    : "✅ Approve"}
                                </button>
                              )}

                              {/* REJECT */}

                              {business.status
                                ?.toLowerCase() !==
                                "rejected" && (
                                <button
                                  onClick={() =>
                                    rejectBusiness(
                                      business.id,
                                      business.businessName
                                    )
                                  }
                                  disabled={
                                    actionBusy
                                  }
                                  className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  ❌ Reject
                                </button>
                              )}

                              {/* DELETE */}

                              <button
                                onClick={() =>
                                  deleteBusiness(
                                    business.id,
                                    business.businessName
                                  )
                                }
                                disabled={
                                  actionBusy
                                }
                                className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                🗑 Delete
                              </button>

                            </div>

                          </div>

                        </div>

                      </div>
                    );
                  }
                )

              )}

            </div>

          )}

          {/* ==================================
              VIEW / EDIT BUSINESS MODAL
          =================================== */}

          {selectedBusiness && modalMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">

                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-green-700">
                      {modalMode === "edit"
                        ? "✏️ Edit Business"
                        : "👁 Business Details"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {modalMode === "edit"
                        ? "Update the business information below."
                        : "View the complete registered business information."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeBusinessModal}
                    className="rounded-full bg-gray-100 px-4 py-2 text-xl font-bold text-gray-600 transition hover:bg-gray-200"
                  >
                    ✕
                  </button>
                </div>

                {modalMode === "view" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-500">
                        Business Name
                      </p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {selectedBusiness.businessName || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-500">
                        Owner Name
                      </p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {selectedBusiness.ownerName || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-500">
                        Mobile
                      </p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {selectedBusiness.mobile || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-500">
                        Category
                      </p>
                      <p className="mt-1 text-lg font-bold text-gray-900">
                        {selectedBusiness.category || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4 sm:col-span-2">
                      <p className="text-sm font-semibold text-gray-500">
                        Status
                      </p>
                      <p className="mt-1 text-lg font-bold uppercase text-gray-900">
                        {selectedBusiness.status || "-"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditBusiness(selectedBusiness)}
                      className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-700 sm:col-span-2"
                    >
                      ✏️ Edit Business
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block font-bold text-gray-700">
                        Business Name
                      </label>
                      <input
                        value={editBusinessName}
                        onChange={(e) =>
                          setEditBusinessName(e.target.value)
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white p-4 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-bold text-gray-700">
                        Owner Name
                      </label>
                      <input
                        value={editOwnerName}
                        onChange={(e) =>
                          setEditOwnerName(e.target.value)
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white p-4 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-bold text-gray-700">
                        Mobile
                      </label>
                      <input
                        value={editMobile}
                        onChange={(e) =>
                          setEditMobile(e.target.value)
                        }
                        inputMode="tel"
                        className="w-full rounded-xl border border-gray-300 bg-white p-4 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-bold text-gray-700">
                        Category
                      </label>
                      <input
                        value={editCategory}
                        onChange={(e) =>
                          setEditCategory(e.target.value)
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white p-4 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                      />
                    </div>

                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-500">
                        Current Status
                      </p>
                      <p className="mt-1 font-bold uppercase text-gray-800">
                        {selectedBusiness.status || "-"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Use Approve / Reject buttons on the business card to change status.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={closeBusinessModal}
                        disabled={actionLoading === selectedBusiness.id}
                        className="flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={saveBusiness}
                        disabled={actionLoading === selectedBusiness.id}
                        className="flex-1 rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading === selectedBusiness.id
                          ? "Saving..."
                          : "💾 Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </AdminProtected>
  );
}
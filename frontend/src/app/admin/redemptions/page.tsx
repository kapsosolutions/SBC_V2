"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";

import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

interface Redemption {
  id: string;
  studentName: string;
  businessName: string;
  offerTitle: string;
  discount: string;
  status: string;
  redeemedAt?: unknown;
  createdAt?: unknown;
  timestamp?: unknown;
  date?: unknown;
}

function getRedemptionDate(
  item: Redemption
): Date | null {
  const raw =
    item.redeemedAt ??
    item.createdAt ??
    item.timestamp ??
    item.date;

  if (!raw) return null;

  try {
    if (raw instanceof Timestamp) {
      const date = raw.toDate();

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    if (
      typeof raw === "object" &&
      raw !== null &&
      "toDate" in raw &&
      typeof (raw as { toDate?: unknown }).toDate ===
        "function"
    ) {
      const date = (
        raw as { toDate: () => Date }
      ).toDate();

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    if (
      typeof raw === "object" &&
      raw !== null &&
      "seconds" in raw
    ) {
      const date = new Date(
        Number(
          (raw as { seconds: number }).seconds
        ) * 1000
      );

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    const date = new Date(
      typeof raw === "number"
        ? raw
        : String(raw)
    );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  } catch {
    return null;
  }
}

function formatRedeemedDate(
  item: Redemption
) {
  const date = getRedemptionDate(item);

  if (!date) {
    return "Date & time unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getMonthName(month: number) {
  return new Date(
    2000,
    month,
    1
  ).toLocaleString("en-IN", {
    month: "long",
  });
}

export default function AdminRedemptions() {
  const [redemptions, setRedemptions] =
    useState<Redemption[]>([]);

  const [search, setSearch] =
    useState("");

  const [businessFilter, setBusinessFilter] =
    useState("all");

  const [monthFilter, setMonthFilter] =
    useState("all");

  const [yearFilter, setYearFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [downloading, setDownloading] =
    useState(false);

  const [selectedRedemption, setSelectedRedemption] =
    useState<Redemption | null>(null);

  /*
   * ==========================================
   * LOAD REDEMPTIONS
   * ==========================================
   */

  useEffect(() => {
    loadRedemptions();
  }, []);

  const loadRedemptions = async () => {
    try {
      setLoading(true);

      const snap = await getDocs(
        collection(db, "redemptions")
      );

      const data = snap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Redemption[];

      setRedemptions(data);
    } catch (error) {
      console.error(
        "Error loading redemptions:",
        error
      );

      alert(
        "Unable to load redemptions."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * BUSINESS LIST
   * ==========================================
   */

  const businessOptions = useMemo(() => {
    const businesses =
      redemptions
        .map(
          (item) =>
            item.businessName?.trim()
        )
        .filter(Boolean);

    return Array.from(
      new Set(businesses)
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [redemptions]);

  /*
   * ==========================================
   * YEAR LIST
   * ==========================================
   */

  const yearOptions = useMemo(() => {
    const years =
      redemptions
        .map((item) => {
          const date =
            getRedemptionDate(item);

          return date
            ? date.getFullYear()
            : null;
        })
        .filter(
          (year): year is number =>
            year !== null
        );

    return Array.from(
      new Set(years)
    ).sort((a, b) => b - a);
  }, [redemptions]);

  /*
   * ==========================================
   * FILTERED REDEMPTIONS
   * ==========================================
   */

  const filteredRedemptions =
    useMemo(() => {
      const searchText =
        search.trim().toLowerCase();

      return redemptions
        .filter((item) => {
          /*
           * STUDENT SEARCH
           */

          if (
            searchText &&
            !(
              item.studentName
                ?.toLowerCase()
                .includes(searchText)
            )
          ) {
            return false;
          }

          /*
           * BUSINESS FILTER
           */

          if (
            businessFilter !== "all" &&
            item.businessName !==
              businessFilter
          ) {
            return false;
          }

          /*
           * DATE
           */

          const date =
            getRedemptionDate(item);

          /*
           * MONTH FILTER
           */

          if (
            monthFilter !== "all"
          ) {
            if (!date) {
              return false;
            }

            const selectedMonth =
              Number(monthFilter);

            if (
              date.getMonth() !==
              selectedMonth
            ) {
              return false;
            }
          }

          /*
           * YEAR FILTER
           */

          if (
            yearFilter !== "all"
          ) {
            if (!date) {
              return false;
            }

            if (
              date.getFullYear() !==
              Number(yearFilter)
            ) {
              return false;
            }
          }

          return true;
        })
        .sort((a, b) => {
          const aDate =
            getRedemptionDate(a)
              ?.getTime() || 0;

          const bDate =
            getRedemptionDate(b)
              ?.getTime() || 0;

          return bDate - aDate;
        });
    }, [
      redemptions,
      search,
      businessFilter,
      monthFilter,
      yearFilter,
    ]);

  /*
   * ==========================================
   * DELETE
   * ==========================================
   */

  const deleteRedemption = async (
    id: string,
    studentName: string
  ) => {
    const ok = window.confirm(
      `Delete redemption of "${studentName}" ?`
    );

    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "redemptions", id)
      );

      setRedemptions(
        (current) =>
          current.filter(
            (item) =>
              item.id !== id
          )
      );

      if (
        selectedRedemption?.id === id
      ) {
        setSelectedRedemption(
          null
        );
      }
    } catch (error) {
      console.error(
        "Delete redemption error:",
        error
      );

      alert(
        "Failed to delete redemption."
      );
    }
  };

  /*
   * ==========================================
   * DOWNLOAD EXCEL
   * ==========================================
   */

  const downloadExcel = () => {
    if (
      filteredRedemptions.length === 0
    ) {
      alert(
        "No redemptions available to download."
      );

      return;
    }

    try {
      setDownloading(true);

      const excelData =
        filteredRedemptions.map(
          (item, index) => ({
            "S.No": index + 1,

            "Student Name":
              item.studentName || "-",

            "Business Name":
              item.businessName || "-",

            "Offer":
              item.offerTitle || "-",

            "Discount":
              item.discount || "-",

            "Status":
              (
                item.status ||
                "redeemed"
              ).toUpperCase(),

            "Redeemed On":
              formatRedeemedDate(item),

            "Record ID":
              item.id,
          })
        );

      const worksheet =
        XLSX.utils.json_to_sheet(
          excelData
        );

      /*
       * COLUMN WIDTHS
       */

      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 28 },
        { wch: 35 },
        { wch: 18 },
        { wch: 15 },
        { wch: 28 },
        { wch: 38 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Redemptions"
      );

      /*
       * FILE NAME
       */

      let fileName =
        "SBC_Redemptions";

      if (
        businessFilter !== "all"
      ) {
        fileName +=
          `_${businessFilter
            .replace(
              /[^a-zA-Z0-9]+/g,
              "_"
            )
            .slice(0, 30)}`;
      }

      if (
        monthFilter !== "all"
      ) {
        fileName +=
          `_${getMonthName(
            Number(monthFilter)
          )}`;
      }

      if (
        yearFilter !== "all"
      ) {
        fileName +=
          `_${yearFilter}`;
      }

      fileName += ".xlsx";

      XLSX.writeFile(
        workbook,
        fileName
      );

      console.log(
        "✅ Redemption Excel downloaded:",
        fileName
      );
    } catch (error) {
      console.error(
        "Excel download error:",
        error
      );

      alert(
        "Unable to download Excel file."
      );
    } finally {
      setDownloading(false);
    }
  };

  /*
   * ==========================================
   * CLEAR FILTERS
   * ==========================================
   */

  const clearFilters = () => {
    setSearch("");
    setBusinessFilter("all");
    setMonthFilter("all");
    setYearFilter("all");
  };

  /*
   * ==========================================
   * PENDING / TOTAL
   * ==========================================
   */

  const totalRedemptions =
    redemptions.length;

  return (
    <AdminProtected>
      <main className="min-h-screen bg-[#f5f3ed] p-4 md:p-8">

        <div className="mx-auto max-w-7xl">

          {/* ================================= */}
          {/* HEADER */}
          {/* ================================= */}

          <div className="mb-6 overflow-hidden rounded-[28px] bg-[#07111f] shadow-[0_20px_65px_rgba(7,17,31,0.13)]">

            <div className="flex flex-col gap-5 px-6 py-7 md:flex-row md:items-center md:justify-between md:px-8">

              <div>

                <span className="inline-flex rounded-full bg-[#d4af37]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#f1cf63]">
                  SBC Admin
                </span>

                <h1 className="mt-2 text-3xl font-black text-white">
                  Redemption Management
                </h1>

                <p className="mt-1 text-sm text-white/50">
                  View, search, filter and
                  download SBC redemptions.
                </p>

              </div>

              <Link
                href="/admin/dashboard"
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
              >
                ← Dashboard
              </Link>

            </div>

          </div>

          {/* ================================= */}
          {/* FILTER PANEL */}
          {/* ================================= */}

          <div className="mb-6 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">

            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="text-lg font-black text-[#07111f]">
                  Redemption Filters
                </h2>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Select business and month to
                  view redemptions for that period.
                </p>

              </div>

              <div className="rounded-full bg-[#fff8df] px-4 py-2 text-xs font-black text-[#8a680c]">
                {filteredRedemptions.length} Results
              </div>

            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

              {/* STUDENT SEARCH */}

              <div className="lg:col-span-1">

                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Student Search
                </label>

                <div className="relative">

                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">
                    🔎
                  </span>

                  <input
                    type="text"
                    placeholder="Search student..."
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-[#fbfaf6] py-3.5 pl-11 pr-4 text-sm font-semibold text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                  />

                </div>

              </div>

              {/* BUSINESS */}

              <div>

                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Business
                </label>

                <select
                  value={businessFilter}
                  onChange={(e) =>
                    setBusinessFilter(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-[#fbfaf6] px-4 py-3.5 text-sm font-bold text-[#07111f] outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                >

                  <option value="all">
                    All Businesses
                  </option>

                  {businessOptions.map(
                    (business) => (
                      <option
                        key={business}
                        value={business}
                      >
                        {business}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* MONTH */}

              <div>

                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Month
                </label>

                <select
                  value={monthFilter}
                  onChange={(e) =>
                    setMonthFilter(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-[#fbfaf6] px-4 py-3.5 text-sm font-bold text-[#07111f] outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                >

                  <option value="all">
                    All Months
                  </option>

                  {Array.from(
                    { length: 12 },
                    (_, month) => (
                      <option
                        key={month}
                        value={month}
                      >
                        {getMonthName(
                          month
                        )}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* YEAR */}

              <div>

                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Year
                </label>

                <select
                  value={yearFilter}
                  onChange={(e) =>
                    setYearFilter(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-[#fbfaf6] px-4 py-3.5 text-sm font-bold text-[#07111f] outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                >

                  <option value="all">
                    All Years
                  </option>

                  {yearOptions.map(
                    (year) => (
                      <option
                        key={year}
                        value={year}
                      >
                        {year}
                      </option>
                    )
                  )}

                </select>

              </div>

            </div>

            {/* FILTER ACTIONS */}

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-xs font-semibold text-slate-400">
                Showing{" "}
                <span className="font-black text-[#07111f]">
                  {filteredRedemptions.length}
                </span>{" "}
                of{" "}
                <span className="font-black text-[#07111f]">
                  {totalRedemptions}
                </span>{" "}
                redemptions
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">

                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                >
                  ↻ Clear Filters
                </button>

                <button
                  type="button"
                  onClick={downloadExcel}
                  disabled={
                    downloading ||
                    filteredRedemptions.length ===
                      0
                  }
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloading
                    ? "Preparing Excel..."
                    : "📥 Download Excel"}
                </button>

              </div>

            </div>

          </div>

          {/* ================================= */}
          {/* CONTENT */}
          {/* ================================= */}

          {loading ? (

            <div className="rounded-[28px] bg-white p-12 text-center shadow-sm">

              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#d4af37]" />

              <h2 className="mt-4 text-xl font-black text-[#07111f]">
                Loading Redemptions...
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Fetching the latest redemption
                records.
              </p>

            </div>

          ) : filteredRedemptions.length ===
            0 ? (

            <div className="rounded-[28px] bg-white p-12 text-center shadow-sm">

              <div className="text-4xl">
                📊
              </div>

              <h2 className="mt-4 text-2xl font-black text-[#07111f]">
                No Redemptions Found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                No redemption records match
                your selected filters.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-2xl bg-[#07111f] px-5 py-3 text-sm font-black text-[#f1cf63]"
              >
                Clear Filters
              </button>

            </div>

          ) : (

            <div className="grid gap-4">

              {filteredRedemptions.map(
                (item) => (

                  <div
                    key={item.id}
                    className="overflow-hidden rounded-[26px] border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                  >

                    <div className="flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-center">

                      {/* STUDENT */}

                      <div className="flex min-w-0 flex-1 items-center gap-4">

                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fff8df] text-xl font-black text-[#8a680c]">
                          {(item.studentName ||
                            "S")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h2 className="truncate text-lg font-black text-[#07111f]">
                              {item.studentName ||
                                "Unknown Student"}
                            </h2>

                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                              {(
                                item.status ||
                                "redeemed"
                              ).toUpperCase()}
                            </span>

                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-slate-500">

                            <span>
                              🏪{" "}
                              {item.businessName ||
                                "-"}
                            </span>

                            <span>
                              🎁{" "}
                              {item.offerTitle ||
                                "-"}
                            </span>

                            <span>
                              🕒{" "}
                              {formatRedeemedDate(
                                item
                              )}
                            </span>

                          </div>

                        </div>

                      </div>

                      {/* BENEFIT */}

                      <div className="rounded-2xl border border-[#d4af37]/20 bg-[#fffdf5] px-5 py-3 lg:min-w-[180px]">

                        <p className="text-[9px] font-black uppercase tracking-wider text-[#a37b0d]">
                          Benefit
                        </p>

                        <p className="mt-1 font-black text-[#07111f]">
                          {item.discount ||
                            "-"}
                        </p>

                      </div>

                      {/* ACTIONS */}

                      <div className="flex gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedRedemption(
                              item
                            )
                          }
                          className="rounded-xl bg-[#07111f] px-5 py-3 text-sm font-black text-[#f1cf63] shadow-sm transition hover:bg-[#101d2e] hover:shadow-md"
                        >
                          View Details
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteRedemption(
                              item.id,
                              item.studentName
                            )
                          }
                          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-600 transition hover:bg-red-100"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                    <div className="border-t border-slate-100 bg-[#fbfaf6] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:px-6">
                      Redemption Record · ID:{" "}
                      {item.id}
                    </div>

                  </div>
                )
              )}

            </div>

          )}

        </div>

        {/* ================================= */}
        {/* VIEW DETAILS POPUP */}
        {/* ================================= */}

        {selectedRedemption && (

          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07111f]/70 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setSelectedRedemption(
                  null
                );
              }
            }}
          >

            <div
              className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.30)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="redemption-details-title"
            >

              {/* POPUP HEADER */}

              <div className="bg-[#07111f] px-6 py-6 text-white">

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f1cf63]">
                      Redemption Details
                    </p>

                    <h2
                      id="redemption-details-title"
                      className="mt-2 text-2xl font-black"
                    >
                      {selectedRedemption.studentName ||
                        "Student"}
                    </h2>

                    <p className="mt-1 text-sm text-white/50">
                      SBC redemption record
                    </p>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRedemption(
                        null
                      )
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl font-bold text-white transition hover:bg-white/20"
                    aria-label="Close"
                  >
                    ×
                  </button>

                </div>

              </div>

              {/* POPUP CONTENT */}

              <div className="max-h-[75vh] space-y-3 overflow-y-auto p-6">

                <div className="rounded-2xl border border-slate-200 bg-[#fbfaf6] p-4">

                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Student
                  </p>

                  <p className="mt-1 font-black text-[#07111f]">
                    {selectedRedemption.studentName ||
                      "-"}
                  </p>

                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#fbfaf6] p-4">

                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Business
                  </p>

                  <p className="mt-1 font-black text-[#07111f]">
                    {selectedRedemption.businessName ||
                      "-"}
                  </p>

                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#fbfaf6] p-4">

                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Offer
                  </p>

                  <p className="mt-1 font-black text-[#07111f]">
                    {selectedRedemption.offerTitle ||
                      "-"}
                  </p>

                </div>

                <div className="grid gap-3 sm:grid-cols-2">

                  <div className="rounded-2xl border border-[#d4af37]/20 bg-[#fffdf5] p-4">

                    <p className="text-[9px] font-black uppercase tracking-wider text-[#a37b0d]">
                      Discount
                    </p>

                    <p className="mt-1 font-black text-[#07111f]">
                      {selectedRedemption.discount ||
                        "-"}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">

                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">
                      Status
                    </p>

                    <p className="mt-1 font-black uppercase text-emerald-700">
                      {selectedRedemption.status ||
                        "redeemed"}
                    </p>

                  </div>

                </div>

                {/* DATE & TIME */}

                <div className="rounded-2xl border border-[#d4af37]/25 bg-[#fffdf5] p-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#07111f] text-lg">
                      🕒
                    </div>

                    <div>

                      <p className="text-[9px] font-black uppercase tracking-wider text-[#a37b0d]">
                        Redeemed On
                      </p>

                      <p className="mt-1 text-sm font-black text-[#07111f]">
                        {formatRedeemedDate(
                          selectedRedemption
                        )}
                      </p>

                    </div>

                  </div>

                </div>

                {/* RECORD ID */}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">

                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Record ID
                  </p>

                  <p className="mt-1 break-all font-mono text-xs font-bold text-slate-600">
                    {selectedRedemption.id}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedRedemption(
                      null
                    )
                  }
                  className="w-full rounded-2xl bg-[#07111f] py-3.5 text-sm font-black text-[#f1cf63] transition hover:bg-[#101d2e]"
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        )}

      </main>
    </AdminProtected>
  );
}
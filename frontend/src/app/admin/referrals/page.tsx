"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase";
import AdminProtected from "@/components/AdminProtected";

type Student = {
  id: string;
  uid?: string;
  fullName?: string;
  cardNumber?: string;
  mobile?: string;
  email?: string;
  college?: string;
  course?: string;
  year?: string;
  status?: string;
  points?: number;

  referralCode?: string;
  referredBy?: string;
  referralStatus?: string;
  referralPaymentStatus?: string;
  successfulReferrals?: number;
  pendingReferrals?: number;
  referralRewardUnlocked?: boolean;

  membershipStatus?: string;
  membershipStartDate?: unknown;
  membershipExpiryDate?: unknown;
  membershipPlan?: string;
  lastMembershipPaymentId?: string;
  lastMembershipOrderId?: string;
  lastMembershipPaymentAt?: unknown;

  paymentStatus?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  paidAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;

  [key: string]: unknown;
};

type ReferralRow = {
  referrer: Student | null;
  referred: Student;
  referralCode: string;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {}
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return new Date(
      (value as { seconds: number }).seconds * 1000
    );
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDate(value: unknown): string {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "object") {
    const date = toDate(value);
    if (date) return formatDate(value);

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";

  return String(value);
}

function studentLabel(student: Student | null): string {
  if (!student) return "Not found";
  return `${student.fullName || "Unnamed Student"} (${student.cardNumber || "No SBC Number"})`;
}

export default function AdminReferralsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        setError("");

        const snap = await getDocs(collection(db, "students"));

        const data: Student[] = snap.docs.map((item) => {
          const raw = item.data();

          return {
            id: item.id,
            ...raw,
          } as Student;
        });

        setStudents(data);
      } catch (err) {
        console.error("Referral student loading error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load referral details."
        );
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, []);

  const studentsByReferralCode = useMemo(() => {
    const map = new Map<string, Student>();

    for (const student of students) {
      const code = String(student.referralCode || "").trim().toUpperCase();
      if (code) {
        map.set(code, student);
      }
    }

    return map;
  }, [students]);

  const referralRows = useMemo<ReferralRow[]>(() => {
    return students
      .filter((student) => String(student.referredBy || "").trim())
      .map((referred) => {
        const referralCode = String(referred.referredBy || "")
          .trim()
          .toUpperCase();

        return {
          referrer: studentsByReferralCode.get(referralCode) || null,
          referred,
          referralCode,
        };
      })
      .sort((a, b) => {
        const aDate = toDate(a.referred.createdAt)?.getTime() || 0;
        const bDate = toDate(b.referred.createdAt)?.getTime() || 0;
        return bDate - aDate;
      });
  }, [students, studentsByReferralCode]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return referralRows;

    return referralRows.filter(({ referrer, referred, referralCode }) => {
      const haystack = [
        referrer?.fullName,
        referrer?.cardNumber,
        referrer?.mobile,
        referrer?.email,
        referrer?.referralCode,
        referred.fullName,
        referred.cardNumber,
        referred.mobile,
        referred.email,
        referralCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [referralRows, search]);

  const referrerCount = useMemo(() => {
    return new Set(
      referralRows
        .map((row) => row.referrer?.id)
        .filter(Boolean)
    ).size;
  }, [referralRows]);

  const successfulCount = useMemo(() => {
    return referralRows.filter(
      ({ referred }) =>
        String(referred.referralPaymentStatus || "").toLowerCase() ===
          "success" ||
        String(referred.paymentStatus || "").toLowerCase() === "paid"
    ).length;
  }, [referralRows]);

  const rewardsUnlocked = useMemo(() => {
    return students.reduce((total, student) => {
      const count = Number(student.successfulReferrals || 0);
      return total + Math.floor(count / 10);
    }, 0);
  }, [students]);

  const detailFields = selected
    ? [
        ["Full Name", selected.fullName],
        ["SBC Number", selected.cardNumber],
        ["Mobile", selected.mobile],
        ["Email", selected.email],
        ["College", selected.college],
        ["Course", selected.course],
        ["Year", selected.year],
        ["Account Status", selected.status],
        ["Points", selected.points],
        ["Referral Code", selected.referralCode],
        ["Referred By Code", selected.referredBy],
        ["Referral Status", selected.referralStatus],
        ["Referral Payment Status", selected.referralPaymentStatus],
        ["Successful Referrals", selected.successfulReferrals],
        ["Pending Referrals", selected.pendingReferrals],
        ["Referral Reward Unlocked", selected.referralRewardUnlocked],
        ["Membership Status", selected.membershipStatus],
        ["Membership Plan", selected.membershipPlan],
        ["Membership Start", selected.membershipStartDate],
        ["Membership Expiry", selected.membershipExpiryDate],
        ["Last Membership Payment ID", selected.lastMembershipPaymentId],
        ["Last Membership Order ID", selected.lastMembershipOrderId],
        ["Last Membership Payment At", selected.lastMembershipPaymentAt],
        ["Payment Status", selected.paymentStatus],
        ["Payment Amount", selected.paymentAmount],
        ["Payment Currency", selected.paymentCurrency],
        ["Razorpay Payment ID", selected.razorpayPaymentId],
        ["Razorpay Order ID", selected.razorpayOrderId],
        ["Paid At", selected.paidAt],
        ["Registered At", selected.createdAt],
        ["Updated At", selected.updatedAt],
        ["Firebase UID", selected.uid || selected.id],
      ]
    : [];

  const selectedReferrer = selected
    ? studentsByReferralCode.get(
        String(selected.referredBy || "").trim().toUpperCase()
      ) || null
    : null;

  const selectedReferredStudents = selected
    ? students.filter(
        (student) =>
          String(student.referredBy || "").trim().toUpperCase() ===
          String(selected.referralCode || "").trim().toUpperCase()
      )
    : [];

  return (
    <AdminProtected>
      <main className="min-h-screen bg-[#f5f3ed] p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 rounded-[2rem] bg-[#07111f] p-6 shadow-[0_20px_60px_rgba(7,17,31,0.16)] md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                  SBC Admin
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                  🎁 Referral Management
                </h1>
                <p className="mt-2 max-w-3xl text-white/60">
                  See exactly who referred whom, which student joined through
                  which referral code, and open the complete student profile.
                </p>
              </div>

              <Link
                href="/admin/dashboard"
                className="rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 px-5 py-3 text-center font-black text-[#f1cf63] transition hover:bg-[#d4af37]/20"
              >
                ← Admin Dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)]">
              <p className="text-sm font-bold text-slate-500">Total Referral Joins</p>
              <p className="mt-3 text-4xl font-black text-[#8a680c]">
                {loading ? "..." : referralRows.length}
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)]">
              <p className="text-sm font-bold text-slate-500">Students Referring</p>
              <p className="mt-3 text-4xl font-black text-[#07111f]">
                {loading ? "..." : referrerCount}
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)]">
              <p className="text-sm font-bold text-slate-500">
                Successful Paid Referrals
              </p>
              <p className="mt-3 text-4xl font-black text-emerald-600">
                {loading ? "..." : successfulCount}
              </p>
            </div>

            <div className="rounded-3xl border-2 border-[#d4af37]/30 bg-gradient-to-br from-[#fffdf5] to-[#f7f1dd] p-6 shadow-[0_18px_55px_rgba(7,17,31,0.08)]">
              <p className="text-sm font-bold text-[#8a680c]">
                Rewards Unlocked
              </p>
              <p className="mt-3 text-4xl font-black text-[#07111f]">
                {loading ? "..." : `₹${rewardsUnlocked * 250}`}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Based on 10 successful referrals per ₹250 reward
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-white p-5 shadow-[0_18px_55px_rgba(7,17,31,0.08)] md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-[#07111f]">
                  Who Referred Whom?
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Referred student is shown with the SBC number in brackets.
                </p>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, SBC number, mobile, referral code..."
                className="w-full rounded-2xl border border-black/10 bg-[#fbfaf6] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#d4af37] md:max-w-md"
              />
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">
                {error}
              </div>
            ) : loading ? (
              <div className="mt-6 rounded-2xl bg-[#fbfaf6] p-10 text-center font-bold text-slate-500">
                Loading referral details...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-black/10 bg-[#fbfaf6] p-10 text-center">
                <p className="font-black text-slate-600">
                  No referral records found.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  When a student joins using another student's referral code,
                  the relationship will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-black/5">
                <table className="min-w-[1050px] w-full text-left">
                  <thead className="bg-[#07111f] text-xs uppercase tracking-wide text-white">
                    <tr>
                      <th className="px-4 py-4">Referrer</th>
                      <th className="px-4 py-4">Referral Code</th>
                      <th className="px-4 py-4">Referred Student</th>
                      <th className="px-4 py-4">Joined</th>
                      <th className="px-4 py-4">Payment</th>
                      <th className="px-4 py-4">Referral Status</th>
                      <th className="px-4 py-4">Details</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-black/5">
                    {filteredRows.map(
                      ({ referrer, referred, referralCode }) => {
                        const paid =
                          String(
                            referred.referralPaymentStatus || ""
                          ).toLowerCase() === "success" ||
                          String(referred.paymentStatus || "").toLowerCase() ===
                            "paid";

                        return (
                          <tr
                            key={`${referred.id}-${referralCode}`}
                            className="bg-white transition hover:bg-[#fffdf5]"
                          >
                            <td className="px-4 py-5 align-top">
                              <button
                                onClick={() =>
                                  referrer && setSelected(referrer)
                                }
                                className="text-left"
                                disabled={!referrer}
                              >
                                <p className="font-black text-[#07111f]">
                                  {referrer?.fullName || "Referrer not found"}
                                </p>
                                <p className="mt-1 text-xs font-bold text-[#8a680c]">
                                  {referrer?.cardNumber
                                    ? `(${referrer.cardNumber})`
                                    : "No SBC Number"}
                                </p>
                              </button>
                            </td>

                            <td className="px-4 py-5 align-top">
                              <span className="rounded-lg bg-[#fff8df] px-3 py-2 text-xs font-black text-[#8a680c]">
                                {referralCode || "—"}
                              </span>
                            </td>

                            <td className="px-4 py-5 align-top">
                              <button
                                onClick={() => setSelected(referred)}
                                className="text-left"
                              >
                                <p className="font-black text-[#07111f]">
                                  {referred.fullName || "Unnamed Student"}
                                </p>
                                <p className="mt-1 text-xs font-black text-[#2b5bd7]">
                                  ({referred.cardNumber || "No SBC Number"})
                                </p>
                              </button>
                            </td>

                            <td className="px-4 py-5 align-top text-sm font-semibold text-slate-600">
                              {formatDate(referred.createdAt)}
                            </td>

                            <td className="px-4 py-5 align-top">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-black ${
                                  paid
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {paid ? "₹199 Paid" : "Pending"}
                              </span>
                            </td>

                            <td className="px-4 py-5 align-top">
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                                {referred.referralStatus || "pending"}
                              </span>
                            </td>

                            <td className="px-4 py-5 align-top">
                              <button
                                onClick={() => setSelected(referred)}
                                className="rounded-xl bg-[#07111f] px-4 py-2 text-xs font-black text-[#f1cf63] transition hover:opacity-90"
                              >
                                View Full Details
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-3xl border border-[#d4af37]/25 bg-gradient-to-br from-[#fffdf5] to-[#f7f1dd] p-6">
            <h2 className="text-2xl font-black text-[#07111f]">
              🔗 Referral Flow
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The referred student's <strong>Referred By</strong> code is
              matched against another student's own <strong>Referral Code</strong>.
              This lets Admin see the actual relationship without relying on
              names alone.
            </p>
          </div>
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#07111f]/70 p-4 backdrop-blur-sm">
            <div className="mx-auto my-6 max-w-6xl rounded-[2rem] bg-[#f5f3ed] shadow-2xl">
              <div className="sticky top-0 z-10 rounded-t-[2rem] bg-[#07111f] p-6 md:p-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f1cf63]">
                      Full Student Details
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">
                      {selected.fullName || "Unnamed Student"}
                    </h2>
                    <p className="mt-1 font-black text-[#f1cf63]">
                      {selected.cardNumber || "No SBC Number"}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelected(null)}
                    className="rounded-xl bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/20"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              <div className="p-5 md:p-7">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {detailFields.map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-black/5 bg-white p-4"
                    >
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                        {String(label)}
                      </p>
                      <p className="mt-2 break-words text-sm font-bold text-[#07111f]">
                        {displayValue(value)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Referred By
                    </p>
                    <h3 className="mt-2 text-xl font-black text-[#07111f]">
                      {studentLabel(selectedReferrer)}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Referral Code: {selected.referredBy || "—"}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                      Students Referred By This Student
                    </p>
                    <p className="mt-2 text-xl font-black text-[#07111f]">
                      {selectedReferredStudents.length}
                    </p>
                  </div>
                </div>

                {selectedReferredStudents.length > 0 && (
                  <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black text-[#07111f]">
                      👥 Referral Network
                    </h3>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {selectedReferredStudents.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => setSelected(student)}
                          className="rounded-2xl border border-black/5 bg-[#fbfaf6] p-4 text-left transition hover:border-[#d4af37]"
                        >
                          <p className="font-black text-[#07111f]">
                            {student.fullName || "Unnamed Student"}{" "}
                            <span className="text-[#2b5bd7]">
                              ({student.cardNumber || "No SBC Number"})
                            </span>
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Joined: {formatDate(student.createdAt)}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            Payment: {student.paymentStatus || "—"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminProtected>
  );
}

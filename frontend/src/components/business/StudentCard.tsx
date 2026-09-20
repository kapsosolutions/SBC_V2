"use client";

import { Student, Offer } from "@/types/student";

interface StudentCardProps {
  student: Student;
  offer: Offer | null;
  usedCount: number;
  redeeming: boolean;
  onRedeem: () => void;
}

export default function StudentCard({
  student,
  offer,
  usedCount,
  redeeming,
  onRedeem,
}: StudentCardProps) {
  const limitReached = usedCount >= 4;

  const getStatus = () => {
    if (usedCount === 0) {
      return {
        text: "🌟 First Time Use",
        color: "text-green-700",
        bg: "bg-green-50",
      };
    }

    if (usedCount >= 4) {
      return {
        text: "❌ Limit Reached",
        color: "text-red-700",
        bg: "bg-red-50",
      };
    }

    return {
      text: `✅ Used ${usedCount} / 4`,
      color: "text-blue-700",
      bg: "bg-blue-50",
    };
  };

  const status = getStatus();

  return (
    <div className="mt-8 rounded-3xl bg-white p-8 shadow-xl">

      <h2 className="mb-6 text-3xl font-bold text-green-600">
        ✅ Student Verified
      </h2>

      <div className="grid gap-5 md:grid-cols-2">

        <div className="rounded-xl bg-slate-100 p-5">
          <p className="text-sm text-gray-500">Student Name</p>
          <h3 className="mt-2 text-xl font-bold">
            {student.fullName}
          </h3>
        </div>

        <div className="rounded-xl bg-slate-100 p-5">
          <p className="text-sm text-gray-500">Card Number</p>
          <h3 className="mt-2 text-xl font-bold">
            {student.cardNumber}
          </h3>
        </div>

        <div className="rounded-xl bg-slate-100 p-5">
          <p className="text-sm text-gray-500">College</p>
          <h3 className="mt-2 text-xl font-bold">
            {student.college}
          </h3>
        </div>

        <div className="rounded-xl bg-slate-100 p-5">
          <p className="text-sm text-gray-500">Course</p>
          <h3 className="mt-2 text-xl font-bold">
            {student.course}
          </h3>
        </div>

        <div className="rounded-xl bg-slate-100 p-5">
          <p className="text-sm text-gray-500">Year</p>
          <h3 className="mt-2 text-xl font-bold">
            {student.year}
          </h3>
        </div>

        <div className="rounded-xl bg-slate-100 p-5">
          <p className="text-sm text-gray-500">Mobile</p>
          <h3 className="mt-2 text-xl font-bold">
            {student.mobile}
          </h3>
        </div>

      </div>

      {offer && (
        <div className="mt-8 rounded-2xl bg-emerald-50 p-6">

          <h3 className="text-xl font-bold text-emerald-700">
            Active Offer
          </h3>

          <p className="mt-2 text-lg font-semibold">
            {offer.title}
          </p>

          <p className="text-gray-600">
            {offer.description}
          </p>

          <div className="mt-3 inline-block rounded-full bg-green-600 px-4 py-2 text-white">
            {offer.discount}
          </div>

        </div>
      )}

      <div className={`mt-8 rounded-2xl p-6 ${status.bg}`}>

        <h2 className={`text-2xl font-bold ${status.color}`}>
          {status.text}
        </h2>

      </div>

      <button
        disabled={limitReached || redeeming}
        onClick={onRedeem}
        className={`mt-8 w-full rounded-2xl py-5 text-xl font-bold text-white transition

${
  limitReached
    ? "bg-gray-400 cursor-not-allowed"
    : redeeming
    ? "bg-orange-500"
    : "bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-[1.02]"
}`}
      >
        {limitReached
          ? "Limit Reached"
          : redeeming
          ? "Redeeming..."
          : "Redeem Offer"}
      </button>

    </div>
  );
}
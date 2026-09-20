"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";

import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

interface Student {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  course?: string;
  year?: string;
  cardNumber: string;
  status: string;
  createdAt?: any;
}

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] =
    useState<string | null>(null);
  const [approvingStudent, setApprovingStudent] =
    useState<string | null>(null);

  // VIEW / EDIT STUDENT
  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);
  const [studentModalMode, setStudentModalMode] =
    useState<"view" | "edit" | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editCardNumber, setEditCardNumber] = useState("");
  const [savingStudent, setSavingStudent] =
    useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);

      const snap = await getDocs(
        collection(db, "students")
      );

      const data = snap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Student[];

      setStudents(data);
    } catch (error) {
      console.error(
        "Error loading students:",
        error
      );

      alert("Unable to load students.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * EXCEL EXPORT
   * ==========================================
   */

  const formatRegistrationDate = (
    createdAt: any
  ) => {
    try {
      if (createdAt?.toDate) {
        return createdAt
          .toDate()
          .toLocaleString("en-IN");
      }

      if (createdAt instanceof Date) {
        return createdAt.toLocaleString("en-IN");
      }

      return "";
    } catch {
      return "";
    }
  };

  const downloadStudentsExcel = (
    studentsToExport: Student[],
    filename: string
  ) => {
    if (!studentsToExport.length) {
      alert("No students available to download.");
      return;
    }

    try {
      const exportData =
        studentsToExport.map(
          (student, index) => ({
            "S.No": index + 1,
            "Full Name":
              student.fullName || "",
            "Email":
              student.email || "",
            "Mobile":
              student.mobile || "",
            "College":
              student.college || "",
            "Course":
              student.course || "",
            "Year":
              student.year || "",
            "SBC Card Number":
              student.cardNumber || "",
            "Status":
              student.status
                ? student.status.toUpperCase()
                : "",
            "Registered On":
              formatRegistrationDate(
                student.createdAt
              ),
            "Student Document ID":
              student.id || "",
          })
        );

      const worksheet =
        XLSX.utils.json_to_sheet(
          exportData
        );

      /*
       * Set useful Excel column widths
       */

      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 32 },
        { wch: 16 },
        { wch: 35 },
        { wch: 25 },
        { wch: 14 },
        { wch: 20 },
        { wch: 14 },
        { wch: 24 },
        { wch: 34 },
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Students"
      );

      XLSX.writeFile(
        workbook,
        filename
      );

      console.log(
        `✅ Excel downloaded: ${filename}`
      );
    } catch (error) {
      console.error(
        "Excel export error:",
        error
      );

      alert(
        "Unable to create Excel file."
      );
    }
  };

  const downloadAllStudents = () => {
    downloadStudentsExcel(
      students,
      `SBC_All_Students_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  const downloadSearchResults = () => {
    downloadStudentsExcel(
      filteredStudents,
      `SBC_Student_Search_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  const approveStudent = async (
    id: string,
    name: string
  ) => {
    const ok = window.confirm(
      `Approve "${name}" as an SBC student?`
    );

    if (!ok) return;

    try {
      setApprovingStudent(id);

      await updateDoc(
        doc(db, "students", id),
        {
          status: "active",
        }
      );

      setStudents((currentStudents) =>
        currentStudents.map((student) =>
          student.id === id
            ? {
                ...student,
                status: "active",
              }
            : student
        )
      );

      setExpandedStudent(id);

      alert(
        `${name} approved successfully.`
      );
    } catch (error) {
      console.error(
        "Error approving student:",
        error
      );

      alert(
        "Unable to approve student."
      );
    } finally {
      setApprovingStudent(null);
    }
  };

  /*
   * ==========================================
   * VIEW / EDIT STUDENT
   * ==========================================
   */

  const openViewStudent = (student: Student) => {
    setSelectedStudent(student);
    setStudentModalMode("view");
  };

  const openEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setEditFullName(student.fullName || "");
    setEditEmail(student.email || "");
    setEditMobile(student.mobile || "");
    setEditCollege(student.college || "");
    setEditCourse(student.course || "");
    setEditYear(student.year || "");
    setEditCardNumber(student.cardNumber || "");
    setStudentModalMode("edit");
  };

  const closeStudentModal = () => {
    if (savingStudent) return;

    setSelectedStudent(null);
    setStudentModalMode(null);
  };

  const saveStudent = async () => {
    if (!selectedStudent) return;

    const fullName = editFullName.trim();
    const email = editEmail.trim();
    const mobile = editMobile.trim();
    const college = editCollege.trim();
    const course = editCourse.trim();
    const year = editYear.trim();
    const cardNumber = editCardNumber.trim();

    if (
      !fullName ||
      !email ||
      !mobile ||
      !college ||
      !course ||
      !year ||
      !cardNumber
    ) {
      alert(
        "Please fill all student details."
      );
      return;
    }

    try {
      setSavingStudent(true);

      await updateDoc(
        doc(
          db,
          "students",
          selectedStudent.id
        ),
        {
          fullName,
          email,
          mobile,
          college,
          course,
          year,
          cardNumber,
        }
      );

      setStudents((currentStudents) =>
        currentStudents.map((student) =>
          student.id === selectedStudent.id
            ? {
                ...student,
                fullName,
                email,
                mobile,
                college,
                course,
                year,
                cardNumber,
              }
            : student
        )
      );

      alert(
        "Student details updated successfully."
      );

      setSelectedStudent(null);
      setStudentModalMode(null);
    } catch (error) {
      console.error(
        "Error updating student:",
        error
      );

      alert(
        "Unable to update student details."
      );
    } finally {
      setSavingStudent(false);
    }
  };

  const deleteStudent = async (
    id: string,
    name: string
  ) => {
    const ok = window.confirm(
      `Delete "${name}" ?`
    );

    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "students", id)
      );

      setStudents((currentStudents) =>
        currentStudents.filter(
          (student) =>
            student.id !== id
        )
      );

      if (expandedStudent === id) {
        setExpandedStudent(null);
      }
    } catch (error) {
      console.error(
        "Error deleting student:",
        error
      );

      alert(
        "Unable to delete student."
      );
    }
  };

  const isPending = (
    student: Student
  ) =>
    student.status?.toLowerCase() ===
    "pending";

  /*
   * =========================================
   * FILTER + SORT
   * =========================================
   *
   * Search supports:
   * Name
   * Email
   * Mobile
   * College
   * Course
   * Year
   * Card Number
   *
   * Pending students first
   * Latest registered first
   */

  const searchTerm =
    search.trim().toLowerCase();

  const filteredStudents = students
    .filter((student) => {
      if (!searchTerm) {
        return true;
      }

      const searchableText = [
        student.fullName,
        student.email,
        student.mobile,
        student.college,
        student.course,
        student.year,
        student.cardNumber,
        student.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        searchTerm
      );
    })
    .sort((a, b) => {
      const aPending = isPending(a);
      const bPending = isPending(b);

      // Pending students first
      if (aPending && !bPending) {
        return -1;
      }

      if (!aPending && bPending) {
        return 1;
      }

      // Latest registration first
      const aTime =
        a.createdAt?.toMillis?.() || 0;

      const bTime =
        b.createdAt?.toMillis?.() || 0;

      return bTime - aTime;
    });

  const pendingCount =
    students.filter(
      (student) =>
        isPending(student)
    ).length;

  const activeCount =
    students.filter(
      (student) =>
        !isPending(student)
    ).length;

  return (
    <AdminProtected>
      <main className="min-h-screen bg-[#f6f8fc] text-slate-900">

        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">

          {/* TOP HEADER */}

          <div className="mb-6 overflow-hidden rounded-[28px] bg-slate-950 shadow-xl">

            <div className="relative px-6 py-7 sm:px-8">

              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

              <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                <div className="flex items-center gap-4">

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl ring-1 ring-white/15">
                    🎓
                  </div>

                  <div>

                    <div className="mb-1 flex flex-wrap items-center gap-2">

                      <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300 ring-1 ring-blue-400/20">
                        SBC Admin
                      </span>

                      {pendingCount > 0 && (
                        <span className="rounded-full bg-orange-400/15 px-3 py-1 text-xs font-bold text-orange-300 ring-1 ring-orange-300/20">
                          {pendingCount} pending
                        </span>
                      )}

                    </div>

                    <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                      Student Management
                    </h1>

                    <p className="mt-1 text-sm text-slate-400">
                      Review, approve and manage SBC student accounts.
                    </p>

                  </div>

                </div>

                <Link
                  href="/admin/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  <span>←</span>
                  Dashboard
                </Link>

              </div>

            </div>

          </div>

          {/* OVERVIEW CARDS */}

          {!loading && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Total Students
                    </p>

                    <p className="mt-2 text-3xl font-extrabold text-slate-900">
                      {students.length}
                    </p>

                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                    👥
                  </div>

                </div>

              </div>

              <div
                className={`rounded-3xl border p-5 shadow-sm ${
                  pendingCount > 0
                    ? "border-orange-200 bg-orange-50/70"
                    : "border-emerald-200 bg-emerald-50/70"
                }`}
              >

                <div className="flex items-center justify-between">

                  <div>

                    <p
                      className={`text-xs font-bold uppercase tracking-wider ${
                        pendingCount > 0
                          ? "text-orange-600"
                          : "text-emerald-600"
                      }`}
                    >
                      Pending Approval
                    </p>

                    <p
                      className={`mt-2 text-3xl font-extrabold ${
                        pendingCount > 0
                          ? "text-orange-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {pendingCount}
                    </p>

                  </div>

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${
                      pendingCount > 0
                        ? "bg-orange-100"
                        : "bg-emerald-100"
                    }`}
                  >
                    {pendingCount > 0
                      ? "⏳"
                      : "✓"}
                  </div>

                </div>

              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Active Members
                    </p>

                    <p className="mt-2 text-3xl font-extrabold text-slate-900">
                      {activeCount}
                    </p>

                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                    ✓
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* SEARCH + EXPORT TOOLBAR */}

          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

            <div className="flex flex-col gap-5">

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>

                  <h2 className="text-base font-extrabold text-slate-900">
                    Student Directory
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Search by name, mobile, college, email, course, year or card number.
                  </p>

                </div>

                <div className="flex flex-col gap-2 sm:flex-row">

                  <button
                    type="button"
                    onClick={
                      downloadSearchResults
                    }
                    disabled={
                      filteredStudents.length ===
                      0
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    📥 Download Search
                  </button>

                  <button
                    type="button"
                    onClick={
                      downloadAllStudents
                    }
                    disabled={
                      students.length ===
                      0
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    📊 Download All Students
                  </button>

                </div>

              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">

                <div className="relative w-full">

                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                    🔍
                  </span>

                  <input
                    type="text"
                    placeholder="Search name, mobile, college, email, course, year or card number..."
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-sm font-bold text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  )}

                </div>

                <div className="shrink-0 rounded-2xl bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-600">
                  {search
                    ? `${filteredStudents.length} result${
                        filteredStudents.length ===
                        1
                          ? ""
                          : "s"
                      }`
                    : `${students.length} students`}
                </div>

              </div>

            </div>

          </div>

          {/* CONTENT */}

          {loading ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-12 text-center shadow-sm">

              <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

              <h2 className="text-lg font-extrabold text-slate-900">
                Loading students...
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Fetching the latest SBC student records.
              </p>

            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
                🎓
              </div>

              <h2 className="mt-5 text-xl font-extrabold text-slate-900">
                No Students Found
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Try a different name, mobile number, college or card number.
              </p>

            </div>
          ) : (
            <div className="space-y-4">

              {filteredStudents.map(
                (student) => {
                  const pending =
                    isPending(student);

                  const isExpanded =
                    expandedStudent ===
                    student.id;

                  return (
                    <div
                      key={
                        student.id
                      }
                      className={`overflow-hidden rounded-[28px] border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                        pending
                          ? "border-orange-200 bg-gradient-to-r from-[#fff7df] via-[#fffdf5] to-[#f4df9b] ring-1 ring-orange-100"
                          : "border-[#d4af37]/30 bg-gradient-to-r from-[#fff4c7] via-[#fffdf4] to-[#f0d985]"
                      }`}
                    >

                      {/* STUDENT ROW */}

                      <div className="p-5 sm:p-6">

                        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                          <div className="flex min-w-0 items-start gap-4">

                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${
                                pending
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-[#fff3c4] text-[#8a680c]"
                              }`}
                            >
                              {(
                                student.fullName ||
                                "S"
                              )
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </div>

                            <div className="min-w-0">

                              <div className="mb-2 flex flex-wrap items-center gap-2">

                                {pending ? (
                                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-orange-700">
                                    New Student
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
                                    Active Member
                                  </span>
                                )}

                              </div>

                              <h2 className="truncate text-xl font-extrabold text-slate-900 sm:text-2xl">
                                {student.fullName ||
                                  "-"}
                              </h2>

                              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">

                                <span>
                                  📧{" "}
                                  {student.email ||
                                    "-"}
                                </span>

                                <span>
                                  📱{" "}
                                  {student.mobile ||
                                    "-"}
                                </span>

                                <span>
                                  🏫{" "}
                                  {student.college ||
                                    "-"}
                                </span>

                              </div>

                            </div>

                          </div>

                          <div className="flex flex-col gap-3 xl:items-end">

                            <div className="flex items-center gap-3">

                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                                  pending
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {pending
                                  ? "PENDING"
                                  : "APPROVED"}
                              </span>

                              <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                                {student.cardNumber ||
                                  "No Card"}
                              </span>

                            </div>

                            <div className="flex flex-wrap gap-2">

                              <button
                                onClick={() =>
                                  setExpandedStudent(
                                    isExpanded
                                      ? null
                                      : student.id
                                  )
                                }
                                className="rounded-xl border border-[#d4af37]/35 bg-white/90 px-4 py-2.5 text-sm font-bold text-[#07111f] shadow-sm transition hover:border-[#d4af37] hover:bg-[#07111f] hover:text-[#f1cf63]"
                              >
                                {isExpanded
                                  ? "⌃ Hide"
                                  : "👁 View"}
                              </button>

                              <button
                                onClick={() =>
                                  openEditStudent(
                                    student
                                  )
                                }
                                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
                              >
                                ✏️ Edit
                              </button>

                              {pending && (
                                <button
                                  onClick={() =>
                                    approveStudent(
                                      student.id,
                                      student.fullName
                                    )
                                  }
                                  disabled={
                                    approvingStudent ===
                                    student.id
                                  }
                                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {approvingStudent ===
                                  student.id
                                    ? "Approving..."
                                    : "✓ Approve"}
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  deleteStudent(
                                    student.id,
                                    student.fullName
                                  )
                                }
                                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
                              >
                                🗑
                              </button>

                            </div>

                          </div>

                        </div>

                      </div>

                      {/* EXPANDED DETAILS */}

                      {isExpanded && (
                        <div className="border-t border-[#d4af37]/30 bg-gradient-to-br from-[#fff4c7] via-[#fffdf4] to-[#e9cf72] p-5 shadow-[inset_0_8px_30px_rgba(212,175,55,0.08)] sm:p-6">

                          <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#d4af37]/30 bg-gradient-to-r from-[#07111f] via-[#17243a] to-[#8a680c] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">

                            <div className="flex items-center gap-4">

                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/20">
                                👤
                              </div>

                              <div>

                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f8e7a1]">
                                  Student Profile
                                </p>

                                <h3 className="mt-1 text-xl font-extrabold">
                                  {student.fullName ||
                                    "Student"}{" "}
                                  — Complete Details
                                </h3>

                              </div>

                            </div>

                            <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-[#fff7d1] ring-1 ring-white/15">
                              SBC ID:{" "}
                              {student.id}
                            </span>

                          </div>

                          {/* CONTACT */}

                          <div className="mb-5 rounded-3xl border border-[#d4af37]/25 bg-gradient-to-br from-[#fffaf0] to-[#f6e8b5] p-5">

                            <div className="mb-4 flex items-center gap-3">

                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#07111f] text-sm text-[#f1cf63]">
                                ✦
                              </div>

                              <div>

                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#9a7410]">
                                  Contact Information
                                </p>

                                <h4 className="text-base font-extrabold text-slate-900">
                                  Student Contact
                                </h4>

                              </div>

                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">

                              {[
                                [
                                  "📧",
                                  "Email",
                                  student.email,
                                ],
                                [
                                  "📱",
                                  "Mobile",
                                  student.mobile,
                                ],
                                [
                                  "👤",
                                  "Full Name",
                                  student.fullName,
                                ],
                                [
                                  "🪪",
                                  "SBC Card Number",
                                  student.cardNumber,
                                ],
                              ].map(
                                ([
                                  icon,
                                  label,
                                  value,
                                ]) => (
                                  <div
                                    key={
                                      label
                                    }
                                    className="rounded-2xl border border-[#e6d28b] bg-white p-4 shadow-sm"
                                  >

                                    <div className="flex items-start gap-3">

                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff3c4] text-base">
                                        {icon}
                                      </div>

                                      <div className="min-w-0">

                                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                          {label}
                                        </p>

                                        <p className="mt-1 break-words text-sm font-extrabold text-slate-800">
                                          {value ||
                                            "-"}
                                        </p>

                                      </div>

                                    </div>

                                  </div>
                                )
                              )}

                            </div>

                          </div>

                          {/* ACADEMIC */}

                          <div className="mb-5 rounded-3xl border border-[#d4af37]/25 bg-gradient-to-br from-[#fffaf0] to-[#f1e2b1] p-5">

                            <div className="mb-4 flex items-center gap-3">

                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#07111f] text-sm text-[#f1cf63]">
                                🎓
                              </div>

                              <div>

                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#9a7410]">
                                  Academic Information
                                </p>

                                <h4 className="text-base font-extrabold text-slate-900">
                                  Education Details
                                </h4>

                              </div>

                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">

                              {[
                                [
                                  "🏫",
                                  "College",
                                  student.college,
                                ],
                                [
                                  "📚",
                                  "Course",
                                  student.course,
                                ],
                                [
                                  "📅",
                                  "Year",
                                  student.year,
                                ],
                              ].map(
                                ([
                                  icon,
                                  label,
                                  value,
                                ]) => (
                                  <div
                                    key={
                                      label
                                    }
                                    className="rounded-2xl border border-[#e6d28b] bg-white p-4 shadow-sm"
                                  >

                                    <div className="flex items-center gap-3">

                                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3c4] text-base">
                                        {icon}
                                      </div>

                                      <div className="min-w-0">

                                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                          {label}
                                        </p>

                                        <p className="mt-1 break-words text-sm font-extrabold text-slate-800">
                                          {value ||
                                            "-"}
                                        </p>

                                      </div>

                                    </div>

                                  </div>
                                )
                              )}

                            </div>

                          </div>

                          {/* CARD + REGISTRATION */}

                          <div className="grid gap-5 lg:grid-cols-2">

                            <div className="rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#07111f] via-[#1b2b43] to-[#a17a12] p-5 text-white shadow-md">

                              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#f8e7a1]">
                                SBC Card
                              </p>

                              <p className="mt-3 text-xs font-semibold text-[#f8e7a1]">
                                Card Number
                              </p>

                              <p className="mt-1 text-2xl font-black tracking-wide">
                                {student.cardNumber ||
                                  "-"}
                              </p>

                              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#d4af37]/20 px-3 py-1.5 text-xs font-extrabold text-[#fff4bf] ring-1 ring-[#d4af37]/30">
                                {pending
                                  ? "⏳ Pending Approval"
                                  : "✓ Active SBC Member"}
                              </div>

                            </div>

                            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">

                              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-700">
                                Registration
                              </p>

                              <div className="mt-4 flex items-center gap-4">

                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-xl">
                                  🕐
                                </div>

                                <div>

                                  <p className="text-xs font-bold text-slate-500">
                                    Registered On
                                  </p>

                                  <p className="mt-1 text-sm font-extrabold text-slate-800">
                                    {student
                                      .createdAt
                                      ?.toDate
                                      ? student.createdAt
                                          .toDate()
                                          .toLocaleString(
                                            "en-IN"
                                          )
                                      : "Registration date not available"}
                                  </p>

                                </div>

                              </div>

                            </div>

                          </div>

                          {/* STATUS */}

                          {pending ? (
                            <div className="mt-5 flex flex-col gap-4 rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">

                              <div className="flex items-start gap-3">

                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-xl">
                                  ⚠️
                                </div>

                                <div>

                                  <p className="font-extrabold text-orange-800">
                                    Approval Required
                                  </p>

                                  <p className="mt-1 text-sm text-orange-700/80">
                                    Verify the student details before activating this SBC account.
                                  </p>

                                </div>

                              </div>

                              <button
                                onClick={() =>
                                  approveStudent(
                                    student.id,
                                    student.fullName
                                  )
                                }
                                disabled={
                                  approvingStudent ===
                                  student.id
                                }
                                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {approvingStudent ===
                                student.id
                                  ? "Approving Student..."
                                  : "✓ Approve Student"}
                              </button>

                            </div>
                          ) : (
                            <div className="mt-5 flex items-center gap-3 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-5">

                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-lg text-emerald-700">
                                ✓
                              </div>

                              <div>

                                <p className="font-extrabold text-emerald-800">
                                  Student Approved
                                </p>

                                <p className="text-sm text-emerald-700/80">
                                  This student is currently an active SBC member.
                                </p>

                              </div>

                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

        {/* VIEW / EDIT MODAL */}

        {selectedStudent &&
          studentModalMode && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
              onMouseDown={(e) => {
                if (
                  e.target ===
                  e.currentTarget
                ) {
                  closeStudentModal();
                }
              }}
            >

              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-white/20 bg-white shadow-2xl">

                <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur sm:px-7">

                  <div className="flex items-start justify-between gap-4">

                    <div className="flex items-center gap-3">

                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          studentModalMode ===
                          "edit"
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-blue-50 text-[#9a7410]"
                        }`}
                      >
                        {studentModalMode ===
                        "edit"
                          ? "✏️"
                          : "👤"}
                      </div>

                      <div>

                        <h2 className="text-xl font-extrabold text-slate-900">
                          {studentModalMode ===
                          "edit"
                            ? "Edit Student"
                            : "Student Details"}
                        </h2>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {studentModalMode ===
                          "edit"
                            ? "Update the registered information."
                            : "Complete student account information."}
                        </p>

                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={
                        closeStudentModal
                      }
                      disabled={
                        savingStudent
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
                    >
                      ✕
                    </button>

                  </div>

                </div>

                <div className="p-6 sm:p-7">

                  {studentModalMode ===
                  "view" ? (
                    <div className="grid gap-3 sm:grid-cols-2">

                      {[
                        [
                          "Full Name",
                          selectedStudent.fullName,
                        ],
                        [
                          "Email",
                          selectedStudent.email,
                        ],
                        [
                          "Mobile",
                          selectedStudent.mobile,
                        ],
                        [
                          "College",
                          selectedStudent.college,
                        ],
                        [
                          "Course",
                          selectedStudent.course,
                        ],
                        [
                          "Year",
                          selectedStudent.year,
                        ],
                        [
                          "SBC Card Number",
                          selectedStudent.cardNumber,
                        ],
                        [
                          "Account Status",
                          selectedStudent.status?.toUpperCase(),
                        ],
                      ].map(
                        ([
                          label,
                          value,
                        ]) => (
                          <div
                            key={
                              label
                            }
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >

                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                              {label}
                            </p>

                            <p className="mt-1.5 break-words text-sm font-extrabold text-slate-800">
                              {value ||
                                "-"}
                            </p>

                          </div>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openEditStudent(
                            selectedStudent
                          )
                        }
                        className="mt-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-indigo-700 sm:col-span-2"
                      >
                        ✏️ Edit Student
                      </button>

                    </div>
                  ) : (
                    <div className="space-y-5">

                      <div className="grid gap-4 sm:grid-cols-2">

                        {[
                          [
                            "Full Name",
                            editFullName,
                            setEditFullName,
                          ],
                          [
                            "Email",
                            editEmail,
                            setEditEmail,
                          ],
                          [
                            "Mobile",
                            editMobile,
                            setEditMobile,
                          ],
                          [
                            "College",
                            editCollege,
                            setEditCollege,
                          ],
                          [
                            "Course",
                            editCourse,
                            setEditCourse,
                          ],
                          [
                            "Year",
                            editYear,
                            setEditYear,
                          ],
                        ].map(
                          ([
                            label,
                            value,
                            setter,
                          ]) => (
                            <div
                              key={
                                label as string
                              }
                            >

                              <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500">
                                {label as string}
                              </label>

                              <input
                                type={
                                  label ===
                                  "Email"
                                    ? "email"
                                    : "text"
                                }
                                inputMode={
                                  label ===
                                  "Mobile"
                                    ? "tel"
                                    : undefined
                                }
                                value={
                                  value as string
                                }
                                onChange={(
                                  e
                                ) =>
                                  (
                                    setter as (
                                      value: string
                                    ) => void
                                  )(
                                    e.target
                                      .value
                                  )
                                }
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                              />

                            </div>
                          )
                        )}

                        <div className="sm:col-span-2">

                          <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-500">
                            SBC Card Number
                          </label>

                          <input
                            value={
                              editCardNumber
                            }
                            onChange={(e) =>
                              setEditCardNumber(
                                e.target
                                  .value
                              )
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                          />

                        </div>

                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Current Account Status
                        </p>

                        <p className="mt-1 text-sm font-extrabold uppercase text-slate-800">
                          {selectedStudent.status ||
                            "-"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Use the approval controls to change the account status.
                        </p>

                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">

                        <button
                          type="button"
                          onClick={
                            closeStudentModal
                          }
                          disabled={
                            savingStudent
                          }
                          className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={
                            saveStudent
                          }
                          disabled={
                            savingStudent
                          }
                          className="flex-1 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingStudent
                            ? "Saving..."
                            : "💾 Save Changes"}
                        </button>

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
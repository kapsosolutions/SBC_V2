"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, storage } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import AdminProtected from "@/components/AdminProtected";

export default function AdminNotificationsPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  /*
   * ============================================================
   * FIREBASE STORAGE IMAGE UPLOAD
   * ============================================================
   *
   * Admin selects an image directly from the PC.
   * The image is automatically uploaded to Firebase Storage
   * and the download URL is attached to the notification.
   */

  const uploadImageToFirebaseStorage = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be smaller than 10 MB.");
      return;
    }

    try {
      setImageUploading(true);
      setResult("");

      const user = auth.currentUser;

      if (!user) {
        throw new Error("Admin login required.");
      }

      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();

      const filePath =
        `notification-images/${user.uid}/${Date.now()}-${safeFileName}`;

      const storageRef = ref(storage, filePath);

      await uploadBytes(storageRef, file, {
        contentType: file.type,
        cacheControl: "public,max-age=31536000",
      });

      const downloadUrl =
        await getDownloadURL(storageRef);

      setImageUrl(downloadUrl);

      console.log(
        "✅ Notification image uploaded to Firebase Storage:",
        downloadUrl
      );
    } catch (error) {
      console.error(
        "Firebase Storage image upload error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to upload image."
      );
    } finally {
      setImageUploading(false);
    }
  };

  /*
   * ============================================================
   * SEND NOTIFICATION
   * ============================================================
   */

  const sendNotification = async () => {
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const cleanImageUrl = imageUrl.trim();

    if (!cleanTitle || !cleanMessage) {
      alert(
        "Please enter notification title and message."
      );
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      alert("Admin login required.");
      return;
    }

    try {
      setSending(true);
      setResult("");

      const idToken = await user.getIdToken();

      const response = await fetch(
        `${API_BASE_URL}/api/admin/notifications/send`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },

          body: JSON.stringify({
            title: cleanTitle,
            message: cleanMessage,
            imageUrl: cleanImageUrl || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to send notification."
        );
      }

      setResult(
        `✅ Notification sent. ${data.successCount} students received it.`
      );

      setTitle("");
      setMessage("");
      setImageUrl("");
    } catch (error) {
      console.error(error);

      setResult(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Failed to send notification."
        }`
      );
    } finally {
      setSending(false);
    }
  };

  /*
   * ============================================================
   * REMOVE IMAGE
   * ============================================================
   */

  const removeImage = () => {
    setImageUrl("");
  };

  return (
    <AdminProtected>
      <main className="min-h-screen bg-[#f4f6f8] text-slate-900">

        {/* =====================================================
            TOP HEADER
        ===================================================== */}

        <header className="border-b border-slate-200 bg-[#07111f] text-white">
          <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">

            <div className="flex items-center justify-between gap-4">

              {/* BRAND */}

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/40 bg-[#d4af37]/10 text-xl font-black text-[#f1cf63] shadow-[0_0_35px_rgba(212,175,55,0.12)]">
                  SBC
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#f1cf63]">
                    Student Benefit Card
                  </p>

                  <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                    Notification Center
                  </h1>
                </div>

              </div>

              {/* DASHBOARD BUTTON */}

              <button
                type="button"
                onClick={() =>
                  router.push("/admin/dashboard")
                }
                className="shrink-0 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2.5 text-sm font-black text-[#f1cf63] transition hover:bg-[#d4af37] hover:text-[#07111f]"
              >
                ← Dashboard
              </button>

            </div>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
              Create and send premium push notifications
              with a custom image to SBC students.
            </p>

          </div>
        </header>

        {/* =====================================================
            MAIN CONTENT
        ===================================================== */}

        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">

            {/* =================================================
                LEFT - FORM
            ================================================= */}

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-8">

              {/* AUDIENCE */}

              <div className="mb-8 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-lg">
                    🎯
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                      Audience
                    </p>

                    <p className="mt-1 font-black text-slate-900">
                      All Registered Students
                    </p>
                  </div>

                </div>

                <p className="mt-3 text-xs leading-5 text-blue-700/70">
                  Only students who have enabled browser
                  notifications will receive this push.
                </p>

              </div>

              {/* TITLE */}

              <div className="mb-7">

                <label className="mb-2 block text-sm font-black text-slate-800">
                  Notification Title
                </label>

                <input
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder="🎉 New SBC Offer"
                  maxLength={100}
                  disabled={
                    sending ||
                    imageUploading
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold outline-none transition placeholder:text-slate-400 focus:border-[#c49b27] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                />

                <div className="mt-2 text-right text-[11px] font-semibold text-slate-400">
                  {title.length}/100
                </div>

              </div>

              {/* MESSAGE */}

              <div className="mb-7">

                <label className="mb-2 block text-sm font-black text-slate-800">
                  Message
                </label>

                <textarea
                  value={message}
                  onChange={(e) =>
                    setMessage(e.target.value)
                  }
                  placeholder="New student offers are now available!"
                  maxLength={300}
                  rows={5}
                  disabled={
                    sending ||
                    imageUploading
                  }
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-medium leading-6 outline-none transition placeholder:text-slate-400 focus:border-[#c49b27] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                />

                <div className="mt-2 text-right text-[11px] font-semibold text-slate-400">
                  {message.length}/300
                </div>

              </div>

              {/* IMAGE UPLOAD */}

              <div>

                <div className="mb-3 flex items-center justify-between">

                  <label className="text-sm font-black text-slate-800">
                    Notification Image
                  </label>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Optional
                  </span>

                </div>

                {!imageUrl ? (

                  <label
                    className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-[#c49b27] hover:bg-[#fffdf5] ${
                      imageUploading ||
                      sending
                        ? "pointer-events-none opacity-60"
                        : ""
                    }`}
                  >

                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm transition group-hover:scale-105">
                      {imageUploading
                        ? "⏳"
                        : "🖼️"}
                    </div>

                    <p className="font-black text-slate-800">
                      {imageUploading
                        ? "Uploading to Firebase Storage..."
                        : "Upload Notification Image"}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      JPG, PNG or WEBP • Maximum 10 MB
                    </p>

                    <span className="mt-4 rounded-xl bg-[#07111f] px-5 py-2.5 text-xs font-black text-white transition group-hover:bg-[#d4af37] group-hover:text-[#07111f]">
                      Choose Image
                    </span>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={
                        imageUploading ||
                        sending
                      }
                      onChange={(e) => {
                        const file =
                          e.target.files?.[0];

                        if (file) {
                          uploadImageToFirebaseStorage(
                            file
                          );
                        }

                        e.target.value = "";
                      }}
                    />

                  </label>

                ) : (

                  <div className="overflow-hidden rounded-2xl border border-[#d4af37]/30 bg-[#fffdf5]">

                    <div className="relative">

                      <img
                        src={imageUrl}
                        alt="Notification preview"
                        className="max-h-72 w-full object-cover"
                      />

                      <div className="absolute left-4 top-4 rounded-full bg-emerald-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
                        ✓ Uploaded
                      </div>

                    </div>

                    <div className="flex items-center justify-between gap-4 p-4">

                      <div className="min-w-0">

                        <p className="font-black text-slate-800">
                          Image ready
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-400">
                          Firebase Storage
                        </p>

                      </div>

                      <button
                        type="button"
                        onClick={removeImage}
                        disabled={sending}
                        className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>

                    </div>

                  </div>

                )}

              </div>

              {/* SEND BUTTON */}

              <button
                onClick={sendNotification}
                disabled={
                  sending ||
                  imageUploading ||
                  !title.trim() ||
                  !message.trim()
                }
                className="mt-8 w-full rounded-2xl bg-gradient-to-r from-[#a8790c] via-[#d4af37] to-[#f1cf63] px-6 py-4 text-base font-black text-[#07111f] shadow-[0_12px_30px_rgba(180,135,20,0.25)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? "Sending Notification..."
                  : imageUploading
                  ? "Uploading Image..."
                  : "🔔 Send to All Students"}
              </button>

              {/* RESULT */}

              {result && (
                <div
                  className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${
                    result.startsWith("✅")
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {result}
                </div>
              )}

            </section>

            {/* =================================================
                RIGHT - LIVE PREVIEW
            ================================================= */}

            <section>

              <div className="sticky top-6">

                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b18a16]">
                    Live Preview
                  </p>

                  <h2 className="mt-1 text-2xl font-black text-[#07111f]">
                    Mobile Notification
                  </h2>
                </div>

                {/* PHONE */}

                <div className="mx-auto max-w-sm rounded-[2.5rem] border-[8px] border-[#111827] bg-[#0b1220] p-3 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">

                  {/* PHONE TOP */}

                  <div className="mb-4 flex items-center justify-center">
                    <div className="h-5 w-28 rounded-full bg-black" />
                  </div>

                  {/* SCREEN */}

                  <div className="min-h-[520px] rounded-[2rem] bg-gradient-to-b from-slate-800 to-slate-950 p-4">

                    <div className="mb-6 flex items-center justify-between text-[10px] font-bold text-white/60">
                      <span>9:41</span>
                      <span>● ● ●</span>
                    </div>

                    {/* NOTIFICATION */}

                    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">

                      {/* IMAGE */}

                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt="Notification"
                          className="h-40 w-full object-cover"
                        />
                      )}

                      <div className="p-4">

                        <div className="flex items-start gap-3">

                          {/* SBC ICON */}

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#07111f] text-[10px] font-black text-[#f1cf63]">
                            SBC
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="flex items-center justify-between gap-2">

                              <p className="truncate text-xs font-black text-slate-900">
                                Student Benefit Card
                              </p>

                              <span className="shrink-0 text-[9px] text-slate-400">
                                now
                              </span>

                            </div>

                            <p className="mt-1 text-sm font-black leading-5 text-slate-900">
                              {title ||
                                "🎉 New SBC Offer"}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {message ||
                                "New student offers are now available!"}
                            </p>

                          </div>

                        </div>

                      </div>

                    </div>

                    {/* PHONE CONTENT */}

                    <div className="mt-8 text-center">

                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d4af37]/10 text-2xl">
                        🔔
                      </div>

                      <p className="mt-4 text-sm font-black text-white/80">
                        SBC Notifications
                      </p>

                      <p className="mt-1 text-xs leading-5 text-white/35">
                        Students will receive your
                        notification on supported devices.
                      </p>

                    </div>

                  </div>

                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs leading-5 text-slate-500">
                  This is a visual preview. The actual
                  Android Chrome notification appearance
                  may vary by device and Chrome version.
                </div>

              </div>

            </section>

          </div>

        </div>
      </main>
    </AdminProtected>
  );
}
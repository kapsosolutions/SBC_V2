"use client";

import {
  use,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { v4 as uuid } from "uuid";

import {
  CLOUDINARY_UPLOAD_PRESET,
  CLOUDINARY_UPLOAD_URL,
} from "@/lib/cloudinary";

import BusinessProtected from "@/components/BusinessProtected";

import { auth, db } from "@/lib/firebase";

import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

interface EditOfferProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditOffer({
  params,
}: EditOfferProps) {
  const router = useRouter();

  /*
   * Next.js 15/16:
   * params is a Promise.
   */
  const { id: offerId } = use(params);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [description, setDescription] =
    useState("");

  const [oldDesktopImage, setOldDesktopImage] =
    useState("");

  const [oldMobileImage, setOldMobileImage] =
    useState("");

  const [desktopPreview, setDesktopPreview] =
    useState("");

  const [mobilePreview, setMobilePreview] =
    useState("");

  const [desktopImageFile, setDesktopImageFile] =
    useState<File | null>(null);

  const [mobileImageFile, setMobileImageFile] =
    useState<File | null>(null);

  /*
   * ==========================================
   * LOAD OFFER
   * ==========================================
   */

  useEffect(() => {
    if (!offerId) {
      router.replace(
        "/business/my-offers"
      );

      return;
    }

    loadOffer();
  }, [offerId]);

  /*
   * ==========================================
   * LOAD OFFER DATA
   * ==========================================
   */

  const loadOffer = async () => {
    try {
      setLoading(true);

      const user =
        auth.currentUser;

      if (!user) {
        router.replace(
          "/business/login"
        );

        return;
      }

      const offerRef =
        doc(
          db,
          "offers",
          offerId
        );

      const offerSnap =
        await getDoc(
          offerRef
        );

      if (!offerSnap.exists()) {
        alert(
          "❌ Offer Not Found"
        );

        router.replace(
          "/business/my-offers"
        );

        return;
      }

      const data =
        offerSnap.data();

      /*
       * =====================================
       * SECURITY CHECK
       * =====================================
       *
       * Business can edit only its own offer.
       */

      if (
        data.businessId !==
        user.uid
      ) {
        alert(
          "❌ You are not authorized to edit this offer."
        );

        router.replace(
          "/business/my-offers"
        );

        return;
      }

      /*
       * Only load description + image.
       *
       * Title / Discount / Category
       * are intentionally NOT editable.
       */

      setDescription(
        data.description || ""
      );

      const desktopImage =
        data.desktopImage || data.image || "";

      const mobileImage =
        data.mobileImage || data.image || "";

      setOldDesktopImage(desktopImage);
      setOldMobileImage(mobileImage);
      setDesktopPreview(desktopImage);
      setMobilePreview(mobileImage);

    } catch (error) {
      console.error(
        "Offer loading error:",
        error
      );

      alert(
        "❌ Failed to load offer."
      );

      router.replace(
        "/business/my-offers"
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ==========================================
   * IMAGE CHANGE
   * ==========================================
   */

  const handleImageChange = (
    type: "desktop" | "mobile",
    file: File | null
  ) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("❌ Please select a valid image.");
      return;
    }

    const url = URL.createObjectURL(file);

    if (type === "desktop") {
      setDesktopImageFile(file);
      setDesktopPreview(url);
    } else {
      setMobileImageFile(file);
      setMobilePreview(url);
    }
  };

  /*
   * ==========================================
   * UPDATE OFFER
   * ==========================================
   */

  const updateOffer =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        alert(
          "❌ Business login required."
        );

        return;
      }

      /*
       * Description is optional.
       * But if entered, keep it short.
       */

      if (
        description.trim().length >
        1000
      ) {
        alert(
          "❌ Description should be 1000 characters or less."
        );

        return;
      }

      /*
       * Image must exist.
       *
       * Existing image is accepted,
       * or a new image can be uploaded.
       */

      if (
        (!oldDesktopImage && !desktopImageFile) ||
        (!oldMobileImage && !mobileImageFile)
      ) {
        alert(
          "❌ Please upload both Desktop and Mobile offer images."
        );

        return;
      }

      try {
        setSaving(true);

        /*
         * =====================================
         * FINAL OWNERSHIP CHECK
         * =====================================
         */

        const offerRef =
          doc(
            db,
            "offers",
            offerId
          );

        const offerSnap =
          await getDoc(
            offerRef
          );

        if (!offerSnap.exists()) {
          alert(
            "❌ Offer not found."
          );

          return;
        }

        const currentData =
          offerSnap.data();

        if (
          currentData.businessId !==
          user.uid
        ) {
          alert(
            "❌ You are not authorized to edit this offer."
          );

          return;
        }

        /*
         * =====================================
         * IMAGE
         * =====================================
         */

        const uploadImage = async (file: File) => {
          const formData = new FormData();

          formData.append("file", file);
          formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
          formData.append("public_id", uuid());

          const upload = await fetch(
            CLOUDINARY_UPLOAD_URL,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!upload.ok) {
            throw new Error("Cloudinary upload failed.");
          }

          const uploaded = await upload.json();

          if (!uploaded.secure_url) {
            throw new Error("Image upload failed.");
          }

          return uploaded.secure_url as string;
        };

        const desktopImage = desktopImageFile
          ? await uploadImage(desktopImageFile)
          : oldDesktopImage;

        const mobileImage = mobileImageFile
          ? await uploadImage(mobileImageFile)
          : oldMobileImage;

        /*
         * =====================================
         * UPDATE FIRESTORE
         * =====================================
         *
         * IMPORTANT:
         *
         * Only description + image are updated.
         *
         * Existing:
         * - title
         * - discount
         * - category
         *
         * are NOT touched.
         */

        await updateDoc(
          offerRef,
          {
            description:
              description.trim(),

            // Keep legacy "image" as desktop image for backward compatibility.
            image: desktopImage,
            desktopImage,
            mobileImage,
          }
        );

        alert(
          "✅ Offer Updated Successfully"
        );

        router.replace(
          "/business/my-offers"
        );

      } catch (error) {
        console.error(
          "Offer update error:",
          error
        );

        alert(
          error instanceof Error
            ? `❌ ${error.message}`
            : "❌ Failed to update offer."
        );
      } finally {
        setSaving(false);
      }
    };

  /*
   * ==========================================
   * LOADING
   * ==========================================
   */

  if (loading) {
    return (
      <BusinessProtected>
        <main className="flex min-h-screen items-center justify-center bg-[#f5f3ed] p-6">

          <div className="w-full max-w-md rounded-[2rem] bg-white p-10 text-center shadow-[0_25px_80px_rgba(7,17,31,0.12)]">

            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#d4af37]" />

            <h2 className="text-2xl font-black text-[#07111f]">
              Loading Offer...
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Please wait...
            </p>

          </div>

        </main>
      </BusinessProtected>
    );
  }

  /*
   * ==========================================
   * PAGE
   * ==========================================
   */

  return (
    <BusinessProtected>

      <main className="min-h-screen bg-[#f5f3ed] px-4 py-8 sm:px-6">

        <div className="mx-auto max-w-2xl">

          <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-[0_25px_80px_rgba(7,17,31,0.12)]">

            {/* =================================
                HEADER
            ================================= */}

            <div className="bg-[#07111f] px-6 py-7 text-white sm:px-8">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4af37]">
                    SBC Business Portal
                  </p>

                  <h1 className="mt-2 text-3xl font-black">
                    ✏️ Edit Offer
                  </h1>

                  <p className="mt-1 text-sm text-white/60">
                    Update your offer image and short description.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/business/my-offers"
                    )
                  }
                  className="shrink-0 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/20"
                >
                  ← My Offers
                </button>

              </div>

            </div>

            {/* =================================
                FORM
            ================================= */}

            <div className="space-y-7 p-6 sm:p-8">

              {/* =================================
                  DESKTOP + MOBILE OFFER IMAGES
              ================================= */}

              <div className="space-y-5">

                <div>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                        Desktop Offer Image
                      </label>
                      <p className="mt-1 text-xs text-slate-400">
                        Recommended <b>1920 × 675</b> · wide desktop banner
                      </p>
                    </div>
                  </div>

                  <label className="group block cursor-pointer overflow-hidden rounded-[1.5rem] border-2 border-dashed border-[#d4af37]/40 bg-[#fbfaf6] transition hover:border-[#d4af37] hover:bg-[#fffdf5]">
                    <div className="p-3">
                      {desktopPreview ? (
                        <img
                          src={desktopPreview}
                          alt="Desktop Offer Preview"
                          className="aspect-[1920/675] w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-40 flex-col items-center justify-center text-center">
                          <div className="text-4xl">🖥️</div>
                          <p className="mt-3 text-sm font-black text-[#07111f]">
                            Upload Desktop Image
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-black/5 bg-white px-5 py-3 text-center text-sm font-black text-[#8a680c]">
                      📷 Change Desktop Image
                    </div>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        handleImageChange(
                          "desktop",
                          e.target.files?.[0] || null
                        )
                      }
                      disabled={saving}
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-3">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                      Mobile Offer Image
                    </label>
                    <p className="mt-1 text-xs text-slate-400">
                      Recommended <b>675 × 950</b> · mobile portrait banner
                    </p>
                  </div>

                  <label className="group block cursor-pointer overflow-hidden rounded-[1.5rem] border-2 border-dashed border-[#d4af37]/40 bg-[#fbfaf6] transition hover:border-[#d4af37] hover:bg-[#fffdf5]">
                    <div className="flex min-h-52 justify-center p-3">
                      {mobilePreview ? (
                        <img
                          src={mobilePreview}
                          alt="Mobile Offer Preview"
                          className="max-h-[520px] w-auto max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-40 flex-col items-center justify-center text-center">
                          <div className="text-4xl">📱</div>
                          <p className="mt-3 text-sm font-black text-[#07111f]">
                            Upload Mobile Image
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-black/5 bg-white px-5 py-3 text-center text-sm font-black text-[#8a680c]">
                      📷 Change Mobile Image
                    </div>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        handleImageChange(
                          "mobile",
                          e.target.files?.[0] || null
                        )
                      }
                      disabled={saving}
                    />
                  </label>
                </div>

              </div>

              {/* =================================
                  SHORT DESCRIPTION
              ================================= */}

              <div>

                <div className="mb-2 flex items-center justify-between gap-3">

                  <div>

                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                      Short Description
                    </label>

                    <p className="mt-1 text-xs text-slate-400">
                      Optional · Keep it short and clear.
                    </p>

                  </div>

                  <span className="text-[10px] font-bold text-slate-400">
                    {description.length}/1000
                  </span>

                </div>

                <textarea
                  value={description}
                  maxLength={1000}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  placeholder="Example: Enjoy our special student combo with delicious food at a great price."
                  className="h-28 w-full resize-none rounded-2xl border border-black/10 bg-[#fbfaf6] p-4 text-sm font-medium text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                />

              </div>

              {/* =================================
                  INFO BOX
              ================================= */}

              <div className="rounded-2xl border border-[#d4af37]/20 bg-[#fffdf5] p-4">

                <p className="text-sm font-black text-[#8a680c]">
                  💡 Offer Information
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Add the important offer details inside the image. The short description can be used for a quick explanation of the offer.
                </p>

              </div>

              {/* =================================
                  BUTTONS
              ================================= */}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/business/my-offers"
                    )
                  }
                  disabled={saving}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    updateOffer
                  }
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-[#d4af37] py-4 text-sm font-black text-[#07111f] shadow-lg transition hover:bg-[#f1cf63] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "⏳ Saving..."
                    : "💾 Save Changes"}
                </button>

              </div>

            </div>

          </div>

        </div>

      </main>

    </BusinessProtected>
  );
}
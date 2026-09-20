"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import BusinessProtected from "@/components/BusinessProtected";

import { auth, db } from "@/lib/firebase";
import {
  CLOUDINARY_UPLOAD_PRESET,
  CLOUDINARY_UPLOAD_URL,
} from "@/lib/cloudinary";

import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

import { v4 as uuid } from "uuid";

interface ExistingOffer {
  id: string;
  category: string;
  image: string;
  desktopImage?: string;
  mobileImage?: string;
  description: string;
}


export default function AddOffer() {
  const router = useRouter();

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const [desktopImageFile, setDesktopImageFile] =
    useState<File | null>(null);

  const [mobileImageFile, setMobileImageFile] =
    useState<File | null>(null);

  const [desktopPreview, setDesktopPreview] = useState("");
  const [mobilePreview, setMobilePreview] = useState("");

  const [categories, setCategories] =
    useState<string[]>([]);

  const [loadingCategories, setLoadingCategories] =
    useState(true);

  const [checkingOffer, setCheckingOffer] =
    useState(true);

  const [existingOffer, setExistingOffer] =
    useState<ExistingOffer | null>(null);

  const [saving, setSaving] = useState(false);

  /*
   * ==========================================================
   * LOAD CATEGORIES
   * ==========================================================
   */

  useEffect(() => {
    loadCategories();
  }, []);

  /*
   * ==========================================================
   * CHECK AUTH + EXISTING ACTIVE OFFER
   * ==========================================================
   */

  useEffect(() => {
    const unsubscribe =
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          router.replace("/business/login");
          return;
        }

        await checkExistingOffer(user.uid);
      });

    return () => unsubscribe();
  }, [router]);

  /*
   * ==========================================================
   * CHECK EXISTING ACTIVE OFFER
   * ==========================================================
   */

  const checkExistingOffer = async (
    businessId: string
  ) => {
    try {
      setCheckingOffer(true);

      const offerQuery = query(
        collection(db, "offers"),
        where("businessId", "==", businessId),
        where("status", "==", "active")
      );

      const offerSnap =
        await getDocs(offerQuery);

      if (!offerSnap.empty) {
        const offerDoc =
          offerSnap.docs[0];

        const data =
          offerDoc.data();

        setExistingOffer({
          id: offerDoc.id,
          category: data.category || "",
          image: data.image || "",
          desktopImage: data.desktopImage || data.image || "",
          mobileImage: data.mobileImage || data.image || "",
          description:
            data.description || "",
        });
      } else {
        setExistingOffer(null);
      }
    } catch (error) {
      console.error(
        "Active offer checking error:",
        error
      );
    } finally {
      setCheckingOffer(false);
    }
  };

  /*
   * ==========================================================
   * LOAD CATEGORIES
   * ==========================================================
   */

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);

      const snap = await getDocs(
        collection(db, "categories")
      );

      const data = snap.docs
        .map((item) => {
          const itemData = item.data();

          return (
            itemData.name ||
            itemData.category ||
            itemData.title ||
            ""
          );
        })
        .filter(Boolean) as string[];

      const uniqueCategories =
        Array.from(new Set(data)).sort(
          (a, b) => a.localeCompare(b)
        );

      setCategories(uniqueCategories);
    } catch (error) {
      console.error(
        "Category loading error:",
        error
      );
    } finally {
      setLoadingCategories(false);
    }
  };

  /*
   * ==========================================================
   * IMAGE SELECT
   * ==========================================================
   */

  const handleImageChange = (
    type: "desktop" | "mobile",
    file: File | null
  ) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image.");
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
   * ==========================================================
   * DESCRIPTION
   * ==========================================================
   */

  const handleDescriptionChange = (
    value: string
  ) => {
    setDescription(value);
  };

  /*
   * ==========================================================
   * ADD OFFER
   * ==========================================================
   */

  const addOffer = async () => {
    if (!category) {
      alert("Please select a category.");
      return;
    }

    if (!description.trim()) {
      alert(
        "Please enter a short description."
      );
      return;
    }

    if (!desktopImageFile || !mobileImageFile) {
      alert(
        "Please select both Desktop and Mobile offer images."
      );
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      alert("Business login required.");
      return;
    }

    try {
      setSaving(true);

      /*
       * ======================================================
       * FINAL ACTIVE OFFER CHECK
       * ======================================================
       */

      const existingOfferQuery =
        query(
          collection(db, "offers"),
          where(
            "businessId",
            "==",
            user.uid
          ),
          where(
            "status",
            "==",
            "active"
          )
        );

      const existingOfferSnap =
        await getDocs(
          existingOfferQuery
        );

      if (
        !existingOfferSnap.empty
      ) {
        const offerDoc =
          existingOfferSnap.docs[0];

        const data =
          offerDoc.data();

        setExistingOffer({
          id: offerDoc.id,
          category:
            data.category || "",
          image:
            data.image || "",
          description:
            data.description || "",
        });

        alert(
          "⚠️ You already have an active offer.\n\nPlease manage your existing offer before creating a new one."
        );

        return;
      }

      /*
       * ======================================================
       * BUSINESS DETAILS
       * ======================================================
       */

      const businessSnap =
        await getDoc(
          doc(
            db,
            "businesses",
            user.uid
          )
        );

      const businessData =
        businessSnap.exists()
          ? businessSnap.data()
          : {};

      const businessName =
        businessData.businessName || "";

      const businessMobile =
        businessData.mobile ||
        businessData.phone ||
        businessData.businessMobile ||
        businessData.ownerMobile ||
        "";

      const businessAddress =
        businessData.address ||
        businessData.businessAddress ||
        businessData.location ||
        businessData.fullAddress ||
        "";

      /*
       * ======================================================
       * CLOUDINARY UPLOAD
       * ======================================================
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

      const [desktopImage, mobileImage] = await Promise.all([
        uploadImage(desktopImageFile),
        uploadImage(mobileImageFile),
      ]);

      /*
       * ======================================================
       * SAVE OFFER
       * ======================================================
       *
       * Title/Discount are no longer used.
       * We keep title as "SBC Offer" internally so
       * older parts of the application remain compatible.
       */

      await addDoc(
        collection(db, "offers"),
        {
          title: "SBC Offer",

          discount: "",

          category,

          description: description.trim(),

          // Keep legacy "image" as desktop image for backward compatibility.
          image: desktopImage,
          desktopImage,
          mobileImage,

          businessId:
            user.uid,

          businessName,

          businessMobile,

          businessAddress,

          status: "active",

          createdAt:
            serverTimestamp(),
        }
      );

      alert(
        "✅ Offer added successfully."
      );

      router.replace(
        "/business/my-offers"
      );
    } catch (error) {
      console.error(
        "Offer creation error:",
        error
      );

      alert(
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Failed to add offer."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  if (
    checkingOffer ||
    loadingCategories
  ) {
    return (
      <BusinessProtected>
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div className="rounded-3xl bg-white p-10 text-center shadow-xl">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

            <h2 className="text-2xl font-bold text-green-700">
              Checking Offer...
            </h2>

            <p className="mt-2 text-gray-500">
              Please wait...
            </p>
          </div>
        </main>
      </BusinessProtected>
    );
  }

  /*
   * ==========================================================
   * EXISTING ACTIVE OFFER
   * ==========================================================
   */

  if (existingOffer) {
    return (
      <BusinessProtected>
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/40 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.10)] p-6 sm:p-8">

              <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-white via-white to-green-50/70 px-6 py-6 sm:px-8">
                <h1 className="text-3xl font-bold text-green-700">
                  ➕ Add New Offer
                </h1>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/business/dashboard"
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  ← Back
                </button>
              </div>

              <div className="rounded-3xl border-2 border-yellow-300 bg-yellow-50 p-7">

                <div className="text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100 text-4xl">
                    ⚠️
                  </div>

                  <h2 className="mt-5 text-2xl font-bold text-yellow-800">
                    You Already Have an Active Offer
                  </h2>

                  <p className="mt-3 leading-6 text-yellow-700">
                    A business can have only one
                    active offer at a time.
                  </p>
                </div>

                <div className="mt-7 overflow-hidden rounded-2xl bg-white shadow-md">

                  {existingOffer.image ? (
                    <img
                      src={
                        existingOffer.image
                      }
                      alt="Active SBC Offer"
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-gray-100 text-5xl">
                      🎁
                    </div>
                  )}

                  <div className="p-6">

                    {existingOffer.category && (
                      <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                        {existingOffer.category}
                      </span>
                    )}

                    {existingOffer.description && (
                      <p className="mt-4 text-sm leading-6 text-gray-600">
                        {existingOffer.description}
                      </p>
                    )}

                  </div>
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/business/my-offers"
                      )
                    }
                    className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700"
                  >
                    ✏️ Manage Existing Offer
                  </button>

                  <p className="mt-3 text-center text-sm text-gray-500">
                    Edit or delete your current
                    offer from My Offers.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </main>
      </BusinessProtected>
    );
  }

  /*
   * ==========================================================
   * NORMAL ADD OFFER PAGE
   * ==========================================================
   */

  return (
    <BusinessProtected>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/40 px-4 py-8 sm:px-6 lg:px-8">

        <div className="mx-auto max-w-2xl">

          <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">

            {/* HEADER */}

            <div className="flex items-center justify-between gap-4 bg-[#07111f] px-6 py-6 text-white sm:px-8">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4af37]">
                  SBC Business Portal
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  ➕ Add New Offer
                </h1>

                <p className="mt-2 text-sm text-white/55">
                  Upload your offer image and add a short description.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/business/my-offers"
                  )
                }
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/15"
              >
                ← Back
              </button>

            </div>

            {/* FORM */}

            <div className="space-y-6 p-6 sm:p-8">

              {/* CATEGORY */}

              <div>
                <label className="mb-2 block text-sm font-black text-slate-800">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-[#fafbf9] p-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                >
                  <option value="">
                    Select Category
                  </option>

                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* SHORT DESCRIPTION */}

              <div>

                <label className="mb-2 block text-sm font-black text-slate-800">
                  Short Description
                </label>

                <textarea
                  placeholder="Example: Special student combo at ₹299..."
                  value={description}
                  onChange={(e) =>
                    handleDescriptionChange(
                      e.target.value
                    )
                  }
                  className="h-32 w-full resize-none rounded-2xl border border-slate-200 bg-[#fafbf9] p-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d4af37] focus:bg-white focus:ring-4 focus:ring-[#d4af37]/10"
                />

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Add the important offer details students should know. No character limit.
                </p>

              </div>

              {/* DESKTOP + MOBILE OFFER IMAGES */}

              <div className="space-y-4">

                <div>
                  <label className="mb-1 block text-sm font-black text-slate-800">
                    Desktop Offer Image
                  </label>
                  <p className="mb-3 text-xs text-slate-400">
                    Recommended: <b>1920 × 675</b> (wide desktop banner)
                  </p>

                  <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-[#fafbf9] p-4 transition hover:border-[#d4af37] hover:bg-[#fffdf5]">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        handleImageChange(
                          "desktop",
                          e.target.files?.[0] || null
                        )
                      }
                      className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 transition hover:border-[#d4af37]"
                    />

                    {desktopPreview && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        <img
                          src={desktopPreview}
                          alt="Desktop Offer Preview"
                          className="aspect-[1920/675] w-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-black text-slate-800">
                    Mobile Offer Image
                  </label>
                  <p className="mb-3 text-xs text-slate-400">
                    Recommended: <b>675 × 950</b> (mobile portrait banner)
                  </p>

                  <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-[#fafbf9] p-4 transition hover:border-[#d4af37] hover:bg-[#fffdf5]">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) =>
                        handleImageChange(
                          "mobile",
                          e.target.files?.[0] || null
                        )
                      }
                      className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 transition hover:border-[#d4af37]"
                    />

                    {mobilePreview && (
                      <div className="mt-4 flex justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 p-2">
                        <img
                          src={mobilePreview}
                          alt="Mobile Offer Preview"
                          className="max-h-[520px] w-auto max-w-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* INFO */}

              <div className="rounded-2xl border border-[#d4af37]/20 bg-[#fffdf5] p-4">

                <p className="text-sm font-black text-[#8a680c]">
                  💡 Offer Display
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Students will mainly see your offer image,
                  business name, address and short description.
                  Keep the important offer details inside the image.
                </p>

              </div>

              {/* SAVE */}

              <button
                type="button"
                onClick={addOffer}
                disabled={saving}
                className="w-full rounded-2xl bg-[#07111f] py-4 text-base font-black text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "⏳ Uploading & Saving..."
                  : "💾 Add Offer"}
              </button>

            </div>
          </div>
        </div>
      </main>
    </BusinessProtected>
  );
}
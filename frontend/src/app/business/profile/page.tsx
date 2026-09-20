"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";

import { onAuthStateChanged } from "firebase/auth";

import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

export default function BusinessProfile() {

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [uid, setUid] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(auth, async (user) => {

        if (!user) {
          router.replace("/business/login");
          return;
        }

        setUid(user.uid);

        const snap =
          await getDoc(
            doc(db, "businesses", user.uid)
          );

        if (snap.exists()) {

          const data = snap.data();

          setBusinessName(data.businessName || "");
          setOwnerName(data.ownerName || "");
          setMobile(data.mobile || "");
          setCategory(data.category || "");
          setAddress(data.address || "");
          setWebsite(data.website || "");
          setDescription(data.description || "");

        }

        setLoading(false);

      });

    return () => unsubscribe();

  }, [router]);
    const saveProfile = async () => {

    if (
      !businessName ||
      !ownerName ||
      !mobile ||
      !category ||
      !address
    ) {
      alert("Please fill all required fields");
      return;
    }

    try {

      await updateDoc(
        doc(db, "businesses", uid),
        {
          businessName,
          ownerName,
          mobile,
          category,
          address,
          website,
          description,
        }
      );

      alert("Profile Updated Successfully");

      router.push("/business/dashboard");

    } catch (error) {

      console.log(error);

      alert("Failed to Update Profile");

    }

  };

  if (loading) {

    return (
      <div className="flex min-h-screen items-center justify-center text-2xl font-bold">
        Loading...
      </div>
    );

  }

  return (

    <main className="min-h-screen bg-slate-100 p-6">

      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-xl">

        <h1 className="mb-8 text-center text-3xl font-bold text-green-700">
          🏪 Business Profile
        </h1>

        <div className="space-y-4">

          <input
            placeholder="Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-xl border p-3"
          />

          <input
            placeholder="Owner Name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            className="w-full rounded-xl border p-3"
          />

          <input
            placeholder="Mobile Number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-xl border p-3"
          />

          <input
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border p-3"
          />

          <textarea
            placeholder="Business Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-24 w-full rounded-xl border p-3"
          />
                    <input
            placeholder="Website (Optional)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full rounded-xl border p-3"
          />

          <textarea
            placeholder="Business Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-32 w-full rounded-xl border p-3"
          />

          <div className="flex gap-4 pt-4">

            <button
              type="button"
              onClick={() => router.push("/business/dashboard")}
              className="flex-1 rounded-xl border border-gray-300 py-3 font-bold hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveProfile}
              className="flex-1 rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700"
            >
              💾 Save Profile
            </button>

          </div>

        </div>
              </div>

    </main>

  );

}
"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";

import { onAuthStateChanged } from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

interface Props {
  children: ReactNode;
}

export default function BusinessProtected({
  children,
}: Props) {

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {

        if (!user) {
          router.replace("/business/login");
          return;
        }

        const businessRef = doc(
          db,
          "businesses",
          user.uid
        );

        const businessSnap =
          await getDoc(businessRef);

        if (!businessSnap.exists()) {
          router.replace("/business/login");
          return;
        }

        const business =
          businessSnap.data();

        if (business.status === "pending") {
          router.replace("/business/pending");
          return;
        }

        if (business.status === "rejected") {
          router.replace("/business/rejected");
          return;
        }

        setLoading(false);

      }
    );

    return () => unsubscribe();

  }, [router]);
    if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">

        <div className="rounded-3xl bg-white p-10 shadow-xl text-center">

          <h2 className="text-2xl font-bold text-green-700">
            Checking Business Access...
          </h2>

          <p className="mt-3 text-gray-600">
            Please wait...
          </p>

        </div>

      </main>
    );
  }

  return <>{children}</>;
}
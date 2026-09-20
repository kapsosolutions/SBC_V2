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

export default function AdminProtected({
  children,
}: Props) {

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {

        if (!user) {

          router.replace("/admin/login");
          return;

        }

        const adminRef = doc(
          db,
          "admins",
          user.uid
        );

        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {

          router.replace("/admin/login");
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

        <div className="rounded-3xl bg-white p-10 shadow-xl">

          <h2 className="text-2xl font-bold text-blue-700">
            Checking Admin Access...
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
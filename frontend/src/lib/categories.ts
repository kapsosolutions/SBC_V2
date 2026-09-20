import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export interface Category {
  id: string;
  name: string;
  createdAt?: unknown;
}

export async function getCategories(): Promise<Category[]> {
  const q = query(
    collection(db, "categories"),
    orderBy("name", "asc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((item) => ({
    id: item.id,
    name: item.data().name || "",
    createdAt: item.data().createdAt,
  }));
}

export async function addCategory(
  name: string
): Promise<void> {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Category name is required");
  }

  await addDoc(collection(db, "categories"), {
    name: cleanName,
    createdAt: serverTimestamp(),
  });
}

export async function deleteCategory(
  categoryId: string
): Promise<void> {
  await deleteDoc(
    doc(db, "categories", categoryId)
  );
}
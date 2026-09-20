"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

interface Category {
  id: string;
  name: string;
  status?: string;
  createdAt?: any;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editingName, setEditingName] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);

      const q = query(
        collection(db, "categories"),
        orderBy("createdAt", "asc")
      );

      const snap = await getDocs(q);

      const data = snap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Category[];

      setCategories(data);
    } catch (error) {
      console.error(
        "Category loading error:",
        error
      );

      alert(
        "Unable to load categories."
      );
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async () => {
    const categoryName =
      name.trim();

    if (!categoryName) {
      alert(
        "Please enter category name."
      );
      return;
    }

    const exists = categories.some(
      (category) =>
        category.name
          .toLowerCase() ===
        categoryName.toLowerCase()
    );

    if (exists) {
      alert(
        "This category already exists."
      );
      return;
    }

    try {
      setSaving(true);

      await addDoc(
        collection(db, "categories"),
        {
          name: categoryName,
          status: "active",
          createdAt:
            serverTimestamp(),
        }
      );

      setName("");

      await loadCategories();

      alert(
        "✅ Category added successfully."
      );
    } catch (error) {
      console.error(
        "Add category error:",
        error
      );

      alert(
        "Unable to add category."
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (
    category: Category
  ) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const newName =
      editingName.trim();

    if (!newName) {
      alert(
        "Category name cannot be empty."
      );
      return;
    }

    const exists = categories.some(
      (category) =>
        category.id !== editingId &&
        category.name
          .toLowerCase() ===
          newName.toLowerCase()
    );

    if (exists) {
      alert(
        "This category already exists."
      );
      return;
    }

    try {
      setSaving(true);

      await updateDoc(
        doc(
          db,
          "categories",
          editingId
        ),
        {
          name: newName,
        }
      );

      cancelEdit();

      await loadCategories();

      alert(
        "✅ Category updated."
      );
    } catch (error) {
      console.error(
        "Update category error:",
        error
      );

      alert(
        "Unable to update category."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (
    id: string,
    categoryName: string
  ) => {
    const ok = window.confirm(
      `Delete "${categoryName}" category?`
    );

    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "categories", id)
      );

      setCategories(
        (current) =>
          current.filter(
            (category) =>
              category.id !== id
          )
      );

      alert(
        "✅ Category deleted."
      );
    } catch (error) {
      console.error(
        "Delete category error:",
        error
      );

      alert(
        "Unable to delete category."
      );
    }
  };

  return (
    <AdminProtected>
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">

        <div className="mx-auto max-w-5xl">

          {/* HEADER */}

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <h1 className="text-4xl font-bold text-purple-700">
                🏷️ Category Management
              </h1>

              <p className="mt-2 text-gray-600">
                Add, edit and manage SBC offer categories.
              </p>
            </div>

            <Link
              href="/admin/dashboard"
              className="rounded-xl bg-gray-700 px-6 py-3 text-center font-bold text-white hover:bg-gray-800"
            >
              ← Dashboard
            </Link>

          </div>

          {/* ADD */}

          <div className="mb-8 rounded-3xl bg-white p-6 shadow-xl md:p-8">

            <h2 className="text-2xl font-bold text-purple-700">
              ➕ Add New Category
            </h2>

            <p className="mt-2 text-gray-500">
              New categories will automatically appear
              in Business Offer forms.
            </p>

            <div className="mt-6 flex flex-col gap-4 md:flex-row">

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addCategory();
                  }
                }}
                placeholder="Example: Pharmacy"
                className="flex-1 rounded-xl border border-gray-300 p-4 outline-none focus:border-purple-600"
              />

              <button
                onClick={addCategory}
                disabled={saving}
                className="rounded-xl bg-purple-600 px-8 py-4 font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "➕ Add Category"}
              </button>

            </div>

          </div>

          {/* LIST */}

          <div className="rounded-3xl bg-white p-6 shadow-xl md:p-8">

            <div className="mb-6">

              <h2 className="text-2xl font-bold">
                📋 Categories
              </h2>

              <p className="mt-1 text-gray-500">
                Total Categories:{" "}
                {categories.length}
              </p>

            </div>

            {loading ? (

              <div className="rounded-2xl bg-slate-100 p-10 text-center">
                <p className="font-bold text-gray-600">
                  Loading Categories...
                </p>
              </div>

            ) : categories.length === 0 ? (

              <div className="rounded-2xl bg-slate-100 p-10 text-center">

                <div className="text-5xl">
                  🏷️
                </div>

                <h3 className="mt-3 text-xl font-bold">
                  No Categories
                </h3>

                <p className="mt-2 text-gray-500">
                  Add your first category above.
                </p>

              </div>

            ) : (

              <div className="space-y-4">

                {categories.map(
                  (category, index) => (

                    <div
                      key={category.id}
                      className="rounded-2xl border border-gray-200 bg-slate-50 p-4"
                    >

                      {editingId ===
                      category.id ? (

                        <div className="flex flex-col gap-3 md:flex-row">

                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) =>
                              setEditingName(
                                e.target.value
                              )
                            }
                            className="flex-1 rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-purple-600"
                          />

                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            💾 Save
                          </button>

                          <button
                            onClick={cancelEdit}
                            className="rounded-xl bg-gray-500 px-5 py-3 font-bold text-white hover:bg-gray-600"
                          >
                            Cancel
                          </button>

                        </div>

                      ) : (

                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                          <div className="flex items-center gap-4">

                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 font-bold text-purple-700">
                              {index + 1}
                            </div>

                            <div>

                              <h3 className="text-xl font-bold text-gray-800">
                                {category.name}
                              </h3>

                              <p className="text-sm text-green-600">
                                ● Active
                              </p>

                            </div>

                          </div>

                          <div className="flex gap-3">

                            <button
                              onClick={() =>
                                startEdit(
                                  category
                                )
                              }
                              className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
                            >
                              ✏️ Edit
                            </button>

                            <button
                              onClick={() =>
                                deleteCategory(
                                  category.id,
                                  category.name
                                )
                              }
                              className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
                            >
                              🗑 Delete
                            </button>

                          </div>

                        </div>

                      )}

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </div>

      </main>
    </AdminProtected>
  );
}
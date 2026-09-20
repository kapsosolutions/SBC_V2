"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminProtected from "@/components/AdminProtected";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/api";
import { onAuthStateChanged } from "firebase/auth";

function formatDate(raw: any) {
  try {
    const ms = raw?.seconds ? Number(raw.seconds) * 1000 : raw?.toMillis?.() || (typeof raw === "number" ? raw : 0);
    if (!ms) return "—";
    return new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return "—"; }
}

export default function AdminPayouts() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const load = async (user = auth.currentUser) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/admin/payouts`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || "Unable to load payouts.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Unable to load payout requests.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { if (user) load(user); });
    return () => unsub();
  }, []);

  const process = async (id: string, action: "approve" | "reject") => {
    if (action === "approve" && !utr.trim()) { alert("Enter the UTR / payment reference ID before marking as paid."); return; }
    const ok = window.confirm(action === "approve" ? "Confirm that this payout has been paid?" : "Reject this payout request?");
    if (!ok) return;
    try {
      setActionId(id);
      const user = auth.currentUser;
      if (!user) throw new Error("Admin session expired. Please login again.");
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/admin/payouts`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, action, utr: utr.trim(), note: note.trim() }) });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || "Unable to update payout.");
      setSelected(null); setUtr(""); setNote(""); await load(user);
    } catch (error: any) { alert(error?.message || "Unable to update payout."); }
    finally { setActionId(null); }
  };

  const pending = items.filter((x) => x.status === "pending");
  const paid = items.filter((x) => x.status === "paid");
  const pendingAmount = pending.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const paidAmount = paid.reduce((sum, x) => sum + Number(x.amount || 0), 0);

  return <AdminProtected>
    <main className="min-h-screen bg-[#f5f3ed] p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[28px] bg-[#07111f] p-7 shadow-[0_20px_65px_rgba(7,17,31,0.13)] md:p-9">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div><span className="rounded-full bg-[#d4af37]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#f1cf63]">SBC Admin</span><h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">💰 Referral Payouts</h1><p className="mt-2 text-sm text-white/50">Review student payout requests and record UPI / bank payments.</p></div>
            <Link href="/admin/dashboard" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/10">← Dashboard</Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending Requests</p><p className="mt-2 text-3xl font-black text-[#07111f]">{pending.length}</p><p className="mt-1 text-sm font-bold text-[#a37b0d]">₹{pendingAmount.toLocaleString()}</p></div>
          <div className="rounded-3xl bg-emerald-50 p-5"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Paid Requests</p><p className="mt-2 text-3xl font-black text-emerald-700">{paid.length}</p><p className="mt-1 text-sm font-bold text-emerald-700">₹{paidAmount.toLocaleString()}</p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">All Requests</p><p className="mt-2 text-3xl font-black text-[#07111f]">{items.length}</p></div>
        </div>

        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm">
          <div className="border-b border-black/5 px-6 py-5"><h2 className="text-xl font-black text-[#07111f]">Payout Queue</h2><p className="mt-1 text-sm text-slate-400">Newest requests first.</p></div>
          {loading ? <div className="p-10 text-center font-bold text-slate-400">Loading payout requests...</div> : items.length === 0 ? <div className="p-10 text-center font-bold text-slate-400">No payout requests yet.</div> : <div className="divide-y divide-black/5">{items.map((item) => <div key={item.id} className="p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-[#07111f]">{item.studentName || "Student"}</h3><span className={`rounded-full px-3 py-1 text-[10px] font-black ${item.status === "paid" ? "bg-emerald-50 text-emerald-700" : item.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{String(item.status || "pending").toUpperCase()}</span></div><p className="mt-1 text-sm text-slate-400">Requested {formatDate(item.requestedAt)} • {String(item.method || "").toUpperCase()}</p><p className="mt-3 text-2xl font-black text-[#a37b0d]">₹{Number(item.amount || 0).toLocaleString()}</p></div><div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]"><div className="rounded-2xl bg-[#fbfaf6] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Payment Details</p>{item.method === "upi" ? <p className="mt-1 font-black text-[#07111f]">{item.upiId || "—"}</p> : <><p className="mt-1 font-black text-[#07111f]">{item.accountName || "—"}</p><p className="text-xs text-slate-500">A/C {item.accountNumber || "—"} • {item.ifsc || "—"}</p></>}</div>{item.status === "pending" ? <button type="button" onClick={() => { setSelected(item); setUtr(""); setNote(""); }} className="rounded-2xl bg-[#07111f] px-5 py-3 text-sm font-black text-white hover:bg-[#111d2d]">Review / Pay →</button> : <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">UTR / Note</p><p className="mt-1 font-bold text-[#07111f]">{item.utr || "—"}</p><p className="text-xs text-slate-500">{item.adminNote || "—"}</p></div>}</div></div></div>)}</div>}
        </div>
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111f]/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-[#b18a16]">Payout Review</p><h3 className="mt-2 text-2xl font-black text-[#07111f]">₹{Number(selected.amount || 0).toLocaleString()} to {selected.studentName || "Student"}</h3></div><button onClick={() => setSelected(null)} className="rounded-full bg-slate-100 px-3 py-2 font-black">✕</button></div><div className="mt-5 rounded-2xl bg-[#fbfaf6] p-4 text-sm"><p className="font-black">{selected.method === "upi" ? "UPI" : "Bank Account"}</p><p className="mt-1 font-bold text-[#07111f]">{selected.method === "upi" ? selected.upiId : `${selected.accountName} • ${selected.accountNumber} • ${selected.ifsc}`}</p></div><label className="mt-5 block text-xs font-black uppercase tracking-wider text-slate-500">UTR / Payment Reference ID</label><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Required when paid" className="mt-2 w-full rounded-2xl border border-black/10 bg-[#fbfaf6] p-4 outline-none focus:border-[#d4af37]" /><label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-500">Admin Note</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" rows={3} className="mt-2 w-full rounded-2xl border border-black/10 bg-[#fbfaf6] p-4 outline-none focus:border-[#d4af37]" /><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => process(selected.id, "reject")} disabled={!!actionId} className="rounded-2xl border border-red-200 bg-red-50 py-4 text-sm font-black text-red-700 disabled:opacity-50">Reject</button><button type="button" onClick={() => process(selected.id, "approve")} disabled={!!actionId} className="rounded-2xl bg-[#d4af37] py-4 text-sm font-black text-[#07111f] disabled:opacity-50">{actionId ? "Processing..." : "Mark as Paid"}</button></div></div></div>}
    </main>
  </AdminProtected>;
}

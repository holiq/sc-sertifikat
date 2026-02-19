"use client";

import { useState } from "react";
import CertificateForm from "@/components/CertificateForm";
import StatusBadge from "@/components/StatusBadge";
import { getCertificate, getHistory, CertStatus, STATUS_LABEL } from "@/lib/contract";
import { isValidHash, shortHash } from "@/lib/hash";
import type { CertificateData, StatusHistoryEntry } from "@/lib/contract";

type Tab = "issue" | "manage";

interface LookupResult {
  hash: string;
  data: CertificateData;
  history: StatusHistoryEntry[];
}

function formatDate(ts: bigint) {
  return new Date(Number(ts) * 1000).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("issue");

  const [lookupHash, setLookupHash] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not-found" | "error">("idle");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  const [newStatus, setNewStatus] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleLookup = async () => {
    if (!isValidHash(lookupHash.trim())) {
      setLookupState("error");
      setLookupResult(null);
      return;
    }
    setLookupState("loading");
    setUpdateMsg(null);
    try {
      const hash = lookupHash.trim() as `0x${string}`;
      const [data, history] = await Promise.all([getCertificate(hash), getHistory(hash)]);
      if (!data.exists) {
        setLookupState("not-found");
        setLookupResult(null);
      } else {
        setLookupState("found");
        setLookupResult({ hash, data, history });
        setNewStatus(data.status === CertStatus.Active ? 1 : 0);
      }
    } catch {
      setLookupState("error");
    }
  };

  const handleUpdateStatus = async () => {
    if (!lookupResult) return;
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: lookupResult.hash, status: newStatus, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUpdateMsg({ type: "ok", text: `Status berhasil diubah. Tx: ${json.txHash}` });
      setReason("");
      const [data, history] = await Promise.all([
        getCertificate(lookupResult.hash as `0x${string}`),
        getHistory(lookupResult.hash as `0x${string}`),
      ]);
      setLookupResult({ ...lookupResult, data, history });
    } catch (err: unknown) {
      setUpdateMsg({ type: "err", text: (err as Error).message });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Hero */}
      <div className="gradient-hero py-10 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        <div className="relative mx-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 rounded-full px-3 py-1 text-white/90 text-xs font-medium mb-3">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            Panel Administrator
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1.5 tracking-tight">
            Manajemen Sertifikat
          </h1>
          <p className="text-indigo-100 text-sm">
            Terbitkan sertifikat baru atau kelola status sertifikat yang sudah ada di blockchain.
          </p>
        </div>
      </div>

      <div className="px-4 pb-12">
        <div className="mx-auto max-w-2xl -mt-5 relative z-10 space-y-5">
          {/* Warning banner */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Halaman admin</span> — Setiap tindakan akan menghasilkan transaksi on-chain dan tidak dapat dibatalkan. Pastikan data sudah benar sebelum mengirim.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 w-fit border border-slate-200/60">
            {(["issue", "manage"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "issue" ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14"/></svg>
                    Terbitkan
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Kelola Status
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Issue */}
          {tab === "issue" && (
            <div className="animate-fade-in rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Terbitkan Sertifikat Baru</h2>
                  <p className="text-xs text-slate-400">Upload PDF dan isi detail sertifikat</p>
                </div>
              </div>
              <CertificateForm />
            </div>
          )}

          {/* Tab: Manage */}
          {tab === "manage" && (
            <div className="animate-fade-in space-y-4">
              {/* Lookup card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">Cari Sertifikat</h2>
                    <p className="text-xs text-slate-400">Masukkan hash untuk menemukan data</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupHash}
                    onChange={(e) => setLookupHash(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                    placeholder="0x... (hash sertifikat)"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 px-4 py-2.5 font-mono text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-3 focus:ring-indigo-400/15 focus:bg-white transition-all"
                  />
                  <button
                    onClick={handleLookup}
                    disabled={lookupState === "loading"}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm"
                  >
                    {lookupState === "loading" ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    ) : "Cari"}
                  </button>
                </div>

                {lookupState === "not-found" && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                    Sertifikat tidak ditemukan di blockchain.
                  </div>
                )}
                {lookupState === "error" && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                    Hash tidak valid atau gagal membaca blockchain.
                  </div>
                )}
              </div>

              {/* Result: found */}
              {lookupState === "found" && lookupResult && (
                <div className="animate-fade-in rounded-2xl border border-slate-200/80 bg-white p-6 space-y-5 shadow-lg shadow-slate-900/5">
                  {/* Certificate info */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{lookupResult.data.label}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{shortHash(lookupResult.hash)}</p>
                    </div>
                    <StatusBadge status={lookupResult.data.status} />
                  </div>

                  <dl className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                    <div>
                      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Tanggal Terbit</dt>
                      <dd className="text-slate-700">{formatDate(lookupResult.data.issuedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Issuer</dt>
                      <dd className="font-mono text-xs text-slate-600 break-all">{shortHash(lookupResult.data.issuer)}</dd>
                    </div>
                  </dl>

                  {/* History */}
                  {lookupResult.history.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Riwayat Status ({lookupResult.history.length})</p>
                      <div className="space-y-2">
                        {lookupResult.history.map((h, i) => (
                          <div key={i} className="flex items-center gap-2.5 text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <StatusBadge status={h.status} />
                            <span className="text-slate-500">{formatDate(h.changedAt)}</span>
                            {h.reason && <span className="italic text-slate-400">— {h.reason}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Update form */}
                  <div className="border-t border-slate-100 pt-5 space-y-4">
                    <p className="text-sm font-bold text-slate-700">Ubah Status Sertifikat</p>

                    <div className="flex gap-2 flex-wrap">
                      {([0, 1, 2] as CertStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setNewStatus(s)}
                          disabled={lookupResult.data.status === s}
                          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
                            newStatus === s && lookupResult.data.status !== s
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25"
                              : lookupResult.data.status === s
                              ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
                              : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
                          }`}
                        >
                          {STATUS_LABEL[s]}
                          {lookupResult.data.status === s && <span className="ml-1 text-xs opacity-60">(kini)</span>}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Alasan perubahan status (opsional)"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-3 focus:ring-indigo-400/15 focus:bg-white transition-all"
                    />

                    <button
                      onClick={handleUpdateStatus}
                      disabled={updating || newStatus === lookupResult.data.status}
                      className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm shadow-indigo-500/25"
                    >
                      {updating ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          Memproses transaksi…
                        </span>
                      ) : "Simpan Perubahan"}
                    </button>

                    {updateMsg && (
                      <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border text-sm ${
                        updateMsg.type === "ok"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {updateMsg.type === "ok" ? (
                          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : (
                          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                        )}
                        <span className="font-mono text-xs break-all">{updateMsg.text}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

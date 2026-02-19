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

  // -- Manage tab state --
  const [lookupHash, setLookupHash] = useState("");
  const [lookupState, setLookupState] = useState<
    "idle" | "loading" | "found" | "not-found" | "error"
  >("idle");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  // -- Update status state --
  const [newStatus, setNewStatus] = useState<number>(1); // default Revoked
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
      const [data, history] = await Promise.all([
        getCertificate(hash),
        getHistory(hash),
      ]);
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
        body: JSON.stringify({
          hash: lookupResult.hash,
          status: newStatus,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setUpdateMsg({ type: "ok", text: `Status berhasil diubah. Tx: ${json.txHash}` });
      setReason("");
      // Refresh data
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
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Panel Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Terbitkan sertifikat baru atau kelola status sertifikat yang sudah ada.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 w-fit">
          {(["issue", "manage"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t === "issue" ? "Terbitkan Sertifikat" : "Kelola Status"}
            </button>
          ))}
        </div>

        {/* Tab: Issue */}
        {tab === "issue" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="font-semibold text-zinc-800 mb-4">
              Terbitkan Sertifikat Baru
            </h2>
            <CertificateForm />
          </div>
        )}

        {/* Tab: Manage */}
        {tab === "manage" && (
          <div className="space-y-4">
            {/* Lookup */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="font-semibold text-zinc-800 mb-4">
                Cari Sertifikat
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={lookupHash}
                  onChange={(e) => setLookupHash(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  placeholder="0x... (hash sertifikat)"
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleLookup}
                  disabled={lookupState === "loading"}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-300 transition-colors"
                >
                  {lookupState === "loading" ? "..." : "Cari"}
                </button>
              </div>

              {lookupState === "not-found" && (
                <p className="mt-3 text-sm text-red-600">Sertifikat tidak ditemukan.</p>
              )}
              {lookupState === "error" && (
                <p className="mt-3 text-sm text-red-600">
                  Hash tidak valid atau gagal membaca blockchain.
                </p>
              )}
            </div>

            {/* Detail sertifikat ditemukan */}
            {lookupState === "found" && lookupResult && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
                {/* Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-zinc-800">
                      {lookupResult.data.label}
                    </h3>
                    <StatusBadge status={lookupResult.data.status} />
                  </div>
                  <dl className="text-sm space-y-1 text-zinc-600">
                    <div className="flex gap-2">
                      <dt className="font-medium text-zinc-500 w-28 shrink-0">Terbit</dt>
                      <dd>{formatDate(lookupResult.data.issuedAt)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium text-zinc-500 w-28 shrink-0">Issuer</dt>
                      <dd className="font-mono text-xs break-all">{lookupResult.data.issuer}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium text-zinc-500 w-28 shrink-0">Hash</dt>
                      <dd className="font-mono text-xs break-all">{shortHash(lookupResult.hash)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Riwayat */}
                {lookupResult.history.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-zinc-700 mb-2">
                      Riwayat Status ({lookupResult.history.length})
                    </p>
                    <div className="space-y-2">
                      {lookupResult.history.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                          <StatusBadge status={h.status} />
                          <span>{formatDate(h.changedAt)}</span>
                          {h.reason && <span className="italic">— {h.reason}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form update status */}
                <div className="border-t border-zinc-100 pt-4 space-y-3">
                  <p className="text-sm font-semibold text-zinc-700">
                    Ubah Status Sertifikat
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {([0, 1, 2] as CertStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setNewStatus(s)}
                        disabled={lookupResult.data.status === s}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                          newStatus === s && lookupResult.data.status !== s
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "border-zinc-300 text-zinc-600 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                      >
                        {STATUS_LABEL[s]}
                        {lookupResult.data.status === s && " (saat ini)"}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Alasan perubahan status (opsional)"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updating || newStatus === lookupResult.data.status}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 transition-colors"
                  >
                    {updating ? "Memproses..." : "Simpan Perubahan Status"}
                  </button>
                  {updateMsg && (
                    <p
                      className={`text-xs rounded-lg px-3 py-2 border ${
                        updateMsg.type === "ok"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {updateMsg.text}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

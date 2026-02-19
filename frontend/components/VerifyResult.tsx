"use client";

import { CertificateData, CertStatus, StatusHistoryEntry } from "@/lib/contract";
import { shortHash } from "@/lib/hash";
import StatusBadge from "./StatusBadge";

interface VerifyResultProps {
  hash: string;
  data: CertificateData;
  history: StatusHistoryEntry[];
}

function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default function VerifyResult({ hash, data, history }: VerifyResultProps) {
  if (!data.exists) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="mb-2 text-4xl">✗</div>
        <h2 className="text-lg font-semibold text-red-800">
          Sertifikat Tidak Ditemukan
        </h2>
        <p className="mt-1 text-sm text-red-600">
          Hash ini tidak terdaftar di blockchain. Sertifikat mungkin tidak
          valid atau file telah dimodifikasi.
        </p>
        <p className="mt-3 font-mono text-xs text-red-400 break-all">{hash}</p>
      </div>
    );
  }

  const isActive = data.status === CertStatus.Active;

  return (
    <div className="space-y-4">
      {/* Header status */}
      <div
        className={`rounded-xl border p-6 text-center ${
          isActive
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <div className="mb-2 text-4xl">{isActive ? "✓" : "✗"}</div>
        <h2
          className={`text-lg font-semibold ${
            isActive ? "text-emerald-800" : "text-red-800"
          }`}
        >
          {isActive
            ? "Sertifikat Valid & Terverifikasi"
            : "Sertifikat Tidak Aktif"}
        </h2>
        <div className="mt-2 flex justify-center">
          <StatusBadge status={data.status} />
        </div>
      </div>

      {/* Detail sertifikat */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
        <h3 className="font-semibold text-zinc-800">Detail Sertifikat</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt className="text-zinc-500 font-medium">Nama Sertifikat</dt>
            <dd className="font-semibold text-zinc-800 sm:text-right sm:max-w-xs">{data.label}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt className="text-zinc-500 font-medium">Tanggal Terbit</dt>
            <dd className="text-zinc-800">{formatDate(data.issuedAt)}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt className="text-zinc-500 font-medium">Diterbitkan Oleh</dt>
            <dd className="font-mono text-xs text-zinc-600 break-all">{data.issuer}</dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <dt className="text-zinc-500 font-medium">Hash Dokumen</dt>
            <dd className="font-mono text-xs text-zinc-600 break-all">{hash}</dd>
          </div>
        </dl>
      </div>

      {/* Riwayat status */}
      {history.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="font-semibold text-zinc-800 mb-4">
            Riwayat Perubahan Status ({history.length})
          </h3>
          <ol className="relative border-l border-zinc-200 space-y-4 ml-3">
            {history.map((entry, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-zinc-400" />
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StatusBadge status={entry.status} />
                  <span className="text-xs text-zinc-400">
                    {formatDate(entry.changedAt)}
                  </span>
                </div>
                {entry.reason && (
                  <p className="text-sm text-zinc-600 italic">
                    &ldquo;{entry.reason}&rdquo;
                  </p>
                )}
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  oleh: {shortHash(entry.changedBy)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Link Etherscan */}
      <div className="text-center">
        <a
          href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          Lihat di Sepolia Etherscan →
        </a>
      </div>
    </div>
  );
}

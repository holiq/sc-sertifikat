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
      <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-8 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-red-100 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-red-800 mb-1">Sertifikat Tidak Ditemukan</h2>
        <p className="text-sm text-red-600 max-w-xs mx-auto leading-relaxed">
          Hash ini tidak terdaftar di blockchain. Sertifikat mungkin tidak valid atau file telah dimodifikasi.
        </p>
        <p className="mt-4 font-mono text-xs text-red-400 break-all bg-red-100/60 rounded-lg px-3 py-2">{hash}</p>
      </div>
    );
  }

  const isActive = data.status === CertStatus.Active;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`rounded-2xl border p-6 text-center relative overflow-hidden ${
        isActive
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"
          : "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
      }`}>
        {/* Decorative circle */}
        <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 ${
          isActive ? "bg-emerald-400" : "bg-amber-400"
        }`}/>

        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center mx-auto mb-3 ${
          isActive ? "bg-emerald-100 border-emerald-300" : "bg-amber-100 border-amber-300"
        }`}>
          {isActive ? (
            <svg className="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
          ) : (
            <svg className="w-8 h-8 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          )}
        </div>

        <h2 className={`text-lg font-bold mb-2 ${
          isActive ? "text-emerald-800" : "text-amber-800"
        }`}>
          {isActive ? "Sertifikat Valid & Terverifikasi" : "Sertifikat Tidak Aktif"}
        </h2>
        <div className="flex justify-center">
          <StatusBadge status={data.status} />
        </div>
      </div>

      {/* Detail */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4 shadow-sm shadow-slate-900/5">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 className="font-bold text-slate-800">Detail Sertifikat</h3>
        </div>
        <dl className="space-y-3">
          {[
            { label: "Nama Sertifikat", value: data.label, bold: true },
            { label: "Tanggal Terbit", value: formatDate(data.issuedAt) },
            { label: "Diterbitkan Oleh", value: data.issuer, mono: true },
            { label: "Hash Dokumen", value: hash, mono: true },
          ].map(({ label, value, bold, mono }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2.5 border-b border-slate-100 last:border-0">
              <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wide sm:w-40 shrink-0">{label}</dt>
              <dd className={`text-sm sm:text-right break-all ${
                bold ? "font-bold text-slate-800" :
                mono ? "font-mono text-xs text-slate-600" :
                "text-slate-700"
              }`}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h3 className="font-bold text-slate-800">Riwayat Status</h3>
            <span className="ml-auto text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{history.length}</span>
          </div>
          <ol className="relative border-l-2 border-slate-100 space-y-4 ml-3">
            {history.map((entry, i) => (
              <li key={i} className="ml-5 relative">
                <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300 shadow-sm" />
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StatusBadge status={entry.status} />
                  <span className="text-xs text-slate-400">{formatDate(entry.changedAt)}</span>
                </div>
                {entry.reason && (
                  <p className="text-sm text-slate-500 italic bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100 mt-1.5">
                    &ldquo;{entry.reason}&rdquo;
                  </p>
                )}
                <p className="text-xs text-slate-400 font-mono mt-1.5">oleh: {shortHash(entry.changedBy)}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Etherscan link */}
      <div className="flex justify-center">
        <a
          href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Lihat kontrak di Sepolia Etherscan
        </a>
      </div>
    </div>
  );
}

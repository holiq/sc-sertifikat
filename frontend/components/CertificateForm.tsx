"use client";

import { useState, useRef } from "react";
import { hashFile, isValidHash } from "@/lib/hash";
import QRCode from "qrcode";

interface IssuedCertificate {
  hash: string;
  label: string;
  qrDataUrl: string;
  txHash: string;
}

export default function CertificateForm() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<IssuedCertificate | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (f: File) => {
    setFile(f);
    setError("");
    setIssued(null);
    const computed = await hashFile(f);
    setHash(computed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await processFile(f);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await processFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIssued(null);

    if (!isValidHash(hash)) {
      setError("Hash tidak valid. Upload file PDF terlebih dahulu.");
      return;
    }
    if (!label.trim()) {
      setError("Nama sertifikat tidak boleh kosong.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash, label: label.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Terjadi kesalahan");

      const verifyUrl = `${window.location.origin}/verify?hash=${hash}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 256, margin: 2 });

      setIssued({ hash, label: label.trim(), qrDataUrl, txHash: json.txHash });
      setFile(null);
      setHash("");
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drop zone */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            File Sertifikat (PDF)
          </label>
          <label
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 group ${
              isDragging
                ? "border-indigo-400 bg-indigo-50 scale-[1.01]"
                : file
                ? "border-emerald-300 bg-emerald-50/60"
                : "border-slate-200 bg-slate-50/70 hover:bg-indigo-50/40 hover:border-indigo-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{file.name}</span>
                <span className="text-xs text-emerald-500">{(file.size / 1024).toFixed(1)} KB · Klik untuk ganti</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${isDragging ? "bg-indigo-100" : "bg-slate-100 group-hover:bg-indigo-100"}`}>
                  <svg className={`w-5 h-5 transition-colors duration-200 ${isDragging ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                </div>
                <span className={`text-sm font-medium transition-colors duration-200 ${isDragging ? "text-indigo-600" : "text-slate-500 group-hover:text-indigo-600"}`}>
                  {isDragging ? "Lepas file di sini" : "Klik atau drag & drop PDF"}
                </span>
                <span className="text-xs text-slate-400">Hanya .pdf yang diterima</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        {/* Auto hash */}
        {hash && (
          <div className="animate-fade-in">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Hash Dokumen (keccak256)
            </label>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-600 break-all select-all leading-relaxed">
              {hash}
            </div>
          </div>
        )}

        {/* Label */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Nama / Label Sertifikat
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Contoh: Sertifikat Kelulusan Informatika 2025"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 px-4 py-3 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-3 focus:ring-indigo-400/15 focus:bg-white transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="animate-fade-in flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 border border-red-200">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !hash || !label}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm shadow-indigo-500/25"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Memproses transaksi on-chain…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
              </svg>
              Terbitkan Sertifikat
            </span>
          )}
        </button>
      </form>

      {/* Success result */}
      {issued && (
        <div className="animate-fade-in rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-emerald-800">Sertifikat Berhasil Diterbitkan!</h3>
              <p className="text-xs text-emerald-600">Tersimpan permanen di blockchain Sepolia</p>
            </div>
          </div>

          <dl className="space-y-2.5 text-sm bg-white/60 rounded-xl p-4 border border-emerald-200/60">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Nama Sertifikat</dt>
              <dd className="font-semibold text-slate-800">{issued.label}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Hash Dokumen</dt>
              <dd className="font-mono text-xs text-slate-700 break-all">{issued.hash}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Transaction Hash</dt>
              <dd>
                <a
                  href={`https://sepolia.etherscan.io/tx/${issued.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline break-all transition-colors"
                >
                  {issued.txHash}
                </a>
              </dd>
            </div>
          </dl>

          <div className="flex flex-col items-center gap-3 pt-1">
            <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={issued.qrDataUrl} alt="QR Code verifikasi" className="w-36 h-36" />
            </div>
            <p className="text-xs font-medium text-emerald-700">QR Code Verifikasi</p>
            <a
              href={issued.qrDataUrl}
              download={`qr-${issued.hash.slice(0, 10)}.png`}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Download QR Code
            </a>
          </div>
        </div>
      )}
    </div>
  );
}


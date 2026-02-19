"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getCertificate, getHistory } from "@/lib/contract";
import { hashFile, isValidHash } from "@/lib/hash";
import VerifyResult from "@/components/VerifyResult";
import type { CertificateData, StatusHistoryEntry } from "@/lib/contract";

type VerifyState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "result"; hash: string; data: CertificateData; history: StatusHistoryEntry[] }
  | { phase: "error"; message: string };

function VerifyContent() {
  const searchParams = useSearchParams();
  const [inputHash, setInputHash] = useState("");
  const [state, setState] = useState<VerifyState>({ phase: "idle" });
  const [isDragging, setIsDragging] = useState(false);

  const verify = useCallback(async (hash: string) => {
    if (!isValidHash(hash)) {
      setState({ phase: "error", message: "Format hash tidak valid. Hash harus berupa 0x diikuti 64 karakter hex." });
      return;
    }
    setState({ phase: "loading" });
    try {
      const [data, history] = await Promise.all([
        getCertificate(hash as `0x${string}`),
        getHistory(hash as `0x${string}`),
      ]);
      setState({ phase: "result", hash, data, history });
    } catch {
      setState({ phase: "error", message: "Gagal membaca data dari blockchain. Periksa koneksi atau coba lagi." });
    }
  }, []);

  useEffect(() => {
    const hashFromUrl = searchParams.get("hash");
    if (hashFromUrl) {
      setInputHash(hashFromUrl);
      verify(hashFromUrl);
    }
  }, [searchParams, verify]);

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setState({ phase: "error", message: "Hanya file PDF yang diterima." });
      return;
    }
    setState({ phase: "loading" });
    try {
      const hash = await hashFile(file);
      setInputHash(hash);
      await verify(hash);
    } catch {
      setState({ phase: "error", message: "Gagal membaca file." });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify(inputHash.trim());
  };

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Hero section */}
      <div className="gradient-hero py-14 px-4 text-center relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-xl">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-white/90 text-xs font-medium mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Ethereum Sepolia Blockchain
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Verifikasi Keaslian Sertifikat
          </h1>
          <p className="text-indigo-100 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Upload file PDF sertifikat atau masukkan hash untuk membuktikan keaslian dokumen di blockchain secara instan.
          </p>
        </div>
      </div>

      {/* Card section */}
      <div className="px-4 pb-12">
        <div className="mx-auto max-w-lg -mt-6 relative z-10">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-indigo-500/5 p-6 space-y-5">
            {/* Upload drop zone */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Upload File PDF Sertifikat
              </label>
              <label
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 group ${
                  isDragging
                    ? "border-indigo-400 bg-indigo-50 scale-[1.01]"
                    : "border-slate-200 bg-slate-50/70 hover:bg-indigo-50/50 hover:border-indigo-300"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2.5 transition-all duration-200 ${isDragging ? "bg-indigo-100" : "bg-slate-100 group-hover:bg-indigo-100"}`}>
                  <svg className={`w-5 h-5 transition-colors duration-200 ${isDragging ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <span className={`text-sm font-medium transition-colors duration-200 ${isDragging ? "text-indigo-600" : "text-slate-500 group-hover:text-indigo-600"}`}>
                  {isDragging ? "Lepas file di sini" : "Klik atau drag & drop file PDF"}
                </span>
                <span className="text-slate-400 text-xs mt-1">Hanya .pdf yang diterima</span>
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <hr className="flex-1 border-slate-200" />
              <span className="text-xs font-semibold text-slate-400 tracking-wider">ATAU</span>
              <hr className="flex-1 border-slate-200" />
            </div>

            {/* Hash input */}
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Masukkan Hash Secara Manual
                </label>
                <input
                  type="text"
                  value={inputHash}
                  onChange={(e) => setInputHash(e.target.value)}
                  placeholder="0x1234...abcd (66 karakter)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 px-4 py-3 font-mono text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-3 focus:ring-indigo-400/15 focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={state.phase === "loading" || !inputHash}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm shadow-indigo-500/25"
              >
                {state.phase === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Memverifikasi…
                  </span>
                ) : "Verifikasi Sekarang"}
              </button>
            </form>
          </div>

          {/* Result area */}
          <div className="mt-5 space-y-4">
            {state.phase === "loading" && (
              <div className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 rounded-full gradient-hero mx-auto flex items-center justify-center animate-pulse">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <p className="text-slate-500 text-sm font-medium">Membaca data dari blockchain…</p>
                <p className="text-slate-400 text-xs">Harap tunggu sebentar</p>
              </div>
            )}

            {state.phase === "error" && (
              <div className="animate-fade-in rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Terjadi Kesalahan</p>
                  <p className="text-sm text-red-600 mt-0.5">{state.message}</p>
                </div>
              </div>
            )}

            {state.phase === "result" && (
              <div className="animate-fade-in">
                <VerifyResult hash={state.hash} data={state.data} history={state.history} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 rounded-full gradient-hero mx-auto animate-pulse"/>
            <p className="text-slate-400 text-sm">Memuat halaman…</p>
          </div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

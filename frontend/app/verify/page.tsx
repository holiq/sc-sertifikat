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

  // Auto-verify jika ada ?hash= di URL (dari QR code)
  useEffect(() => {
    const hashFromUrl = searchParams.get("hash");
    if (hashFromUrl) {
      setInputHash(hashFromUrl);
      verify(hashFromUrl);
    }
  }, [searchParams, verify]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ phase: "loading" });
    try {
      const hash = await hashFile(file);
      setInputHash(hash);
      await verify(hash);
    } catch {
      setState({ phase: "error", message: "Gagal membaca file." });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verify(inputHash.trim());
  };

  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="mx-auto max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">
            Verifikasi Sertifikat
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Upload file PDF sertifikat asli atau masukkan hash untuk
            memverifikasi keasliannya di blockchain Sepolia.
          </p>
        </div>

        {/* Input area */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-5">
          {/* Upload PDF */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Upload File PDF Sertifikat
            </label>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors">
              <span className="text-zinc-400 text-sm">Klik atau drag &amp; drop file PDF di sini</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-zinc-200" />
            <span className="text-xs text-zinc-400 font-medium">ATAU</span>
            <hr className="flex-1 border-zinc-200" />
          </div>

          {/* Input hash manual */}
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Masukkan Hash Secara Manual
              </label>
              <input
                type="text"
                value={inputHash}
                onChange={(e) => setInputHash(e.target.value)}
                placeholder="0x1234...abcd (66 karakter)"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={state.phase === "loading" || !inputHash}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 transition-colors"
            >
              {state.phase === "loading" ? "Memverifikasi..." : "Verifikasi"}
            </button>
          </form>
        </div>

        {/* Result */}
        {state.phase === "loading" && (
          <div className="text-center py-8 text-zinc-500 text-sm animate-pulse">
            Membaca data dari blockchain…
          </div>
        )}

        {state.phase === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.message}
          </div>
        )}

        {state.phase === "result" && (
          <VerifyResult
            hash={state.hash}
            data={state.data}
            history={state.history}
          />
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <p className="text-zinc-500 text-sm animate-pulse">Memuat halaman…</p>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

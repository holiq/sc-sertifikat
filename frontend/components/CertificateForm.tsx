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
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setIssued(null);
    const computed = await hashFile(f);
    setHash(computed);
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

      // Generate QR code
      const verifyUrl = `${window.location.origin}/verify?hash=${hash}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 256 });

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
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Upload PDF */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            File Sertifikat (PDF)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
          />
          {file && (
            <p className="mt-1 text-xs text-zinc-500">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Hash otomatis */}
        {hash && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Hash Dokumen (keccak256)
            </label>
            <div className="rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-600 break-all">
              {hash}
            </div>
          </div>
        )}

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Nama Sertifikat
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Contoh: Sertifikat Kelulusan Informatika 2025"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !hash || !label}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 transition-colors"
        >
          {loading ? "Memproses transaksi..." : "Terbitkan Sertifikat"}
        </button>
      </form>

      {/* Hasil issued */}
      {issued && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 text-xl">✓</span>
            <h3 className="font-semibold text-emerald-800">
              Sertifikat Berhasil Diterbitkan
            </h3>
          </div>

          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-emerald-700 font-medium">Nama</dt>
              <dd className="text-emerald-900">{issued.label}</dd>
            </div>
            <div>
              <dt className="text-emerald-700 font-medium">Hash</dt>
              <dd className="font-mono text-xs text-emerald-800 break-all">
                {issued.hash}
              </dd>
            </div>
            <div>
              <dt className="text-emerald-700 font-medium">Transaction Hash</dt>
              <dd>
                <a
                  href={`https://sepolia.etherscan.io/tx/${issued.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-600 hover:underline break-all"
                >
                  {issued.txHash}
                </a>
              </dd>
            </div>
          </dl>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-2 pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={issued.qrDataUrl}
              alt="QR Code verifikasi"
              className="w-40 h-40 rounded-lg border border-emerald-200"
            />
            <p className="text-xs text-emerald-700">QR Code Verifikasi</p>
            <a
              href={issued.qrDataUrl}
              download={`qr-${issued.hash.slice(0, 10)}.png`}
              className="text-xs text-blue-600 hover:underline"
            >
              Download QR Code
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

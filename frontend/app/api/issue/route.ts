import { NextRequest, NextResponse } from "next/server";
import { CONTRACT_ABI, CONTRACT_ADDRESS, getWalletClient, publicClient } from "@/lib/contract";
import { isValidHash } from "@/lib/hash";

/**
 * POST /api/issue
 * Body: { hash: "0x...", label: "string" }
 *
 * Menerbitkan sertifikat baru ke blockchain.
 * Private key diambil dari ADMIN_PRIVATE_KEY (server-side only).
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  console.log("[/api/issue] ===== REQUEST START =====");
  try {
    const body = await req.json();
    const { hash, label } = body as { hash?: string; label?: string };
    console.log("[/api/issue] body:", { hash, label });

    // Cek env vars
    console.log("[/api/issue] env check:", {
      CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "(not set)",
      ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY
        ? `set (${process.env.ADMIN_PRIVATE_KEY.length} chars)`
        : "(NOT SET)",
      RPC_URL: process.env.SEPOLIA_RPC_URL ?? "(not set, using default)",
    });

    // Validasi input
    if (!hash || !isValidHash(hash)) {
      console.warn("[/api/issue] validasi gagal: hash tidak valid", hash);
      return NextResponse.json({ error: "Hash tidak valid. Harus berupa hex 32-byte (0x...)" }, { status: 400 });
    }
    if (!label || label.trim().length === 0) {
      console.warn("[/api/issue] validasi gagal: label kosong");
      return NextResponse.json({ error: "Label sertifikat tidak boleh kosong" }, { status: 400 });
    }
    if (label.trim().length > 256) {
      console.warn("[/api/issue] validasi gagal: label terlalu panjang", label.trim().length);
      return NextResponse.json({ error: "Label terlalu panjang (maks 256 karakter)" }, { status: 400 });
    }

    // Cek duplikasi sebelum mengirim transaksi (hemat gas)
    console.log("[/api/issue] cek duplikasi di blockchain...");
    const existing = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getCertificate",
      args: [hash as `0x${string}`],
    })) as [boolean, string, bigint, `0x${string}`, number];
    console.log("[/api/issue] getCertificate result: exists =", existing[0]);

    if (existing[0]) {
      console.warn("[/api/issue] duplikasi: hash sudah terdaftar", hash);
      return NextResponse.json({ error: "Sertifikat dengan hash ini sudah terdaftar di blockchain" }, { status: 409 });
    }

    // Kirim transaksi menggunakan wallet admin
    console.log("[/api/issue] inisialisasi wallet client...");
    const walletClient = getWalletClient();
    console.log("[/api/issue] mengirim transaksi issueCertificate...");
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "issueCertificate",
      args: [hash as `0x${string}`, label.trim()],
    });
    console.log(`[/api/issue] transaksi terkirim: ${txHash} (${Date.now() - t0}ms)`);

    // Langsung return txHash tanpa menunggu konfirmasi block
    // (konfirmasi dilakukan oleh frontend via polling)
    return NextResponse.json({
      success: true,
      txHash,
      pending: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`[/api/issue] ERROR (${Date.now() - t0}ms):`, message);
    if (err instanceof Error && err.stack) console.error("[/api/issue] stack:", err.stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

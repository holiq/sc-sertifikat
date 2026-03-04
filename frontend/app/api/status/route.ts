import { NextRequest, NextResponse } from "next/server";
import { CONTRACT_ABI, CONTRACT_ADDRESS, getWalletClient, publicClient, CertStatus } from "@/lib/contract";
import { isValidHash } from "@/lib/hash";

/**
 * POST /api/status
 * Body: { hash: "0x...", status: 0|1|2, reason: "string" }
 *
 * Mengubah status sertifikat yang sudah ada:
 *   0 = Active
 *   1 = Revoked
 *   2 = Updated
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  console.log("[/api/status] ===== REQUEST START =====");
  try {
    const body = await req.json();
    const { hash, status, reason = "" } = body as { hash?: string; status?: number; reason?: string };
    console.log("[/api/status] body:", { hash, status, reason });

    // Cek env vars
    console.log("[/api/status] env check:", {
      CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "(not set)",
      ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY
        ? `set (${process.env.ADMIN_PRIVATE_KEY.length} chars)`
        : "(NOT SET)",
      RPC_URL: process.env.SEPOLIA_RPC_URL ?? "(not set, using default)",
    });

    // Validasi hash
    if (!hash || !isValidHash(hash)) {
      console.warn("[/api/status] validasi gagal: hash tidak valid", hash);
      return NextResponse.json({ error: "Hash tidak valid" }, { status: 400 });
    }

    // Validasi status
    if (status === undefined || ![0, 1, 2].includes(status)) {
      console.warn("[/api/status] validasi gagal: status tidak valid", status);
      return NextResponse.json(
        { error: "Status tidak valid. Gunakan 0 (Active), 1 (Revoked), atau 2 (Updated)" },
        { status: 400 },
      );
    }

    // Cek sertifikat exists
    console.log("[/api/status] cek sertifikat di blockchain...");
    const existing = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getCertificate",
      args: [hash as `0x${string}`],
    })) as [boolean, string, bigint, `0x${string}`, number];
    console.log("[/api/status] getCertificate result: exists =", existing[0], "currentStatus =", existing[4]);

    if (!existing[0]) {
      console.warn("[/api/status] sertifikat tidak ditemukan:", hash);
      return NextResponse.json({ error: "Sertifikat tidak ditemukan" }, { status: 404 });
    }

    // Cek status sudah sama
    if (existing[4] === status) {
      const statusLabel = ["Active", "Revoked", "Updated"][status];
      console.warn("[/api/status] status sudah sama:", statusLabel);
      return NextResponse.json({ error: `Status sertifikat sudah ${statusLabel}` }, { status: 409 });
    }

    // Kirim transaksi
    console.log("[/api/status] inisialisasi wallet client...");
    const walletClient = getWalletClient();
    console.log(`[/api/status] mengirim transaksi updateStatus: ${existing[4]} -> ${status}...`);
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "updateStatus",
      args: [hash as `0x${string}`, status as CertStatus, reason],
    });
    console.log(`[/api/status] transaksi terkirim: ${txHash} (${Date.now() - t0}ms)`);

    // Langsung return txHash tanpa menunggu konfirmasi block
    // (konfirmasi dilakukan oleh frontend via polling)
    return NextResponse.json({
      success: true,
      txHash,
      newStatus: status,
      pending: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`[/api/status] ERROR (${Date.now() - t0}ms):`, message);
    if (err instanceof Error && err.stack) console.error("[/api/status] stack:", err.stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

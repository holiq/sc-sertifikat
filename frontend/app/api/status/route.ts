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
  try {
    const body = await req.json();
    const { hash, status, reason = "" } = body as { hash?: string; status?: number; reason?: string };

    // Validasi hash
    if (!hash || !isValidHash(hash)) {
      return NextResponse.json({ error: "Hash tidak valid" }, { status: 400 });
    }

    // Validasi status
    if (status === undefined || ![0, 1, 2].includes(status)) {
      return NextResponse.json(
        { error: "Status tidak valid. Gunakan 0 (Active), 1 (Revoked), atau 2 (Updated)" },
        { status: 400 },
      );
    }

    // Cek sertifikat exists
    const existing = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getCertificate",
      args: [hash as `0x${string}`],
    })) as [boolean, string, bigint, `0x${string}`, number];

    if (!existing[0]) {
      return NextResponse.json({ error: "Sertifikat tidak ditemukan" }, { status: 404 });
    }

    // Cek status sudah sama
    if (existing[4] === status) {
      const statusLabel = ["Active", "Revoked", "Updated"][status];
      return NextResponse.json({ error: `Status sertifikat sudah ${statusLabel}` }, { status: 409 });
    }

    // Kirim transaksi
    const walletClient = getWalletClient();
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "updateStatus",
      args: [hash as `0x${string}`, status as CertStatus, reason],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaksi gagal di blockchain" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      txHash,
      newStatus: status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/status]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

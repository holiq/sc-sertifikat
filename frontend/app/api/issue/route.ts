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
  try {
    const body = await req.json();
    const { hash, label } = body as { hash?: string; label?: string };

    // Validasi input
    if (!hash || !isValidHash(hash)) {
      return NextResponse.json({ error: "Hash tidak valid. Harus berupa hex 32-byte (0x...)" }, { status: 400 });
    }
    if (!label || label.trim().length === 0) {
      return NextResponse.json({ error: "Label sertifikat tidak boleh kosong" }, { status: 400 });
    }
    if (label.trim().length > 256) {
      return NextResponse.json({ error: "Label terlalu panjang (maks 256 karakter)" }, { status: 400 });
    }

    // Cek duplikasi sebelum mengirim transaksi (hemat gas)
    const existing = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getCertificate",
      args: [hash as `0x${string}`],
    })) as [boolean, string, bigint, `0x${string}`, number];

    if (existing[0]) {
      return NextResponse.json({ error: "Sertifikat dengan hash ini sudah terdaftar di blockchain" }, { status: 409 });
    }

    // Kirim transaksi menggunakan wallet admin
    const walletClient = getWalletClient();
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "issueCertificate",
      args: [hash as `0x${string}`, label.trim()],
    });

    // Tunggu konfirmasi
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaksi gagal di blockchain" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/issue]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

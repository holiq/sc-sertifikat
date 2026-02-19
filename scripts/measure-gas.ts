/**
 * Script pengukuran gas fee untuk laporan akademik.
 *
 * Mengukur gas aktual dari setiap fungsi CertificateRegistry
 * menggunakan jaringan lokal Hardhat (EDR).
 *
 * Jalankan:
 *   npx hardhat run scripts/measure-gas.ts
 */

import hre from "hardhat";
import { keccak256, toBytes, formatEther, parseGwei } from "viem";

// Simulasi hash PDF
const HASH_A = keccak256(toBytes("sertifikat_a.pdf"));
const HASH_B = keccak256(toBytes("sertifikat_b.pdf"));
const LABEL = "Sertifikat Kelulusan Program Studi Informatika 2025";

const { viem } = await hre.network.connect();

async function measureGas(
  label: string,
  fn: () => Promise<`0x${string}`>,
  publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>,
) {
  const txHash = await fn();
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const gasUsed = receipt.gasUsed;
  return { label, gasUsed };
}

async function main() {
  const publicClient = await viem.getPublicClient();
  const registry = await viem.deployContract("CertificateRegistry");

  const results: { label: string; gasUsed: bigint }[] = [];

  // 1. issueCertificate — sertifikat pertama (dengan SSTORE awal, lebih mahal)
  results.push(
    await measureGas(
      "issueCertificate (sertifikat baru)",
      () => registry.write.issueCertificate([HASH_A, LABEL]),
      publicClient,
    ),
  );

  // 2. issueCertificate — sertifikat kedua (label lebih pendek)
  results.push(
    await measureGas(
      "issueCertificate (label pendek)",
      () => registry.write.issueCertificate([HASH_B, "Sertifikat Pelatihan"]),
      publicClient,
    ),
  );

  // 3. updateStatus — Active → Revoked (SSTORE pertama di slot history)
  results.push(
    await measureGas(
      "updateStatus (Active → Revoked)",
      () =>
        registry.write.updateStatus([
          HASH_A,
          1, // Revoked
          "Ditemukan pemalsuan dokumen",
        ]),
      publicClient,
    ),
  );

  // 4. updateStatus — Revoked → Active (history bertambah)
  results.push(
    await measureGas(
      "updateStatus (Revoked → Active)",
      () =>
        registry.write.updateStatus([
          HASH_A,
          0, // Active
          "Verifikasi ulang berhasil",
        ]),
      publicClient,
    ),
  );

  // 5. updateStatus — Active → Updated
  results.push(
    await measureGas(
      "updateStatus (Active → Updated)",
      () => registry.write.updateStatus([HASH_A, 2, "Diperbarui ke versi baru"]), // Updated
      publicClient,
    ),
  );

  // 6. View functions — estimasi dari eth_call (selalu 0 biaya off-chain)
  const viewFunctions = [
    "getCertificate (read data)",
    "isValid (quick check)",
    "getHistory (baca riwayat)",
    "getHistoryCount (baca jumlah)",
  ];

  // =====================================================================
  // Harga referensi gas saat ini (estimasi untuk laporan)
  // Gunakan harga ETH dan gas price yang relevan saat deployment
  // =====================================================================
  const ETH_PRICE_USD = 2500; // estimasi harga ETH dalam USD
  const GAS_PRICE_GWEI = 10n; // 10 gwei (typical Sepolia)
  const GAS_PRICE_WEI = GAS_PRICE_GWEI * 1_000_000_000n;

  function estimateCostUSD(gasUsed: bigint): string {
    const costWei = gasUsed * GAS_PRICE_WEI;
    const costEth = parseFloat(formatEther(costWei));
    const costUsd = costEth * ETH_PRICE_USD;
    return `$${costUsd.toFixed(4)}`;
  }

  // =====================================================================
  // Cetak hasil
  // =====================================================================
  console.log("\n" + "=".repeat(75));
  console.log("  GAS REPORT — CertificateRegistry.sol");
  console.log(`  Asumsi: Gas price = ${GAS_PRICE_GWEI} gwei | ETH price = $${ETH_PRICE_USD}`);
  console.log("=".repeat(75));
  console.log(`  ${"Fungsi".padEnd(40)} ${"Gas Used".padStart(12)} ${"Est. Biaya".padStart(14)}`);
  console.log("-".repeat(75));

  // Write functions
  for (const r of results) {
    console.log(
      `  ${r.label.padEnd(40)} ${r.gasUsed.toString().padStart(12)} ${estimateCostUSD(r.gasUsed).padStart(14)}`,
    );
  }

  // View functions
  for (const name of viewFunctions) {
    console.log(`  ${name.padEnd(40)} ${"0 (view)".padStart(12)} ${"$0.0000".padStart(14)}`);
  }

  console.log("=".repeat(75));
  console.log("  * View functions selalu gratis saat dipanggil off-chain.");
  console.log("  * Gas bisa berbeda di Sepolia tergantung basefee dan kondisi jaringan.");
  console.log("  * Salin tabel ini ke laporan BAB 5 — Hasil & Analisis.\n");

  // Summary
  const maxGas = results.reduce((max, r) => (r.gasUsed > max ? r.gasUsed : max), 0n);
  const minGas = results.reduce((min, r) => (r.gasUsed < min ? r.gasUsed : min), BigInt(Number.MAX_SAFE_INTEGER));
  console.log(`  Gas tertinggi : ${maxGas.toLocaleString()} gas`);
  console.log(`  Gas terendah  : ${minGas.toLocaleString()} gas`);
  console.log("=".repeat(75) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

/**
 * Script demo: menerbitkan satu sertifikat ke jaringan Sepolia.
 *
 * Cara pakai:
 *   npx hardhat run scripts/issue-certificate.ts --network sepolia
 *
 * Pastikan .env sudah diisi dengan SEPOLIA_RPC_URL dan SEPOLIA_PRIVATE_KEY.
 * Contract harus sudah deploy — isi CONTRACT_ADDRESS di bawah.
 */

import hre from "hardhat";
import { keccak256, toBytes } from "viem";

// ============================================================================
// KONFIGURASI — isi setelah deploy
// ============================================================================
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS as `0x${string}`) ?? "0xYOUR_CONTRACT_ADDRESS";

const { viem, networkName } = await hre.network.connect();

// Simulasi hash dari file PDF (di produksi, hash dihitung dari bytes file asli)
const DEMO_PDF_CONTENT = "demo_sertifikat_informatika_2025_user001.pdf";
const CERTIFICATE_HASH = keccak256(toBytes(DEMO_PDF_CONTENT));
const CERTIFICATE_LABEL =
  "Sertifikat Kelulusan Program Studi Informatika — Angkatan 2025";

// ============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("  CertificateRegistry — Demo Issuance Script");
  console.log("=".repeat(60));
  console.log(`  Network  : ${networkName}`);
  console.log(`  Contract : ${CONTRACT_ADDRESS}`);
  console.log(`  Hash     : ${CERTIFICATE_HASH}`);
  console.log(`  Label    : ${CERTIFICATE_LABEL}`);
  console.log("=".repeat(60));

  if (CONTRACT_ADDRESS === "0xYOUR_CONTRACT_ADDRESS") {
    throw new Error(
      "Isi CONTRACT_ADDRESS dengan alamat contract yang sudah dideploy!"
    );
  }

  // Ambil wallet client dari private key di .env
  const [walletClient] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log(`\n  Wallet   : ${walletClient.account.address}`);

  // Baca contract
  const registry = await viem.getContractAt(
    "CertificateRegistry",
    CONTRACT_ADDRESS
  );

  // Cek apakah sudah ada
  const [exists] = await registry.read.getCertificate([CERTIFICATE_HASH]);
  if (exists) {
    console.log("\n  ⚠ Sertifikat dengan hash ini sudah ada di blockchain.");
    const [, label, issuedAt, issuer, status] =
      await registry.read.getCertificate([CERTIFICATE_HASH]);
    console.log(`     Label    : ${label}`);
    console.log(
      `     IssuedAt : ${new Date(Number(issuedAt) * 1000).toISOString()}`
    );
    console.log(`     Issuer   : ${issuer}`);
    console.log(`     Status   : ${["Active", "Revoked", "Updated"][status]}`);
    return;
  }

  // Terbitkan sertifikat
  console.log("\n  Mengirim transaksi issueCertificate...");
  const txHash = await registry.write.issueCertificate([
    CERTIFICATE_HASH,
    CERTIFICATE_LABEL,
  ]);

  console.log(`  Tx Hash  : ${txHash}`);
  console.log("  Menunggu konfirmasi...");

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  console.log(`  Status   : ${receipt.status}`);
  console.log(`  Block    : ${receipt.blockNumber}`);
  console.log(`  Gas Used : ${receipt.gasUsed.toLocaleString()} gas`);

  // Verifikasi hasil
  const [, label, issuedAt, issuer] = await registry.read.getCertificate([
    CERTIFICATE_HASH,
  ]);
  const isValid = await registry.read.isValid([CERTIFICATE_HASH]);

  console.log("\n" + "=".repeat(60));
  console.log("  ✅ Sertifikat berhasil diterbitkan!");
  console.log("=".repeat(60));
  console.log(`  Label    : ${label}`);
  console.log(
    `  IssuedAt : ${new Date(Number(issuedAt) * 1000).toISOString()}`
  );
  console.log(`  Issuer   : ${issuer}`);
  console.log(`  Valid    : ${isValid}`);
  console.log(
    `\n  Etherscan: https://sepolia.etherscan.io/tx/${txHash}`
  );
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

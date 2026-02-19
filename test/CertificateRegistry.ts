import hre from "hardhat";
import { assert } from "chai";
import { keccak256, toBytes, zeroHash } from "viem";
import { describe, it, beforeEach } from "node:test";

/**
 * Unit test untuk CertificateRegistry smart contract.
 *
 * Jalankan:
 *   npx hardhat test
 *   REPORT_GAS=true npx hardhat test   ← untuk laporan gas fee
 */
describe("CertificateRegistry", async function () {
  // ==========================================================================
  // Helpers
  // ==========================================================================

  /** Hash dummy yang mewakili "file PDF" */
  const HASH_A = keccak256(toBytes("sertifikat_a.pdf_content"));
  const HASH_B = keccak256(toBytes("sertifikat_b.pdf_content"));
  const LABEL_A = "Sertifikat Kelulusan Program Studi Informatika 2025";
  const LABEL_B = "Sertifikat Peserta Seminar Nasional Blockchain 2025";


  const { viem } = await hre.network.connect();

  type CertificateRegistry = Awaited<
    ReturnType<typeof viem.deployContract<"CertificateRegistry">>
  >;

  let registry: CertificateRegistry;
  let ownerAddress: `0x${string}`;
  let nonOwnerAddress: `0x${string}`;

  beforeEach(async function () {
    // Deploy fresh contract sebelum setiap test
    registry = await viem.deployContract("CertificateRegistry");

    const [owner, nonOwner] = await viem.getWalletClients();
    ownerAddress = owner.account.address;
    nonOwnerAddress = nonOwner.account.address;
  });

  // ==========================================================================
  // Deployment
  // ==========================================================================

  describe("Deployment", function () {
    it("harus deploy dengan owner yang benar", async function () {
      const contractOwner = await registry.read.owner();
      assert.equal(
        contractOwner.toLowerCase(),
        ownerAddress.toLowerCase(),
        "Owner tidak sesuai"
      );
    });
  });

  // ==========================================================================
  // issueCertificate
  // ==========================================================================

  describe("issueCertificate()", function () {
    it("berhasil menerbitkan sertifikat dan menyimpan data dengan benar", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);

      const [exists, label, issuedAt, issuer, status] =
        await registry.read.getCertificate([HASH_A]);

      assert.isTrue(exists, "exists harus true");
      assert.equal(label, LABEL_A, "label tidak sesuai");
      assert.isAbove(Number(issuedAt), 0, "issuedAt harus diisi");
      assert.equal(
        issuer.toLowerCase(),
        ownerAddress.toLowerCase(),
        "issuer harus owner"
      );
      assert.equal(Number(status), 0, "status awal harus Active (0)");
    });

    it("berhasil emit event CertificateIssued", async function () {
      const publicClient = await viem.getPublicClient();
      const hash = await registry.write.issueCertificate([HASH_A, LABEL_A]);
      const receipt = await publicClient.getTransactionReceipt({ hash });

      assert.equal(receipt.status, "success", "transaksi harus sukses");
      assert.isAbove(receipt.logs.length, 0, "harus ada event log");
    });

    it("revert jika hash adalah zero bytes32", async function () {
      try {
        await registry.write.issueCertificate([zeroHash, LABEL_A]);
        assert.fail("Seharusnya revert");
      } catch (err: unknown) {
        assert.include(
          (err as Error).message,
          "InvalidHash",
          "Error harus InvalidHash"
        );
      }
    });

    it("revert jika label kosong", async function () {
      try {
        await registry.write.issueCertificate([HASH_A, ""]);
        assert.fail("Seharusnya revert");
      } catch (err: unknown) {
        assert.include(
          (err as Error).message,
          "LabelCannotBeEmpty",
          "Error harus LabelCannotBeEmpty"
        );
      }
    });

    it("revert jika hash yang sama diterbitkan dua kali (anti-duplikasi)", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);

      try {
        await registry.write.issueCertificate([HASH_A, "Label Lain"]);
        assert.fail("Seharusnya revert");
      } catch (err: unknown) {
        assert.include(
          (err as Error).message,
          "CertificateAlreadyExists",
          "Error harus CertificateAlreadyExists"
        );
      }
    });

    it("revert jika dipanggil oleh non-owner", async function () {
      const [, nonOwner] = await viem.getWalletClients();
      const registryAsNonOwner = await viem.getContractAt(
        "CertificateRegistry",
        registry.address,
        { client: { wallet: nonOwner } }
      );

      try {
        await registryAsNonOwner.write.issueCertificate([HASH_A, LABEL_A]);
        assert.fail("Seharusnya revert");
      } catch (err: unknown) {
        assert.include(
          (err as Error).message,
          "OwnableUnauthorizedAccount",
          "Error harus OwnableUnauthorizedAccount"
        );
      }
    });

    it("bisa menerbitkan dua sertifikat berbeda tanpa konflik", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
      await registry.write.issueCertificate([HASH_B, LABEL_B]);

      const [existsA] = await registry.read.getCertificate([HASH_A]);
      const [existsB] = await registry.read.getCertificate([HASH_B]);

      assert.isTrue(existsA, "sertifikat A harus ada");
      assert.isTrue(existsB, "sertifikat B harus ada");
    });
  });

  // ==========================================================================
  // getCertificate
  // ==========================================================================

  describe("getCertificate()", function () {
    it("mengembalikan exists=false untuk hash yang belum terdaftar", async function () {
      const [exists] = await registry.read.getCertificate([HASH_A]);
      assert.isFalse(exists, "exists harus false untuk hash tidak dikenal");
    });

    it("mengembalikan data lengkap setelah sertifikat diterbitkan", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);

      const [exists, label, issuedAt, issuer, status] =
        await registry.read.getCertificate([HASH_A]);

      assert.isTrue(exists);
      assert.equal(label, LABEL_A);
      assert.isAbove(Number(issuedAt), 0);
      assert.equal(issuer.toLowerCase(), ownerAddress.toLowerCase());
      assert.equal(Number(status), 0); // Active
    });
  });

  // ==========================================================================
  // isValid
  // ==========================================================================

  describe("isValid()", function () {
    it("mengembalikan false untuk hash yang tidak terdaftar", async function () {
      const valid = await registry.read.isValid([HASH_A]);
      assert.isFalse(valid);
    });

    it("mengembalikan true untuk sertifikat Active", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
      const valid = await registry.read.isValid([HASH_A]);
      assert.isTrue(valid);
    });

    it("mengembalikan false untuk sertifikat Revoked", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
      await registry.write.updateStatus([HASH_A, 1, "Sertifikat palsu ditemukan"]); // 1 = Revoked

      const valid = await registry.read.isValid([HASH_A]);
      assert.isFalse(valid);
    });

    it("mengembalikan false untuk sertifikat Updated", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
      await registry.write.updateStatus([HASH_A, 2, "Diperbarui ke versi baru"]); // 2 = Updated

      const valid = await registry.read.isValid([HASH_A]);
      assert.isFalse(valid);
    });
  });

  // ==========================================================================
  // updateStatus
  // ==========================================================================

  describe("updateStatus()", function () {
    beforeEach(async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
    });

    it("berhasil mengubah status ke Revoked", async function () {
      await registry.write.updateStatus([HASH_A, 1, "Ditemukan pemalsuan"]);

      const [, , , , status] = await registry.read.getCertificate([HASH_A]);
      assert.equal(Number(status), 1, "status harus Revoked (1)");
    });

    it("berhasil mengubah status ke Updated", async function () {
      await registry.write.updateStatus([HASH_A, 2, "Diperbarui"]);

      const [, , , , status] = await registry.read.getCertificate([HASH_A]);
      assert.equal(Number(status), 2, "status harus Updated (2)");
    });

    it("menyimpan satu entri history setelah satu kali update", async function () {
      await registry.write.updateStatus([HASH_A, 1, "Revoked pertama kali"]);

      const count = await registry.read.getHistoryCount([HASH_A]);
      assert.equal(Number(count), 1, "history harus berisi 1 entri");
    });

    it("history bertambah setiap kali status diubah", async function () {
      await registry.write.updateStatus([HASH_A, 1, "Revoked"]);
      await registry.write.updateStatus([HASH_A, 0, "Diaktifkan kembali"]);
      await registry.write.updateStatus([HASH_A, 2, "Updated"]);

      const count = await registry.read.getHistoryCount([HASH_A]);
      assert.equal(Number(count), 3, "history harus berisi 3 entri");
    });

    it("revert jika status tidak berubah (StatusUnchanged)", async function () {
      try {
        // Status awal sudah Active (0), update ke Active lagi
        await registry.write.updateStatus([HASH_A, 0, "Tidak ada perubahan"]);
        assert.fail("Seharusnya revert");
      } catch (err: unknown) {
        assert.include(
          (err as Error).message,
          "StatusUnchanged",
          "Error harus StatusUnchanged"
        );
      }
    });

    it("revert jika hash tidak terdaftar (CertificateNotFound)", async function () {
      try {
        await registry.write.updateStatus([HASH_B, 1, "Mencoba hash lain"]);
        assert.fail("Seharusnya revert");
      } catch (err: unknown) {
        assert.include(
          (err as Error).message,
          "CertificateNotFound",
          "Error harus CertificateNotFound"
        );
      }
    });

    it("revert jika dipanggil oleh non-owner", async function () {
      const [, nonOwner] = await viem.getWalletClients();
      const registryAsNonOwner = await viem.getContractAt(
        "CertificateRegistry",
        registry.address,
        { client: { wallet: nonOwner } }
      );

      try {
        await registryAsNonOwner.write.updateStatus([
          HASH_A,
          1,
          "Unauthorized",
        ]);
        assert.fail("Seharusnya revert");
      } catch (err: unknown) {
        assert.include(
          (err as Error).message,
          "OwnableUnauthorizedAccount",
          "Error harus OwnableUnauthorizedAccount"
        );
      }
    });

    it("emit event StatusUpdated dengan data yang benar", async function () {
      const publicClient = await viem.getPublicClient();
      const txHash = await registry.write.updateStatus([
        HASH_A,
        1,
        "Dicabut karena kesalahan data",
      ]);
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash,
      });

      assert.equal(receipt.status, "success", "transaksi harus sukses");
      assert.isAbove(receipt.logs.length, 0, "harus ada event log");
    });
  });

  // ==========================================================================
  // getHistory
  // ==========================================================================

  describe("getHistory()", function () {
    it("mengembalikan array kosong untuk sertifikat baru (belum ada update)", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);

      const history = await registry.read.getHistory([HASH_A]);
      assert.equal(history.length, 0, "history awal harus kosong");
    });

    it("mengembalikan history kosong untuk hash tidak dikenal", async function () {
      const history = await registry.read.getHistory([HASH_A]);
      assert.equal(history.length, 0, "history hash tidak dikenal harus kosong");
    });

    it("mengembalikan data history yang benar setelah update status", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
      await registry.write.updateStatus([HASH_A, 1, "Sertifikat dicabut"]);

      const history = await registry.read.getHistory([HASH_A]);
      assert.equal(history.length, 1);
      assert.equal(Number(history[0].status), 1, "status di history harus Revoked");
      assert.equal(history[0].reason, "Sertifikat dicabut");
      assert.equal(
        history[0].changedBy.toLowerCase(),
        ownerAddress.toLowerCase(),
        "changedBy harus owner"
      );
      assert.isAbove(Number(history[0].changedAt), 0);
    });

    it("urutan history sesuai urutan waktu perubahan", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
      await registry.write.updateStatus([HASH_A, 1, "Pertama: Revoked"]);
      await registry.write.updateStatus([HASH_A, 0, "Kedua: Active"]);
      await registry.write.updateStatus([HASH_A, 2, "Ketiga: Updated"]);

      const history = await registry.read.getHistory([HASH_A]);
      assert.equal(history.length, 3);
      assert.equal(Number(history[0].status), 1); // Revoked
      assert.equal(Number(history[1].status), 0); // Active
      assert.equal(Number(history[2].status), 2); // Updated
    });
  });

  // ==========================================================================
  // getHistoryCount
  // ==========================================================================

  describe("getHistoryCount()", function () {
    it("mengembalikan 0 untuk sertifikat baru", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);
      const count = await registry.read.getHistoryCount([HASH_A]);
      assert.equal(Number(count), 0);
    });

    it("bertambah setiap update status", async function () {
      await registry.write.issueCertificate([HASH_A, LABEL_A]);

      await registry.write.updateStatus([HASH_A, 1, ""]);
      assert.equal(Number(await registry.read.getHistoryCount([HASH_A])), 1);

      await registry.write.updateStatus([HASH_A, 0, ""]);
      assert.equal(Number(await registry.read.getHistoryCount([HASH_A])), 2);
    });
  });
});

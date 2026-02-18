# Sistem Sertifikat Akademik Digital — Implementation Plan

> **Mata Kuliah:** Blockchain Technology  
> **Stack:** Hardhat v3 (Viem) · Solidity 0.8.28 · Next.js 16 (App Router) · Tailwind CSS v4 · Sepolia Testnet  
> **Pendekatan:** Hash-only / Proof of Existence — hanya hash `keccak256` yang disimpan di blockchain, bukan file PDF.

---

## Daftar Isi

1. [Arsitektur Sistem](#1-arsitektur-sistem)
2. [Struktur Folder](#2-struktur-folder)
3. [Phase 1 — Smart Contract](#3-phase-1--smart-contract)
4. [Phase 2 — Deployment & Konfigurasi](#4-phase-2--deployment--konfigurasi)
5. [Phase 3 — Frontend (Next.js)](#5-phase-3--frontend-nextjs)
6. [Phase 4 — Pengujian](#6-phase-4--pengujian)
7. [Phase 5 — Laporan Akhir](#7-phase-5--laporan-akhir)
8. [Referensi & Tools](#8-referensi--tools)

---

## 1. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                        USER FLOW                            │
│                                                             │
│  Admin                                                      │
│   └─► Backend Wallet (custodial)                            │
│         └─► Smart Contract (Sepolia)                        │
│               └─► Simpan hash on-chain                      │
│                                                             │
│  Mahasiswa / Publik                                         │
│   └─► QR Code pada sertifikat PDF                           │
│         └─► Halaman Verifikasi (Next.js)                    │
│               └─► Read-only call ke smart contract          │
│                     └─► Tampilkan status & metadata         │
└─────────────────────────────────────────────────────────────┘
```

### Komponen Utama

| Komponen           | Teknologi                   | Fungsi                             |
| ------------------ | --------------------------- | ---------------------------------- |
| Smart Contract     | Solidity 0.8.28 + Hardhat   | Menyimpan hash & status sertifikat |
| Blockchain Network | Ethereum Sepolia Testnet    | Jaringan eksekusi                  |
| Frontend           | Next.js 16 App Router       | UI admin & verifikasi publik       |
| Styling            | Tailwind CSS v4             | Tampilan antarmuka                 |
| Blockchain Client  | viem v2                     | Interaksi read/write ke contract   |
| QR Code            | `qrcode` (npm)              | Generate QR dari hash              |
| PDF Hash           | `crypto` (Node.js built-in) | Hitung keccak256 dari file PDF     |

### Prinsip Desain

- **Immutable** — data yang sudah tersimpan tidak bisa dihapus
- **Anti-duplicate** — satu hash hanya bisa disimpan sekali
- **Admin-controlled** — hanya wallet admin yang bisa menerbitkan
- **Public verifiable** — siapapun bisa verifikasi tanpa butuh wallet
- **Gas-efficient** — verifikasi adalah view function (0 gas)

---

## 2. Struktur Folder

```
sc-sertifikat/
├── .github/
│   └── IMPLEMENTATION_PLAN.md       ← file ini
├── contracts/
│   ├── Counter.sol                  ← (hapus / abaikan, template awal)
│   └── CertificateRegistry.sol      ← [BUAT] smart contract utama
├── ignition/
│   └── modules/
│       └── CertificateRegistry.ts   ← [BUAT] deployment module
├── test/
│   └── CertificateRegistry.ts       ← [BUAT] unit test
├── scripts/
│   └── issue-certificate.ts         ← [BUAT] script demo issuance
├── frontend/                        ← Next.js App
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 ← redirect ke /verify
│   │   ├── admin/
│   │   │   └── page.tsx             ← [BUAT] halaman admin (issue + revoke)
│   │   └── verify/
│   │       └── page.tsx             ← [BUAT] halaman verifikasi publik
│   ├── components/
│   │   ├── CertificateForm.tsx      ← [BUAT] form penerbitan sertifikat
│   │   ├── VerifyResult.tsx         ← [BUAT] tampilan hasil verifikasi
│   │   └── StatusBadge.tsx          ← [BUAT] badge Active/Revoked/Updated
│   ├── lib/
│   │   ├── contract.ts              ← [BUAT] ABI + contract address + viem client
│   │   └── hash.ts                  ← [BUAT] utility keccak256 hashing
│   └── public/
│       └── contract-abi.json        ← [BUAT] ABI hasil compile
├── hardhat.config.ts
├── package.json
└── .env                             ← SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY
```

---

## 3. Phase 1 — Smart Contract

### 3.1 Desain Data

```solidity
// contracts/CertificateRegistry.sol

enum Status { Active, Revoked, Updated }

struct Certificate {
    bool exists;
    string label;       // misal: "Sertifikat Peserta Seminar Nasional 2025"
    uint256 issuedAt;   // block.timestamp saat penerbitan
    address issuer;     // wallet admin yang menerbitkan
    Status status;      // status saat ini
}

struct StatusHistory {
    Status status;
    uint256 changedAt;
    address changedBy;
    string reason;      // opsional: alasan perubahan status
}
```

### 3.2 Storage

```solidity
mapping(bytes32 => Certificate) private certificates;
mapping(bytes32 => StatusHistory[]) private statusHistories;
```

- Key mapping adalah `bytes32 hash` — hasil `keccak256` dari isi sertifikat
- `private` agar tidak langsung diakses, tapi exposed via getter function

### 3.3 Events (wajib untuk indexing)

```solidity
event CertificateIssued(bytes32 indexed hash, string label, address indexed issuer, uint256 issuedAt);
event StatusUpdated(bytes32 indexed hash, Status newStatus, address indexed updatedBy, string reason);
```

### 3.4 Functions

| Fungsi                                                        | Modifier    | Deskripsi                          |
| ------------------------------------------------------------- | ----------- | ---------------------------------- |
| `issueCertificate(bytes32 hash, string label)`                | `onlyOwner` | Menerbitkan sertifikat baru        |
| `updateStatus(bytes32 hash, Status newStatus, string reason)` | `onlyOwner` | Update status + simpan history     |
| `getCertificate(bytes32 hash)`                                | `view`      | Ambil data sertifikat (0 gas)      |
| `getHistory(bytes32 hash)`                                    | `view`      | Ambil semua riwayat status (0 gas) |
| `isValid(bytes32 hash)`                                       | `view`      | Return true jika exists & Active   |

### 3.5 Definisi Hash Input

> **Kritis:** hash harus dihitung secara konsisten di semua tempat.

**Pilihan yang direkomendasikan — hash dari file PDF binary:**

```typescript
// Di frontend/backend (Node.js)
import { createHash } from "crypto";
import { keccak256, toBytes } from "viem";

// Baca file PDF lalu hash
const fileBuffer = fs.readFileSync("sertifikat.pdf");
const hash = keccak256(fileBuffer); // output: 0x...
```

Dengan pendekatan ini:

- Mahasiswa dapat memverifikasi dengan mengupload PDF asli mereka
- Hash dari file yang dimodifikasi akan berbeda → deteksi pemalsuan

### 3.6 Anti-Duplicate Guard

```solidity
function issueCertificate(bytes32 hash, string calldata label) external onlyOwner {
    require(!certificates[hash].exists, "Certificate already exists");
    // ...
}
```

### 3.7 File yang Perlu Dibuat

- [ ] `contracts/CertificateRegistry.sol` — smart contract lengkap ✅
- [ ] `ignition/modules/CertificateRegistry.ts` — deployment via Hardhat Ignition ✅
- [ ] `test/CertificateRegistry.ts` — 28 unit test, semua passing ✅

---

## 4. Phase 2 — Deployment & Konfigurasi

### 4.1 Environment Variables

Buat file `.env` di root project:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
SEPOLIA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

> **Catatan keamanan:** Gunakan wallet khusus untuk development. Jangan pernah commit `.env` ke git. File `.env` sudah ada di `.gitignore` Hardhat secara default.

RPC gratis yang bisa digunakan:

- [Infura](https://infura.io) — daftar gratis, limit 100k req/hari
- [Alchemy](https://alchemy.com) — daftar gratis, lebih stabil
- [Sepolia public RPC](https://rpc.sepolia.org) — tanpa daftar, kadang lambat

### 4.2 Mendapatkan Sepolia ETH (untuk gas)

- [Alchemy Sepolia Faucet](https://sepoliafaucet.com)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
- Butuh minimal ±0.1 SepoliaETH untuk deploy + beberapa transaksi

### 4.3 Compile

```bash
npx hardhat compile
```

Output ABI akan ada di `artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json`.

Salin ABI ke frontend:

```bash
cp artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json \
   frontend/public/contract-abi.json
```

### 4.4 Deploy ke Sepolia

```bash
npx hardhat ignition deploy ignition/modules/CertificateRegistry.ts \
  --network sepolia
```

Setelah deploy, **catat contract address** yang muncul di terminal, lalu simpan ke:

```env
# .env frontend
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

### 4.5 Verifikasi Contract di Etherscan (opsional, nilai tambah)

```bash
npx hardhat verify --network sepolia 0xYOUR_CONTRACT_ADDRESS
```

Ini membuat source code contract terlihat publik di Sepolia Etherscan — poin plus untuk laporan.

---

## 5. Phase 3 — Frontend (Next.js)

### 5.1 Tambah Dependencies

```bash
cd frontend
npm install viem qrcode
npm install -D @types/qrcode
```

### 5.2 Struktur Halaman

#### Halaman 1: `/verify` — Verifikasi Publik

**Fitur:**

- Input: upload file PDF atau paste hash manual (0x...)
- Proses: hitung keccak256 dari file, query smart contract
- Output: status sertifikat (Active / Revoked / Updated), label, tanggal terbit, issuer address, dan history perubahan status

**Flow:**

```
User upload PDF
  → browser hitung keccak256 (di client, tidak perlu server)
  → call getCertificate(hash) via viem publicClient (read-only)
  → tampilkan hasil
```

#### Halaman 2: `/admin` — Panel Admin

**Fitur:**

- Form upload PDF → otomatis hitung hash → isi label → submit transaksi `issueCertificate`
- Tabel daftar sertifikat yang sudah diterbitkan (dari events)
- Tombol Revoke / Update status per sertifikat
- Generate & download QR Code dari hash

**Catatan:** Karena menggunakan custodial model (backend wallet), transaksi write dikirim dari server menggunakan private key yang disimpan di environment variable server, bukan dari wallet browser user.

### 5.3 Setup viem Client

```typescript
// frontend/lib/contract.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Read-only client (digunakan di frontend/publik)
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

// Write client (HANYA digunakan di server-side / API route)
// Private key TIDAK boleh ada di NEXT_PUBLIC_
export const getWalletClient = () => {
  const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as `0x${string}`);
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });
};
```

### 5.4 API Routes (Next.js)

Buat server-side API route untuk write operations:

```
frontend/app/api/
├── issue/route.ts      ← POST: terbitkan sertifikat
└── status/route.ts     ← POST: update status sertifikat
```

Ini penting karena `ADMIN_PRIVATE_KEY` hanya boleh ada di server, tidak boleh di-expose ke browser.

### 5.5 Hash Utility

```typescript
// frontend/lib/hash.ts
import { keccak256 } from "viem";

export async function hashFile(file: File): Promise<`0x${string}`> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  return keccak256(bytes);
}

export function hashFromHex(hex: string): `0x${string}` {
  return hex as `0x${string}`;
}
```

### 5.6 QR Code

QR code di-generate berisi URL verifikasi dengan hash sebagai query parameter:

```
https://your-domain.com/verify?hash=0xabc123...
```

```typescript
import QRCode from "qrcode";

const url = `${process.env.NEXT_PUBLIC_BASE_URL}/verify?hash=${hash}`;
const qrDataUrl = await QRCode.toDataURL(url);
// render sebagai <img src={qrDataUrl} />
```

---

## 6. Phase 4 — Pengujian

### 6.1 Unit Test Smart Contract

File: `test/CertificateRegistry.ts`

Test case yang wajib ada:

| Test Case                       | Yang Diuji                               |
| ------------------------------- | ---------------------------------------- |
| `issueCertificate` berhasil     | Hash tersimpan, event ter-emit           |
| `issueCertificate` duplikat     | Revert dengan pesan "already exists"     |
| `issueCertificate` by non-owner | Revert dengan OwnableUnauthorizedAccount |
| `getCertificate` hash valid     | Return data yang benar                   |
| `getCertificate` hash tidak ada | Return exists = false                    |
| `updateStatus` ke Revoked       | Status berubah, history bertambah        |
| `getHistory`                    | Return array history yang benar          |
| `isValid` Active                | Return true                              |
| `isValid` Revoked               | Return false                             |

```bash
# Jalankan semua test
npx hardhat test

# Dengan gas report
REPORT_GAS=true npx hardhat test
```

### 6.2 Pengujian Gas Fee (Wajib untuk Laporan)

Catat hasil dari `REPORT_GAS=true npx hardhat test`:

| Fungsi             | Gas Used | Estimasi Biaya (USD) |
| ------------------ | -------- | -------------------- |
| `issueCertificate` | ~xxx gas | ~$x.xx               |
| `updateStatus`     | ~xxx gas | ~$x.xx               |
| `getCertificate`   | 0 (view) | $0.00                |
| `isValid`          | 0 (view) | $0.00                |

> Data diambil dari jaringan lokal Hardhat (EDR). Gas di Sepolia mainnet bisa sedikit berbeda tergantung basefee saat transaksi.

**Hasil aktual (lokal, `REPORT_GAS=true npx hardhat test`):**

| Fungsi             | Gas Used          | Keterangan             |
| ------------------ | ----------------- | ---------------------- |
| `issueCertificate` | ~diukur saat test | Write — butuh gas      |
| `updateStatus`     | ~diukur saat test | Write — butuh gas      |
| `getCertificate`   | 0                 | View function — gratis |
| `isValid`          | 0                 | View function — gratis |
| `getHistory`       | 0                 | View function — gratis |
| `getHistoryCount`  | 0                 | View function — gratis |

> Jalankan `REPORT_GAS=true npx hardhat test` untuk melihat angka gas aktual. Masukkan ke tabel laporan BAB 5.

### 6.3 Uji Keamanan Dasar

| Vektor Serangan           | Mekanisme Perlindungan                     | Status                 |
| ------------------------- | ------------------------------------------ | ---------------------- |
| Penerbitan oleh non-admin | `onlyOwner` modifier                       | Dilindungi             |
| Hash duplikat             | `require(!exists)` guard                   | Dilindungi             |
| Penghapusan data          | Tidak ada fungsi delete                    | Tidak applicable       |
| Modifikasi retroaktif     | Sifat immutable blockchain                 | Dilindungi             |
| Private key exposure      | Disimpan di env server, bukan NEXT*PUBLIC* | Dilindungi (by design) |
| Pemalsuan PDF             | Hash akan berbeda                          | Terdeteksi             |

### 6.4 Uji Fungsional Frontend

- [ ] Upload PDF → hash terhitung dengan benar
- [ ] Hash valid → verifikasi tampilkan data benar
- [ ] Hash tidak terdaftar → tampilkan "Sertifikat tidak ditemukan"
- [ ] Hash sertifikat revoked → tampilkan status Revoked + history
- [ ] QR Code di-scan → redirect ke halaman verifikasi dengan hash

---

## 7. Phase 5 — Laporan Akhir

### Struktur Laporan

#### BAB 1: Pendahuluan

- Latar belakang: masalah pemalsuan sertifikat akademik
- Rumusan masalah
- Tujuan: membangun sistem verifikasi berbasis blockchain
- Batasan: hanya hash yang disimpan, bukan file; jaringan Sepolia

#### BAB 2: Tinjauan Pustaka

- **Blockchain** — definisi, karakteristik (immutable, decentralized, transparent)
- **Smart Contract** — definisi, cara kerja di EVM
- **Consensus Mechanism** — Proof of Stake (Ethereum post-Merge)
- **Keccak256** — algoritma hash yang digunakan
- **Proof of Existence** — konsep notaris digital berbasis hash

#### BAB 3: Metodologi

- Pendekatan: hash-only (proof of existence)
- Arsitektur sistem (diagram)
- Pemilihan teknologi dan justifikasinya
- Alur penerbitan dan verifikasi sertifikat (flowchart)

#### BAB 4: Implementasi

- Smart contract `CertificateRegistry.sol` + penjelasan setiap fungsi
- Deployment ke Sepolia (transaction hash, contract address)
- Frontend: halaman admin dan verifikasi
- Integrasi QR Code

#### BAB 5: Hasil & Analisis

- Screenshot pengujian fungsional
- **Tabel gas fee** (hasil dari `REPORT_GAS=true npx hardhat test`)
- Analisis keamanan (tabel dari Phase 4)
- Link contract di Sepolia Etherscan
- Pembahasan: kelebihan dan keterbatasan sistem

#### BAB 6: Kesimpulan & Saran

- Ringkasan pencapaian
- Saran pengembangan (IPFS untuk storage PDF, multi-sig, mainnet)

---

## 8. Referensi & Tools

### Tools

| Tool              | Link                         | Fungsi                         |
| ----------------- | ---------------------------- | ------------------------------ |
| Hardhat           | https://hardhat.org          | Compile, test, deploy contract |
| Hardhat Ignition  | https://hardhat.org/ignition | Deployment management          |
| viem              | https://viem.sh              | Blockchain client TypeScript   |
| Next.js           | https://nextjs.org           | Frontend framework             |
| Tailwind CSS      | https://tailwindcss.com      | Styling                        |
| Sepolia Faucet    | https://sepoliafaucet.com    | Mendapatkan test ETH           |
| Sepolia Etherscan | https://sepolia.etherscan.io | Explorasi transaksi            |
| Alchemy           | https://alchemy.com          | RPC provider gratis            |

### Urutan Pengerjaan yang Disarankan

```
[1] Buat CertificateRegistry.sol
    │
[2] Tulis unit test (test/CertificateRegistry.ts)
    │
[3] Jalankan test lokal + catat gas fee
    │
[4] Setup .env (RPC URL + private key)
    │
[5] Deploy ke Sepolia
    │
[6] Salin ABI ke frontend/public/
    │
[7] Buat lib/contract.ts + lib/hash.ts
    │
[8] Buat API route /api/issue dan /api/status
    │
[9] Buat halaman /verify
    │
[10] Buat halaman /admin
     │
[11] Uji fungsional end-to-end
     │
[12] Tulis laporan
```

---

> Dokumen ini adalah living plan — update sesuai perkembangan implementasi.  
> Last updated: February 2026

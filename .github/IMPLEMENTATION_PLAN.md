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

- [x] `contracts/CertificateRegistry.sol` — smart contract lengkap ✅
- [x] `ignition/modules/CertificateRegistry.ts` — deployment via Hardhat Ignition ✅
- [x] `test/CertificateRegistry.ts` — 28 unit test, semua passing ✅

---

## 4. Phase 2 — Deployment & Konfigurasi

### 4.1 Environment Variables

File sudah disiapkan — **kalian hanya perlu mengisi nilainya:**

| File                    | Status               | Isi yang dibutuhkan                                      |
| ----------------------- | -------------------- | -------------------------------------------------------- |
| `.env`                  | ✅ Sudah dibuat      | `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`                 |
| `frontend/.env.local`   | ✅ Sudah dibuat      | `NEXT_PUBLIC_CONTRACT_ADDRESS`, `ADMIN_PRIVATE_KEY`, dll |
| `.env.example`          | ✅ Template tersedia | —                                                        |
| `frontend/.env.example` | ✅ Template tersedia | —                                                        |

> **Keamanan:** `.env` dan `.env.local` sudah masuk `.gitignore` — tidak akan ter-commit ke git.

**Isi `.env` (root project):**

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

**Isi `frontend/.env.local` (setelah deploy):**

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ADMIN_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

RPC gratis yang bisa digunakan:

- [Alchemy](https://alchemy.com) — daftar gratis, lebih stabil (**rekomendasi**)
- [Infura](https://infura.io) — daftar gratis, limit 100k req/hari
- [Sepolia public RPC](https://rpc.sepolia.org) — tanpa daftar, kadang lambat

### 4.2 Mendapatkan Sepolia ETH (untuk gas)

- [Alchemy Sepolia Faucet](https://sepoliafaucet.com)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
- Butuh minimal ±0.1 SepoliaETH untuk deploy + beberapa transaksi

### 4.3 Compile

```bash
npx hardhat compile
```

> ✅ Sudah berhasil dikompilasi — `artifacts/` sudah berisi ABI.

Output ABI ada di `artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json`.

Update ABI ke frontend kapanpun ada perubahan contract:

```bash
cp artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json \
   frontend/public/contract-abi.json
```

> ✅ `frontend/public/contract-abi.json` sudah disalin.

### 4.4 Deploy ke Sepolia

Pastikan `.env` sudah diisi, lalu jalankan:

```bash
npx hardhat ignition deploy ignition/modules/CertificateRegistry.ts \
  --network sepolia
```

Output terminal akan menampilkan:

```
CertificateRegistryModule#CertificateRegistry - 0xYOUR_CONTRACT_ADDRESS
```

Salin address tersebut ke `frontend/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS
```

### 4.5 Demo Issuance (opsional, untuk laporan)

Script demo sudah tersedia untuk menguji contract yang sudah deploy:

```bash
# Isi CONTRACT_ADDRESS di scripts/issue-certificate.ts terlebih dahulu
npx hardhat run scripts/issue-certificate.ts --network sepolia
```

Output akan menampilkan transaction hash + link Etherscan — screenshot ini berguna untuk laporan BAB 4.

### 4.6 Verifikasi Contract di Etherscan (opsional, nilai tambah)

```bash
npx hardhat verify --network sepolia 0xYOUR_CONTRACT_ADDRESS
```

Ini membuat source code contract terlihat publik di Sepolia Etherscan — poin plus untuk laporan.

### 4.7 Checklist Phase 2

- [x] Daftar Alchemy/Infura dan dapatkan API key
- [x] Siapkan wallet testnet khusus (jangan pakai wallet utama)
- [x] Dapatkan Sepolia ETH dari faucet
- [x] Isi `.env` dengan RPC URL dan private key
- [x] Jalankan `npx hardhat ignition deploy ... --network sepolia`
- [x] Salin contract address ke `frontend/.env.local`
- [x] (Opsional) Jalankan script demo `issue-certificate.ts`
- [x] (Opsional) Verifikasi di Etherscan

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

### 6.1 Unit Test Smart Contract ✅

File: `test/CertificateRegistry.ts` — **28 test, semua passing**

```bash
npx hardhat test
```

| Test Case                                 | Hasil   |
| ----------------------------------------- | ------- |
| `issueCertificate` berhasil               | ✅ Pass |
| `issueCertificate` duplikat revert        | ✅ Pass |
| `issueCertificate` zero hash revert       | ✅ Pass |
| `issueCertificate` label kosong revert    | ✅ Pass |
| `issueCertificate` by non-owner revert    | ✅ Pass |
| `issueCertificate` dua sertifikat berbeda | ✅ Pass |
| `getCertificate` hash tidak terdaftar     | ✅ Pass |
| `getCertificate` data lengkap             | ✅ Pass |
| `isValid` Active                          | ✅ Pass |
| `isValid` Revoked                         | ✅ Pass |
| `isValid` Updated                         | ✅ Pass |
| `isValid` hash tidak terdaftar            | ✅ Pass |
| `updateStatus` ke Revoked                 | ✅ Pass |
| `updateStatus` ke Updated                 | ✅ Pass |
| `updateStatus` history append             | ✅ Pass |
| `updateStatus` history bertambah          | ✅ Pass |
| `updateStatus` StatusUnchanged revert     | ✅ Pass |
| `updateStatus` CertificateNotFound revert | ✅ Pass |
| `updateStatus` non-owner revert           | ✅ Pass |
| `updateStatus` emit event                 | ✅ Pass |
| `getHistory` array kosong awal            | ✅ Pass |
| `getHistory` hash tidak dikenal           | ✅ Pass |
| `getHistory` data benar                   | ✅ Pass |
| `getHistory` urutan kronologis            | ✅ Pass |
| `getHistoryCount` awal 0                  | ✅ Pass |
| `getHistoryCount` bertambah               | ✅ Pass |
| Deployment owner benar                    | ✅ Pass |
| Emit event CertificateIssued              | ✅ Pass |

### 6.2 Pengujian Gas Fee ✅

Diukur menggunakan `scripts/measure-gas.ts` di jaringan lokal Hardhat EDR.

```bash
npx hardhat run scripts/measure-gas.ts
```

**Hasil aktual (gas price: 10 gwei | ETH: $2,500):**

| Fungsi                             | Gas Used    | Est. Biaya (10 gwei) | Jenis |
| ---------------------------------- | ----------- | -------------------- | ----- |
| `issueCertificate` (label panjang) | **163,586** | $4.09                | Write |
| `issueCertificate` (label pendek)  | **118,420** | $2.96                | Write |
| `updateStatus` (Active → Revoked)  | **148,261** | $3.71                | Write |
| `updateStatus` (Revoked → Active)  | **111,225** | $2.78                | Write |
| `updateStatus` (Active → Updated)  | **131,125** | $3.28                | Write |
| `getCertificate`                   | **0**       | $0.00                | View  |
| `isValid`                          | **0**       | $0.00                | View  |
| `getHistory`                       | **0**       | $0.00                | View  |
| `getHistoryCount`                  | **0**       | $0.00                | View  |

**Catatan untuk laporan:**

- Gas tertinggi: **163,586** (`issueCertificate` label panjang)
- Gas terendah write: **111,225** (`updateStatus` berikutnya)
- Semua fungsi verifikasi (read) = **0 gas** — gratis bagi pengguna publik
- `issueCertificate` lebih mahal karena inisialisasi semua field struct pertama kali (SSTORE dari 0)
- `updateStatus` berikutnya lebih murah karena beberapa slot storage sudah non-zero
- Estimasi biaya di Sepolia mainnet bervariasi tergantung basefee aktual saat transaksi

### 6.3 Uji Keamanan Dasar ✅

| Vektor Serangan                 | Mekanisme Perlindungan                          | Diuji            | Status                 |
| ------------------------------- | ----------------------------------------------- | ---------------- | ---------------------- |
| Penerbitan oleh non-admin       | `onlyOwner` modifier (OpenZeppelin)             | ✅ Test case #7  | Dilindungi             |
| Hash duplikat / double-spend    | `CertificateAlreadyExists` custom error         | ✅ Test case #6  | Dilindungi             |
| Input zero hash                 | `InvalidHash` custom error                      | ✅ Test case #4  | Dilindungi             |
| Label kosong                    | `LabelCannotBeEmpty` custom error               | ✅ Test case #5  | Dilindungi             |
| Update status tidak ada         | `CertificateNotFound` custom error              | ✅ Test case #20 | Dilindungi             |
| Update status sama              | `StatusUnchanged` custom error                  | ✅ Test case #19 | Dilindungi             |
| Penghapusan data on-chain       | Tidak ada fungsi `delete`                       | —                | Tidak applicable       |
| Modifikasi data retroaktif      | Sifat immutable blockchain (Ethereum)           | —                | Dilindungi by protocol |
| Private key exposure ke browser | `ADMIN_PRIVATE_KEY` tanpa `NEXT_PUBLIC_` prefix | —                | Dilindungi by design   |
| Pemalsuan file PDF              | Hash file berbeda → verifikasi gagal            | —                | Terdeteksi             |
| Reentrancy                      | Tidak ada external call / ETH transfer          | —                | Tidak applicable       |

**Kesimpulan keamanan:** Semua vektor serangan yang relevan sudah tertangani. Custom errors digunakan (bukan string revert) untuk efisiensi gas dan kejelasan error handling.

### 6.4 Uji Fungsional Frontend

Lakukan setelah deploy ke Sepolia dan `frontend/.env.local` sudah diisi:

- [ ] `GET /verify` — halaman terbuka tanpa error
- [ ] Upload PDF → hash keccak256 terhitung otomatis di browser
- [ ] Hash valid (terdaftar) → tampilkan label, tanggal, issuer, status Active
- [ ] Hash tidak terdaftar → tampilkan "Sertifikat Tidak Ditemukan"
- [ ] Hash sertifikat Revoked → tampilkan badge Revoked + riwayat alasan
- [ ] URL `?hash=0x...` langsung memicu verifikasi (dari QR scan)
- [ ] `GET /admin` — halaman terbuka tanpa error
- [ ] Form issue: upload PDF → auto-hash → isi label → submit → tampilkan QR
- [ ] QR Code bisa di-download sebagai PNG
- [ ] Tab Kelola: input hash → temukan sertifikat → ubah status → berhasil
- [ ] Transaksi gagal (duplikat) → tampilkan pesan error yang jelas
- [ ] `POST /api/issue` dan `POST /api/status` mengembalikan `txHash`

### 6.5 Checklist Phase 4

- [x] Unit test 28 kasus — semua passing ✅
- [x] Gas measurement script tersedia (`scripts/measure-gas.ts`) ✅
- [x] Angka gas aktual tercatat di laporan ✅
- [x] Analisis keamanan terdokumentasi ✅
- [ ] Uji fungsional frontend (setelah deploy ke Sepolia)

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

- Screenshot pengujian fungsional (halaman verifikasi, admin, QR code)
- **Tabel gas fee aktual** (diukur via `scripts/measure-gas.ts` di Hardhat EDR lokal):

  | Fungsi                             | Gas Used | Est. Biaya (10 gwei, ETH $2500) |
  | ---------------------------------- | -------- | ------------------------------- |
  | `issueCertificate` (label panjang) | 163,586  | $4.09                           |
  | `issueCertificate` (label pendek)  | 118,420  | $2.96                           |
  | `updateStatus` (Active → Revoked)  | 148,261  | $3.71                           |
  | `updateStatus` (Revoked → Active)  | 111,225  | $2.78                           |
  | `updateStatus` (Active → Updated)  | 131,125  | $3.28                           |
  | `getCertificate`                   | 0 (view) | $0.00                           |
  | `isValid`                          | 0 (view) | $0.00                           |
  | `getHistory`                       | 0 (view) | $0.00                           |
  | `getHistoryCount`                  | 0 (view) | $0.00                           |

- Analisis keamanan (tabel dari Phase 4 — semua custom error teruji)
- **Hasil unit test**: 28 test cases, semua passing ✅
- Link contract di Sepolia Etherscan (dari `NEXT_PUBLIC_CONTRACT_ADDRESS`)
- Pembahasan: kelebihan dan keterbatasan sistem

**Poin analisis yang perlu dibahas:**

1. `issueCertificate` mahal karena SSTORE dari 0 ke non-zero (21K gas/slot × ~6 field)
2. `updateStatus` lebih murah karena sebagian slot sudah non-zero (SSTORE reset = 5K gas)
3. Fungsi `view` = 0 gas, verifikasi publik 100% gratis — keunggulan utama sistem
4. Dibanding sistem tradisional (biaya server, biaya sertifikat kertas), biaya once-time ~$3–4 per sertifikat sangat kompetitif

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

# SC Sertifikat — Sistem Registri Sertifikat Berbasis Blockchain

Sistem notaris digital untuk sertifikat akademik yang dibangun di atas blockchain Ethereum. Keaslian sertifikat dibuktikan dengan menyimpan hash kriptografis (keccak256) dari file PDF secara permanen on-chain — tanpa menyimpan file aslinya.

## Daftar Isi

- [Gambaran Umum](#gambaran-umum)
- [Arsitektur](#arsitektur)
- [Cara Kerja](#cara-kerja)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Menjalankan Frontend](#menjalankan-frontend)
- [Smart Contract](#smart-contract)
- [Pengujian](#pengujian)
- [Deployment](#deployment)
- [API Endpoint](#api-endpoint)

---

## Gambaran Umum

Proyek ini menyediakan infrastruktur untuk menerbitkan dan memverifikasi sertifikat digital secara terdesentralisasi:

- **Smart Contract** `CertificateRegistry.sol` — menyimpan hash PDF sertifikat di Ethereum Sepolia Testnet.
- **Frontend Next.js** — antarmuka publik untuk verifikasi sertifikat dan panel admin untuk penerbitan.
- **Pendekatan Proof-of-Existence** — dokumen asli tidak pernah diunggah ke blockchain; hanya sidik jari kriptografisnya yang disimpan.

**Alamat Kontrak (Sepolia):** `0x3E9C8E874dB4393C9373795C5eb911486C586A0E`

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│                                                                 │
│   /verify          →  Verifikasi sertifikat (publik)            │
│   /admin           →  Terbitkan & kelola sertifikat (admin)     │
│   /api/issue       →  API: menerbitkan sertifikat baru          │
│   /api/status      →  API: memperbarui status sertifikat        │
└────────────────────────────┬────────────────────────────────────┘
                             │ viem (read: publicClient)
                             │ viem (write: walletClient — server-side only)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              CertificateRegistry.sol (Sepolia)                  │
│                                                                 │
│   issueCertificate(hash, label)   →  Terbitkan sertifikat       │
│   updateStatus(hash, status, reason) →  Ubah status             │
│   getCertificate(hash)            →  Baca data sertifikat       │
│   getHistory(hash)                →  Riwayat perubahan status   │
│   isValid(hash)                   →  Cek validitas sertifikat   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cara Kerja

1. **Menerbitkan Sertifikat**
   - Admin mengunggah file PDF sertifikat melalui panel `/admin`.
   - Frontend menghitung hash keccak256 dari file PDF di sisi klien.
   - Hash beserta label dikirim ke API route `/api/issue` (server-side).
   - Server memanggil fungsi `issueCertificate` pada smart contract menggunakan private key admin.
   - Hash tersimpan permanen di blockchain.

2. **Memverifikasi Sertifikat**
   - Siapa pun dapat mengunjungi halaman `/verify`.
   - Unggah file PDF atau tempel hash secara manual.
   - Sistem menghitung hash file dan mencocokkannya dengan data on-chain.
   - Hasil verifikasi ditampilkan: **Aktif**, **Dicabut**, atau **Tidak Ditemukan**.

3. **Status Sertifikat**

   | Status    | Keterangan                                      |
   | --------- | ----------------------------------------------- |
   | `Active`  | Sertifikat valid dan aktif                      |
   | `Revoked` | Sertifikat dicabut / tidak berlaku lagi         |
   | `Updated` | Sertifikat diperbarui, merujuk ke versi terbaru |

---

## Struktur Proyek

```
sc-sertifikat/
├── contracts/
│   └── CertificateRegistry.sol   # Smart contract utama
├── ignition/
│   ├── modules/
│   │   └── CertificateRegistry.ts  # Modul deployment Hardhat Ignition
│   └── deployments/
│       └── chain-11155111/         # Hasil deployment Sepolia
├── test/
│   └── CertificateRegistry.ts    # Unit test smart contract
├── scripts/
│   ├── issue-certificate.ts      # Script CLI untuk menerbitkan sertifikat
│   └── measure-gas.ts            # Script pengukuran estimasi gas
├── frontend/
│   ├── app/
│   │   ├── verify/page.tsx       # Halaman verifikasi (publik)
│   │   ├── admin/page.tsx        # Panel admin
│   │   └── api/
│   │       ├── issue/route.ts    # API: penerbitan sertifikat
│   │       └── status/route.ts   # API: update status
│   ├── components/               # Komponen UI React
│   ├── lib/
│   │   ├── contract.ts           # Client viem & fungsi kontrak
│   │   └── hash.ts               # Utilitas hashing file PDF
│   └── public/
│       └── contract-abi.json     # ABI kontrak untuk frontend
├── hardhat.config.ts
└── package.json
```

---

## Prasyarat

- [Node.js](https://nodejs.org/) v18 atau lebih baru
- [npm](https://www.npmjs.com/) atau [pnpm](https://pnpm.io/)
- Akun Ethereum dengan sedikit SepoliaETH (untuk deployment & penerbitan sertifikat)
- RPC endpoint Sepolia (misalnya dari [Infura](https://infura.io/), [Alchemy](https://alchemy.com/), atau [Chainstack](https://chainstack.com/))

---

## Instalasi

**1. Clone repositori dan instal dependensi root (Hardhat):**

```shell
npm install
```

**2. Instal dependensi frontend:**

```shell
cd frontend
npm install
```

---

## Konfigurasi Environment

Buat file `.env.local` di dalam folder `frontend/`:

```env
# Alamat smart contract yang sudah di-deploy
NEXT_PUBLIC_CONTRACT_ADDRESS=0x3E9C8E874dB4393C9373795C5eb911486C586A0E

# RPC URL Sepolia untuk pembacaan data (aman untuk browser)
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# RPC URL Sepolia untuk penulisan (server-side only)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Private key wallet admin (JANGAN awali dengan 0x, atau boleh dengan 0x)
# JANGAN pernah expose variabel ini ke sisi klien (tidak boleh pakai NEXT_PUBLIC_)
ADMIN_PRIVATE_KEY=your_private_key_here
```

> **Peringatan:** `ADMIN_PRIVATE_KEY` adalah kunci privat wallet yang memiliki hak akses ke kontrak. Jaga kerahasiaannya dan jangan pernah di-commit ke repositori.

---

## Menjalankan Frontend

```shell
cd frontend

# Mode development
npm run dev

# Build production
npm run build
npm run start
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

- **Halaman Verifikasi:** [http://localhost:3000/verify](http://localhost:3000/verify)
- **Panel Admin:** [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Smart Contract

### Fungsi Utama

| Fungsi                                  | Akses       | Deskripsi                                  |
| --------------------------------------- | ----------- | ------------------------------------------ |
| `issueCertificate(hash, label)`         | `onlyOwner` | Menerbitkan sertifikat baru                |
| `updateStatus(hash, newStatus, reason)` | `onlyOwner` | Memperbarui status sertifikat              |
| `getCertificate(hash)`                  | Publik      | Mengambil data lengkap sertifikat          |
| `getHistory(hash)`                      | Publik      | Mengambil riwayat perubahan status         |
| `isValid(hash)`                         | Publik      | Mengecek apakah sertifikat aktif dan valid |
| `getHistoryCount(hash)`                 | Publik      | Jumlah riwayat perubahan status            |

### Kompilasi Kontrak

```shell
npx hardhat compile
```

---

## Pengujian

Jalankan seluruh test smart contract:

```shell
npx hardhat test
```

Jalankan test secara selektif:

```shell
# Hanya test Solidity
npx hardhat test solidity

# Hanya test Node.js
npx hardhat test nodejs
```

---

## Deployment

### Deploy ke Jaringan Lokal

```shell
npx hardhat ignition deploy ignition/modules/CertificateRegistry.ts
```

### Deploy ke Sepolia Testnet

**1. Simpan private key menggunakan hardhat-keystore:**

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

**2. Jalankan deployment:**

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/CertificateRegistry.ts
```

**3. Salin alamat kontrak hasil deployment ke `.env.local` frontend.**

---

## API Endpoint

### `POST /api/issue` — Menerbitkan Sertifikat

**Request body:**

```json
{
  "hash": "0xabc123...64_karakter_hex",
  "label": "Sertifikat Kelulusan 2025 - Budi Santoso"
}
```

**Response sukses:**

```json
{
  "txHash": "0xtransaction_hash..."
}
```

---

### `POST /api/status` — Memperbarui Status Sertifikat

**Request body:**

```json
{
  "hash": "0xabc123...64_karakter_hex",
  "status": 1,
  "reason": "Sertifikat dicabut karena pelanggaran akademik"
}
```

Nilai `status`: `0` = Active, `1` = Revoked, `2` = Updated

**Response sukses:**

```json
{
  "txHash": "0xtransaction_hash..."
}
```

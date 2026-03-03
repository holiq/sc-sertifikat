import { createPublicClient, createWalletClient, http, custom } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Abi } from "viem";
import contractJson from "@/public/contract-abi.json";

// ============================================================================
// ABI & Contract Address
// ============================================================================

export const CONTRACT_ABI = contractJson.abi as Abi;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ?? "0x";

// ============================================================================
// Public Client — read-only, aman dipakai di browser
// ============================================================================

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

// ============================================================================
// Wallet Client — HANYA untuk server-side (API route)
// Private key tidak boleh ada di NEXT_PUBLIC_
// ============================================================================

export function getWalletClient() {
  let pk = process.env.ADMIN_PRIVATE_KEY;
  if (!pk) throw new Error("ADMIN_PRIVATE_KEY tidak ditemukan di environment");
  pk = pk.trim();

  if (!pk.startsWith("0x"))  pk = `0x${pk}`;

  if (pk.length !== 66) throw new Error(`Invalid private key length: ${pk.length}`);

  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });
}

// ============================================================================
// Browser Wallet Client — untuk static export (GitHub Pages)
// Menggunakan private key dari NEXT_PUBLIC_ADMIN_PRIVATE_KEY jika tersedia,
// atau MetaMask / wallet browser sebagai fallback.
// ============================================================================

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export async function getWalletClientBrowser() {
  // Gunakan private key langsung jika sudah dikonfigurasi (tidak perlu MetaMask)
  let pk = process.env.NEXT_PUBLIC_ADMIN_PRIVATE_KEY;
  if (pk) {
    pk = pk.trim();
    if (!pk.startsWith("0x")) pk = `0x${pk}`;
    if (pk.length !== 66) throw new Error("Format private key tidak valid. Pastikan berupa hex 32-byte (0x + 64 karakter).");
    const account = privateKeyToAccount(pk as `0x${string}`);
    return createWalletClient({
      account,
      chain: sepolia,
      transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    });
  }

  // Fallback: gunakan MetaMask / wallet browser
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask atau wallet browser tidak terdeteksi. Silakan install MetaMask.");
  }

  const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
  if (!accounts || accounts.length === 0) {
    throw new Error("Tidak ada akun yang terhubung. Hubungkan wallet terlebih dahulu.");
  }

  const walletClient = createWalletClient({
    account: accounts[0],
    chain: sepolia,
    transport: custom(window.ethereum),
  });

  // Pastikan terhubung ke Sepolia
  const chainId = await walletClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(`Wallet terhubung ke chain ID ${chainId}. Silakan ganti ke Sepolia (chain ID ${sepolia.id}).`);
  }

  return walletClient;
}

// ============================================================================
// Types — mencerminkan struct Solidity
// ============================================================================

export enum CertStatus {
  Active = 0,
  Revoked = 1,
  Updated = 2,
}

export const STATUS_LABEL: Record<number, string> = {
  [CertStatus.Active]: "Active",
  [CertStatus.Revoked]: "Revoked",
  [CertStatus.Updated]: "Updated",
};

export interface CertificateData {
  exists: boolean;
  label: string;
  issuedAt: bigint;
  issuer: `0x${string}`;
  status: CertStatus;
}

export interface StatusHistoryEntry {
  status: CertStatus;
  changedAt: bigint;
  changedBy: `0x${string}`;
  reason: string;
}

// ============================================================================
// Read helpers — wrapper tipis di atas publicClient.readContract
// ============================================================================

export async function getCertificate(hash: `0x${string}`): Promise<CertificateData> {
  const result = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getCertificate",
    args: [hash],
  })) as [boolean, string, bigint, `0x${string}`, number];

  return {
    exists: result[0],
    label: result[1],
    issuedAt: result[2],
    issuer: result[3],
    status: result[4] as CertStatus,
  };
}

export async function isValid(hash: `0x${string}`): Promise<boolean> {
  return (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "isValid",
    args: [hash],
  })) as boolean;
}

export async function getHistory(hash: `0x${string}`): Promise<StatusHistoryEntry[]> {
  const result = (await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getHistory",
    args: [hash],
  })) as StatusHistoryEntry[];

  return result;
}

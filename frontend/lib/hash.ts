import { keccak256 } from "viem";

/**
 * Menghitung keccak256 hash dari File object (PDF atau file lainnya).
 * Dijalankan sepenuhnya di browser — tidak perlu server.
 *
 * @param file  File object dari <input type="file">
 * @returns     keccak256 hash sebagai hex string (0x...)
 */
export async function hashFile(file: File): Promise<`0x${string}`> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  return keccak256(bytes);
}

/**
 * Validasi format hash — harus berupa hex 32-byte (66 karakter dengan prefix 0x).
 */
export function isValidHash(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Memformat hash panjang menjadi versi singkat untuk tampilan.
 * Contoh: 0xabcd...ef12
 */
export function shortHash(hash: string): string {
  if (hash.length < 12) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

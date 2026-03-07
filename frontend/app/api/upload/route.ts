import { NextRequest, NextResponse } from "next/server";
import { isValidHash } from "@/lib/hash";
import { uploadToR2 } from "@/lib/r2";

/**
 * POST /api/upload
 * Body: multipart/form-data with fields:
 *   - file: PDF file
 *   - hash: 0x... certificate hash
 *
 * Uploads the PDF to Cloudflare R2. Accessible via /api/pdf/{hash}
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const hash = formData.get("hash") as string | null;

    if (!file || !hash) {
      return NextResponse.json({ error: "Field 'file' dan 'hash' wajib diisi" }, { status: 400 });
    }

    if (!isValidHash(hash)) {
      return NextResponse.json({ error: "Hash tidak valid" }, { status: 400 });
    }

    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Hanya file PDF yang diterima" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await uploadToR2(`${hash}.pdf`, buffer);

    return NextResponse.json({ success: true, url: `/api/pdf/${hash}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/upload] ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

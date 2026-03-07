import { NextRequest, NextResponse } from "next/server";
import { isValidHash } from "@/lib/hash";
import { existsInR2, getFromR2 } from "@/lib/r2";

/**
 * GET /api/pdf/[hash]
 * Proxy stream PDF dari R2 ke browser.
 * HEAD /api/pdf/[hash] — cek apakah file ada.
 */

type Params = { params: Promise<{ hash: string }> };

export async function HEAD(_req: NextRequest, { params }: Params) {
  const { hash } = await params;
  if (!isValidHash(hash)) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const exists = await existsInR2(`${hash}.pdf`);
    return new NextResponse(null, { status: exists ? 200 : 404 });
  } catch (err) {
    console.error("[/api/pdf HEAD] R2 error:", err);
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { hash } = await params;
  if (!isValidHash(hash)) {
    return new NextResponse("Hash tidak valid", { status: 400 });
  }

  try {
    const { bytes, contentType, contentLength } = await getFromR2(`${hash}.pdf`);

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (contentLength) headers["Content-Length"] = String(contentLength);

    return new NextResponse(bytes.buffer as ArrayBuffer, { status: 200, headers });
  } catch (err) {
    console.error("[/api/pdf GET] R2 error:", err);
    return new NextResponse("File tidak ditemukan", { status: 404 });
  }
}

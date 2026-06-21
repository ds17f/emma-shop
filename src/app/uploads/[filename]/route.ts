import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Serve user-uploaded images at request time.
//
// In production (`next start`), Next.js indexes the `public/` folder ONCE at
// server startup and only serves files present in that frozen index. Files
// written to `public/uploads` at runtime (see api/admin/upload) are therefore
// 404'd by the static handler until the next restart — the upload succeeds and
// persists on the volume, but the image never shows. This route reads the file
// from disk on every request, so freshly uploaded images are served immediately.

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // The dynamic segment can't contain a slash, but guard against any other
  // path-traversal trickery before touching the filesystem.
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const filePath = path.join(process.cwd(), "public", "uploads", filename);

  try {
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

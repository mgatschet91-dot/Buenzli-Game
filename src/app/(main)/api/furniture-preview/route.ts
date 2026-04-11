import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PREVIEWS_DIR = path.join(process.cwd(), 'public', 'isometric', 'items', 'previews');

// Nur erlaubte Typen: alphanumerisch + Underscore (verhindert Path-Traversal)
const SAFE_TYPE = /^[a-zA-Z0-9_]{1,64}$/;

export async function POST(req: NextRequest) {
  try {
    const { type, dataUrl } = await req.json();

    if (!type || !SAFE_TYPE.test(type)) {
      return NextResponse.json({ ok: false, error: 'invalid type' }, { status: 400 });
    }
    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ ok: false, error: 'invalid dataUrl' }, { status: 400 });
    }

    const filePath = path.join(PREVIEWS_DIR, `${type}.png`);

    // Bereits vorhanden → nichts tun (race condition safe)
    if (fs.existsSync(filePath)) {
      return NextResponse.json({ ok: true, cached: true });
    }

    // Base64 → Buffer → Datei schreiben
    const base64 = dataUrl.replace('data:image/png;base64,', '');
    const buf = Buffer.from(base64, 'base64');
    fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
    fs.writeFileSync(filePath, buf);

    return NextResponse.json({ ok: true, saved: true });
  } catch (err) {
    console.error('[furniture-preview] POST error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}

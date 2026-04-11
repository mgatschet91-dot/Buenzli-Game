import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'sprite-offsets.json');

function readOffsets(): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

// GET — return all stored offsets
export async function GET() {
  return NextResponse.json(readOffsets());
}

// POST { key: string, value: number } — save a new offset
export async function POST(req: NextRequest) {
  try {
    let { key, value } = await req.json();
    if (typeof key !== 'string' || typeof value !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    // Normalize full URL to pathname so dev and prod share the same keys
    try { key = new URL(key).pathname; } catch { /* already a path */ }
    const offsets = readOffsets();
    offsets[key] = value;
    fs.writeFileSync(DATA_FILE, JSON.stringify(offsets, null, 2));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

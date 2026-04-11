import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MUSIC_DIR = path.join(process.cwd(), 'public', 'audio', 'music');
const GENRES = ['techno', 'house', 'pop', 'misc'] as const;
const ALLOWED_EXTENSIONS = ['.mp3', '.ogg', '.wav'];

export type MusicLibrary = {
  [genre: string]: string[];
};

export async function GET() {
  const library: MusicLibrary = {};

  for (const genre of GENRES) {
    const genreDir = path.join(MUSIC_DIR, genre);
    try {
      const files = fs.readdirSync(genreDir).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      });
      library[genre] = files;
    } catch {
      library[genre] = [];
    }
  }

  return NextResponse.json(library);
}

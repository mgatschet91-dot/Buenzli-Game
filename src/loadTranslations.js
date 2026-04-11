import { readFile } from 'node:fs/promises';
import path from 'node:path';

function buildLocaleCandidates(locale) {
  const raw = String(locale || '').trim();
  if (!raw) return [];
  const normalizedDash = raw.replace('_', '-');
  const baseLanguage = normalizedDash.split('-')[0];
  const candidates = [
    raw,
    normalizedDash,
    normalizedDash.toLowerCase(),
    baseLanguage,
  ].filter(Boolean);
  return [...new Set(candidates)];
}

export default async function loadTranslations(locale) {
  const candidates = buildLocaleCandidates(locale);
  for (const candidate of candidates) {
    const filePath = path.join(process.cwd(), 'public', '_gt', `${candidate}.json`);
    try {
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      // Next candidate probieren
    }
  }
  return {};
}

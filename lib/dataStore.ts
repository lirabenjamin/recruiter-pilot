// lib/dataStore.ts
// Minimal, flat data loader for pre-defined pairs.
import fs from 'fs';
import path from 'path';

export type FlatPair = {
  id: string;
  essay_a_id: string;
  essay_b_id: string;
  essay_a: string;
  essay_b: string;
};

let pairsCache: FlatPair[] | null = null;

/**
 * Load and cache pairs from data/pairs.json.
 * [{ id: "pair_0001", essay_a_id: "...", essay_b_id: "...", essay_a: "<p>...</p>", essay_b: "<p>...</p>" }, ...]
 */
export function loadPairs(): FlatPair[] {
  if (pairsCache) return pairsCache;

  const filePath = path.join(process.cwd(), 'data', 'pairs.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);

  if (!Array.isArray(json)) {
    throw new Error('pairs.json must be an array');
  }

  const pairs: FlatPair[] = json.map((row: any, idx: number) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`pairs.json[${idx}] must be an object`);
    }
    const { id, essay_a_id, essay_b_id, essay_a, essay_b } = row;
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error(`pairs.json[${idx}].id must be a non-empty string`);
    }
    if (typeof essay_a !== 'string' || typeof essay_b !== 'string') {
      throw new Error(`pairs.json[${idx}] must have string fields 'essay_a' and 'essay_b'`);
    }
    return { id: id.trim(), essay_a_id, essay_b_id, essay_a, essay_b };
  });

  pairsCache = pairs;
  return pairsCache;
}

/** Clear the in-memory cache (useful in dev/hot-reload). */
export function clearPairsCache() {
  pairsCache = null;
}

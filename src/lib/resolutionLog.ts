// Persistent resolution ledger — lives in localStorage, capped at 50 entries.
// Every resolution (single or bulk) appends here; reverting a resolution marks it reverted
// rather than erasing it, so the audit trail survives.

import type { Status } from '../data/mock';

export interface ResolutionEntry {
  key: string;
  siteId: string;
  id: string;
  item: string;
  location: string;
  valueVar: number;
  rootCause: string;
  resolvedAt: number;
  resolvedBy: string;
  reverted: boolean;
  before: { status: Status; owner: string | null; rootCause: string | null };
}

export const RESOLUTIONS_KEY = 'recon:resolutions:v1';

export function loadResolutions(): ResolutionEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RESOLUTIONS_KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as ResolutionEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveResolutions(entries: ResolutionEntry[]): void {
  try { localStorage.setItem(RESOLUTIONS_KEY, JSON.stringify(entries)); } catch { /* storage unavailable */ }
}

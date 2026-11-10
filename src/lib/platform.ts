/** Detect macOS for keycap hints. */
const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
export const isMac =
  typeof navigator !== 'undefined' &&
  /mac/i.test(nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent);

export const modKey = isMac ? '⌘' : 'Ctrl';
export const modKeyLabel = isMac ? '⌘ K' : 'Ctrl K';

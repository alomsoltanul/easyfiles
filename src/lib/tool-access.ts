/**
 * Which tools require a paid plan.
 *
 * Kept separate from tools.tsx so server code and the entitlement layer can
 * import it without pulling in the JSX icon set.
 *
 * Slugs are Tool.href values. Every paid plan unlocks all of these — the paid
 * tiers differ on limits, not on which tools they expose.
 */

export type ToolAccess = 'free' | 'pro';

export const PRO_TOOL_SLUGS = [
  '/pdf/ocr',
  '/pdf/edit',
  '/pdf/compare',
  '/pdf/redact',
  '/pdf/repair',
  '/pdf/to-pdfa',
  '/pdf/forms',
  '/pdf/sign',
  '/pdf/to-word',
  '/pdf/to-excel',
  '/pdf/to-powerpoint',
  '/video',
] as const;

const PRO_SET: ReadonlySet<string> = new Set(PRO_TOOL_SLUGS);

export function accessForSlug(slug: string): ToolAccess {
  return PRO_SET.has(slug) ? 'pro' : 'free';
}

export function isProTool(slug: string): boolean {
  return PRO_SET.has(slug);
}

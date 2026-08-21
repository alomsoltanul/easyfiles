'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { checkRun, type GateResult } from '@/lib/entitlements';
import { useEntitlements } from './useEntitlements';

/**
 * Plan limits applied at the point files enter a tool.
 *
 * The route path is the tool slug — Tool.href and the page route are the same
 * string — so no component has to be told which tool it is.
 */
export function useFileLimits() {
  const entitlements = useEntitlements();
  const pathname = usePathname();
  const [blocked, setBlocked] = useState<GateResult | null>(null);

  /**
   * Returns the files if they pass, or null if the plan blocks them. On a block
   * `blocked` holds the reason for LimitNotice to render.
   */
  const admit = useCallback(
    (files: File[]): File[] | null => {
      const result = checkRun(entitlements, pathname ?? '', files);
      if (!result.ok) {
        setBlocked(result);
        return null;
      }
      setBlocked(null);
      return files;
    },
    [entitlements, pathname],
  );

  const clearBlock = useCallback(() => setBlocked(null), []);

  return { entitlements, admit, blocked, clearBlock };
}

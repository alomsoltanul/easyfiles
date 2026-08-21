'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { MeResponse } from '@/lib/me';
import { ANON_ENTITLEMENTS, entitlementsFor, type Entitlements } from '@/lib/entitlements';

/**
 * One shared /api/me request per page load.
 *
 * Deliberately client-side: reading cookies in the root layout would make every
 * one of the 56 tool pages dynamic, and those pages are the SEO surface. The
 * header renders a neutral state for the few hundred ms before this resolves.
 */

let cache: MeResponse | null = null;
let inflight: Promise<MeResponse | null> | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): MeResponse | null {
  return cache;
}

function getServerSnapshot(): MeResponse | null {
  return null;
}

async function load(): Promise<MeResponse | null> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    cache = (await res.json()) as MeResponse;
  } catch {
    // Offline or the endpoint is unavailable — stay on anonymous limits rather
    // than blocking a tool that would otherwise work.
    cache = null;
  }
  emit();
  return cache;
}

/** Force a re-read, e.g. after a run consumes quota or a plan changes. */
export function refreshMe(): Promise<MeResponse | null> {
  inflight = load().finally(() => {
    inflight = null;
  });
  return inflight;
}

export interface UseMe {
  me: MeResponse | null;
  /** true until the first response lands */
  loading: boolean;
  refresh: () => void;
}

export function useMe(): UseMe {
  const me = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (started) return;
    started = true;
    void refreshMe();
  }, []);

  const refresh = useCallback(() => {
    if (!inflight) void refreshMe();
  }, []);

  return { me, loading: me === null && !cache, refresh };
}

/** Entitlements derived from /api/me, falling back to anonymous limits. */
export function useEntitlements(): Entitlements {
  const { me } = useMe();
  if (!me) return ANON_ENTITLEMENTS;
  return entitlementsFor(me.planId, me.signedIn, me.usageToday);
}

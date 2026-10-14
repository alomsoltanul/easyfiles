'use client';

import { useEffect, useRef } from 'react';

interface ProfileViewBeaconProps {
  username: string;
}

export default function ProfileViewBeacon({ username }: ProfileViewBeaconProps) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    // Use sendBeacon if available, otherwise fetch with keepalive
    const payload = JSON.stringify({ username });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/view', blob);
    } else {
      fetch('/api/analytics/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silently ignore view counter network hiccups
      });
    }
  }, [username]);

  return null;
}

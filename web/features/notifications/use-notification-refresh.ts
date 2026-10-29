'use client';

import { useEffect, useState } from 'react';

export const NOTIFICATION_REFRESH_EVENT = 'notifications:refresh-target';

export function useNotificationRefresh() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(NOTIFICATION_REFRESH_EVENT, refresh);
  }, []);
  return revision;
}

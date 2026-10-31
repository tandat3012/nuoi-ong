'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { BeeLoader } from './bee-loader';

export function InitialBeeLoader({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-background px-4">
          <BeeLoader label="Mộc Ong đang chuẩn bị..." />
        </div>
      )}
      <div className={loading ? 'hidden' : 'contents'} inert={loading}>
        {children}
      </div>
    </>
  );
}

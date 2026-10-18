'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { routeLabels } from '@/shared/config/navigation';

export function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === '/dashboard' || pathname === '/') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const items = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const label = routeLabels[href] || decodeURIComponent(segment);
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Đường dẫn trang" className="flex items-center text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
            aria-label="Về trang tổng quan"
          >
            <Home className="size-3.5" />
            <span className="sr-only">Tổng quan</span>
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-1.5">
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            {item.isLast ? (
              <span className="font-medium text-foreground truncate max-w-40 sm:max-w-64" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="transition-colors hover:text-foreground truncate max-w-32"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

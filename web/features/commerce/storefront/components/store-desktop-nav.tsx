'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';
import { STOREFRONT_CONFIG } from '../config/storefront-config';

export function StoreDesktopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Danh mục và điều hướng chính"
      className="hidden md:block border-t border-b border-border/70 bg-card/40"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ul className="flex items-center justify-center gap-1 sm:gap-2 lg:gap-3 py-2 text-sm font-medium">
          {STOREFRONT_CONFIG.navigation.map((item) => {
            const isActive = item.isImplemented && item.href === pathname;

            return (
              <li key={item.label} className="shrink-0">
                {item.isImplemented ? (
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center rounded-full text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-secondary text-secondary-foreground border border-amber-300/70 shadow-2xs px-4 py-1.5'
                        : 'text-foreground/80 hover:text-foreground hover:bg-muted/70 px-3.5 py-1.5',
                      'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
                    )}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className="inline-flex items-center px-3.5 py-1.5 text-sm text-foreground/70 cursor-default select-none font-medium"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

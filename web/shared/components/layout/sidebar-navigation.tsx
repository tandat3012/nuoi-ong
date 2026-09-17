'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { primaryNavigation } from '@/shared/config/navigation';

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Điều hướng chính" className="flex gap-1 overflow-x-auto lg:flex-col">
      {primaryNavigation.map((item) => {
        const isCurrent = isCurrentRoute(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? 'page' : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isCurrent
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid size-7 place-items-center rounded-lg text-[0.65rem] font-bold ${
                isCurrent ? 'bg-white/15' : 'bg-muted text-secondary-foreground'
              }`}
            >
              {item.shortLabel}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

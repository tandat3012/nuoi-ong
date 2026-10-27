'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavigationItemVisible, primaryNavigationSections } from '@/shared/config/navigation';
import { cn } from '@/shared/lib/utils';
import { useFarmMembership } from '@/features/auth';

function isCurrentRoute(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const access = useFarmMembership();

  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col space-y-5">
      {primaryNavigationSections.map((section) => {
        const items = section.items.filter((item) => isNavigationItemVisible(item, access));
        if (items.length === 0) return null;

        return (
          <div key={section.title} className="space-y-1">
            <h2 className="px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h2>
            <div className="space-y-0.5">
              {items.map((item) => {
                const isCurrent = isCurrentRoute(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                      isCurrent
                        ? 'bg-secondary font-semibold text-secondary-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn('size-4 shrink-0', isCurrent ? 'text-primary' : 'text-muted-foreground')}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

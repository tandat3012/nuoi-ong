'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { primaryNavigationSections } from '@/shared/config/navigation';
import { cn } from '@/shared/lib/utils';
import { useAuthContext } from '@/features/auth';

function isCurrentRoute(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data, selectedFarmId } = useAuthContext();
  const canManagePersonnel = data.memberships
    .find(({ farm }) => farm.id === selectedFarmId)
    ?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER');

  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col space-y-6">
      {primaryNavigationSections.map((section) => (
        <div key={section.title} className="space-y-1.5">
          <h2 className="px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h2>
          <div className="space-y-0.5">
            {section.items
              .filter(
                (item) => item.href !== '/personnel' || canManagePersonnel,
              )
              .map((item) => {
                const isCurrent = isCurrentRoute(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                      isCurrent
                        ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        isCurrent
                          ? 'text-primary-foreground'
                          : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

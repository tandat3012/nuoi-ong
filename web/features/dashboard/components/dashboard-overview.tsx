'use client';

import Link from 'next/link';
import { useFarmMembership } from '@/features/auth';
import { isNavigationItemVisible, primaryNavigationSections } from '@/shared/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

// shortcut: hub links only, no live KPIs; add metric cards once the API exposes a farm summary endpoint.
export function DashboardOverview() {
  const access = useFarmMembership();
  const { membership } = access;

  const sections = primaryNavigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.href !== '/dashboard' && isNavigationItemVisible(item, access)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tổng quan"
        description={membership ? `Trang trại ${membership.farm.name}` : 'Chọn trang trại để bắt đầu làm việc.'}
      />

      {sections.map((section, index) => (
        <section key={section.title} aria-labelledby={`hub-${index}`} className="space-y-3">
          <h2 id={`hub-${index}`} className="text-sm font-semibold text-muted-foreground">
            {section.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-3.5 rounded-xl border bg-card p-4 shadow-2xs transition-colors hover:border-primary/40 hover:bg-secondary/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground group-hover:text-primary">{label}</span>
                  {description && (
                    <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{description}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

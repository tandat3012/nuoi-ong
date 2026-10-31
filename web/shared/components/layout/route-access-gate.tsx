'use client';

import { Lock } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useFarmMembership } from '@/features/auth';
import { findNavigationItem, isNavigationItemAllowed } from '@/shared/config/navigation';
import { EmptyState } from '@/shared/components/ui/empty-state';

/** Blocks direct URLs to screens the selected farm role may not open; the API enforces the same rules. */
export function RouteAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const access = useFarmMembership();
  const item = findNavigationItem(pathname);
  if (access.membership && item && !isNavigationItemAllowed(item, access))
    return (
      <EmptyState
        icon={Lock}
        title="Không có quyền truy cập"
        description={`Vai trò của bạn trong trang trại này không được mở mục “${item.label}”.`}
      />
    );
  return children;
}

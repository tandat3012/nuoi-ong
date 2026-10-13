'use client';

import { useId } from 'react';
import { useAuthContext } from '../context/auth-context';
import type { FarmRoleCode } from '../types/auth-context';
import { cn } from '@/shared/lib/utils';
import { Sprout, ChevronDown } from 'lucide-react';

const roleLabels: Record<FarmRoleCode, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ trại',
  EMPLOYEE: 'Nhân viên',
  GUEST: 'Khách',
};

export function FarmSwitcher({ className = '' }: { className?: string }) {
  const id = useId();
  const { data, selectedFarmId, selectFarm } = useAuthContext();
  const membership = data.memberships.find(({ farm }) => farm.id === selectedFarmId);

  return (
    <div className={cn('relative flex items-center min-w-0', className)}>
      <label htmlFor={id} className="sr-only">Trang trại đang làm việc</label>
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-2.5 flex items-center gap-1.5 text-primary">
          <Sprout className="size-4 shrink-0" aria-hidden="true" />
        </div>
        <select
          id={id}
          value={selectedFarmId ?? ''}
          disabled={data.memberships.length < 2}
          aria-describedby={`${id}-role`}
          onChange={(event) => selectFarm(event.target.value)}
          className={cn(
            'h-9 w-full min-w-44 max-w-64 appearance-none truncate rounded-lg border border-input bg-card pl-8 pr-8 text-xs font-semibold text-foreground shadow-2xs transition-colors',
            'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
            data.memberships.length < 2 ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          {!membership && <option value="" disabled>Chọn trang trại</option>}
          {data.memberships.map(({ farm }) => (
            <option key={farm.id} value={farm.id}>
              {farm.name} ({farm.code})
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      {membership && (
        <span
          id={`${id}-role`}
          className="ml-2 hidden rounded-md bg-secondary px-2 py-0.5 text-[0.65rem] font-medium text-secondary-foreground xl:inline-block truncate max-w-28"
          title={membership.roles.map((role) => roleLabels[role] ?? role).join(' · ')}
        >
          {membership.roles.map((role) => roleLabels[role] ?? role)[0] || 'Thành viên'}
        </span>
      )}
    </div>
  );
}
